import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { HttpError } from "@/server/http";
const bytes = Buffer.from("%PDF-1.4\nFrozen returned bytes\n%%EOF\n");
const content = { header: { name: "Frozen source" } };
const resumeId = "22222222-2222-4222-8222-222222222222";
let archives = [], failArchive = false;
mock.module("@/server/auth", { namedExports: { requireUser: async () => ({ supabase: {}, user: { id: "own-user" } }) } });
mock.module("@/server/rateLimit", { namedExports: { enforceRateLimit: async () => {} } });
mock.module("@/server/supabaseAdmin", { namedExports: { createAdminClient: () => ({ trusted: true }) } });
mock.module("@/server/resume/renderResume", { namedExports: {
  renderResumeInput: (await import("zod")).z.object({ resumeId: (await import("zod")).z.string().uuid(), format: (await import("zod")).z.enum(["pdf", "tex"]) }),
  renderResume: async (db, user, input) => ({ title: "Test", latex: "source", pdf: input.format === "tex" ? null : bytes, content }),
} });
mock.module("@/server/applications/submissions", { namedExports: { recordResumeExport: async (admin, userId, value) => {
  if (failArchive) throw new HttpError(503, "Archive unavailable");
  archives.push({ admin, userId, value });
  return { id: "frozen-artifact", sha256: "frozen-hash" };
} } });
const { POST } = await import("@/app/api/download-resume/route");
const request = format => new Request("http://localhost/api/download-resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeId, format }) });

test("PDF download archives its returned bytes and source before responding; TeX is not labeled a PDF artifact", async () => {
  const response = await POST(request("pdf"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Resume-Artifact-Id"), "frozen-artifact");
  assert.equal(Buffer.from(await response.arrayBuffer()).equals(bytes), true);
  assert.equal(archives.length, 1);
  assert.equal(archives[0].value.pdf, bytes);
  assert.equal(archives[0].value.content, content);
  assert.equal(archives[0].userId, "own-user");
  assert.equal(archives[0].value.resumeId, resumeId);
  const source = await POST(request("tex"));
  assert.equal(source.headers.get("X-Resume-Artifact-Id"), null);
  assert.equal(await source.text(), "source");
  assert.equal(archives.length, 1);
});
test("an archive failure cannot return an apparently archived PDF", async () => {
  failArchive = true;
  const response = await POST(request("pdf"));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "Archive unavailable");
});
