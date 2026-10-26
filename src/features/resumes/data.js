import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/server/auth";
import { HEADER_FIELDS, normalizeResumeContent } from "@/features/resumes/resumeDocument";

export async function listResumes(supabase, userId) {
  const { data, error } = await supabase
    .from("resumes")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

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

  const content = normalizeResumeContent(resumeRes.data.content);
  const { header, needsHeaderSave } = resolveHeader(content.header, profileRes.data || {});

  return {
    id: resumeRes.data.id,
    title: resumeRes.data.title || "",
    content: { ...content, header },
    needsHeaderSave,
  };
});

function sortedBullets(bullets) {
  return [...(bullets || [])].sort((a, b) => a.sort_order - b.sort_order).map((b) => b.content);
}

// The master CV shown in the editor's side drawer
export async function getMasterCv(supabase, userId) {
  const [eduRes, expRes, projRes, skillRes] = await Promise.all([
    supabase.from("cv_education").select("*").eq("user_id", userId).order("sort_order"),
    supabase
      .from("cv_experience")
      .select("*, cv_experience_bullets(*)")
      .eq("user_id", userId)
      .order("sort_order"),
    supabase
      .from("cv_projects")
      .select("*, cv_project_bullets(*)")
      .eq("user_id", userId)
      .order("sort_order"),
    supabase.from("cv_skills").select("*").eq("user_id", userId).order("sort_order"),
  ]);

  return {
    education: (eduRes.data || []).map((edu) => ({
      id: edu.id,
      school: edu.school || "",
      location: edu.location || "",
      major: edu.major || "",
      degreeType: edu.degree_type || "",
      gpa: edu.gpa || "",
      startDate: edu.start_date || "",
      endDate: edu.end_date || "",
    })),
    experience: (expRes.data || []).map((exp) => ({
      id: exp.id,
      company: exp.company || "",
      position: exp.position || "",
      location: exp.location || "",
      startDate: exp.start_date || "",
      endDate: exp.end_date || "",
      currentlyWorking: Boolean(exp.currently_working),
      bullets: sortedBullets(exp.cv_experience_bullets),
    })),
    projects: (projRes.data || []).map((proj) => ({
      id: proj.id,
      name: proj.name || "",
      description: proj.description || "",
      startDate: proj.start_date || "",
      endDate: proj.end_date || "",
      currentlyWorking: Boolean(proj.currently_working),
      bullets: sortedBullets(proj.cv_project_bullets),
    })),
    skills: (skillRes.data || []).map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category || "",
    })),
  };
}
