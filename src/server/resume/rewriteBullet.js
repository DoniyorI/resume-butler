import "server-only";
import { z } from "zod";
import { chatJSON } from "@/server/openai";
import { checkRewrite, technologies } from "@/server/resume/guardrails";

const REWRITE_PROMPT = `You rewrite one resume bullet point three ways. Keep the user's facts: never add or swap a technology, tool, product, industry, result or number, and don't add claims the bullet doesn't make. Where a number would help and none is given, use a placeholder like [X%] for the user to fill in. Keep the bullet's ending punctuation.

Variants:
- "stronger": opens with a strong action verb and leads with impact
- "tailored": where the bullet already describes something the job description names, uses the job's wording for it (if there is no job description, make it clearer instead)
- "shorter": same meaning in at most 95 characters

Return JSON: { "stronger": "...", "tailored": "...", "shorter": "..." }`;

const VARIANTS = [
  { key: "stronger", label: "Stronger" },
  { key: "tailored", label: "Tailored to the job" },
  { key: "shorter", label: "Shorter", allowCuts: true },
];

export const rewriteBulletInput = z.object({
  text: z.string().trim().min(1, "Write the bullet first").max(1000),
  // e.g. "Software Engineer at Acme", so the model knows where the bullet is from
  context: z.string().max(300).default(""),
  jobDescription: z.string().max(20_000).default(""),
});

// Returns { variants: [{ label, text }] }, leaving out unchanged ones and any that change the facts
export async function rewriteBullet({ text, context, jobDescription }) {
  const job = jobDescription.trim() ? `Job description:\n${jobDescription}\n\n` : "";
  const tech = [...technologies(text)];
  const keep = tech.length ? `\nTechnologies to keep exactly as written: ${tech.join(", ")}` : "";
  const answer = await chatJSON({
    system: REWRITE_PROMPT,
    user: `${job}Role: ${context || "unknown"}\nBullet: ${text}${keep}`,
    temperature: 0.5,
    maxTokens: 600,
  });

  const seen = new Set([text]);
  const variants = [];
  for (const { key, label, allowCuts } of VARIANTS) {
    // Drops variants that add or swap facts (see guardrails.js)
    const value =
      typeof answer[key] === "string" ? checkRewrite(text, answer[key].slice(0, 1000), { allowCuts }) : null;
    if (value && !seen.has(value)) {
      seen.add(value);
      variants.push({ label, text: value });
    }
  }
  return { variants };
}
