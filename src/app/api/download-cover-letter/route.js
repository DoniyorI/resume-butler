import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { attachmentHeader, errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { renderCoverLetter, renderCoverLetterInput } from "@/server/resume/renderCoverLetter";

// Falls back to the .tex source when PDF compilation fails. Shares the
// download limit with resumes.
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const input = await parseJson(request, renderCoverLetterInput);
    await enforceRateLimit(supabase, "download-resume");

    const { title, latex, pdf } = await renderCoverLetter(supabase, user.id, input);
    return pdf
      ? new NextResponse(pdf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": attachmentHeader(title, "pdf", "cover-letter"),
          },
        })
      : new NextResponse(latex, {
          headers: {
            "Content-Type": "application/x-tex",
            "Content-Disposition": attachmentHeader(title, "tex", "cover-letter"),
          },
        });
  } catch (error) {
    return errorResponse(error, "Error generating cover letter");
  }
}
