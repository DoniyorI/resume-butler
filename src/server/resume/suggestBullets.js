import "server-only";
import { z } from "zod";
import { chatJSON } from "@/server/openai";

const SUGGEST_PROMPT = `You are a resume writing assistant. You help improve bullet points to better match a job description.

Rules:
1. KEEP the user's original meaning and facts — never invent accomplishments
2. Only make SMALL, targeted edits:
   - Add relevant keywords from the job description where they naturally fit
   - Add quantified metrics placeholders like [X%] or [X+] if the bullet lacks numbers (the user fills in the actual number)
   - Strengthen weak verbs (e.g. "helped" → "contributed to", "worked on" → "developed")
   - Tighten wordy phrases
3. If a bullet is already good, return it unchanged with no suggestion
4. Never completely rewrite a bullet — the user should recognize their original text
5. Each suggestion should explain WHY the change helps (e.g. "adds keyword: CI/CD")

Return a JSON array where each item has:
{
  "index": 0,
  "section": "experience",
  "itemIndex": 0,
  "original": "the original bullet text",
  "suggested": "the improved bullet text (or same as original if no change needed)",
  "reason": "why this change helps (or null if no change)",
  "changed": true/false
}

Only include bullets where changed=true. Skip bullets that are already good.`;

const MAX_BULLETS = 60;

export const suggestBulletsInput = z.object({
  jobDescription: z.string().min(1).max(20_000),
  resumeContent: z
    .object({
      experience: z.array(z.any()).max(100).optional(),
      projects: z.array(z.any()).max(100).optional(),
    })
    .passthrough(),
});

function sectionBullets(entries, section, contextOf, out) {
  (entries || []).forEach((entry, itemIndex) => {
    const descriptions = Array.isArray(entry.description)
      ? entry.description
      : (entry.description || "").split("\n");
    descriptions.forEach((bullet, bulletIndex) => {
      if (!bullet || !bullet.trim()) return;
      out.push({
        index: out.length,
        section,
        itemIndex,
        bulletIndex,
        text: bullet.trim(),
        context: contextOf(entry),
      });
    });
  });
}

function collectBullets(resumeContent) {
  const bullets = [];
  sectionBullets(
    resumeContent.experience,
    "experience",
    (exp) => `${exp.companyName || exp.company || ""} — ${exp.position || ""}`,
    bullets
  );
  sectionBullets(resumeContent.projects, "projects", (proj) => proj.projectName || proj.name || "", bullets);
  return bullets.slice(0, MAX_BULLETS);
}

// Suggest small edits to resume bullets for a job description. Returns { suggestions }.
export async function suggestBullets({ jobDescription, resumeContent }) {
  const bullets = collectBullets(resumeContent);
  if (bullets.length === 0) return { suggestions: [] };

  const bulletList = bullets
    .map((b) => `[${b.section}][item ${b.itemIndex}][bullet ${b.bulletIndex}] (${b.context}): "${b.text}"`)
    .join("\n");

  const parsed = await chatJSON({
    system: SUGGEST_PROMPT,
    user: `Job Description:\n${jobDescription}\n\nBullet Points:\n${bulletList}\n\nReturn a JSON object with a "suggestions" array.`,
  });

  // Map the model's answer back to a bullet we actually sent. Model output is
  // untrusted: suggestions that don't match a real bullet are dropped, and the
  // indices always come from our own list so the editor can apply them safely.
  const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
    .filter((s) => s && s.changed && typeof s.suggested === "string" && s.suggested.trim())
    .map((s) => {
      const match =
        bullets.find(
          (b) =>
            b.section === s.section &&
            b.itemIndex === s.itemIndex &&
            (b.bulletIndex === s.bulletIndex || b.text === s.original)
        ) || bullets.find((b) => b.text === s.original);
      if (!match) return null;
      return {
        section: match.section,
        itemIndex: match.itemIndex,
        bulletIndex: match.bulletIndex,
        original: match.text,
        suggested: s.suggested.slice(0, 1000),
        reason: typeof s.reason === "string" ? s.reason.slice(0, 500) : null,
      };
    })
    .filter(Boolean);

  return { suggestions };
}
