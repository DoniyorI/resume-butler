import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeImport } from "@/features/profile/importSummary";
test("import feedback distinguishes new entries, matched entries and unique bullets", () => {
  const result = summarizeImport({ results: { education: 1, experience: 0, projects: 0, skills: 2 }, merged: { education: 0, experience: 1, projects: 0 }, bulletsAdded: 2 });
  assert.equal(result.headline, "Resume imported");
  assert.deepEqual(result.lines, ["3 new entries · 1 existing entry matched · 2 unique bullets added"]);
});
test("repeated imports and review items do not claim new data was added", () => {
  const result = summarizeImport({ results: {}, merged: { experience: 2 }, bulletsAdded: 0, needsReview: { experience: 1, bullets: 2 }, datesNeedingReview: 1 });
  assert.equal(result.headline, "No duplicate entries added");
  assert.ok(result.lines.some(line => line.includes("1 entry needs review")));
  assert.ok(result.lines.some(line => line.includes("2 bullets")));
  assert.ok(result.lines.some(line => line.includes("1 imported date")));
});
