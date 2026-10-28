import "server-only";
import { z } from "zod";
import { chatJSON } from "@/server/openai";
import { itemBullets } from "@/features/resumes/resumeDocument";
import { checkRewrite, technologies } from "@/server/resume/guardrails";

const SHARED_RULES = `Rules:
1. Keep the user's facts. Never add a technology, tool, language, product, industry, team size, result or number the bullet doesn't already state, and never swap one for another (e.g. "React Native" must stay "React Native", "accounting software" must stay "accounting software").
2. Don't add claims about what the work focused on or improved ("focusing on accessibility", "enhancing security") unless the bullet says so.
3. Where a bullet has no number, you may add a placeholder like [X%] or [N users] for the user to fill in. Never make up the number itself.
4. Make small, targeted edits the user will recognise as their own bullet. Keep its ending punctuation.
5. Skip bullets that are already good, and skip any you can't improve without adding facts. Only return real improvements, not punctuation or article changes.
6. "reason" says in under 12 words why the change helps.
7. "kind" is one of: "keyword" (uses the job's wording for something the bullet already describes), "metric" (adds a number placeholder), "verb" (stronger opening verb), "concise" (same meaning, fewer words).`;

const PROMPTS = {
  match: `You help tailor resume bullet points to a job description.
Make bullets speak to what the job asks for: where a bullet already describes something the job names, use the job's wording for it; open with a strong action verb; and show impact.

${SHARED_RULES}`,
  concise: `You help a resume fit on one page. Shorten the bullets you are given so each fits on one line (about 95 characters) where possible, keeping the strongest facts, numbers and keywords. Prefer cutting filler ("in order to", "various", "successfully") over cutting substance.

${SHARED_RULES}`,
};

const OUTPUT_FORMAT = `Return a JSON object: { "suggestions": [{ "ref": "B3", "suggested": "...", "reason": "...", "kind": "keyword" }] }
"ref" is the id in brackets in front of the bullet you changed.`;

const MAX_BULLETS = 60;
const KINDS = new Set(["keyword", "metric", "verb", "concise"]);

const bulletRef = z.object({
  section: z.enum(["experience", "projects"]),
  itemIndex: z.number().int().min(0),
  bulletIndex: z.number().int().min(0),
});

export const suggestBulletsInput = z
  .object({
    // "match" tailors to the job description; "concise" shortens for space
    focus: z.enum(["match", "concise"]).default("match"),
    jobDescription: z.string().max(20_000).default(""),
    resumeContent: z
      .object({
        experience: z.array(z.any()).max(100).optional(),
        projects: z.array(z.any()).max(100).optional(),
      })
      .passthrough(),
    // Limit the review to these bullets (e.g. the longest ones when tightening)
    only: z.array(bulletRef).max(MAX_BULLETS).optional(),
  })
  .refine((input) => input.focus !== "match" || input.jobDescription.trim(), {
    message: "Add a job description first",
  });

function collectBullets(resumeContent, only) {
  const wanted = only && new Set(only.map((b) => `${b.section}:${b.itemIndex}:${b.bulletIndex}`));
  const bullets = [];
  const add = (entries, section, contextOf) => {
    (entries || []).forEach((entry, itemIndex) => {
      itemBullets(entry).forEach((bullet, bulletIndex) => {
        if (!bullet || !bullet.trim()) return;
        if (wanted && !wanted.has(`${section}:${itemIndex}:${bulletIndex}`)) return;
        bullets.push({ section, itemIndex, bulletIndex, text: bullet.trim(), context: contextOf(entry) });
      });
    });
  };
  add(resumeContent.experience, "experience", (exp) =>
    [exp.position, exp.companyName || exp.company].filter(Boolean).join(" at ")
  );
  add(resumeContent.projects, "projects", (proj) => proj.projectName || proj.name || "");
  return bullets.slice(0, MAX_BULLETS);
}

/**
 * Suggest edits to resume bullets. Returns { suggestions: [{ section,
 * itemIndex, bulletIndex, original, suggested, reason, kind }] }, where the
 * position always comes from our own list so the editor can apply it safely.
 */
export async function suggestBullets({ focus, jobDescription, resumeContent, only }) {
  const bullets = collectBullets(resumeContent, only);
  if (bullets.length === 0) return { suggestions: [] };

  // Each bullet lists the technologies it names, which the model must keep
  const bulletList = bullets
    .map((b, i) => {
      const tech = [...technologies(b.text)];
      return `[B${i}] (${b.context}) ${b.text}${tech.length ? `\n     keep: ${tech.join(", ")}` : ""}`;
    })
    .join("\n");
  const job = jobDescription.trim() ? `Job description:\n${jobDescription}\n\n` : "";

  const parsed = await chatJSON({
    task: "writing",
    system: `${PROMPTS[focus]}\n\n${OUTPUT_FORMAT}`,
    user: `${job}Bullets:\n${bulletList}`,
    temperature: 0.3,
  });

  const seen = new Set();
  const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
    .map((s) => {
      const index = Number(String(s?.ref || "").replace(/^B/i, ""));
      const bullet = Number.isInteger(index) ? bullets[index] : undefined;
      if (!bullet || seen.has(index) || typeof s.suggested !== "string") return null;
      // Drops edits that add or swap facts (see guardrails.js)
      const suggested = checkRewrite(bullet.text, s.suggested.slice(0, 1000), {
        allowCuts: focus === "concise",
      });
      if (!suggested) return null;
      seen.add(index);
      return {
        section: bullet.section,
        itemIndex: bullet.itemIndex,
        bulletIndex: bullet.bulletIndex,
        original: bullet.text,
        suggested,
        reason: typeof s.reason === "string" ? s.reason.slice(0, 200) : null,
        kind: KINDS.has(s.kind) ? s.kind : focus === "concise" ? "concise" : "keyword",
      };
    })
    .filter(Boolean);

  return { suggestions };
}
