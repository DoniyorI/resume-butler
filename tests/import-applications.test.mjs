import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";

const { commitImport, undoImport, loadExistingForImport } = await import("@/server/applications/importApplications");
const { planImport } = await import("@/server/applications/importPlan");

const user = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";

const planOf = (...lines) => planImport({ text: ["Company,Role,Date,Pay,Remote", ...lines].join("\n"), today: "2026-11-14", existing: [], options: {} });

test("commit inserts only ready rows, for the user, with the date and job details", async () => {
  const db = database();
  const plan = planOf("Acme,Dev,2026-01-05,$120k - $150k,Remote", "Skip,Dev,,,", ",Dev,2026-01-05,,");
  const result = await commitImport(db, user, plan);
  assert.equal(result.imported, 1);
  assert.equal(result.ids.length, 1);
  assert.equal(db.tables.applications.length, 1);
  const row = db.tables.applications[0];
  assert.equal(row.user_id, user);
  assert.equal(row.company, "Acme");
  assert.equal(row.applied_date, "2026-01-05");
  assert.equal(row.salary_min, 120000);
  assert.equal(row.workplace_type, "remote");
  assert.equal(row.status, "Applied");
});

test("a unique violation is a duplicate, another error is a failure, the rest continue", async () => {
  const db = database();
  db.fail("applications", "insert", { code: "23505", message: "dup" });
  db.fail("applications", "insert", { code: "XX000", message: "boom Secret Co" }, 1);
  const lines = Array.from({ length: 8 }, (_, i) => `Co${i},Dev,2026-01-05,,`);
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  let result;
  try { result = await commitImport(db, user, planOf(...lines)); } finally { console.error = original; }
  // fail() entries apply in order: the first insert sees 23505 only if it is the first matching fault
  assert.equal(result.imported + result.failed + result.duplicates, 8);
  assert.equal(result.duplicates, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.imported, 6);
  assert.equal(db.tables.applications.length, 6);
  assert.equal(logged.length, 1);
  assert.doesNotMatch(logged[0], /Co\d|Secret/);
});

test("loadExistingForImport reads only the user's applications", async () => {
  const db = database({ applications: [
    { id: "a", user_id: user, company: "Acme", role: "Dev", applied_date: "2026-01-05", portal_link: "https://x.example" },
    { id: "b", user_id: other, company: "Theirs", role: "", applied_date: null, portal_link: "" },
  ] });
  assert.deepEqual(await loadExistingForImport(db, user), [{ company: "Acme", role: "Dev", appliedDate: "2026-01-05", link: "https://x.example" }]);
});

test("undo removes only the user's recent rows from the given ids", async () => {
  const old = new Date(Date.now() - 2 * 3600_000).toISOString();
  const fresh = new Date().toISOString();
  const db = database({ applications: [
    { id: "m1", user_id: user, created_at: fresh },
    { id: "m2", user_id: user, created_at: old },
    { id: "t1", user_id: other, created_at: fresh },
    { id: "m3", user_id: user, created_at: fresh },
  ] });
  assert.equal(await undoImport(db, user, ["m1", "m2", "t1"]), 1);
  assert.deepEqual(db.tables.applications.map((r) => r.id).sort(), ["m2", "m3", "t1"]);
});

test("undo chunks ids and rejects more than 500", async () => {
  const ids = Array.from({ length: 250 }, (_, i) => `id${i}`);
  const db = database({ applications: ids.map((id) => ({ id, user_id: user, created_at: new Date().toISOString() })) });
  assert.equal(await undoImport(db, user, ids), 250);
  await assert.rejects(() => undoImport(db, user, Array.from({ length: 501 }, (_, i) => `x${i}`)), { status: 400 });
});
