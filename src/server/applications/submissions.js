import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpError } from "@/server/http";

export const MAX_ARTIFACT_BYTES = 3 * 1024 * 1024;
const uuid = z.string().uuid();
const recordedDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use a valid submission date");
export const submissionInput = z.object({
  eventId: uuid, applicationId: uuid, kind: z.enum(["export", "upload", "selected", "unknown"]),
  artifactId: uuid.nullable().default(null), resumeId: uuid.nullable().default(null),
  submittedOn: recordedDate, supersedesId: uuid.nullable().default(null),
  notes: z.string().trim().max(5000).default(""),
  answers: z.array(z.object({ question: z.string().max(1000), answer: z.string().max(10000) })).max(30).default([]),
  answerSelections: z.array(z.object({ id: uuid, revision: z.number().int().min(1) }).strict()).max(20).default([]),
}).superRefine((input, context) => {
  if (new Set(input.answerSelections.map(item => item.id)).size !== input.answerSelections.length || input.answerSelections.length + input.answers.length > 30) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["answerSelections"], message: "Choose each answer once, with at most 30 answers total." });
  }
  if (input.kind === "export" ? !input.artifactId || input.resumeId : input.kind === "selected" ? !input.resumeId || input.artifactId : input.artifactId || input.resumeId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose one source for this recorded version." });
  }
});

export function preparePdfArtifact(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  if (bytes.length > MAX_ARTIFACT_BYTES) throw new HttpError(413, "Use a PDF no larger than 3 MB.");
  // File signature checks only; this is byte preservation, not a malware scan
  // or a claim that every PDF viewer can render an uploaded document.
  if (bytes.length < 16 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-" || !bytes.subarray(-2048).includes(Buffer.from("%%EOF"))) {
    throw new HttpError(400, "Choose a complete PDF file.");
  }
  return { pdfHex: "\\x" + bytes.toString("hex"), sha256: createHash("sha256").update(bytes).digest("hex"), sizeBytes: bytes.length };
}

export function archiveError(error) {
  if (["PGRST202", "42883", "42703", "42P01", "PGRST205"].includes(error?.code)) throw new HttpError(503, "Submission archive setup is pending (migration 015). Your version has not been recorded; please retry after setup.");
  if (error?.code === "P0002") throw new HttpError(404, "That application, file or resume is no longer available.");
  if (error?.code === "PT409") throw new HttpError(409, "A selected answer changed or is no longer approved. Review and reselect the latest approved version.");
  if (error?.code === "55000") throw new HttpError(409, "This capture request changed. Review the details and create a new record.");
  if (error?.code === "22023") throw new HttpError(400, "Check the file and submission details.");
  if (error?.code === "54000") throw new HttpError(507, "Your private PDF archive has reached its 200 MB capacity. Existing records are safe. Contact the app operator to increase capacity.");
  if (error) throw new Error(`Submission archive operation failed (${error.code || "unknown"})`);
}

export async function recordResumeExport(admin, userId, { resumeId, title, content, pdf }) {
  const artifact = preparePdfArtifact(pdf);
  const { data, error } = await admin.rpc("record_resume_export", {
    p_user_id: userId, p_event_id: randomUUID(), p_resume_id: resumeId,
    p_title: title, p_content: content, p_pdf: artifact.pdfHex, p_sha256: artifact.sha256,
  });
  archiveError(error);
  if (!uuid.safeParse(data?.id).success) throw new Error("Invalid PDF archive result");
  return data;
}

export async function captureSubmission(admin, userId, input, { bytes, fileName } = {}) {
  if (input.kind === "upload" && !bytes) throw new HttpError(400, "Choose the PDF you submitted.");
  if (input.kind !== "upload" && bytes) throw new HttpError(400, "Choose upload mode to attach a PDF.");
  const artifact = bytes ? preparePdfArtifact(bytes) : null;
  const filename = fileName ? String(fileName).replace(/[\r\n\\/]/g, "-").replace(/\.pdf$/i, "").slice(0, 196) + ".pdf" : null;
  const intent = { ...input, pdfSha256: artifact?.sha256 || null, filename };
  // Empty new fields must not invalidate already accepted A4 retry fingerprints.
  if (!input.answerSelections?.length) delete intent.answerSelections;
  const requestHash = createHash("sha256").update(JSON.stringify(intent)).digest("hex");
  const { data, error } = await admin.rpc("capture_application_submission", {
    p_user_id: userId, p_event_id: input.eventId,
    p_input: { ...intent, requestHash }, p_pdf: artifact?.pdfHex || null,
  });
  archiveError(error);
  if (!uuid.safeParse(data?.id).success) throw new Error("Invalid submission archive result");
  return data;
}

export async function readSubmissionRequest(request) {
  const type = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data;/i.test(type) || !request.body) throw new HttpError(400, "Use the submission form to record a version.");
  const limit = 4 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw new HttpError(413, "Request is too large. Use a PDF no larger than 3 MB.");
  const reader = request.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large. Use a PDF no larger than 3 MB.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let form, raw;
  try {
    form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData();
    raw = JSON.parse(form.get("record"));
  } catch { throw new HttpError(400, "The submission form could not be read. Please try again."); }
  const parsed = submissionInput.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
  const file = form.get("pdf");
  return { input: parsed.data, file: file && typeof file.arrayBuffer === "function" ? file : null };
}

export function decodeArtifact(row) {
  if (typeof row.pdf_bytes !== "string" || !/^\\x(?:[0-9a-f]{2})+$/i.test(row.pdf_bytes)) throw new Error("Invalid stored PDF bytes");
  const bytes = Buffer.from(row.pdf_bytes.slice(2), "hex");
  if (bytes.length !== row.size_bytes || createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error("Stored PDF integrity check failed");
  return bytes;
}
