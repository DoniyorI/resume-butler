"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { HttpError } from "@/server/http";

const TITLE_MAX = 200;
const MAX_CONTENT_CHARS = 100_000;

const idSchema = z.string().uuid("Invalid cover letter");
const titleSchema = z.string().trim().min(1, "Title is required").max(TITLE_MAX, "Title is too long");
const headerField = z.string().max(500);

const contentSchema = z.object({
  // Draft.js raw content (convertToRaw)
  body: z.object({ blocks: z.array(z.record(z.unknown())), entityMap: z.record(z.unknown()) }),
  header: z.object({
    contactPhone: headerField,
    contactEmail: headerField,
    name: headerField,
    linkedin: headerField,
    portfolio: headerField,
  }),
  date: z.string().datetime().nullable(),
  recipient: z.object({ name: z.string().max(200), company: z.string().max(200) }),
  greeting: z.string().max(200),
  signOff: z.string().max(200),
  target: z.object({
    jobDescription: z.string().max(50_000),
    applicationId: z.string().uuid().nullable(),
    company: z.string().max(200),
    role: z.string().max(200),
  }),
});

// Writes `content` over the stored content, keeping keys it doesn't include
async function mergeContent(supabase, userId, id, content) {
  if (JSON.stringify(content).length > MAX_CONTENT_CHARS) {
    throw new HttpError(413, "Cover letter is too large to save");
  }
  const { data: existing, error } = await supabase
    .from("cover_letters")
    .select("content")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!existing) throw new HttpError(404, "Cover letter not found");
  const stored = existing.content && typeof existing.content === "object" ? existing.content : {};
  return { ...stored, ...content };
}

async function updateCoverLetter(supabase, userId, id, values) {
  const { data, error } = await supabase
    .from("cover_letters")
    .update(values)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Cover letter not found");
  revalidatePath("/documents");
  revalidatePath(`/coverletters/${id}`);
  return data;
}

export async function createCoverLetter(input) {
  const result = await runAction("Error creating cover letter", async () => {
    const { supabase, user } = await requireUser();
    const title = parseInput(titleSchema, input?.title);

    const { data, error } = await supabase
      .from("cover_letters")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (error) throw error;
    return data;
  });

  if (!result.ok) return result;
  revalidatePath("/documents");
  redirect(`/coverletters/${result.data.id}`);
}

export async function renameCoverLetter(coverLetterId, title) {
  return runAction("Error renaming cover letter", async () => {
    const { supabase, user } = await requireUser();
    const id = parseInput(idSchema, coverLetterId);
    return updateCoverLetter(supabase, user.id, id, { title: parseInput(titleSchema, title) });
  });
}

export async function deleteCoverLetter(coverLetterId) {
  return runAction("Error deleting cover letter", async () => {
    const { supabase, user } = await requireUser();
    const id = parseInput(idSchema, coverLetterId);

    const { error } = await supabase.from("cover_letters").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;

    revalidatePath("/documents");
    return { id };
  });
}

// Autosave for the editor. Like the resume autosave it skips
// revalidatePath, which would re-render the page after every pause in typing.
export async function saveCoverLetterContent(coverLetterId, content) {
  return runAction("Error saving cover letter", async () => {
    const { supabase, user } = await requireUser();
    const id = parseInput(idSchema, coverLetterId);
    const merged = await mergeContent(supabase, user.id, id, parseInput(contentSchema, content));

    const { error } = await supabase
      .from("cover_letters")
      .update({ content: merged })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return null;
  });
}
