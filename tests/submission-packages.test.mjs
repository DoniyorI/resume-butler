import assert from "node:assert/strict";
import { test } from "node:test";
const load = () => import("../src/server/applications/submissions.js");
const user = "11111111-1111-4111-8111-111111111111";
const resume = "22222222-2222-4222-8222-222222222222";
const event = "33333333-3333-4333-8333-333333333333";
const pdf = Buffer.from("%PDF-1.4\nFictional QA bytes\n%%EOF\n");

test("artifact preparation preserves exact bytes and rejects oversized/non-PDF input", async () => {
  const { preparePdfArtifact, decodeArtifact, MAX_ARTIFACT_BYTES } = await load();
  const artifact = preparePdfArtifact(pdf);
  assert.equal(artifact.pdfHex, "\\x255044462d312e340a46696374696f6e616c2051412062797465730a2525454f460a");
  assert.equal(artifact.sizeBytes, 34);
  assert.equal(artifact.sha256.length, 64);
  const stored = { pdf_bytes: artifact.pdfHex, size_bytes: artifact.sizeBytes, sha256: artifact.sha256 };
  assert.equal(decodeArtifact(stored).equals(pdf), true);
  assert.throws(() => decodeArtifact({ ...stored, sha256: "0".repeat(64) }), /integrity/);
  assert.throws(() => decodeArtifact({ ...stored, size_bytes: 1 }), /integrity/);
  assert.throws(() => preparePdfArtifact(Buffer.from("<html>not a PDF</html>")), e => e.status === 400);
  assert.throws(() => preparePdfArtifact(Buffer.alloc(MAX_ARTIFACT_BYTES + 1)), e => e.status === 413);
});

test("an export archives the same returned PDF and content snapshot without recompiling", async () => {
  const { recordResumeExport } = await load();
  let sent;
  const admin = { rpc: async (name, args) => { sent = { name, args }; return { data: { id: event }, error: null }; } };
  const content = { schemaVersion: 2, header: { name: "Fictional QA" } };
  await recordResumeExport(admin, user, { resumeId: resume, title: "Exported copy", content, pdf });
  assert.equal(sent.name, "record_resume_export");
  assert.equal(sent.args.p_user_id, user);
  assert.equal(sent.args.p_resume_id, resume);
  assert.deepEqual(sent.args.p_content, content);
  assert.equal(Buffer.from(sent.args.p_pdf.slice(2), "hex").equals(pdf), true);
});

test("capture requires an explicit source and fails safely before archive setup", async () => {
  const { submissionInput, captureSubmission } = await load();
  const base = { eventId: event, applicationId: resume, submittedOn: "2026-10-29" };
  assert.equal(submissionInput.safeParse(base).success, false);
  assert.equal(submissionInput.safeParse({ ...base, kind: "export" }).success, false);
  assert.equal(submissionInput.safeParse({ ...base, kind: "selected", resumeId: resume }).success, true);
  assert.equal(submissionInput.safeParse({ ...base, kind: "unknown", artifactId: event }).success, false);
  const admin = { rpc: async () => ({ error: { code: "PGRST202" } }) };
  await assert.rejects(captureSubmission(admin, user, submissionInput.parse({ ...base, kind: "unknown" })), e => e.status === 503);
  await assert.rejects(captureSubmission(admin, user, submissionInput.parse({ ...base, kind: "upload" })), e => e.status === 400);
});

test("retry fingerprints bind selected intent and exact uploaded bytes", async () => {
  const { submissionInput, captureSubmission } = await load();
  const hashes = [];
  const admin = { rpc: async (name, args) => { hashes.push(args.p_input.requestHash); return { data: { id: event }, error: null }; } };
  const input = submissionInput.parse({ eventId: event, applicationId: resume, submittedOn: "2026-10-29", kind: "upload" });
  await captureSubmission(admin, user, input, { bytes: pdf, fileName: "actual.pdf" });
  await captureSubmission(admin, user, input, { bytes: pdf, fileName: "actual.pdf" });
  await captureSubmission(admin, user, { ...input, notes: "Correction" }, { bytes: pdf, fileName: "actual.pdf" });
  assert.equal(hashes[0], hashes[1]);
  assert.notEqual(hashes[0], hashes[2]);
});

// Request parsing must enforce a streamed limit before buffering multipart input.
test("upload parsing bounds a body with no declared content length", async () => {
  const { readSubmissionRequest } = await load();
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { cancelled = true; },
  });
  const request = new Request("https://example.test/api/submissions", { method: "POST", body: stream, duplex: "half", headers: { "Content-Type": "multipart/form-data; boundary=qa" } });
  await assert.rejects(readSubmissionRequest(request), e => e.status === 413);
  assert.equal(cancelled, true);
});
