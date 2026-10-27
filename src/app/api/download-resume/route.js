import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { attachmentHeader as attachment, errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { renderResume, renderResumeInput } from "@/server/resume/renderResume";

// Falls back to the .tex source when PDF compilation fails
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const input = await parseJson(request, renderResumeInput);
    await enforceRateLimit(supabase, "download-resume");

    const { title, latex, pdf } = await renderResume(supabase, user.id, input);

    return pdf
      ? new NextResponse(pdf, {
          headers: { "Content-Type": "application/pdf", "Content-Disposition": attachment(title, "pdf") },
        })
      : new NextResponse(latex, {
          headers: { "Content-Type": "application/x-tex", "Content-Disposition": attachment(title, "tex") },
        });
  } catch (error) {
    return errorResponse(error, "Error generating resume");
  }
}
