import "server-only";
import { z } from "zod";
import { HttpError } from "@/server/http";
import { tailorResume } from "@/server/resume/tailorResume";
import { DEFAULT_SECTION_ORDER } from "@/features/resumes/resumeDocument";

export const generateResumeInput = z.object({
  title: z.string().trim().min(1).max(200),
  jobDescription: z.string().min(1).max(20_000),
});

function headerFromProfile(profile) {
  return {
    name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
    email: profile?.email || "",
    phone: profile?.phone || "",
    linkedin: profile?.linkedin || "",
    github: profile?.github || "",
  };
}

// Create a new resume from the master CV entries that best fit the job.
// Returns { resumeId }.
export async function generateResume(supabase, userId, { title, jobDescription }) {
  const [profileRes, tailored] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, email, phone, linkedin, github")
      .eq("id", userId)
      .maybeSingle(),
    tailorResume(supabase, userId, { jobDescription }),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (!tailored.content) throw new HttpError(400, "Add entries to your master CV first");

  const content = {
    ...tailored.content,
    header: headerFromProfile(profileRes.data),
    order: DEFAULT_SECTION_ORDER,
    target: { jobDescription, applicationId: null, company: "", role: "" },
  };

  const { data: resume, error } = await supabase
    .from("resumes")
    .insert({ user_id: userId, title, content })
    .select("id")
    .single();
  if (error) throw error;

  return { resumeId: resume.id };
}
