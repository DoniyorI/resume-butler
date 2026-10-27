"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { HttpError } from "@/server/http";
import { normalizeHttpUrl } from "@/lib/safeUrl";
import { getCertifications, getEducation, getExperience, getProjects } from "@/features/cv/data";

const MAX_ENTRIES = 100;
const MAX_BULLETS = 50;

const uuid = z.string().uuid();
const newOrExistingId = uuid.nullish();
const text = (max) => z.string().trim().max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .nullable();
const url = text(2048).transform((value) => normalizeHttpUrl(value) || null);
const bullets = z.array(text(2000)).max(MAX_BULLETS);

const experienceSchema = z.object({
  id: newOrExistingId,
  company: text(200),
  position: text(200),
  location: text(200),
  type: text(50),
  currentlyWorking: z.boolean(),
  startDate: date,
  endDate: date,
  bullets,
});

const projectSchema = z.object({
  id: newOrExistingId,
  name: text(200),
  description: text(2000),
  url,
  currentlyWorking: z.boolean(),
  startDate: date,
  endDate: date,
  bullets,
});

const educationSchema = z.object({
  id: newOrExistingId,
  school: text(200),
  location: text(200),
  major: text(200),
  degreeType: text(50),
  // The GPA input gives a string; an empty one is stored as null (gpa is numeric)
  gpa: z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    z.number({ invalid_type_error: "GPA must be a number" }).min(0).max(10).nullable()
  ),
  startDate: date,
  endDate: date,
});

const certificationSchema = z.object({
  id: newOrExistingId,
  name: text(200),
  issuer: text(200),
  dateEarned: date,
  url,
});

const skillSchema = z.object({
  name: text(100).min(1, "Enter a skill"),
  category: text(50),
  sortOrder: z.number().int().min(0).max(10_000),
});

const parse = (schema, input) => parseInput(schema, input, { withField: true });

// Every CV action needs the user and refreshes the profile page (which shows the CV) afterwards
function run(context, body) {
  return runAction(context, async () => {
    const { supabase, user } = await requireUser();
    const data = await body(supabase, user);
    revalidatePath("/profile");
    return data;
  });
}

// Updates the user's row (or inserts a new one) and returns its id. Updates are
// scoped by user_id, so a row that isn't the user's matches nothing.
async function saveOwnedRow(supabase, userId, table, rowId, row) {
  if (rowId) {
    const { data, error } = await supabase
      .from(table)
      .update(row)
      .eq("id", rowId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError(404, "An entry no longer exists. Reload the page and try again.");
    return data.id;
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ ...row, user_id: userId })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

// Callers must have checked that parentId belongs to the user (saveOwnedRow does)
async function replaceBullets(supabase, table, parentColumn, parentId, contents) {
  const { error: deleteError } = await supabase.from(table).delete().eq(parentColumn, parentId);
  if (deleteError) throw deleteError;

  const rows = contents
    .filter((content) => content !== "")
    .map((content, index) => ({ [parentColumn]: parentId, content, sort_order: index }));
  if (rows.length === 0) return;

  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}

async function deleteOwnedRow(supabase, userId, table, rowId) {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", parse(uuid, rowId))
    .eq("user_id", userId)
    .select("id");

  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "That entry no longer exists.");
}

// Saves the whole list in its current order and returns the stored entries
export async function saveExperience(entries) {
  return run("saveExperience", async (supabase, user) => {
    const parsed = parse(z.array(experienceSchema).max(MAX_ENTRIES), entries);

    for (const [index, entry] of parsed.entries()) {
      const experienceId = await saveOwnedRow(supabase, user.id, "cv_experience", entry.id, {
        company: entry.company,
        position: entry.position,
        location: entry.location,
        type: entry.type,
        currently_working: entry.currentlyWorking,
        start_date: entry.startDate,
        end_date: entry.endDate,
        sort_order: index,
      });
      await replaceBullets(supabase, "cv_experience_bullets", "experience_id", experienceId, entry.bullets);
    }

    return getExperience(supabase, user.id);
  });
}

// Bullets go with it (on delete cascade)
export async function deleteExperience(experienceId) {
  return run("deleteExperience", (supabase, user) =>
    deleteOwnedRow(supabase, user.id, "cv_experience", experienceId)
  );
}

export async function saveProjects(entries) {
  return run("saveProjects", async (supabase, user) => {
    const parsed = parse(z.array(projectSchema).max(MAX_ENTRIES), entries);

    for (const [index, entry] of parsed.entries()) {
      const projectId = await saveOwnedRow(supabase, user.id, "cv_projects", entry.id, {
        name: entry.name,
        description: entry.description,
        url: entry.url,
        currently_working: entry.currentlyWorking,
        start_date: entry.startDate,
        end_date: entry.endDate,
        sort_order: index,
      });
      await replaceBullets(supabase, "cv_project_bullets", "project_id", projectId, entry.bullets);
    }

    return getProjects(supabase, user.id);
  });
}

export async function deleteProject(projectId) {
  return run("deleteProject", (supabase, user) =>
    deleteOwnedRow(supabase, user.id, "cv_projects", projectId)
  );
}

export async function saveEducation(entries) {
  return run("saveEducation", async (supabase, user) => {
    const parsed = parse(z.array(educationSchema).max(MAX_ENTRIES), entries);

    for (const [index, entry] of parsed.entries()) {
      await saveOwnedRow(supabase, user.id, "cv_education", entry.id, {
        school: entry.school,
        location: entry.location,
        degree_type: entry.degreeType,
        major: entry.major,
        gpa: entry.gpa,
        start_date: entry.startDate,
        end_date: entry.endDate,
        sort_order: index,
      });
    }

    return getEducation(supabase, user.id);
  });
}

export async function deleteEducation(educationId) {
  return run("deleteEducation", (supabase, user) =>
    deleteOwnedRow(supabase, user.id, "cv_education", educationId)
  );
}

export async function saveCertifications(entries) {
  return run("saveCertifications", async (supabase, user) => {
    const parsed = parse(z.array(certificationSchema).max(MAX_ENTRIES), entries);

    for (const entry of parsed) {
      await saveOwnedRow(supabase, user.id, "cv_certifications", entry.id, {
        name: entry.name,
        issuer: entry.issuer,
        date_earned: entry.dateEarned,
        url: entry.url,
      });
    }

    return getCertifications(supabase, user.id);
  });
}

export async function deleteCertification(certificationId) {
  return run("deleteCertification", (supabase, user) =>
    deleteOwnedRow(supabase, user.id, "cv_certifications", certificationId)
  );
}

export async function addSkill(input) {
  return run("addSkill", async (supabase, user) => {
    const skill = parse(skillSchema, input);

    const { data, error } = await supabase
      .from("cv_skills")
      .insert({
        user_id: user.id,
        name: skill.name,
        category: skill.category,
        sort_order: skill.sortOrder,
      })
      .select("id, name, category")
      .single();

    if (error) throw error;
    return data;
  });
}

export async function deleteSkill(skillId) {
  return run("deleteSkill", (supabase, user) => deleteOwnedRow(supabase, user.id, "cv_skills", skillId));
}
