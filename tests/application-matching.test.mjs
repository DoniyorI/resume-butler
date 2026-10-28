import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePostingIdentity } from "@/lib/postingIdentity";
import { matchSubmittedOpening } from "@/server/applications/matching";

const now = Date.parse("2026-10-28T12:00:00Z");
const app = (fields = {}) => ({ id: "a", company: "Acme Inc.", role: "Backend Engineer", status: "Applied", applied_date: "2026-10-20", ...fields });
const match = (rows, url = "https://job-boards.greenhouse.io/acme/jobs/123") => matchSubmittedOpening(rows, {
  identity: normalizePostingIdentity({ url }), company: "Acme", role: "Backend Engineer", now,
});

test("equal company/title cannot merge distinct posting URLs", () => {
  assert.equal(match([app({ portal_link: "https://job-boards.greenhouse.io/acme/jobs/456" })]).kind, "new");
});
test("equivalent embedded and board URLs reuse the same current opening", () => {
  assert.deepEqual(match([app({ portal_link: "https://boards.greenhouse.io/embed/job_app?for=acme&token=123" })]), {
    kind: "matched", applicationId: "a", reason: "posting_identity",
  });
});
test("equal numeric IDs on different employer boards never merge", () => {
  assert.equal(match([app({ portal_link: "https://boards.greenhouse.io/other/jobs/123" })]).kind, "new");
});
test("an explicit stored identity conflict prevents a URL-based merge", () => {
  assert.equal(match([app({ posting_platform: "greenhouse", posting_namespace: "acme", posting_id: "456", portal_link: "https://job-boards.greenhouse.io/acme/jobs/123" })]).kind, "ambiguous");
});
test("multiple legacy same-title candidates require a choice", () => {
  assert.deepEqual(match([app(), app({ id: "b" })]), { kind: "ambiguous", candidateIds: ["a", "b"], reason: "multiple_candidates" });
});
test("a single legacy candidate without a conflicting link may be reused", () => {
  assert.equal(match([app()]).applicationId, "a");
});
test("unknown URLs that differ in a requisition query remain separate", () => {
  assert.equal(match([app({ portal_link: "https://example.test/job?req=456" })], "https://example.test/job?req=123").kind, "new");
});
test("one strong match beats an unrelated same-title opening", () => {
  assert.equal(match([app({ id: "other", portal_link: "https://boards.greenhouse.io/acme/jobs/456" }), app({ portal_link: "https://boards.greenhouse.io/acme/jobs/123" })]).applicationId, "a");
});
for (const fields of [{ status: "Rejected" }, { status: "Withdrew" }, { applied_date: "2026-01-01" }]) {
  test(`a fresh event creates a new cycle for ${JSON.stringify(fields)}`, () => {
    assert.equal(match([app({ portal_link: "https://boards.greenhouse.io/acme/jobs/123", ...fields })]).kind, "new");
  });
}
test("unrelated companies do not match by a shared role", () => assert.equal(match([app({ company: "Acme Labs" })]).kind, "new"));
test("multiple rows with the same posting identity remain unresolved", () => {
  const portal_link = "https://boards.greenhouse.io/acme/jobs/123";
  assert.equal(match([app({ portal_link }), app({ id: "b", portal_link })]).kind, "ambiguous");
});
