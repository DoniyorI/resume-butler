import { NextResponse } from "next/server";

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

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const { jobDescription, resumeContent } = await request.json();

    if (!jobDescription || !resumeContent) {
      return NextResponse.json(
        { error: "jobDescription and resumeContent are required" },
        { status: 400 }
      );
    }

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

    // Format bullets for GPT
    const bulletList = bullets
      .map((b) => `[${b.section}][item ${b.itemIndex}][bullet ${b.bulletIndex}] (${b.context}): "${b.text}"`)
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SUGGEST_PROMPT },
          {
            role: "user",
            content: `Job Description:\n${jobDescription}\n\nBullet Points:\n${bulletList}\n\nReturn a JSON object with a "suggestions" array.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${err}`);
    }

    const gptData = await response.json();
    const parsed = JSON.parse(gptData.choices[0].message.content);

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
    console.error("Suggest bullets error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
