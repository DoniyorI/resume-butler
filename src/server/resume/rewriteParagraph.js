import "server-only";
import { z } from "zod";
import { chatJSON } from "@/server/openai";
import { checkRewrite, technologies } from "@/server/resume/guardrails";

const REWRITE_PROMPT = `You rewrite one paragraph of a cover letter three ways. Keep the writer's facts: never add or swap a technology, tool, employer, job title, result or number, and don't add claims the paragraph doesn't make. Never give the writer the job's title: they had the titles their CV says. Plain text, no markdown.

Variants:
- "stronger": more confident and specific, leading with what the writer achieved
- "tailored": where the paragraph already covers something the job description asks for, use the job's wording for it (if there is no job description, make it clearer instead)
- "shorter": the same points in about two thirds of the words

Return JSON: { "stronger": "...", "tailored": "...", "shorter": "..." }`;

const VARIANTS = [
  { key: "stronger", label: "Stronger" },
  { key: "tailored", label: "Tailored to the job" },
  { key: "shorter", label: "Shorter" },
];

export const rewriteParagraphInput = z.object({
  text: z.string().trim().min(1, "Write the paragraph first").max(3000),
  jobDescription: z.string().max(20_000).default(""),
});

// Returns { variants: [{ label, text }] }. Rewording a paragraph drops and
// reorders words, so only the technology check applies: a variant that names
// a technology the paragraph didn't is left out.
export async function rewriteParagraph({ text, jobDescription }) {
  const job = jobDescription.trim() ? `Job description:\n${jobDescription}\n\n` : "";
  const tech = [...technologies(text)];
  const keep = tech.length ? `\nTechnologies to keep exactly as written: ${tech.join(", ")}` : "";
  const answer = await chatJSON({
    task: "writing",
    system: REWRITE_PROMPT,
    user: `${job}Paragraph: ${text}${keep}`,
    temperature: 0.6,
    maxTokens: 1500,
  });

  const seen = new Set([text]);
  const variants = [];
  for (const { key, label } of VARIANTS) {
    const value =
      typeof answer[key] === "string"
        ? checkRewrite(text, answer[key].slice(0, 3000), { allowCuts: true })
        : null;
    if (value && !seen.has(value)) {
      seen.add(value);
      variants.push({ label, text: value });
    }
  }
  return { variants };
}
