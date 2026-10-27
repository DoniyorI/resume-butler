import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { HttpError, errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { renderCoverLetter } from "@/server/resume/renderCoverLetter";
import { countPdfPages } from "@/server/resume/renderResume";

const bodySchema = z.object({ coverLetterId: z.string().uuid() });

// Compiles the saved cover letter and returns the PDF's page count, so the
// editor can confirm its estimate. Counts against the download limit.
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const { coverLetterId } = await parseJson(request, bodySchema);
    await enforceRateLimit(supabase, "download-resume");

    const { pdf } = await renderCoverLetter(supabase, user.id, { coverLetterId, format: "pdf" });
    const pages = pdf ? countPdfPages(pdf) : null;
    if (!pages) throw new HttpError(502, "Couldn't build the PDF right now. Try again in a minute.");
    return NextResponse.json({ pages });
  } catch (error) {
    return errorResponse(error, "Error checking cover letter pages");
  }
}
