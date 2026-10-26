import "server-only";

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
