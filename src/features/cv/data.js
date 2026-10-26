import "server-only";

// Reads for the master CV. Dates stay as the "yyyy-MM-dd" strings Postgres
// returns; the client turns them into local Date objects for the pickers.

async function selectOwned(supabase, table, userId, orderColumn, ascending = true) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order(orderColumn, { ascending });

  if (error) throw error;
  return data || [];
}

// Returns { [parentId]: ["bullet", ...] } in sort order
async function selectBullets(supabase, table, parentColumn, parentIds) {
  if (parentIds.length === 0) return {};

  const { data, error } = await supabase
    .from(table)
    .select(`${parentColumn}, content`)
    .in(parentColumn, parentIds)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const byParent = {};
  for (const bullet of data || []) {
    (byParent[bullet[parentColumn]] ||= []).push(bullet.content);
  }
  return byParent;
}

// An entry with no bullets still shows one empty bullet input
const bulletsOrEmpty = (bullets) => (bullets?.length ? bullets : [""]);

export async function getExperience(supabase, userId) {
  const rows = await selectOwned(supabase, "cv_experience", userId, "sort_order");
  const bullets = await selectBullets(
    supabase,
    "cv_experience_bullets",
    "experience_id",
    rows.map((row) => row.id)
  );

  return rows.map((row) => ({
    id: row.id,
    company: row.company || "",
    location: row.location || "",
    position: row.position || "",
    type: row.type || "",
    currentlyWorking: row.currently_working || false,
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    bullets: bulletsOrEmpty(bullets[row.id]),
  }));
}

export async function getProjects(supabase, userId) {
  const rows = await selectOwned(supabase, "cv_projects", userId, "sort_order");
  const bullets = await selectBullets(
    supabase,
    "cv_project_bullets",
    "project_id",
    rows.map((row) => row.id)
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    url: row.url || "",
    currentlyWorking: row.currently_working || false,
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    bullets: bulletsOrEmpty(bullets[row.id]),
  }));
}

export async function getEducation(supabase, userId) {
  const rows = await selectOwned(supabase, "cv_education", userId, "sort_order");

  return rows.map((row) => ({
    id: row.id,
    school: row.school || "",
    location: row.location || "",
    major: row.major || "",
    degreeType: row.degree_type || "",
    gpa: row.gpa ?? "",
    startDate: row.start_date || "",
    endDate: row.end_date || "",
  }));
}

export async function getSkills(supabase, userId) {
  const rows = await selectOwned(supabase, "cv_skills", userId, "sort_order");

  return rows.map((row) => ({
    id: row.id,
    name: row.name || "",
    category: row.category || "Other",
  }));
}

export async function getCertifications(supabase, userId) {
  const rows = await selectOwned(supabase, "cv_certifications", userId, "date_earned", false);

  return rows.map((row) => ({
    id: row.id,
    name: row.name || "",
    issuer: row.issuer || "",
    dateEarned: row.date_earned || "",
    url: row.url || "",
  }));
}

export async function getCvData(supabase, userId) {
  const [experience, projects, education, skills, certifications] = await Promise.all([
    getExperience(supabase, userId),
    getProjects(supabase, userId),
    getEducation(supabase, userId),
    getSkills(supabase, userId),
    getCertifications(supabase, userId),
  ]);

  return { experience, projects, education, skills, certifications };
}
