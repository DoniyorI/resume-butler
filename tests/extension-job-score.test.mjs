import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";
import { getJobScore, jobScoreInput } from "@/server/extension/jobScore";

const owner = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002";
const resumeId = "00000000-0000-4000-8000-000000000010";
const description = "Build backend APIs using Python, Docker and PostgreSQL.";
const resume = (user_id = owner) => ({ id: resumeId, user_id, title: "Backend resume", content: { skills: [{ header: "Languages", skills: "Python" }], experience: [], projects: [], education: [] } });

test("job comparison returns keyword coverage from the owned resume, not the overall ATS score", async () => {
  const result = await getJobScore(database({ resumes: [resume()] }), owner, { jobDescription: description, resumeId });
  assert.equal(result.source.title, "Backend resume");
  assert.equal(result.source.type, "resume");
  assert.ok(result.matched.includes("python"));
  assert.ok(result.missing.includes("docker"));
  assert.equal(result.score, Math.round(result.matched.length / result.totalKeywords * 100));
  assert.equal("content" in result, false);
});

test("foreign or deleted resume choices cannot be scored", async () => {
  await assert.rejects(getJobScore(database({ resumes: [resume(other)] }), owner, { jobDescription: description, resumeId }), e => e.status === 404);
});

test("hidden resume sections cannot inflate job coverage", async () => {
  const row = resume(); row.content.projects = [{ projectName: "Docker", description: ["PostgreSQL backend"] }];
  row.content.order = [{ id: "skills", title: "Skills" }, { id: "projects", title: "Projects", hidden: true }];
  const result = await getJobScore(database({ resumes: [row] }), owner, { jobDescription: description, resumeId });
  assert.deepEqual(result.matched, ["python"]);
});

test("Master CV comparison maps owned skills, bullets, certifications and custom sections", async () => {
  const db = database({
    profiles: [{ id: owner, cv_sections: { revision: 0, titles: {}, customSections: [{ id: "custom:00000000-0000-4000-8000-000000000099", title: "Training", type: "text", items: [{ id: resumeId, text: "Docker" }] }] } }],
    cv_skills: [{ user_id: other, name: "PostgreSQL" }, { user_id: owner, name: "Python" }],
    cv_experience: [{ user_id: owner, company: "Private Company", cv_experience_bullets: [{ content: "Built backend APIs", sort_order: 0 }] }],
    cv_certifications: [{ user_id: owner, name: "AWS" }],
  });
  const result = await getJobScore(db, owner, { jobDescription: description, resumeId: null });
  assert.equal(result.source.type, "master-cv");
  assert.ok(result.matched.includes("python"));
  assert.ok(result.matched.includes("docker"));
  assert.ok(result.missing.includes("postgresql"));
  assert.equal(JSON.stringify(result).includes("Private Company"), false);
});

test("empty sources fail clearly and descriptions without recognized terms have no numeric score", async () => {
  await assert.rejects(getJobScore(database({ resumes: [{ ...resume(), content: {} }] }), owner, { jobDescription: description, resumeId }), e => e.status === 422);
  const result = await getJobScore(database({ resumes: [resume()] }), owner, { jobDescription: "We value thoughtful collaboration and curiosity every day.", resumeId });
  assert.equal(result.score, null); assert.equal(result.totalKeywords, 0);
});

test("score requests reject empty/oversized descriptions, foreign selectors and invalid IDs", () => {
  assert.equal(jobScoreInput.safeParse({ jobDescription: description, resumeId: null }).success, true);
  for (const input of [{ jobDescription: "" }, { jobDescription: "x".repeat(50001) }, { jobDescription: description, userId: other }, { jobDescription: description, resumeId: "bad" }]) {
    assert.equal(jobScoreInput.safeParse(input).success, false);
  }
});
