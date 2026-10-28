import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { HttpError, errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { countPdfPages, renderResume } from "@/server/resume/renderResume";
import { printableResumeKey, hashPdfContentKey } from "@/features/resumes/pdfContentKey";

const bodySchema = z.object({ resumeId: z.string().uuid() });

// Compiles the saved resume and says how many pages the PDF has, so the editor
// can confirm its on-screen estimate. Counts against the download limit.
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const { resumeId } = await parseJson(request, bodySchema);
    await enforceRateLimit(supabase, "download-resume");

    const { pdf, content } = await renderResume(supabase, user.id, { resumeId, format: "pdf" });
    const pages = pdf ? countPdfPages(pdf) : null;
    if (!pages) throw new HttpError(502, "Couldn't build the PDF right now. Try again in a minute.");
    const contentKey = await hashPdfContentKey(printableResumeKey(content));
    return NextResponse.json({ pages, contentKey });
  } catch (error) {
    return errorResponse(error, "Error checking resume pages");
  }
}
