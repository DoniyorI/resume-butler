import "server-only";
import { z } from "zod";
import { HttpError } from "@/server/http";
import { generateCoverLetterLatex } from "@/server/latex";
import { compilePdf } from "@/server/resume/renderResume";
import { normalizeLetter } from "@/features/cover-letters/letterDocument";

export const renderCoverLetterInput = z.object({
  coverLetterId: z.string().uuid(),
  format: z.enum(["tex", "pdf"]).optional(),
});

/**
 * Render one of the user's cover letters. Returns { title, latex, pdf } where
 * pdf is an ArrayBuffer, or null when only .tex was asked for or compiling failed.
 */
export async function renderCoverLetter(supabase, userId, { coverLetterId, format }) {
  const { data, error } = await supabase
    .from("cover_letters")
    .select("title, content")
    .eq("id", coverLetterId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Cover letter not found");

  const latex = generateCoverLetterLatex(normalizeLetter(data.content));
  const pdf = format === "tex" ? null : await compilePdf(latex);
  return { title: data.title, latex, pdf };
}
