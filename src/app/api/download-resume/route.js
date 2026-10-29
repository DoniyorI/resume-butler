import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { attachmentHeader as attachment, errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { renderResume, renderResumeInput } from "@/server/resume/renderResume";

// Falls back to the .tex source when PDF compilation fails
import { createAdminClient } from "@/server/supabaseAdmin";
import { recordResumeExport } from "@/server/applications/submissions";

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const input = await parseJson(request, renderResumeInput);
    await enforceRateLimit(supabase, "download-resume");
    const { title, latex, pdf, content } = await renderResume(supabase, user.id, input);
    if (pdf) {
      // Preserve these exact compiled bytes, never a subsequent re-render.
      // Automatic page-fit checks use /api/resume-pages and do not archive files.
      const artifact = await recordResumeExport(createAdminClient(), user.id, { resumeId: input.resumeId, title, content, pdf });
      return new NextResponse(pdf, { headers: {
        "Content-Type": "application/pdf", "Content-Disposition": attachment(title, "pdf"),
        "Cache-Control": "private, no-store", "X-Resume-Artifact-Id": artifact.id, "X-Resume-SHA256": artifact.sha256,
      } });
    }
    return new NextResponse(latex, { headers: { "Content-Type": "application/x-tex", "Content-Disposition": attachment(title, "tex"), "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error, "Error generating resume"); }
}
