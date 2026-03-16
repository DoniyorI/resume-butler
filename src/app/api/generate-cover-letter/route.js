import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const COVER_LETTER_PROMPT = `You are a cover letter writing assistant. Generate a professional cover letter based on the user's CV data and the job description.

Rules:
1. Use the user's REAL experience, projects, and skills from their CV — never invent accomplishments
2. Reference specific items from their CV that are relevant to the job description
3. Keep it concise — 3-4 paragraphs max
4. Opening paragraph: Express interest in the specific role and company
5. Middle paragraphs: Highlight 2-3 most relevant experiences/projects from their CV, connecting them to what the job requires
6. Closing paragraph: Express enthusiasm and call to action
7. Use a professional but natural tone — not overly formal or robotic
8. Do NOT include the header (name, date, address) — just the letter body starting with "Dear Hiring Manager,"
9. Return plain text, not markdown

Return a JSON object:
{
  "body": "Dear Hiring Manager,\n\nThe cover letter text...\n\nSincerely,\n[Name]",
  "highlights": ["key point 1 from CV used", "key point 2 from CV used"]
}`;

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobDescription, companyName } = await request.json();
    if (!jobDescription) {
      return NextResponse.json({ error: "jobDescription is required" }, { status: 400 });
    }

    // Fetch user's CV data
    const [profileRes, expRes, projRes, eduRes, skillRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("cv_experience").select("*, cv_experience_bullets(*)").eq("user_id", user.id),
      supabase.from("cv_projects").select("*, cv_project_bullets(*)").eq("user_id", user.id),
      supabase.from("cv_education").select("*").eq("user_id", user.id),
      supabase.from("cv_skills").select("*").eq("user_id", user.id),
    ]);

    const profile = profileRes.data || {};
    const cvSummary = {
      name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
      experience: (expRes.data || []).map((exp) => ({
        company: exp.company,
        position: exp.position,
        bullets: (exp.cv_experience_bullets || []).map((b) => b.content),
      })),
      projects: (projRes.data || []).map((proj) => ({
        name: proj.name,
        bullets: (proj.cv_project_bullets || []).map((b) => b.content),
      })),
      education: (eduRes.data || []).map((edu) => ({
        school: edu.school,
        degree: `${edu.degree_type} in ${edu.major}`,
      })),
      skills: (skillRes.data || []).map((s) => s.name),
    };

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
          { role: "system", content: COVER_LETTER_PROMPT },
          {
            role: "user",
            content: `Company: ${companyName || "the company"}\n\nJob Description:\n${jobDescription}\n\nCandidate CV:\n${JSON.stringify(cvSummary)}`,
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

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Cover letter generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate cover letter" }, { status: 500 });
  }
}
