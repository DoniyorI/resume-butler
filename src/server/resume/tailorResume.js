import "server-only";
import { z } from "zod";
import { chatJSON } from "@/server/openai";
import { loadMasterCv } from "@/server/resume/loadCv";
import { cvToResumeItem } from "@/features/resumes/resumeDocument";

const TAILOR_PROMPT = `You choose which entries of a candidate's master CV go on a one-page resume for a specific job.

You get the job description and the CV as a list of entries, each with an id. Pick:
- experience: the 2 to 4 entries most relevant to the job, favouring recent ones
- projects: the 1 to 3 entries most relevant to the job
- education: every entry unless one is clearly irrelevant
- skills: the skills from the CV that matter for this job, grouped into 2 to 4 short category names (for example "Languages", "Frameworks", "Tools"). Use the skill names exactly as written in the CV. Never add a skill that isn't in the CV.

Never invent entries or ids. For each picked experience and project, give a reason of at most 12 words that names what makes it relevant.

Return JSON:
{
  "experience": [{ "id": "...", "reason": "..." }],
  "projects": [{ "id": "...", "reason": "..." }],
  "education": ["id", ...],
  "skills": [{ "category": "...", "names": ["...", ...] }]
}`;

const MAX_EXPERIENCE = 5;
const MAX_PROJECTS = 4;
const MAX_SKILL_GROUPS = 6;
const REASON_CHARS = 120;

export const tailorInput = z.object({
  jobDescription: z.string().trim().min(1, "Add a job description first").max(20_000),
});

// The CV as compact text the model can pick from
function describeCv(cv) {
  const lines = [];
  for (const exp of cv.experience) {
    const dates = [exp.startDate, exp.currentlyWorking ? "Present" : exp.endDate].filter(Boolean).join(" - ");
    lines.push(`[experience id=${exp.id}] ${exp.position} at ${exp.company} (${dates})`);
    exp.bullets.forEach((b) => lines.push(`  - ${b}`));
  }
  for (const proj of cv.projects) {
    lines.push(`[project id=${proj.id}] ${proj.name}${proj.description ? `: ${proj.description}` : ""}`);
    proj.bullets.forEach((b) => lines.push(`  - ${b}`));
  }
  for (const edu of cv.education) {
    lines.push(`[education id=${edu.id}] ${edu.degreeType} ${edu.major} at ${edu.school}`);
  }
  lines.push(`Skills: ${cv.skills.map((s) => s.name).join(", ")}`);
  return lines.join("\n");
}

// Model output is untrusted: keep only ids that exist, in the CV's order, at most `max`
function pickById(entries, picks, max) {
  const reasons = new Map();
  for (const pick of Array.isArray(picks) ? picks : []) {
    const id = typeof pick === "string" ? pick : pick?.id;
    if (typeof id === "string" && !reasons.has(id)) {
      reasons.set(id, typeof pick?.reason === "string" ? pick.reason.slice(0, REASON_CHARS) : "");
    }
  }
  return entries
    .filter((entry) => reasons.has(entry.id))
    .slice(0, max)
    .map((entry) => ({ entry, reason: reasons.get(entry.id) }));
}

// Skill groups that only use skills the CV has, spelled as in the CV
function pickSkills(cvSkills, groups) {
  const byName = new Map(cvSkills.map((s) => [s.name.trim().toLowerCase(), s.name]));
  const used = new Set();
  const lines = [];
  for (const group of (Array.isArray(groups) ? groups : []).slice(0, MAX_SKILL_GROUPS)) {
    const header = typeof group?.category === "string" ? group.category.trim().slice(0, 40) : "";
    const names = (Array.isArray(group?.names) ? group.names : [])
      .map((name) => byName.get(String(name).trim().toLowerCase()))
      .filter((name) => name && !used.has(name));
    names.forEach((name) => used.add(name));
    if (header && names.length) lines.push({ header, skills: names.join(", ") });
  }
  return lines;
}

/**
 * Choose the master CV entries that fit a job. Returns resume sections in the
 * editor's shape, plus what was picked and why, so the editor can show the
 * choice before applying it:
 * { content: { education, experience, projects, skills }, picks: { experience, projects } }
 */
export async function tailorResume(supabase, userId, { jobDescription }) {
  const cv = await loadMasterCv(supabase, userId);
  if (cv.experience.length + cv.projects.length + cv.education.length === 0) {
    return { content: null, picks: null };
  }

  const answer = await chatJSON({
    task: "selection",
    system: TAILOR_PROMPT,
    user: `Job description:\n${jobDescription}\n\nMaster CV:\n${describeCv(cv)}`,
    temperature: 0.2,
  });

  const experience = pickById(cv.experience, answer.experience, MAX_EXPERIENCE);
  const projects = pickById(cv.projects, answer.projects, MAX_PROJECTS);
  let education = pickById(cv.education, answer.education, cv.education.length);
  if (education.length === 0) education = cv.education.map((entry) => ({ entry }));
  const skills = pickSkills(cv.skills, answer.skills);

  return {
    content: {
      education: education.map(({ entry }) => cvToResumeItem.education(entry)),
      experience: experience.map(({ entry }) => cvToResumeItem.experience(entry)),
      projects: projects.map(({ entry }) => cvToResumeItem.projects(entry)),
      skills,
    },
    picks: {
      experience: experience.map(({ entry, reason }) => ({
        title: [entry.position, entry.company].filter(Boolean).join(" at "),
        reason,
      })),
      projects: projects.map(({ entry, reason }) => ({ title: entry.name, reason })),
    },
  };
}
