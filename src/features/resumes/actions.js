"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { HttpError } from "@/server/http";
import { SECTION_IDS } from "@/features/resumes/resumeDocument";

const TITLE_MAX = 200;
const MAX_ITEMS_PER_SECTION = 100;
const MAX_CONTENT_CHARS = 250_000;

const idSchema = z.string().uuid("Invalid resume");
const titleSchema = z.string().trim().min(1, "Title is required").max(TITLE_MAX, "Title is too long");

const itemsSchema = z.array(z.record(z.unknown())).max(MAX_ITEMS_PER_SECTION, "Too many items");

const targetSchema = z.object({
  jobDescription: z.string().max(50_000),
  applicationId: z.string().uuid().nullable(),
  company: z.string().max(200),
  role: z.string().max(200),
});

const contentSchema = z.object({
  header: z.record(z.string().max(1000).nullable()),
  education: itemsSchema,
  experience: itemsSchema,
  projects: itemsSchema,
  skills: itemsSchema,
  order: z
    .array(z.object({ id: z.enum(SECTION_IDS), title: z.string().max(100), hidden: z.boolean().optional() }))
    .max(SECTION_IDS.length),
  // Optional so a save without it keeps the stored one
  target: targetSchema.optional(),
});

export async function createResume(input) {
  const result = await runAction("Error creating resume", async () => {
    const { supabase, user } = await requireUser();
    const title = parseInput(titleSchema, input?.title);

    const { data, error } = await supabase
      .from("resumes")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (error) throw error;
    return data;
  });

  if (!result.ok) return result;
  revalidatePath("/documents");
  redirect(`/resumes/${result.data.id}`);
}

export async function renameResume(resumeId, title) {
  return runAction("Error renaming resume", async () => {
    const { supabase, user } = await requireUser();
    const id = parseInput(idSchema, resumeId);
    const newTitle = parseInput(titleSchema, title);

    const { data, error } = await supabase
      .from("resumes")
      .update({ title: newTitle })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, title")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Resume not found");

    revalidatePath("/documents");
    revalidatePath(`/resumes/${id}`);
    return data;
  });
}

export async function deleteResume(resumeId) {
  return runAction("Error deleting resume", async () => {
    const { supabase, user } = await requireUser();
    const id = parseInput(idSchema, resumeId);

    const { error } = await supabase.from("resumes").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;

    revalidatePath("/documents");
    return { id };
  });
}

// Autosave for the editor. Merges over the stored content so keys the editor
// doesn't manage are kept. It doesn't call revalidatePath: that would re-render
// the editor page on the server after every debounced keystroke.
export async function saveResumeContent(resumeId, content) {
  return runAction("Error saving resume", async () => {
    const { supabase, user } = await requireUser();
    const id = parseInput(idSchema, resumeId);
    const next = parseInput(contentSchema, content);
    if (JSON.stringify(next).length > MAX_CONTENT_CHARS) {
      throw new HttpError(413, "Resume is too large to save");
    }

    const { data: existing, error: readError } = await supabase
      .from("resumes")
      .select("content")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) throw new HttpError(404, "Resume not found");

    const { error } = await supabase
      .from("resumes")
      .update({ content: { ...(existing.content || {}), ...next } })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return null;
  });
}

// The job description of one of the user's applications, for tailoring a
// resume to it. Loaded on demand so the editor page doesn't ship every posting.
export async function loadApplicationJob(applicationId) {
  return runAction("Error loading the job", async () => {
    const { supabase, user } = await requireUser();
    const id = parseInput(z.string().uuid("Invalid application"), applicationId);

    const { data, error } = await supabase
      .from("applications")
      .select("id, company, role, job_description")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Application not found");

    return {
      applicationId: data.id,
      company: data.company || "",
      role: data.role || "",
      jobDescription: data.job_description || "",
    };
  });
}
