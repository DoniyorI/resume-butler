import "server-only";
import { z } from "zod";
import { chatJSON } from "@/server/openai";
import { bulletTexts, loadCv } from "@/server/resume/loadCv";

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

export const coverLetterInput = z.object({
  jobDescription: z.string().min(1).max(20_000),
  companyName: z.string().max(200).optional().nullable(),
});

// Only the fields the letter needs, to keep the prompt small
function cvSummary({ profile, experience, projects, education, skills }) {
  return {
    name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
    experience: experience.map((exp) => ({
      company: exp.company,
      position: exp.position,
      bullets: bulletTexts(exp.cv_experience_bullets),
    })),
    projects: projects.map((proj) => ({
      name: proj.name,
      bullets: bulletTexts(proj.cv_project_bullets),
    })),
    education: education.map((edu) => ({
      school: edu.school,
      degree: `${edu.degree_type} in ${edu.major}`,
    })),
    skills: skills.map((s) => s.name),
  };
}

// Draft a cover letter from the user's CV. Returns the model's { body, highlights }.
export async function generateCoverLetter(supabase, userId, { jobDescription, companyName }) {
  const cv = await loadCv(supabase, userId);
  return chatJSON({
    system: COVER_LETTER_PROMPT,
    user: `Company: ${companyName || "the company"}\n\nJob Description:\n${jobDescription}\n\nCandidate CV:\n${JSON.stringify(cvSummary(cv))}`,
  });
}
