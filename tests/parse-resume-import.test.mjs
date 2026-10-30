import assert from "node:assert/strict";
import { mock, test } from "node:test";
let model;
mock.module("@/server/openai", { namedExports: { chatJSON: async () => model } });
const { parseResume } = await import("@/server/resume/parseResume");
const owner = "00000000-0000-4000-8000-000000000001";
const file = { buffer: Buffer.from("Fictional resume text for safe import verification."), fileName: "fixture.txt" };

test("resume parsing sends a bounded normalized payload to one atomic merge instead of appending", async () => {
  model = { education: [{ school: " Fixture University ", start_date: "2024-09", end_date: "2016", gpa: "bad" }], experience: [{ company: "Fixture", position: "Engineer", start_date: "2025-02-30", bullets: ["Built an API.", "  Built an API.  ", null, "Added tests"] }], projects: [], skills: ["Python", " Python ", { name: "SQL" }] };
  let received;
  const summary = { added: { education: 1, experience: 0, projects: 0, skills: 2 }, merged: { education: 0, experience: 1, projects: 0 }, bulletsAdded: 1, needsReview: { education: 0, experience: 0, projects: 0, bullets: 0 } };
  const db = { from() { throw new Error("Import must not issue append-only table writes"); }, rpc: async (name, args) => { received = { name, args }; return { data: summary, error: null }; } };
  const result = await parseResume(db, owner, file);
  assert.equal(received.name, "merge_resume_import");
  assert.equal("userId" in received.args, false);
  assert.equal(received.args.p_input.education[0].start_date, "2024-09-01");
  assert.equal(received.args.p_input.education[0].end_date, null);
  assert.equal(received.args.p_input.education[0].gpa, null);
  assert.equal(received.args.p_input.experience[0].start_date, null);
  assert.deepEqual(received.args.p_input.experience[0].bullets, ["Built an API.", "Added tests"]);
  assert.deepEqual(result.results, summary.added);
  assert.equal(result.merged.experience, 1);
  assert.equal(result.datesNeedingReview, 2);
});

test("missing merge setup fails before unsafe fallback writes", async () => {
  model = { education: [], experience: [], projects: [], skills: [] };
  await assert.rejects(parseResume({ rpc: async () => ({ data: null, error: { code: "PGRST202" } }), from() { throw new Error("No fallback writes"); } }, owner, file), e => e.status === 503);
});

test("merge failures surface instead of claiming a partially successful import", async () => {
  model = { education: [], experience: [], projects: [], skills: [] };
  await assert.rejects(parseResume({ rpc: async () => ({ data: null, error: { code: "XX000", message: "Synthetic transaction failure" } }) }, owner, file), e => e.code === "XX000");
});
