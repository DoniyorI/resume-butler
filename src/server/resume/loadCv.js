import "server-only";
import { loadCvSections } from "./cvSections.js";

async function rows(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * The user's profile and master CV rows as stored (snake_case). Experience and
 * project rows include their nested cv_experience_bullets / cv_project_bullets.
 */
export async function loadCv(supabase, userId) {
  const [profileRes, experience, projects, education, skills] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    rows(supabase.from("cv_experience").select("*, cv_experience_bullets(*)").eq("user_id", userId)),
    rows(supabase.from("cv_projects").select("*, cv_project_bullets(*)").eq("user_id", userId)),
    rows(supabase.from("cv_education").select("*").eq("user_id", userId)),
    rows(supabase.from("cv_skills").select("*").eq("user_id", userId)),
  ]);
  if (profileRes.error) throw profileRes.error;

  return { profile: profileRes.data, experience, projects, education, skills };
}

export function bulletTexts(bullets) {
  return (bullets || []).map((b) => b.content);
}

function sortedBullets(bullets) {
  return [...(bullets || [])].sort((a, b) => a.sort_order - b.sort_order).map((b) => b.content);
}

/**
 * The master CV in camelCase, in the user's order: { education, experience,
 * projects, skills }. Each entry keeps its row id so AI picks can refer to it.
 */
export async function loadMasterCv(supabase, userId) {
  const [eduRes, expRes, projRes, skillRes, certRes, sectionSettings] = await Promise.all([
    supabase.from("cv_education").select("*").eq("user_id", userId).order("sort_order"),
    supabase
      .from("cv_experience")
      .select("*, cv_experience_bullets(*)")
      .eq("user_id", userId)
      .order("sort_order"),
    supabase.from("cv_projects").select("*, cv_project_bullets(*)").eq("user_id", userId).order("sort_order"),
    supabase.from("cv_skills").select("*").eq("user_id", userId).order("sort_order"),
    supabase.from("cv_certifications").select("*").eq("user_id", userId).order("date_earned"),
    loadCvSections(supabase, userId),
  ]);
  for (const res of [eduRes, expRes, projRes, skillRes, certRes]) {
    if (res.error) throw res.error;
  }

  return {
    customSections: sectionSettings.customSections, sectionTitles: sectionSettings.titles,
    certifications: certRes.data.map(cert => ({ id: cert.id, name: cert.name || "", issuer: cert.issuer || "", dateEarned: cert.date_earned || "", url: cert.url || "" })),
    education: eduRes.data.map((edu) => ({
      id: edu.id,
      school: edu.school || "",
      location: edu.location || "",
      major: edu.major || "",
      degreeType: edu.degree_type || "",
      gpa: edu.gpa || "",
      startDate: edu.start_date || "",
      endDate: edu.end_date || "",
    })),
    experience: expRes.data.map((exp) => ({
      id: exp.id,
      company: exp.company || "",
      position: exp.position || "",
      location: exp.location || "",
      startDate: exp.start_date || "",
      endDate: exp.end_date || "",
      currentlyWorking: Boolean(exp.currently_working),
      bullets: sortedBullets(exp.cv_experience_bullets),
    })),
    projects: projRes.data.map((proj) => ({
      id: proj.id,
      name: proj.name || "",
      description: proj.description || "",
      startDate: proj.start_date || "",
      endDate: proj.end_date || "",
      currentlyWorking: Boolean(proj.currently_working),
      bullets: sortedBullets(proj.cv_project_bullets),
    })),
    skills: skillRes.data.map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category || "",
    })),
  };
}
