import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { printableResumeKey, hashPdfContentKey } from "@/features/resumes/pdfContentKey";
const content = { header: { name: "Synthetic QA" }, experience: [], skills: [] };
mock.module("@/server/auth", { namedExports: { requireUser: async () => ({ supabase: {}, user: { id: "qa-user" } }) } });
mock.module("@/server/rateLimit", { namedExports: { enforceRateLimit: async () => {} } });
mock.module("@/server/resume/renderResume", { namedExports: {
  renderResume: async () => ({ pdf: Buffer.from("synthetic compiled PDF"), content }),
  countPdfPages: () => 1,
} });
const { POST } = await import("@/app/api/resume-pages/route");
test("page confirmation identifies the exact saved content that was compiled", async () => {
  const response = await POST(new Request("http://localhost/api/resume-pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeId: "00000000-0000-4000-8000-000000000010" }) }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.pages, 1);
  assert.equal(result.contentKey, await hashPdfContentKey(printableResumeKey(content)));
});
