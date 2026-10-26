"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { HttpError } from "@/server/http";
import { APPLICATION_STATUSES, DEFAULT_STATUS } from "@/lib/constants";
import { normalizeHttpUrl } from "@/lib/safeUrl";

const MAX_BULK = 500;

const idSchema = z.string().uuid("Invalid application");
const idsSchema = z.array(idSchema).min(1, "Select at least one application").max(MAX_BULK);
const statusSchema = z.enum(APPLICATION_STATUSES, {
  errorMap: () => ({ message: "Unknown status" }),
});
const commentsSchema = z.string().trim().max(5000, "Comments are too long");
const optionalText = (max, label) => z.string().trim().max(max, `${label} is too long`).default("");
const optionalId = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);

// The fields the add dialog and the detail page both edit
const applicationFields = {
  company: z.string().trim().min(1, "Company name is required").max(200, "Company name is too long"),
  role: optionalText(200, "Role"),
  location: optionalText(200, "Location"),
  portalLink: z.string().max(2048, "Portal link is too long").default("").transform(normalizeHttpUrl),
  status: statusSchema.default(DEFAULT_STATUS),
  comments: commentsSchema.default(""),
  appliedDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null),
};

const createSchema = z.object({
  ...applicationFields,
  resumeId: optionalId,
  coverLetterId: optionalId,
});

const updateSchema = z.object({
  ...applicationFields,
  jobDescription: optionalText(50_000, "Job description"),
});

function revalidateApplications(id) {
  revalidatePath("/");
  revalidatePath("/dash");
  if (id) revalidatePath(`/applications/${id}`);
}

async function assertOwnsDocument(supabase, table, id, userId) {
  if (!id) return;
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Linked document not found");
}

export async function createApplication(input) {
  return runAction("createApplication", async () => {
    const { supabase, user } = await requireUser();
    const fields = parseInput(createSchema, input);

    await Promise.all([
      assertOwnsDocument(supabase, "resumes", fields.resumeId, user.id),
      assertOwnsDocument(supabase, "cover_letters", fields.coverLetterId, user.id),
    ]);

    const { data, error } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        company: fields.company,
        role: fields.role,
        location: fields.location,
        portal_link: fields.portalLink,
        status: fields.status,
        comments: fields.comments,
        applied_date: fields.appliedDate,
        resume_id: fields.resumeId,
        cover_letter_id: fields.coverLetterId,
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidateApplications();
    return { id: data.id };
  });
}

export async function updateApplication(id, input) {
  return runAction("updateApplication", async () => {
    const { supabase, user } = await requireUser();
    const applicationId = parseInput(idSchema, id);
    const fields = parseInput(updateSchema, input);

    const { data, error } = await supabase
      .from("applications")
      .update({
        company: fields.company,
        role: fields.role,
        location: fields.location,
        portal_link: fields.portalLink,
        status: fields.status,
        comments: fields.comments,
        job_description: fields.jobDescription,
        applied_date: fields.appliedDate,
      })
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Application not found");

    revalidateApplications(applicationId);
    return { id: applicationId };
  });
}

export async function updateApplicationStatus(id, status) {
  return runAction("updateApplicationStatus", async () => {
    const { supabase, user } = await requireUser();
    const applicationId = parseInput(idSchema, id);
    const newStatus = parseInput(statusSchema, status);

    const { data, error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Application not found");

    revalidateApplications(applicationId);
    return { id: applicationId, status: newStatus };
  });
}

export async function updateApplicationComments(id, comments) {
  return runAction("updateApplicationComments", async () => {
    const { supabase, user } = await requireUser();
    const applicationId = parseInput(idSchema, id);
    const newComments = parseInput(commentsSchema, comments ?? "");

    const { data, error } = await supabase
      .from("applications")
      .update({ comments: newComments })
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Application not found");

    revalidateApplications(applicationId);
    return { id: applicationId, comments: newComments };
  });
}

export async function bulkUpdateApplicationStatus(ids, status) {
  return runAction("bulkUpdateApplicationStatus", async () => {
    const { supabase, user } = await requireUser();
    const applicationIds = parseInput(idsSchema, ids);
    const newStatus = parseInput(statusSchema, status);

    const { data, error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .in("id", applicationIds)
      .eq("user_id", user.id)
      .select("id");
    if (error) throw error;

    revalidateApplications();
    return { count: data.length, status: newStatus };
  });
}

export async function deleteApplications(ids) {
  return runAction("deleteApplications", async () => {
    const { supabase, user } = await requireUser();
    const applicationIds = parseInput(idsSchema, ids);

    const { data, error } = await supabase
      .from("applications")
      .delete()
      .in("id", applicationIds)
      .eq("user_id", user.id)
      .select("id");
    if (error) throw error;

    revalidateApplications();
    return { count: data.length };
  });
}

// Used from the detail page. Redirecting from the action (instead of
// revalidating) keeps the page from re-rendering as a 404 before navigation.
export async function deleteApplicationAndReturn(id) {
  const result = await runAction("deleteApplicationAndReturn", async () => {
    const { supabase, user } = await requireUser();
    const applicationId = parseInput(idSchema, id);

    const { data, error } = await supabase
      .from("applications")
      .delete()
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .select("id");
    if (error) throw error;
    if (data.length === 0) throw new HttpError(404, "Application not found");

    revalidatePath("/");
    revalidatePath("/dash");
    return { id: applicationId };
  });

  if (!result.ok) return result;
  redirect("/");
}

export async function duplicateApplication(id) {
  return runAction("duplicateApplication", async () => {
    const { supabase, user } = await requireUser();
    const applicationId = parseInput(idSchema, id);

    const { data: original, error: readError } = await supabase
      .from("applications")
      .select("company, role, location, portal_link, comments")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!original) throw new HttpError(404, "Application not found");

    const { data, error } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        company: original.company,
        role: original.role,
        location: original.location,
        portal_link: original.portal_link,
        comments: original.comments,
        status: DEFAULT_STATUS,
        applied_date: format(new Date(), "yyyy-MM-dd"),
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidateApplications();
    return { id: data.id };
  });
}

// Resumes and cover letters the add dialog can link. A read, but the dialog
// lives in the nav on every page, so it loads these when it opens.
export async function listLinkableDocuments() {
  return runAction("listLinkableDocuments", async () => {
    const { supabase, user } = await requireUser();

    const [resumesRes, lettersRes] = await Promise.all([
      supabase
        .from("resumes")
        .select("id, title")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("cover_letters")
        .select("id, title")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    if (resumesRes.error) throw resumesRes.error;
    if (lettersRes.error) throw lettersRes.error;

    return { resumes: resumesRes.data || [], coverLetters: lettersRes.data || [] };
  });
}
