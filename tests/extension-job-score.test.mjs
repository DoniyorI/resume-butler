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

// ---------- fit ----------

const { fitSummary } = await import("@/server/fit/fitSummary");
const posting = "Requirements: Python, Docker, PostgreSQL, Kubernetes. Nice to have: Terraform, Kafka. We cannot sponsor visas for this role.";
const secrets = ["Private Company", "Hidden Bullet Secret", "SecretProject"];
const cvRows = () => ({
  profiles: [{ id: owner, cv_sections: { revision: 0, titles: {}, customSections: [{ id: "custom:00000000-0000-4000-8000-000000000099", title: "Private Company", type: "text", items: [{ id: resumeId, text: "Hidden Bullet Secret: built SecretProject services in Python and Docker" }] }] } }],
  cv_skills: [{ user_id: owner, name: "PostgreSQL" }],
});
const expectedKeys = ["band", "reason", "counts", "missing", "listed", "preferredMissing", "notShown", "years", "degree", "language", "checks"];

test("fit for a resume source has the contract's shape and the resume's gaps", async () => {
  const result = await getJobScore(database({ resumes: [resume()], ...cvRows() }), owner, { jobDescription: posting, resumeId });
  assert.deepEqual(Object.keys(result.fit).sort(), [...expectedKeys].sort());
  assert.equal(result.fit.counts.required.total, 4);
  assert.deepEqual(result.fit.missing, ["Kubernetes"]);
  assert.deepEqual(result.fit.listed, ["PostgreSQL"]);
  assert.deepEqual(result.fit.preferredMissing, ["Terraform", "Kafka"]);
  // Backed by the Master CV, absent from the selected resume (which lists only Python)
  assert.deepEqual(result.fit.notShown, ["PostgreSQL", "Docker"]);
  assert.deepEqual(Object.keys(result.fit.years).sort(), ["have", "required", "status"]);
  assert.equal(result.fit.degree.status, "not-stated");
  assert.ok(result.fit.checks.length > 0 && result.fit.checks.every((c) => c.kind && /visa/i.test(c.quote)));
  // Existing fields are unchanged
  assert.equal(result.method, "keyword-coverage-v1");
  assert.equal(result.source.type, "resume");
});

test("fit for the Master CV source has no notShown", async () => {
  const result = await getJobScore(database(cvRows()), owner, { jobDescription: posting, resumeId: null });
  assert.equal(result.source.type, "master-cv");
  assert.equal(result.fit.notShown, null);
  assert.deepEqual(result.fit.missing, ["Kubernetes"]);
});

test("the response carries no text from the user's CV, fit included", async () => {
  for (const resumeIdInput of [resumeId, null]) {
    const result = await getJobScore(database({ resumes: [resume()], ...cvRows() }), owner, { jobDescription: posting, resumeId: resumeIdInput });
    assert.ok(result.fit);
    const text = JSON.stringify(result);
    for (const secret of secrets) assert.equal(text.includes(secret), false, secret);
    assert.equal(JSON.stringify(result.fit).includes("Python and Docker"), false);
  }
});

test("fit is null, and the rest still returned, when the engine throws", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const result = await getJobScore(database({ resumes: [resume()] }), owner, { jobDescription: description, resumeId }, {
      assess: () => { throw new Error("boom"); },
    });
    assert.equal(result.fit, null);
    assert.ok(result.matched.includes("python"));
    assert.equal(result.source.type, "resume");
  } finally { console.error = original; }
});

test("fitSummary caps its lists and keeps only readable names, counts and posting quotes", () => {
  const req = (term, importance, strength) => ({ term, label: term.toUpperCase(), importance, strength, evidence: [{ quote: "private quote", label: "Private Co" }] });
  const many = (n, importance, strength) => Array.from({ length: n }, (_, i) => req(`t${importance[0]}${strength[0]}${i}`, importance, strength));
  const summary = fitSummary({
    band: "low",
    reason: "r",
    counts: { required: { total: 30, demonstrated: 0, listed: 10, missing: 20 }, preferred: { total: 10, demonstrated: 0, listed: 0, missing: 10 } },
    requirements: [...many(20, "required", "missing"), ...many(10, "required", "listed"), ...many(10, "preferred", "missing")],
    years: { required: 3, have: 1, status: "short" },
    degree: { required: "bachelor's degree", status: "short", inProgress: true },
    language: { required: ["Korean", "Japanese"], missing: ["Korean"], status: "short", extra: "x" },
    checks: [{ kind: "onsite", quote: "Onsite 3 days", extra: "x" }],
    resume: { shown: [], notShown: Array.from({ length: 12 }, (_, i) => `tl${i}`) },
  });
  assert.equal(summary.missing.length, 8);
  assert.equal(summary.listed.length, 8);
  assert.equal(summary.preferredMissing.length, 6);
  assert.equal(summary.notShown.length, 8);
  assert.equal(summary.notShown[0], "Tl0");
  assert.deepEqual(summary.degree, { required: "Bachelor's degree", status: "short", inProgress: true });
  assert.deepEqual(summary.checks, [{ kind: "onsite", quote: "Onsite 3 days" }]);
  assert.deepEqual(summary.language, { required: ["Korean", "Japanese"], missing: ["Korean"], status: "short" });
  assert.equal(JSON.stringify(summary).includes("private quote"), false);
  assert.equal(JSON.stringify(summary).includes("Private Co"), false);
  assert.equal(fitSummary(null), null);
});
