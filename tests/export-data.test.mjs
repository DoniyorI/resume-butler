import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";

const { exportJsonChunks, applicationsCsv, NEVER_EXPORT } = await import("@/server/export/exportData");

const user = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const missing = { code: "42P01", message: "relation does not exist" };

// Records every query a database sees: table, then each call and its arguments
function recorded(db) {
  const calls = [];
  const from = db.from.bind(db);
  db.from = (table) => {
    const entry = { table, ops: [] };
    calls.push(entry);
    const query = from(table);
    const proxy = new Proxy(query, {
      get(target, prop) {
        const value = target[prop];
        if (typeof value !== "function") return value;
        if (prop === "then") return value.bind(target);
        return (...args) => {
          entry.ops.push([prop, ...args]);
          const result = value.apply(target, args);
          return result === target ? proxy : result;
        };
      },
    });
    return proxy;
  };
  return calls;
}

const collect = async (db, options) => {
  let text = "";
  for await (const chunk of exportJsonChunks(db, user, options)) text += chunk;
  return text;
};
const has = (entry, op, ...args) =>
  entry.ops.some(([name, ...rest]) => name === op && args.every((arg, i) => JSON.stringify(rest[i]) === JSON.stringify(arg)));

const seed = () => ({
  profiles: [{ id: user, email: "a@example.com", first_name: "Ada" }, { id: other, email: "b@example.com" }],
  cv_experience: [{ id: "e1", user_id: user, company: "Acme" }, { id: "e2", user_id: other, company: "Theirs" }],
  cv_experience_bullets: [
    { id: "b1", experience_id: "e1", content: "Built things" },
    { id: "b2", experience_id: "e2", content: "Not mine" },
  ],
  applications: [
    { id: "a1", user_id: user, company: "Acme", role: "Engineer", status: "Applied", applied_date: "2026-11-01" },
    { id: "a2", user_id: other, company: "Theirs", role: "Dev", status: "Applied", applied_date: "2026-11-02" },
  ],
  application_status_history: [
    { id: "h1", application_id: "a1", status: "Applied" },
    { id: "h2", application_id: "a2", status: "Applied" },
  ],
  email_connections: [{ id: "c1", user_id: user, email_address: "a@example.com", app_password: "SECRET-APP-PASSWORD" }],
  extension_tokens: [{ id: "t1", user_id: user, name: "Chrome extension", token_hash: "SECRET-TOKEN-HASH" }],
  application_submissions: [{ id: "s1", user_id: user, event_id: "x", request_hash: "SECRET-REQUEST-HASH", kind: "unknown" }],
  reusable_answer_versions: [{ answer_id: "r1", user_id: user, revision: 1, request_hash: "SECRET-REQUEST-HASH", content: {} }],
  resume_artifacts: [{ id: "f1", user_id: user, title: "CV", filename: "cv.pdf", pdf_bytes: "SECRET-PDF-BYTES", sha256: "ab" }],
  watched_companies: [{ id: "w1", user_id: user, name: "Board Co" }],
  watched_postings: [
    { id: "p1", user_id: user, company_id: "w1", title: "Dev", description: "SECRET-POSTING-TEXT", url: "https://x.test" },
  ],
  email_sync_locks: [{ user_id: user, lease_token: "SECRET-LEASE" }],
});

test("the chunks join into one valid document with the documented shape", async () => {
  const db = database(seed());
  const now = new Date("2026-11-14T10:00:00Z");
  const text = await collect(db, { now });
  const doc = JSON.parse(text);
  assert.equal(doc.app, "Resume Butler");
  assert.equal(doc.version, 1);
  assert.equal(doc.exportedAt, "2026-11-14T10:00:00.000Z");
  assert.deepEqual(Object.keys(doc), ["app", "version", "exportedAt", "data", "summary"]);
  assert.deepEqual(doc.data.profile, [{ id: user, email: "a@example.com", first_name: "Ada" }]);
  assert.deepEqual(doc.data.cvExperience.map((r) => r.id), ["e1"]);
  assert.deepEqual(doc.data.cvExperienceBullets.map((r) => r.id), ["b1"]);
  assert.deepEqual(doc.data.applications.map((r) => r.id), ["a1"]);
  assert.deepEqual(doc.data.applicationStatusHistory.map((r) => r.id), ["h1"]);
  assert.equal(doc.data.emailConnection[0].email_address, "a@example.com");
  assert.equal(doc.data.extensionTokens[0].name, "Chrome extension");
  assert.equal(doc.summary.counts.applications, 1);
  assert.equal(doc.summary.counts.cvSkills, 0);
  assert.deepEqual(doc.summary.incomplete, []);
  assert.deepEqual(doc.summary.truncated, []);
  assert.ok(doc.summary.notIncluded.length >= 6 && doc.summary.notIncluded.every((s) => typeof s === "string"));
  for (const section of Object.keys(doc.data)) assert.ok(section in doc.summary.counts);
});

test("secrets and the PDF bytes appear nowhere in the output", async () => {
  const text = await collect(database(seed()));
  for (const secret of ["SECRET-APP-PASSWORD", "SECRET-TOKEN-HASH", "SECRET-REQUEST-HASH", "SECRET-LEASE", "SECRET-PDF-BYTES"]) {
    assert.ok(!text.includes(secret), secret);
  }
  for (const key of ["app_password", "token_hash", "lease_token", "request_hash", "pdf_bytes"]) {
    assert.ok(NEVER_EXPORT.includes(key));
    assert.ok(!text.includes(`"${key}"`), key);
  }
  assert.equal(JSON.parse(text).data.resumeArtifacts[0].filename, "cv.pdf");
});

test("watched postings leave out the description", async () => {
  const text = await collect(database(seed()));
  const posting = JSON.parse(text).data.watchedPostings[0];
  assert.equal(posting.title, "Dev");
  assert.ok(!("description" in posting));
  assert.ok(!text.includes("SECRET-POSTING-TEXT"));
});

test("user tables are filtered by user_id and child tables by parent ids", async () => {
  const db = database(seed());
  const calls = recorded(db);
  await collect(db);
  const userTables = ["cv_experience", "cv_projects", "cv_education", "cv_skills", "cv_certifications", "applications",
    "application_activities", "application_offers", "application_submissions", "resumes", "cover_letters",
    "resume_artifacts", "job_opportunities", "watched_companies", "watched_postings", "application_suggestions",
    "reusable_answers", "reusable_answer_versions", "email_connections", "extension_tokens"];
  for (const table of userTables) {
    const mine = calls.filter((c) => c.table === table);
    assert.ok(mine.length, table);
    for (const entry of mine) assert.ok(has(entry, "eq", "user_id", user), table);
  }
  for (const entry of calls.filter((c) => c.table === "profiles")) assert.ok(has(entry, "eq", "id", user));
  const children = {
    cv_experience_bullets: ["experience_id", ["e1"]],
    application_status_history: ["application_id", ["a1"]],
  };
  for (const [table, [column, ids]] of Object.entries(children)) {
    const mine = calls.filter((c) => c.table === table);
    assert.ok(mine.length, table);
    for (const entry of mine) assert.ok(has(entry, "in", column, ids), table);
  }
  // No parents, no child queries
  assert.equal(calls.filter((c) => c.table === "cv_project_bullets").length, 0);
  // Tables that are never exported are never read
  for (const table of ["processed_emails", "api_rate_limits", "email_sync_locks", "application_ingest_events", "reusable_answer_tombstones"]) {
    assert.equal(calls.filter((c) => c.table === table).length, 0, table);
  }
  // Every read is paged and ordered
  for (const entry of calls) assert.ok(entry.ops.some(([name]) => name === "range") && entry.ops.some(([name]) => name === "order"), entry.table);
});

test("child ids are read in chunks of 100", async () => {
  const applications = Array.from({ length: 450 }, (_, i) => ({ id: `a${i}`, user_id: user, company: `C${i}` }));
  const db = database({ applications });
  const calls = recorded(db);
  const doc = JSON.parse(await collect(db));
  const history = calls.filter((c) => c.table === "application_status_history");
  assert.deepEqual(history.map((c) => c.ops.find(([n]) => n === "in")[2].length), [100, 100, 100, 100, 50]);
  assert.equal(doc.summary.counts.applications, 450);
});

test("tables are read in pages of 1,000", async () => {
  const applications = Array.from({ length: 2300 }, (_, i) => ({ id: `a${String(i).padStart(5, "0")}`, user_id: user, company: "C" }));
  const db = database({ applications });
  const calls = recorded(db);
  const doc = JSON.parse(await collect(db));
  assert.equal(doc.data.applications.length, 2300);
  assert.equal(new Set(doc.data.applications.map((r) => r.id)).size, 2300);
  const ranges = calls.filter((c) => c.table === "applications").map((c) => c.ops.find(([n]) => n === "range").slice(1));
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.deepEqual(doc.summary.truncated, []);
});

test("20,000 rows is the cap and the section is reported as truncated", async () => {
  const applications = Array.from({ length: 20_001 }, (_, i) => ({ id: `a${String(i).padStart(6, "0")}`, user_id: user }));
  const doc = JSON.parse(await collect(database({ applications })));
  assert.equal(doc.data.applications.length, 20_000);
  assert.equal(doc.summary.counts.applications, 20_000);
  assert.deepEqual(doc.summary.truncated, ["applications"]);
  // Exactly 20,000 is not truncated
  const exact = JSON.parse(await collect(database({ applications: applications.slice(0, 20_000) })));
  assert.deepEqual(exact.summary.truncated, []);
});

test("a table that does not exist yet is empty, not incomplete", async () => {
  const db = database(seed());
  db.fail("application_offers", "select", missing);
  db.fail("watched_companies", "select", { code: "PGRST205", message: "not in schema cache" });
  const doc = JSON.parse(await collect(db));
  assert.deepEqual(doc.data.applicationOffers, []);
  assert.deepEqual(doc.data.watchedCompanies, []);
  assert.deepEqual(doc.summary.incomplete, []);
  assert.deepEqual(doc.data.applications.map((r) => r.id), ["a1"]);
});

test("a missing column is incomplete, not an empty section", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    for (const code of ["42703", "PGRST204"]) {
      const db = database(seed());
      db.fail("application_offers", "select", { code, message: "column missing" });
      const doc = JSON.parse(await collect(db));
      assert.deepEqual(doc.summary.incomplete, ["applicationOffers"]);
    }
  } finally {
    console.error = original;
  }
});

test("any other failure is incomplete and the document stays valid", async () => {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    const db = database(seed());
    db.fail("cv_skills", "select", { code: "XX000", message: "SECRET-ROW-CONTENT boom" });
    const real = db.from.bind(db);
    db.from = (table) => {
      if (table === "cover_letters") throw new Error("SECRET-ROW-CONTENT network down");
      return real(table);
    };
    const doc = JSON.parse(await collect(db));
    assert.deepEqual(doc.summary.incomplete.sort(), ["coverLetters", "cvSkills"]);
    assert.deepEqual(doc.data.cvSkills, []);
    assert.deepEqual(doc.data.coverLetters, []);
    assert.deepEqual(doc.data.applications.map((r) => r.id), ["a1"]);
    assert.ok(logged.length >= 2);
    assert.ok(!JSON.stringify(logged).includes("SECRET-ROW-CONTENT"));
  } finally {
    console.error = original;
  }
});

test("a failure after the first page keeps the rows already read", async () => {
  const applications = Array.from({ length: 1500 }, (_, i) => ({ id: `a${String(i).padStart(5, "0")}`, user_id: user }));
  const db = database({ applications });
  const real = db.from.bind(db);
  let applicationReads = 0;
  db.from = (table) => {
    if (table === "applications" && ++applicationReads === 2) throw new Error("dropped");
    return real(table);
  };
  const original = console.error;
  console.error = () => {};
  try {
    const doc = JSON.parse(await collect(db));
    assert.equal(doc.data.applications.length, 1000);
    assert.deepEqual(doc.summary.incomplete, ["applications"]);
  } finally {
    console.error = original;
  }
});

test("the applications CSV has a header, ISO dates, formatted pay and guarded cells", async () => {
  const db = database({
    applications: [
      { id: "a1", user_id: user, company: "=HYPERLINK(\"x\")", role: "Engineer, Platform", status: "Applied", applied_date: "2026-11-01",
        location: "Remote", portal_link: "https://example.com/j", salary_min: 120000, salary_max: 150000, salary_currency: "USD",
        salary_period: "year", workplace_type: "remote", employment_type: "Full-time", source: "extension", comments: "line1\nline2" },
      { id: "a2", user_id: user, company: "Beta", role: null, status: "Rejected", applied_date: "2026-11-05", comments: null },
      { id: "a3", user_id: other, company: "Theirs", status: "Applied", applied_date: "2026-11-09" },
    ],
  });
  const calls = recorded(db);
  const csv = await applicationsCsv(db, user);
  assert.ok(csv.startsWith("﻿Company,Role,Status,Applied date,Location,Link,Pay,Workplace,Employment type,Source,Notes\r\n"));
  const lines = csv.split("\r\n");
  // The fake database sorts by its last order() only, so check the order the query asked for
  assert.deepEqual(calls[0].ops.filter(([n]) => n === "order").map(([, ...args]) => args), [["applied_date", { ascending: false }], ["id"]]);
  assert.ok(lines.includes("Beta,,Rejected,2026-11-05,,,,,,,"));
  assert.ok(lines.find((l) => l.includes("HYPERLINK")).startsWith(`"'=HYPERLINK(""x"")","Engineer, Platform",Applied,2026-11-01,Remote,https://example.com/j,$120K – $150K /yr,remote,Full-time,extension,"line1`));
  assert.ok(!csv.includes("Theirs"));
  assert.ok(has(calls[0], "eq", "user_id", user));
});
