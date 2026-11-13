import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";

const { fitForSavedJobs, rankSavedJobsByFit, RANKED_LIMIT } = await import("@/server/fit/savedJobFit");

const user = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const TODAY = new Date(2026, 10, 12);
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// The fake database, made a little closer to PostgREST for these reads: the
// first .order() is the primary sort, "*" with embeds selects whole rows,
// .or() handles the saved-jobs search, and { count: "exact" } is honoured.
// Every query's table and .eq() filters are logged.
function fakeDb(seed) {
  const db = database(seed);
  const log = [];
  const from = db.from.bind(db);
  db.log = log;
  db.from = (table) => {
    const query = from(table);
    query.__log = { table, eqs: [], ins: [] };
    log.push(query.__log);
    return query;
  };
  const proto = Object.getPrototypeOf(from("__probe"));
  if (!proto.__patched) {
    proto.__patched = true;
    const { eq, in: within, order, select, execute } = proto;
    proto.eq = function (key, value) { this.__log?.eqs.push([key, value]); return eq.call(this, key, value); };
    proto.in = function (key, values) { this.__log?.ins.push([key, values]); return within.call(this, key, values); };
    proto.order = function (key, options) { return this.sort ? this : order.call(this, key, options); };
    proto.select = function (columns, options) {
      this.countExact = options?.count === "exact";
      return select.call(this, columns?.includes("*") ? "*" : columns);
    };
    proto.or = function (expression) {
      const terms = expression.split(/,(?=payload->>)/).map((part) => {
        const [, key, quoted] = /^payload->>(\w+)\.ilike\."(.*)"$/.exec(part);
        const needle = quoted.replace(/\\(.)/g, "$1").replace(/^%|%$/g, "").toLowerCase();
        return (row) => String(row.payload?.[key] || "").toLowerCase().includes(needle);
      });
      this.filters.push((row) => terms.some((match) => match(row)));
      return this;
    };
    proto.execute = function () {
      const result = execute.call(this);
      if (this.countExact && !result.error) {
        result.count = this.__tables[this.table].filter((row) => this.filters.every((f) => f(row))).length;
      }
      return result;
    };
  }
  // execute() needs the live tables for the count
  const fromWithTables = db.from;
  db.from = (table) => Object.assign(fromWithTables(table), { __tables: db.tables });
  return db;
}

const cvTables = (owner = user) => ({
  profiles: [{ id: owner, cv_sections: { revision: 0, titles: {}, customSections: [] } }],
  cv_experience: [
    {
      id: uuid(901), user_id: owner, sort_order: 0, company: "Harbor Analytics", position: "Software Engineer",
      start_date: "2021-01-01", end_date: "", currently_working: true,
      cv_experience_bullets: [
        { sort_order: 0, content: "Built reporting services in Python backed by PostgreSQL for the finance team" },
        { sort_order: 1, content: "Packaged every service with Docker for repeatable releases" },
      ],
    },
  ],
  cv_projects: [],
  cv_education: [{ id: uuid(902), user_id: owner, sort_order: 0, school: "State University", degree_type: "Bachelor", major: "Education" }],
  cv_skills: [{ id: uuid(903), user_id: owner, sort_order: 0, name: "Kubernetes", category: "Tools" }],
  cv_certifications: [],
});

const strongA = "Requirements:\n- Python\n- PostgreSQL\n- Docker\n\nWe value clear writing.";
const strongB = "Requirements:\n- Python\n- PostgreSQL\n- Docker\n- Kubernetes\n\nWe value clear writing.";
const good = "Requirements:\n- Python\n- Docker\n- Kubernetes\n- Java\n\nWe value clear writing.";
const stretch = "Requirements:\n- Python\n- Kotlin\n- Java\n- C++\n\nWe value clear writing.";
const low = "Requirements:\n- Kotlin\n- Java\n- C++\n- Terraform\n\nWe value clear writing.";
const unknown = "We are looking for a friendly, curious person to join our growing team.";

const job = (n, description, patch = {}) => ({
  id: uuid(n), user_id: user, resume_id: null, application_id: null,
  created_at: `2026-10-${String(n).padStart(2, "0")}T00:00:00Z`, updated_at: `2026-10-${String(n).padStart(2, "0")}T00:00:00Z`,
  payload: { company: `Company ${n}`, role: "Engineer", location: "Remote", job_description: description },
  ...patch,
});

test("bands rank strong, good, stretch, low, unknown, then jobs without a description", async () => {
  const db = fakeDb({
    ...cvTables(),
    job_opportunities: [
      job(1, strongA), job(2, low), job(3, unknown), job(4, good), job(5, stretch), job(6, ""), job(7, strongB),
      job(8, "Too short to compare"),
    ],
  });
  const result = await rankSavedJobsByFit(db, user, { today: TODAY });
  const bands = result.jobs.map((j) => result.fits[j.id]?.band ?? null);
  assert.deepEqual(bands, ["strong", "strong", "good", "stretch", "low", "unknown", null, null]);
  // Within strong: full coverage (older) before 3.5 of 4 (newer)
  assert.deepEqual(result.jobs.slice(0, 2).map((j) => j.id), [uuid(1), uuid(7)]);
  // No description last, newest first among them; both have a null fit
  assert.deepEqual(result.jobs.slice(-2).map((j) => j.id), [uuid(8), uuid(6)]);
  assert.equal(result.fits[uuid(6)], null);
  assert.equal(result.fits[uuid(8)], null);
  assert.equal(result.total, 8);
  assert.equal(result.ranked, 8);
  assert.equal(result.rankedLimit, RANKED_LIMIT);
  assert.equal(result.hasMore, false);
  assert.equal(result.setupPending, false);
  assert.equal(result.fitUnavailable, false);
});

test("within a band, equal coverage falls back to newest first", async () => {
  const db = fakeDb({ ...cvTables(), job_opportunities: [job(1, strongA), job(3, strongA), job(2, strongA)] });
  const { jobs } = await rankSavedJobsByFit(db, user, { today: TODAY });
  assert.deepEqual(jobs.map((j) => j.id), [uuid(3), uuid(2), uuid(1)]);
});

test("every query is scoped to the user and another user's resume is never read", async () => {
  const mine = uuid(501), theirs = uuid(502);
  const content = (skills) => ({ experience: [{ companyName: "X", position: "Y", description: [skills] }] });
  const db = fakeDb({
    ...cvTables(),
    resumes: [
      { id: mine, user_id: user, content: content("Python and Docker") },
      { id: theirs, user_id: other, content: content("Python, PostgreSQL, Docker") },
    ],
    job_opportunities: [
      job(1, strongA, { resume_id: mine }),
      job(2, strongA, { resume_id: theirs }),
      job(3, strongA, { user_id: other }),
    ],
  });
  const result = await rankSavedJobsByFit(db, user, { today: TODAY });
  assert.deepEqual(result.jobs.map((j) => j.id).sort(), [uuid(1), uuid(2)]);
  for (const query of db.log.filter((q) => q.table !== "__probe")) {
    const key = query.table === "profiles" ? "id" : "user_id";
    assert.ok(query.eqs.some(([k, v]) => k === key && v === user), `${query.table} is filtered by the user`);
  }
  assert.deepEqual(result.fits[uuid(1)].resume, { shown: ["python", "docker"], notShown: ["postgresql"] });
  // The job pointing at another user's resume is compared without one
  assert.equal(result.fits[uuid(2)].resume, null);
  const resumeReads = db.log.filter((q) => q.table === "resumes");
  assert.equal(resumeReads.length, 1, "working resumes load in one query");
});

test("an unreadable working resume is skipped, not fatal", async () => {
  const db = fakeDb({
    ...cvTables(),
    resumes: [{ id: uuid(501), user_id: user, content: { schemaVersion: 99 } }],
    job_opportunities: [job(1, strongA, { resume_id: uuid(501) })],
  });
  const fits = await fitForSavedJobs(db, user, db.tables.job_opportunities, { today: TODAY });
  assert.equal(fits[uuid(1)].band, "strong");
  assert.equal(fits[uuid(1)].resume, null);
});

test("a failed Master CV load lists the jobs newest first with no fits", async (t) => {
  t.mock.method(console, "error", () => {});
  const db = fakeDb({ ...cvTables(), job_opportunities: [job(1, strongA), job(2, low), job(3, "")] });
  db.fail("cv_experience", "select", { code: "XX000", message: "boom" });
  const result = await rankSavedJobsByFit(db, user, { today: TODAY });
  assert.deepEqual(result.jobs.map((j) => j.id), [uuid(3), uuid(2), uuid(1)]);
  assert.deepEqual(result.fits, {});
  assert.equal(result.fitUnavailable, true);

  db.fail("cv_experience", "select", { code: "XX000", message: "boom" });
  assert.deepEqual(await fitForSavedJobs(db, user, db.tables.job_opportunities, { today: TODAY }), {});
});

test("the ranked list pages by 20 and says when there are more saved jobs than it ranks", async () => {
  const jobs = Array.from({ length: 25 }, (_, i) => job(i + 1, i % 2 ? low : strongA, {
    updated_at: new Date(Date.UTC(2026, 9, 1, i)).toISOString(),
  }));
  const db = fakeDb({ ...cvTables(), job_opportunities: jobs });
  const first = await rankSavedJobsByFit(db, user, { today: TODAY, page: 1 });
  const second = await rankSavedJobsByFit(db, user, { today: TODAY, page: 2 });
  assert.equal(first.jobs.length, 20);
  assert.equal(second.jobs.length, 5);
  assert.deepEqual(Object.keys(second.fits).sort(), second.jobs.map((j) => j.id).sort());
  const all = [...first.jobs, ...second.jobs].map((j) => first.fits[j.id] ?? second.fits[j.id]);
  assert.deepEqual(all.map((f) => f.band), [...Array(13).fill("strong"), ...Array(12).fill("low")]);
  assert.equal(new Set([...first.jobs, ...second.jobs].map((j) => j.id)).size, 25);

  const many = Array.from({ length: RANKED_LIMIT + 5 }, (_, i) => job(i + 1, "", {
    updated_at: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
  }));
  const big = await rankSavedJobsByFit(fakeDb({ ...cvTables(), job_opportunities: many }), user, { today: TODAY });
  assert.equal(big.total, RANKED_LIMIT + 5);
  assert.equal(big.ranked, RANKED_LIMIT);
  assert.equal(big.hasMore, true);
});

test("the search filter applies to the ranked list", async () => {
  const db = fakeDb({
    ...cvTables(),
    job_opportunities: [
      job(1, strongA, { payload: { company: "Acme", role: "Engineer", location: "Remote", job_description: strongA } }),
      job(2, low, { payload: { company: "Beta", role: "Acme partner", location: "Remote", job_description: low } }),
      job(3, strongA, { payload: { company: "Gamma", role: "Engineer", location: "Remote", job_description: strongA } }),
    ],
  });
  const result = await rankSavedJobsByFit(db, user, { today: TODAY, search: "acme" });
  assert.deepEqual(result.jobs.map((j) => j.id), [uuid(1), uuid(2)]);
  assert.equal(result.total, 2);
});

test("saved jobs setup pending lists nothing and computes no fit", async () => {
  const db = fakeDb({ ...cvTables() });
  db.fail("job_opportunities", "select", { code: "42P01", message: "missing" });
  const result = await rankSavedJobsByFit(db, user, { today: TODAY });
  assert.deepEqual({ jobs: result.jobs, setupPending: result.setupPending, fits: result.fits }, { jobs: [], setupPending: true, fits: {} });
});
