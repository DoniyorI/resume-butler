import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { chatJSON } from "@/server/openai";
import { enforceRateLimit } from "@/server/rateLimit";

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

const bodySchema = z.object({
  jobDescription: z.string().min(1).max(20_000),
  companyName: z.string().max(200).optional().nullable(),
});

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const { jobDescription, companyName } = await parseJson(request, bodySchema);
    await enforceRateLimit(supabase, "generate-cover-letter");

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

    const parsed = await chatJSON({
      system: COVER_LETTER_PROMPT,
      user: `Company: ${companyName || "the company"}\n\nJob Description:\n${jobDescription}\n\nCandidate CV:\n${JSON.stringify(cvSummary)}`,
    });

    return NextResponse.json(parsed);
  } catch (error) {
    return errorResponse(error, "Cover letter generation error");
  }
}
