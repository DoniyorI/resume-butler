import "server-only";
import { z } from "zod";
import { chatJSON } from "@/server/openai";
import { bulletTexts, loadCv } from "@/server/resume/loadCv";

const RESUME_PROMPT = `Resume Aligner is a CV parser designed to analyze job descriptions and parse input dictionaries containing categories such as education, experience, projects, and skills. Its main function is to select and align entries from the input that best match the specified job requirements for a resume. It should NEVER use the same entry more than once. It strictly preserves the content and structure of the input dictionary, neither adding new items nor altering the existing text.

The output JSON object reflects the structure of the input dictionary, accurately categorizing entries under 'experience', 'projects', and 'skills' as they appear in the input, omitting entries unrelated to the job description so that each "experience" and "projects" category will ALWAYS have THREE entries.

The tool is optimized for API calls, ensuring high responsiveness and adaptability. It delivers responses containing only the output dictionary in a JSON format, structured as described. The output never contains additional commentary or new items and strictly maintains the structure and content of the input. The Response NEEDS to be a JSON object, NO COMMENTARY`;

const SKILLS_PROMPT = `The GPT takes a list of dictionaries containing skills and categorizes these skills into categories. It outputs the results in a JSON dictionary, mapping each category to a list of skill entries. The category should NOT be "skills"`;

export const generateResumeInput = z.object({
  title: z.string().trim().min(1).max(200),
  jobDescription: z.string().min(1).max(20_000),
});

function callGPT(prompt, jobDescription, cv) {
  return chatJSON({
    system: "Provide output in valid JSON",
    user: `${prompt}\n${jobDescription}\n${cv}`,
  });
}

function headerFromProfile(profile) {
  return {
    name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
    email: profile?.email || "",
    phone: profile?.phone || "",
    linkedin: profile?.linkedin || "",
    github: profile?.github || "",
  };
}

// Pick the CV entries that best fit the job, group the skills, and save the
// result as a new resume. Returns { resumeId }.
export async function generateResume(supabase, userId, { title, jobDescription }) {
  const cv = await loadCv(supabase, userId);

  const cvData = {
    education: cv.education,
    experience: cv.experience.map((exp) => ({ ...exp, description: bulletTexts(exp.cv_experience_bullets) })),
    projects: cv.projects.map((proj) => ({ ...proj, description: bulletTexts(proj.cv_project_bullets) })),
    skills: cv.skills.map((s) => ({ name: s.name, category: s.category })),
  };

  const alignedCV = await callGPT(RESUME_PROMPT, jobDescription, JSON.stringify(cvData));

  const skillNames = (alignedCV.skills || []).map((s) => s.name || s);
  const categorizedSkills = await callGPT(SKILLS_PROMPT, "", JSON.stringify(skillNames));

  const content = {
    education: alignedCV.education || [],
    experience: alignedCV.experience || [],
    projects: alignedCV.projects || [],
    skills: categorizedSkills,
    header: headerFromProfile(cv.profile),
  };

  const { data: resume, error } = await supabase
    .from("resumes")
    .insert({ user_id: userId, title, content })
    .select("id")
    .single();
  if (error) throw error;

  return { resumeId: resume.id };
}
