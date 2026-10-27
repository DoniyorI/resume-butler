import "server-only";
import { inflateSync } from "node:zlib";
import { z } from "zod";
import { HttpError } from "@/server/http";
import { generateLatex } from "@/server/latex";

// YtoTech LaTeX-on-HTTP: https://github.com/YtoTech/latex-on-http
const LATEX_COMPILE_URL = "https://latex.ytotech.com/builds/sync";

export const renderResumeInput = z.object({
  resumeId: z.string().uuid(),
  format: z.enum(["tex", "pdf"]).optional(),
});

export async function compilePdf(latex) {
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

/**
 * Number of pages in a compiled PDF. pdflatex stores the page tree in
 * compressed object streams, so streams are inflated and searched for the
 * root /Pages object's /Count. Returns null if it can't be found.
 */
export function countPdfPages(pdf) {
  const bytes = Buffer.from(pdf);
  const text = bytes.toString("latin1");
  const chunks = [text];
  for (const match of text.matchAll(/<<([^]*?)>>\s*stream\r?\n/g)) {
    const length = Number(match[1].match(/\/Length\s+(\d+)/)?.[1]);
    if (!length || !/FlateDecode/.test(match[1])) continue;
    const start = match.index + match[0].length;
    try {
      chunks.push(inflateSync(bytes.subarray(start, start + length)).toString("latin1"));
    } catch {
      // Not every stream inflates on its own (e.g. images); they don't hold the page tree
    }
  }
  const counts = chunks.flatMap((chunk) =>
    [
      ...chunk.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g),
    ].map((m) => Number(m[1] || m[2]))
  );
  return counts.length ? Math.max(...counts) : null;
}
