import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { chatJSON } from "@/server/openai";
import { enforceRateLimit } from "@/server/rateLimit";

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

const bodySchema = z.object({
  jobDescription: z.string().min(1).max(20_000),
  resumeContent: z.object({
    experience: z.array(z.any()).max(30).optional(),
    projects: z.array(z.any()).max(30).optional(),
  }).passthrough(),
});

export async function POST(request) {
  try {
    const { supabase } = await requireUser();
    const { jobDescription, resumeContent } = await parseJson(request, bodySchema, { maxBytes: 200_000 });
    await enforceRateLimit(supabase, "suggest-bullets");

    // Build the bullet list to send to GPT
    const bullets = [];

    (resumeContent.experience || []).forEach((exp, itemIndex) => {
      const descriptions = Array.isArray(exp.description)
        ? exp.description
        : (exp.description || "").split("\n");

      descriptions.forEach((bullet, bulletIndex) => {
        if (!bullet || !bullet.trim()) return;
        bullets.push({
          index: bullets.length,
          section: "experience",
          itemIndex,
          bulletIndex,
          text: bullet.trim(),
          context: `${exp.companyName || exp.company || ""} — ${exp.position || ""}`,
        });
      });
    });

    (resumeContent.projects || []).forEach((proj, itemIndex) => {
      const descriptions = Array.isArray(proj.description)
        ? proj.description
        : (proj.description || "").split("\n");

      descriptions.forEach((bullet, bulletIndex) => {
        if (!bullet || !bullet.trim()) return;
        bullets.push({
          index: bullets.length,
          section: "projects",
          itemIndex,
          bulletIndex,
          text: bullet.trim(),
          context: proj.projectName || proj.name || "",
        });
      });
    });

    if (bullets.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }
    bullets.splice(MAX_BULLETS);

    // Format bullets for GPT
    const bulletList = bullets
      .map((b) => `[${b.section}][item ${b.itemIndex}][bullet ${b.bulletIndex}] (${b.context}): "${b.text}"`)
      .join("\n");

    const parsed = await chatJSON({
      system: SUGGEST_PROMPT,
      user: `Job Description:\n${jobDescription}\n\nBullet Points:\n${bulletList}\n\nReturn a JSON object with a "suggestions" array.`,
    });

    // Map GPT suggestions back to section/item/bullet indices
    const suggestions = (parsed.suggestions || [])
      .filter((s) => s.changed)
      .map((s) => {
        // Find the matching bullet from our list
        const match = bullets.find(
          (b) =>
            b.section === s.section &&
            b.itemIndex === s.itemIndex &&
            (b.bulletIndex === s.bulletIndex || b.text === s.original)
        );
        return {
          section: s.section,
          itemIndex: s.itemIndex,
          bulletIndex: match?.bulletIndex ?? s.bulletIndex ?? s.index,
          original: s.original,
          suggested: s.suggested,
          reason: s.reason,
        };
      });

    return NextResponse.json({ suggestions });
  } catch (error) {
    return errorResponse(error, "Suggest bullets error");
  }
}
