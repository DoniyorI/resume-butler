import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/server/auth";
import { HEADER_FIELDS, readResumeForEditing } from "@/features/resumes/resumeDocument";

// Empty header fields fall back to the profile. needsHeaderSave tells the
// editor to persist the filled-in header, as the old client code did.
function resolveHeader(header, profile) {
  const fallback = {
    name: [profile.first_name, profile.last_name].filter(Boolean).join(" "),
    email: profile.email || "",
    phone: profile.phone || "",
    linkedin: profile.linkedin || "",
    github: profile.github || "",
  };
  const resolved = { ...header };
  for (const field of HEADER_FIELDS) {
    resolved[field] = header[field] || fallback[field];
  }
  const needsHeaderSave = HEADER_FIELDS.some((field) => (header[field] || "") !== resolved[field]);
  return { header: resolved, needsHeaderSave };
}

// Cached per request so generateMetadata and the page share one query.
// Returns null when the resume doesn't exist or belongs to someone else.
export const getResumeForEditor = cache(async (resumeId) => {
  const { supabase, user } = await requirePageUser();

  const [resumeRes, profileRes] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, title, content")
      .eq("id", resumeId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("first_name, last_name, email, phone, linkedin, github")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (resumeRes.error || !resumeRes.data) return null;

  const view = readResumeForEditing(resumeRes.data.content);
  if (view.readOnly) return { id: resumeRes.data.id, title: resumeRes.data.title || "Resume", ...view };
  const content = view.content;
  const { header, needsHeaderSave } = resolveHeader(content.header, profileRes.data || {});

  return {
    id: resumeRes.data.id,
    title: resumeRes.data.title || "",
    content: { ...content, header },
    needsHeaderSave,
  };
});

// The master CV in camelCase, for the editor's CV panel
export { loadMasterCv as getMasterCv } from "@/server/resume/loadCv";

const JOB_OPTIONS_LIMIT = 100;

// Jobs a resume or cover letter can be tailored to: the user's applications
// that have a job description (newest first), and the application the
// document is attached to (applications.resume_id / cover_letter_id), with its
// description, so the editor can start from it. Pass { resumeId } or { coverLetterId }.
export async function getJobOptions(supabase, userId, { resumeId, coverLetterId }) {
  const [linkColumn, documentId] = resumeId ? ["resume_id", resumeId] : ["cover_letter_id", coverLetterId];
  const [optionsRes, linkedRes] = await Promise.all([
    supabase
      .from("applications")
      .select("id, company, role")
      .eq("user_id", userId)
      .not("job_description", "is", null)
      .neq("job_description", "")
      .order("applied_date", { ascending: false, nullsFirst: false })
      .limit(JOB_OPTIONS_LIMIT),
    supabase
      .from("applications")
      .select("id, company, role, job_description")
      .eq("user_id", userId)
      .eq(linkColumn, documentId)
      .order("applied_date", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (optionsRes.error) throw optionsRes.error;

  const linked = linkedRes.data;
  return {
    applications: optionsRes.data.map((app) => ({
      id: app.id,
      company: app.company || "",
      role: app.role || "",
    })),
    linked: linked
      ? {
          applicationId: linked.id,
          company: linked.company || "",
          role: linked.role || "",
          jobDescription: linked.job_description || "",
        }
      : null,
  };
}
