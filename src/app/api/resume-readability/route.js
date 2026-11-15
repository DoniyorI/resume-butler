import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { HttpError, errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { renderResume } from "@/server/resume/renderResume";
import { extractPdfPages } from "@/server/resume/pdfText";
import { checkReadability } from "@/server/resume/readability";

const bodySchema = z.object({ resumeId: z.string().uuid() });
const MAX_EXTRACTED_CHARS = 50_000;

// Compiles the saved resume, reads the text back out of the PDF and reports which of the
// resume's own lines were found. Counts against the download limit.
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const { resumeId } = await parseJson(request, bodySchema);
    await enforceRateLimit(supabase, "download-resume");

    const { pdf, content } = await renderResume(supabase, user.id, { resumeId, format: "pdf" });
    if (!pdf) throw new HttpError(502, "The PDF could not be compiled right now. Try again in a minute.");

    let pages;
    try {
      pages = await extractPdfPages(Buffer.from(pdf));
    } catch (error) {
      console.error("PDF text extraction failed:", error);
      throw new HttpError(502, "The text could not be read from the PDF right now. Try again in a minute.");
    }
    const result = checkReadability(content, pages.join("\n"), { pages: pages.length });
    return NextResponse.json({ ...result, extractedText: result.extractedText.slice(0, MAX_EXTRACTED_CHARS) });
  } catch (error) {
    return errorResponse(error, "Error checking PDF readability");
  }
}
