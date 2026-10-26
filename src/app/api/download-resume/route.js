import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { renderResume, renderResumeInput } from "@/server/resume/renderResume";

// Build a Content-Disposition header that a resume title can't break out of
function attachment(title, extension) {
  const base = (title || "resume").replace(/[^\w .-]/g, "").trim().slice(0, 100) || "resume";
  const filename = `${base}.${extension}`;
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

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
