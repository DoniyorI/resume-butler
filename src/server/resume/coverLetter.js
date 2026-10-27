import "server-only";
import { z } from "zod";
import { chatJSON } from "@/server/openai";
import { technologies } from "@/server/resume/guardrails";
import { bulletTexts, loadCv } from "@/server/resume/loadCv";

const TONES = {
  professional: "professional and confident",
  warm: "warm and personable, while staying professional",
  direct: "direct and to the point, with short sentences",
};

const LENGTHS = {
  short: "3 short paragraphs, about 180 words in total",
  standard: "3 to 4 paragraphs, about 280 words in total",
};

function coverLetterPrompt({ tone, length }) {
  return `You write cover letters from a candidate's CV and a job description.

Rules:
1. Use only the candidate's real experience, projects, skills and education from the CV. Never invent employers, job titles, results, numbers, tools or technologies; the candidate held only the titles in the CV. Name a technology only if it appears in the CV.
2. Describe the candidate's work the way the CV does. Never claim experience in the job's industry, product type or users unless the CV shows it: if the job builds healthcare apps and the CV shows accounting software, say accounting software and explain why that experience transfers.
3. Open with the specific role and company and the candidate's strongest real reason to be considered.
4. In the middle, connect 2 or 3 of the most relevant CV items to what the job asks for, with concrete detail from the CV.
5. End with a short closing paragraph: genuine interest in this company and a call to action.
6. Tone: ${TONES[tone]}. Avoid clichés like "I am writing to express my interest" or "I am excited to apply".
7. Length: ${LENGTHS[length]}.
8. Write only the body paragraphs: no greeting ("Dear ..."), no sign-off, no name, no address. Plain text, no markdown.

Return JSON:
{
  "paragraphs": ["first paragraph", "second paragraph", ...],
  "highlights": ["the CV items you used, a few words each"]
}`;
}

const MAX_PARAGRAPHS = 6;
const PARAGRAPH_CHARS = 1500;

export const coverLetterInput = z.object({
  jobDescription: z.string().min(1).max(20_000),
  companyName: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  tone: z.enum(["professional", "warm", "direct"]).default("professional"),
  length: z.enum(["short", "standard"]).default("standard"),
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
      description: proj.description,
      bullets: bulletTexts(proj.cv_project_bullets),
    })),
    education: education.map((edu) => ({
      school: edu.school,
      degree: `${edu.degree_type} in ${edu.major}`,
    })),
    skills: skills.map((s) => s.name),
  };
}

const asText = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/**
 * Draft a cover letter body from the user's master CV. Returns
 * { paragraphs, highlights, unsupported }: `unsupported` lists technologies
 * the letter names that the CV doesn't, to check before using it.
 */
export async function generateCoverLetter(
  supabase,
  userId,
  { jobDescription, companyName, role, tone, length }
) {
  const cv = cvSummary(await loadCv(supabase, userId));
  const answer = await chatJSON({
    system: coverLetterPrompt({ tone, length }),
    user: `Company: ${companyName || "the company"}\nRole: ${role || "see the job description"}\n\nJob description:\n${jobDescription}\n\nCandidate CV:\n${JSON.stringify(cv)}`,
    temperature: 0.6,
  });

  const paragraphs = (Array.isArray(answer.paragraphs) ? answer.paragraphs : [])
    .map((p) => asText(p, PARAGRAPH_CHARS))
    // The editor has its own greeting and sign-off
    .filter((p) => p && !/^(dear|to whom)\b/i.test(p) && !/^(sincerely|best regards|regards),?$/i.test(p))
    .slice(0, MAX_PARAGRAPHS);
  const highlights = (Array.isArray(answer.highlights) ? answer.highlights : [])
    .map((h) => asText(h, 200))
    .filter(Boolean)
    .slice(0, 8);

  const cvTech = technologies(JSON.stringify(cv));
  const unsupported = [...technologies(paragraphs.join(" "))].filter((skill) => !cvTech.has(skill));

  return { paragraphs, highlights, unsupported };
}
