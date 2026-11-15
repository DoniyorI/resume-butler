import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

const cvCalls = [];
const cv = {
  experience: [{ company: "Acme", position: "Engineer", bullets: ["Built backend services in TypeScript for 40 clients", "Tuned PostgreSQL queries that cut load time by half"] }],
  projects: [],
  skills: [{ name: "Docker", category: "Tools" }],
  education: [],
};
mock.module("@/server/resume/loadCv", { namedExports: { loadMasterCv: async (_db, userId) => (cvCalls.push(userId), cv) } });

// submissionData.js imports "./submissions" without an extension, which Node's loader can't resolve here
mock.module("@/server/applications/submissionData", {
  namedExports: {
    getSubmission: async (db, userId, id) => {
      const { data } = await db.from("application_submissions").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      return data ? { ...data, artifact: null } : null;
    },
  },
});

const { loadInterviewPrep } = await import("@/server/interviews/service");

const user = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const appId = "22222222-2222-4222-8222-222222222222";
const otherApp = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-11-14T12:00:00Z");
const description = `What you'll need
- Strong TypeScript skills for backend services
- Production experience with PostgreSQL
- Experience with Docker and deploying to AWS`;
const snapshot = { experience: [{ companyName: "Acme", position: "Engineer", description: ["Built backend services in TypeScript for 40 clients"] }] };

const seeded = (extra = {}) =>
  database({
    applications: [
      { id: appId, user_id: user, company: "Acme", role: "Platform Engineer", status: "Interviewed", job_description: "", resume_id: null },
      { id: otherApp, user_id: other, company: "Theirs", role: "Dev", status: "Applied", job_description: description, resume_id: null },
    ],
    application_submissions: [
      { id: "s-old", user_id: user, application_id: appId, kind: "selected", submitted_on: "2026-10-01", created_at: "2026-10-01T00:00:00Z", job_description: "old posting text that is long enough to be a description for sure", resume_title: "Old", resume_snapshot: {}, answers: [], supersedes_id: null },
      { id: "s-new", user_id: user, application_id: appId, kind: "selected", submitted_on: "2026-11-01", created_at: "2026-11-01T00:00:00Z", job_description: description, resume_title: "Platform resume", resume_snapshot: snapshot, answers: [{ question: "Why us?", answer: "Logistics." }], supersedes_id: null },
      { id: "s-theirs", user_id: other, application_id: appId, kind: "selected", submitted_on: "2026-11-10", created_at: "2026-11-10T00:00:00Z", job_description: "another user's description that is long enough to count", resume_title: "Not mine", resume_snapshot: {}, answers: [], supersedes_id: null },
    ],
    application_activities: [
      { id: "a1", user_id: user, application_id: appId, kind: "interview", title: "Panel", due_on: "2026-11-16", starts_at: "2026-11-16T15:00:00Z", time_zone: "UTC", status: "open", notes: "", contact_name: "", contact_channel: "", link: "" },
      { id: "a2", user_id: other, application_id: appId, kind: "interview", title: "Not mine", due_on: "2026-11-15", starts_at: "2026-11-15T15:00:00Z", time_zone: "UTC", status: "open", notes: "", contact_name: "", contact_channel: "", link: "" },
    ],
    resumes: [],
    ...extra,
  });

test("prepares from the user's latest submission, scoped to the user", async () => {
  cvCalls.length = 0;
  const prep = await loadInterviewPrep(seeded(), user, appId, { now: NOW });
  assert.equal(prep.source.kind, "submitted");
  assert.equal(prep.source.submissionId, "s-new");
  assert.equal(prep.source.resumeTitle, "Platform resume");
  assert.equal(prep.source.resumeKnown, true);
  assert.equal(prep.upcoming.title, "Panel");
  assert.deepEqual(prep.answers, [{ question: "Why us?", answer: "Logistics." }]);
  assert.deepEqual(cvCalls, [user]);
  const keys = prep.groups.map((g) => g.key);
  assert.ok(keys.includes("goDeeper") && keys.includes("bringUp"), keys.join());
});

test("another user's application, an unknown id and a bad id give null", async () => {
  const db = seeded();
  assert.equal(await loadInterviewPrep(db, user, otherApp, { now: NOW }), null);
  assert.equal(await loadInterviewPrep(db, user, "44444444-4444-4444-8444-444444444444", { now: NOW }), null);
  assert.equal(await loadInterviewPrep(db, user, "not-a-uuid", { now: NOW }), null);
});

test("a missing activities table means no upcoming step, and the page still loads", async () => {
  const db = seeded();
  db.fail("application_activities", "select", { code: "42P01", message: "missing" });
  const prep = await loadInterviewPrep(db, user, appId, { now: NOW });
  assert.equal(prep.upcoming, null);
  assert.equal(prep.past, 0);
  assert.equal(prep.source.submissionId, "s-new");
});

test("no submission (or no submissions table) falls back to the saved application", async () => {
  const db = seeded({ application_submissions: [] });
  db.tables.applications[0].job_description = description;
  const prep = await loadInterviewPrep(db, user, appId, { now: NOW });
  assert.equal(prep.source.kind, "current");
  assert.equal(prep.posting.hasDescription, true);
  assert.equal(prep.source.resumeKnown, false);

  const missing = seeded();
  missing.tables.applications[0].job_description = description;
  missing.fail("application_submissions", "select", { code: "42P01", message: "missing" });
  assert.equal((await loadInterviewPrep(missing, user, appId, { now: NOW })).source.kind, "current");
});

test("an application with no description gets no groups", async () => {
  const prep = await loadInterviewPrep(seeded({ application_submissions: [] }), user, appId, { now: NOW });
  assert.equal(prep.posting.hasDescription, false);
  assert.deepEqual(prep.groups, []);
});
