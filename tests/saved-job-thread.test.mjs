import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

// "One job, one thread": a saved job's context follows it into tailoring and the application.
const user = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const resume = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const otherJob = "44444444-4444-4444-8444-444444444444";
const appId = "55555555-5555-4555-8555-555555555555";
const link = "https://job-boards.greenhouse.io/acme/jobs/123";
const payload = {
  company: "Acme", role: "Engineer", location: "Remote", portal_link: link, job_description: "Build things",
  salary_min: 120000, salary_max: 150000, salary_currency: "USD", salary_period: "year", workplace_type: "remote", employment_type: "Full-time", source_site: "greenhouse",
};
const daysAgo = days => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const savedJob = (patch = {}) => ({ id: jobId, user_id: user, identity_key: "greenhouse:acme:123", payload, resume_id: resume, application_id: null, updated_at: "2026-11-01", ...patch });

let current;
mock.module("@/server/auth", { namedExports: {
  requireUser: async () => ({ supabase: current, user: { id: user } }),
  requirePageUser: async () => ({ supabase: current, user: { id: user } }),
} });
mock.module("next/cache", { namedExports: { revalidatePath() {} } });
// React 18's node build has no cache(); data.js wraps its page reads in it
mock.module("react", { namedExports: { cache: fn => fn } });
mock.module("next/navigation", { namedExports: { redirect() { throw new Error("redirect"); }, notFound() {} } });

const service = await import("@/server/opportunities/service");
const { getJobOptions, getDeepLinkedJob } = await import("@/features/resumes/data");
const { createApplication } = await import("@/features/applications/actions");
const { normalizeResumeContent } = await import("@/features/resumes/resumeDocument");
const { normalizeLetter } = await import("@/features/cover-letters/letterDocument");
const { saveResumeDocument } = await import("@/server/resume/saveDocument");

test("saved jobs with a description are offered as targets, once, newest first", async () => {
  const db = database({
    applications: [{ id: appId, user_id: user, company: "Tracked", role: "Dev", job_description: "Tracked JD", applied_date: "2026-10-01" }],
    job_opportunities: [
      savedJob(),
      savedJob({ id: otherJob, payload: { ...payload, company: "Newer" }, updated_at: "2026-11-05" }),
      savedJob({ id: "66666666-6666-4666-8666-666666666666", application_id: appId, updated_at: "2026-11-06" }),
      savedJob({ id: "77777777-7777-4777-8777-777777777777", payload: { ...payload, job_description: "" } }),
      savedJob({ id: "88888888-8888-4888-8888-888888888888", user_id: other, updated_at: "2026-11-09" }),
    ],
  });
  const options = await getJobOptions(db, user, { resumeId: resume });
  assert.deepEqual(options.applications.map(a => a.id), [appId]);
  assert.deepEqual(options.savedJobs, [{ id: otherJob, company: "Newer", role: "Engineer" }, { id: jobId, company: "Acme", role: "Engineer" }]);
});

test("job options still load before the saved jobs migration", async () => {
  const db = database({ applications: [] });
  db.fail("job_opportunities", "select", { code: "42P01", message: "missing" });
  assert.deepEqual((await getJobOptions(db, user, { coverLetterId: resume })).savedJobs, []);
  db.fail("job_opportunities", "select", { code: "PGRST205", message: "missing" });
  assert.deepEqual(await service.listSavedJobTargets(db, user), []);
});

test("loadSavedJob returns an owned saved job as a target and refuses another user's", async () => {
  const db = database({ job_opportunities: [savedJob({ application_id: appId }), savedJob({ id: otherJob, user_id: other })] });
  assert.deepEqual(await service.loadSavedJob(db, user, jobId), { opportunityId: jobId, applicationId: appId, company: "Acme", role: "Engineer", jobDescription: "Build things" });
  await assert.rejects(service.loadSavedJob(db, user, otherJob), e => e.status === 404);
  await assert.rejects(service.loadSavedJob(db, user, "not-a-uuid"), e => e.status === 404);
});

test("a deep link adopts into an empty document, offers a switch otherwise, and ignores the same or foreign job", async () => {
  const db = database({ job_opportunities: [savedJob(), savedJob({ id: otherJob, user_id: other })] });
  const empty = normalizeResumeContent({}).target;
  assert.equal((await getDeepLinkedJob(db, user, jobId, empty)).adopt, true);
  const elsewhere = { ...empty, jobDescription: "Another job", applicationId: appId };
  assert.deepEqual(await getDeepLinkedJob(db, user, jobId, elsewhere), { adopt: false, target: await service.loadSavedJob(db, user, jobId) });
  assert.equal(await getDeepLinkedJob(db, user, jobId, { ...elsewhere, opportunityId: jobId }), null);
  assert.equal(await getDeepLinkedJob(db, user, otherJob, empty), null);
  assert.equal(await getDeepLinkedJob(db, user, undefined, empty), null);
});

test("applyToSavedJob carries the description, job details and working resume", async () => {
  const db = database({ job_opportunities: [savedJob()], resumes: [{ id: resume, user_id: user }], applications: [] });
  const result = await service.applyToSavedJob(db, user, { opportunityId: jobId, appliedDate: "2026-11-10" });
  assert.equal(result.created, true);
  const row = db.tables.applications.find(a => a.id === result.applicationId);
  assert.equal(row.user_id, user);
  assert.equal(row.status, "Applied");
  assert.equal(row.applied_date, "2026-11-10");
  assert.equal(row.job_description, "Build things");
  assert.equal(row.portal_link, link);
  assert.equal(row.resume_id, resume);
  assert.equal(row.salary_min, 120000);
  assert.equal(row.workplace_type, "remote");
  assert.equal(row.employment_type, "Full-time");
  assert.equal(row.posting_platform, "greenhouse");
  assert.equal(row.posting_id, "123");
});

test("applyToSavedJob leaves out a resume that is gone and refuses another user's job", async () => {
  const db = database({ job_opportunities: [savedJob(), savedJob({ id: otherJob, user_id: other })], resumes: [], applications: [] });
  const { applicationId } = await service.applyToSavedJob(db, user, { opportunityId: jobId, appliedDate: "2026-11-10" });
  assert.equal(db.tables.applications.find(a => a.id === applicationId).resume_id, null);
  await assert.rejects(service.applyToSavedJob(db, user, { opportunityId: otherJob, appliedDate: "2026-11-10" }), e => e.status === 404);
  assert.equal(db.tables.applications.length, 1);
});

test("applyToSavedJob returns the posting's existing application instead of a duplicate", async () => {
  const linked = database({ job_opportunities: [savedJob({ application_id: appId })], applications: [{ id: appId, user_id: user, portal_link: "https://other.example/x" }] });
  assert.deepEqual(await service.applyToSavedJob(linked, user, { opportunityId: jobId, appliedDate: "2026-11-10" }), { applicationId: appId, created: false });
  assert.equal(linked.tables.applications.length, 1);
  const sameLink = database({ job_opportunities: [savedJob()], applications: [{ id: appId, user_id: user, portal_link: link, status: "Applied", applied_date: daysAgo(10) }] });
  assert.deepEqual(await service.applyToSavedJob(sameLink, user, { opportunityId: jobId, appliedDate: "2026-11-10" }), { applicationId: appId, created: false });
  assert.equal(sameLink.tables.applications.length, 1);
});

test("an old or closed application with the same link doesn't block tracking a reposted job", async () => {
  const db = database({ job_opportunities: [savedJob()], resumes: [], applications: [
    { id: appId, user_id: user, portal_link: link, status: "Rejected", applied_date: daysAgo(30) },
    { id: otherJob, user_id: user, posting_url_key: link, status: "Applied", applied_date: daysAgo(200) },
  ] });
  const result = await service.applyToSavedJob(db, user, { opportunityId: jobId, appliedDate: daysAgo(0) });
  assert.equal(result.created, true);
  assert.equal(db.tables.applications.length, 3);
  const open = database({ job_opportunities: [savedJob()], applications: [{ id: appId, user_id: user, posting_url_key: link, status: "Interviewed", applied_date: daysAgo(20) }] });
  assert.deepEqual(await service.applyToSavedJob(open, user, { opportunityId: jobId, appliedDate: daysAgo(0) }), { applicationId: appId, created: false });
});

// The row another tab inserts between this request's check and its own insert
async function applyDuringRace(otherCreatedAt) {
  const db = database({ job_opportunities: [savedJob()], resumes: [], applications: [] });
  const from = db.from.bind(db);
  db.from = table => {
    const query = from(table);
    if (table !== "applications") return query;
    const insert = query.insert.bind(query);
    query.insert = value => {
      db.tables.applications.push({ id: appId, user_id: user, portal_link: link, status: "Applied", applied_date: daysAgo(0), created_at: otherCreatedAt });
      return insert({ ...value, created_at: "2026-11-12T10:00:00.000Z" });
    };
    return query;
  };
  return { db, result: await service.applyToSavedJob(db, user, { opportunityId: jobId, appliedDate: daysAgo(0) }) };
}

test("a double submit keeps the earliest application and the later one removes itself", async () => {
  // With two rows the 013 trigger links neither, so the tie is settled by creation time
  const lost = await applyDuringRace("2026-11-12T09:59:59.000Z");
  assert.deepEqual(lost.result, { applicationId: appId, created: false });
  assert.deepEqual(lost.db.tables.applications.map(a => a.id), [appId]);

  // When this request's row is the earlier one it stays; the other request removes its own
  const won = await applyDuringRace("2026-11-12T10:00:01.000Z");
  assert.equal(won.result.created, true);
  assert.notEqual(won.result.applicationId, appId);
  assert.equal(won.db.tables.applications.length, 2);
});

test("applications are still added before the identity and job detail columns exist", async () => {
  const db = database({ job_opportunities: [savedJob()], resumes: [], applications: [] });
  db.fail("applications", "insert", { code: "PGRST204", message: "column not found" });
  const first = await service.applyToSavedJob(db, user, { opportunityId: jobId, appliedDate: "2026-11-10" });
  const row = db.tables.applications.find(a => a.id === first.applicationId);
  assert.equal(row.job_description, "Build things");
  assert.equal(row.salary_min, 120000, "job details survive when only identity columns are missing");
  assert.equal("posting_platform" in row, false);

  const older = database({ job_opportunities: [savedJob()], resumes: [], applications: [] });
  older.fail("applications", "insert", { code: "42703", message: "column does not exist" }, 2);
  const second = await service.applyToSavedJob(older, user, { opportunityId: jobId, appliedDate: "2026-11-10" });
  assert.equal(older.tables.applications.length, 1);
  const bare = older.tables.applications.find(a => a.id === second.applicationId);
  assert.equal(bare.job_description, "Build things");
  assert.equal("salary_min" in bare, false);
  assert.equal("posting_platform" in bare, false);

  const failing = database({ job_opportunities: [savedJob()], resumes: [], applications: [] });
  failing.fail("applications", "insert", { code: "42703", message: "column does not exist" }, 3);
  await assert.rejects(service.applyToSavedJob(failing, user, { opportunityId: jobId, appliedDate: "2026-11-10" }), e => e.code === "42703");
  assert.equal(failing.tables.applications.length, 0);
});

test("Tailor resume creates a resume aimed at the job and records it as the working resume", async () => {
  const db = database({ job_opportunities: [savedJob({ resume_id: null })], resumes: [] });
  let call;
  db.rpc = async (name, args) => { call = { name, args }; return { data: { id: jobId }, error: null }; };
  const { resumeId, created } = await service.startTailoredResume(db, user, jobId);
  assert.equal(created, true);
  const row = db.tables.resumes.find(r => r.id === resumeId);
  assert.equal(row.user_id, user);
  assert.equal(row.title, "Acme – Engineer");
  assert.deepEqual(row.content.target, { jobDescription: "Build things", applicationId: null, opportunityId: jobId, company: "Acme", role: "Engineer" });
  assert.deepEqual(call, { name: "save_job_opportunity", args: { p_user_id: user, p_payload: payload, p_resume_id: resumeId } });
  // With a working resume it opens that one
  const existing = database({ job_opportunities: [savedJob()], resumes: [{ id: resume, user_id: user }] });
  assert.deepEqual(await service.startTailoredResume(existing, user, jobId), { resumeId: resume, created: false });
  await assert.rejects(service.startTailoredResume(db, other, jobId), e => e.status === 404);
});

test("Tailor resume removes the new resume when it can't be recorded on the saved job", async () => {
  // The fake's own rpc: the function isn't installed
  const db = database({ job_opportunities: [savedJob({ resume_id: null })], resumes: [{ id: resume, user_id: user, title: "Keep me" }] });
  await assert.rejects(service.startTailoredResume(db, user, jobId), e => e.status === 503);
  assert.deepEqual(db.tables.resumes.map(r => r.id), [resume]);
});

test("createApplication fills empty fields from the matching saved job without overwriting typed ones", async () => {
  current = database({ job_opportunities: [savedJob()], resumes: [{ id: resume, user_id: user }, { id: otherJob, user_id: user }], applications: [] });
  const filled = await createApplication({ company: "Acme", portalLink: "https://boards.greenhouse.io/acme/jobs/123?gh_src=x", appliedDate: "" });
  assert.equal(filled.ok, true, filled.error);
  const row = current.tables.applications.find(a => a.id === filled.data.id);
  assert.equal(row.job_description, "Build things");
  assert.equal(row.resume_id, resume);
  assert.equal(row.salary_max, 150000);
  assert.equal(row.workplace_type, "remote");
  assert.equal("applied_date" in row, false, "a blank date is left to the column default");

  const typed = await createApplication({ company: "Acme", portalLink: link, jobDescription: "My notes", resumeId: otherJob, appliedDate: "2026-11-02" });
  const typedRow = current.tables.applications.find(a => a.id === typed.data.id);
  assert.equal(typedRow.job_description, "My notes");
  assert.equal(typedRow.resume_id, otherJob);
  assert.equal(typedRow.applied_date, "2026-11-02");

  const unrelated = await createApplication({ company: "Other", portalLink: "https://example.com/jobs/9", appliedDate: null });
  const unrelatedRow = current.tables.applications.find(a => a.id === unrelated.data.id);
  assert.equal(unrelatedRow.job_description, "");
  assert.equal(unrelatedRow.resume_id, null);
  assert.equal("salary_min" in unrelatedRow, false);
});

test("re-saving keeps the stored description, pay and resume unless the resume is explicitly cleared", async () => {
  const db = database({ job_opportunities: [savedJob()], resumes: [{ id: resume, user_id: user }] });
  const calls = [];
  db.rpc = async (name, args) => { calls.push(args); return { data: { id: jobId }, error: null }; };
  const recapture = { company: "Acme", role: "Engineer", url: link + "?utm=1", jobDescription: "" };
  const capture = input => service.saveOpportunity(db, user, service.opportunityInput.parse(input), { keepStored: true });
  await capture(recapture);
  assert.equal(calls[0].p_payload.job_description, "Build things");
  assert.equal(calls[0].p_payload.salary_min, 120000);
  assert.equal(calls[0].p_payload.workplace_type, "remote");
  assert.equal(calls[0].p_resume_id, resume);

  await capture({ ...recapture, resumeId: null, jobDescription: "Shorter but new" });
  assert.equal(calls[1].p_resume_id, null);
  assert.equal(calls[1].p_payload.job_description, "Shorter but new");

  // New pay replaces the stored range as a whole
  await capture({ ...recapture, salary: { min: 10, max: 20, currency: "EUR", period: "hour" } });
  assert.deepEqual([calls[2].p_payload.salary_min, calls[2].p_payload.salary_max, calls[2].p_payload.salary_currency, calls[2].p_payload.salary_period], [10, 20, "EUR", "hour"]);
});

test("the web editor is authoritative: a cleared description or workplace stays cleared", async () => {
  current = database({ job_opportunities: [savedJob()], resumes: [{ id: resume, user_id: user }] });
  const calls = [];
  current.rpc = async (name, args) => { calls.push(args); return { data: { id: jobId }, error: null }; };
  const { saveJob } = await import("@/features/opportunities/actions");
  const result = await saveJob({ company: "Acme", role: "Engineer", location: "", url: link, jobDescription: "", resumeId: resume, workplaceType: "" });
  assert.equal(result.ok, true, result.error);
  assert.equal(calls[0].p_payload.job_description, "");
  assert.equal("workplace_type" in calls[0].p_payload, false);
  assert.equal("salary_min" in calls[0].p_payload, false);
});

test("document targets keep the saved job and older documents load without one", () => {
  const target = { jobDescription: "JD", applicationId: null, opportunityId: jobId, company: "Acme", role: "Engineer" };
  assert.deepEqual(normalizeResumeContent({ target }).target, target);
  assert.equal(normalizeResumeContent({ target: { jobDescription: "JD", applicationId: null, company: "", role: "" } }).target.opportunityId, null);
  assert.equal(normalizeResumeContent(null).target.opportunityId, null);
  assert.deepEqual(normalizeLetter({ target }).target, target);
  assert.equal(normalizeLetter({}).target.opportunityId, null);
});

test("resume saves keep the target's saved job and reject a malformed one", async () => {
  const content = { ...normalizeResumeContent({ target: { jobDescription: "JD", applicationId: null, opportunityId: jobId, company: "", role: "" } }), revision: 3 };
  let saved;
  const db = { rpc: async (name, args) => { saved = args; return { data: { revision: 4 }, error: null }; } };
  await saveResumeDocument(db, resume, content);
  assert.equal(saved.p_content.target.opportunityId, jobId);
  const old = structuredClone(content); delete old.target.opportunityId;
  await saveResumeDocument(db, resume, old);
  assert.equal(saved.p_content.target.opportunityId, null);
  await assert.rejects(saveResumeDocument(db, resume, { ...content, target: { ...content.target, opportunityId: "bad" } }), e => e.status === 400);
});
