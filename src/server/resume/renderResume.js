import "server-only";
import { z } from "zod";
import { HttpError } from "@/server/http";
import { generateLatex } from "@/server/latex";

// YtoTech LaTeX-on-HTTP: https://github.com/YtoTech/latex-on-http
const LATEX_COMPILE_URL = "https://latex.ytotech.com/builds/sync";

export const renderResumeInput = z.object({
  resumeId: z.string().uuid(),
  format: z.enum(["tex", "pdf"]).optional(),
});

async function compilePdf(latex) {
  const response = await fetch(LATEX_COMPILE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compiler: "pdflatex", resources: [{ main: true, content: latex }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    console.error("LaTeX compilation failed:", await response.text());
    return null;
  }
  return response.arrayBuffer();
}

/**
 * Render one of the user's resumes. Returns { title, latex, pdf } where pdf is
 * an ArrayBuffer, or null when only .tex was asked for or compilation failed.
 */
export async function renderResume(supabase, userId, { resumeId, format }) {
  const { data: resume, error } = await supabase
    .from("resumes")
    .select("title, content")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!resume) throw new HttpError(404, "Resume not found");

  const latex = generateLatex(resume.content || {});
  const pdf = format === "tex" ? null : await compilePdf(latex);
  return { title: resume.title, latex, pdf };
}
