import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";

const user = "11111111-1111-4111-8111-111111111111";
const resume = "22222222-2222-4222-8222-222222222222";
const input = { company: "QA", role: "Engineer", url: "https://boards.greenhouse.io/acme/jobs/123?gh_src=tracking", detectedBy: "greenhouse", postingId: "123", jobDescription: "A real description" };
const load = () => import("../src/server/opportunities/service.js");

test("reopening an equivalent posting restores its owned saved details and resume choice", async () => {
  const { getOpportunityForUrl } = await load();
  const db = database({ job_opportunities: [
    { id: "mine", user_id: user, identity_key: "greenhouse:acme:123", resume_id: resume, payload: { company: "Corrected" } },
    { id: "theirs", user_id: "other", identity_key: "greenhouse:acme:123", resume_id: "private", payload: { company: "Other" } },
  ] });
  assert.deepEqual(await getOpportunityForUrl(db, user, input.url), { id: "mine", resume_id: resume, payload: { company: "Corrected" } });
  assert.equal(await getOpportunityForUrl(db, user, "javascript:bad"), null);
});

test("saved job input rejects unsafe links, empty company and invalid resume IDs", async () => {
  const { opportunityInput } = await load();
  assert.equal(opportunityInput.safeParse(input).success, true);
  for (const patch of [{ url: "javascript:alert(1)" }, { company: " " }, { resumeId: "other" }, { jobDescription: "x".repeat(50001) }]) {
    assert.equal(opportunityInput.safeParse({ ...input, ...patch }).success, false);
  }
});

test("saving normalizes posting identity and validates selected resume ownership", async () => {
  const { saveOpportunity, opportunityInput } = await load();
  const db = database({ resumes: [{ id: resume, user_id: user, title: "CS resume" }] });
  let saved;
  db.rpc = async (name, args) => { saved = { name, args }; return { data: { id: resume }, error: null }; };
  await saveOpportunity(db, user, opportunityInput.parse({ ...input, resumeId: resume }));
  assert.equal(saved.name, "save_job_opportunity");
  assert.equal(saved.args.p_user_id, user);
  assert.equal(saved.args.p_payload.portal_link, "https://job-boards.greenhouse.io/acme/jobs/123");
  assert.equal(saved.args.p_resume_id, resume);
  assert.equal(saved.args.p_payload.job_description, input.jobDescription);
  await assert.rejects(saveOpportunity(db, "33333333-3333-4333-8333-333333333333", opportunityInput.parse({ ...input, resumeId: resume })), e => e.status === 404);
});

test("saved jobs fail safely before migration and list only owned resume metadata", async () => {
  const { saveOpportunity, opportunityInput, listResumeChoices } = await load();
  const db = database({ resumes: [{ id: resume, user_id: user, title: "Selected", content: { private: true } }, { id: "foreign", user_id: "other", title: "Other account" }] });
  await assert.rejects(saveOpportunity(db, user, opportunityInput.parse(input)), e => e.status === 503);
  assert.deepEqual(await listResumeChoices(db, user), [{ id: resume, title: "Selected" }]);
});
