import { randomUUID } from "node:crypto";

// A column, or a JSON text path such as payload->>company (null when absent, as in SQL)
function read(row, key) {
  const path = /^(\w+)->>(\w+)$/.exec(key);
  if (!path) return row[key];
  const value = row[path[1]]?.[path[2]];
  return value == null ? null : String(value);
}

// Small PostgREST boundary double. Services, matching and state transitions stay real.
export function database(seed = {}) {
  const tables = structuredClone(seed);
  const faults = [];
  const db = {
    tables,
    fail(table, operation, error, times = 1) {
      faults.push({ table, operation, error, times });
    },
    from(table) {
      tables[table] ||= [];
      return new Query(table);
    },
    // `now` lets a test pin the clock record_watch_check stamps (the real function uses now())
    now: null,
    rpcCalls: [],
    async rpc(name, args) {
      db.rpcCalls.push({ name, args });
      if (name === "record_watch_check") {
        const row = (tables.watched_companies || []).find((r) => r.id === args.p_company_id);
        if (!row) return { data: null, error: { code: "P0002", message: "Company not found" } };
        row.last_checked_at = new Date(db.now ?? Date.now()).toISOString();
        row.last_error = String(args.p_error ?? "").slice(0, 300);
        if (args.p_open_count != null && args.p_open_count >= 0) row.open_count = args.p_open_count;
        return { data: null, error: null };
      }
      return { data: null, error: { code: "PGRST202", message: "Function is not installed" } };
    },
  };
  class Query {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.filters = [];
    }
    select(columns = "*") { this.columns = columns; return this; }
    eq(key, value) { this.filters.push((row) => read(row, key) === value); return this; }
    neq(key, value) { this.filters.push((row) => key.includes("->>") ? read(row, key) != null && read(row, key) !== value : row[key] !== value); return this; }
    not(key, operator, value) { this.filters.push((row) => operator === "is" && value === null ? read(row, key) != null : read(row, key) !== value); return this; }
    is(key, value) { this.filters.push((row) => (value === null ? row[key] == null : row[key] === value)); return this; }
    in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
    gte(key, value) { this.filters.push((row) => row[key] >= value); return this; }
    lt(key, value) { this.filters.push((row) => row[key] < value); return this; }
    order(key, options = {}) { this.sort = { key, ...options }; return this; }
    limit(count) { this.count = count; return this; }
    range(from, to) { this.bounds = [from, to]; return this; }
    insert(value) { this.operation = "insert"; this.values = Array.isArray(value) ? value : [value]; return this; }
    upsert(value, options = {}) { this.operation = "upsert"; this.values = Array.isArray(value) ? value : [value]; this.conflict = options.onConflict; this.ignore = options.ignoreDuplicates === true; return this; }
    update(value) { this.operation = "update"; this.value = value; return this; }
    delete() { this.operation = "delete"; return this; }
    single() { this.one = "single"; return this; }
    maybeSingle() { this.one = "maybe"; return this; }
    then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }
    execute() {
      const fault = faults.find((f) => f.table === this.table && f.operation === this.operation && f.times > 0);
      if (fault) { fault.times--; return { data: null, error: fault.error }; }
      const rows = tables[this.table];
      let selected = rows.filter((row) => this.filters.every((filter) => filter(row)));
      if (this.operation === "insert" || this.operation === "upsert") {
        selected = [];
        for (const value of this.values) {
          const keys = this.conflict?.split(",") ||
            (["processed_emails", "application_suggestions"].includes(this.table) ? ["user_id", "message_id"] : ["id"]);
          const existing = rows.find((row) => keys.every((key) => value[key] != null && row[key] === value[key]));
          if (existing && this.operation === "insert") return { data: null, error: { code: "23505", message: "Duplicate key" } };
          if (existing && this.ignore) continue;
          if (existing) { Object.assign(existing, structuredClone(value)); selected.push(existing); }
          else {
            const created = { id: randomUUID(), created_at: new Date().toISOString(), state: "pending", ...structuredClone(value) };
            rows.push(created); selected.push(created);
          }
        }
      } else if (this.operation === "update") {
        selected.forEach((row) => Object.assign(row, structuredClone(this.value)));
      } else if (this.operation === "delete") {
        tables[this.table] = rows.filter((row) => !selected.includes(row));
      }
      if (this.sort) {
        const { key, ascending = true, nullsFirst = false } = this.sort;
        selected.sort((a, b) => {
          if (a[key] == null || b[key] == null) return a[key] == b[key] ? 0 : (a[key] == null ? -1 : 1) * (nullsFirst ? 1 : -1);
          return String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1);
        });
      }
      if (this.count != null) selected = selected.slice(0, this.count);
      if (this.bounds) selected = selected.slice(this.bounds[0], this.bounds[1] + 1);
      const projected = selected.map((row) => this.columns && this.columns !== "*"
        ? Object.fromEntries(this.columns.split(",").map((spec) => {
          const [alias, key = alias] = spec.trim().split(/:(?!:)/);
          return [alias.trim(), read(row, key.trim())];
        }))
        : structuredClone(row));
      if (this.one && projected.length > 1 || this.one === "single" && !projected.length) {
        return { data: null, error: { code: "PGRST116", message: "Unexpected row count" } };
      }
      return { data: this.one ? projected[0] ?? null : projected, error: null };
    }
  }
  return db;
}
