"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { HttpError } from "@/server/http";
import { DEFAULT_STATUS } from "@/lib/constants";
import { applicationFields, commentsSchema, optionalText, statusSchema } from "@/features/applications/schema";
import { insertApplication, payloadDetailColumns } from "@/server/applications/insertApplication";
import { getOpportunityForUrl } from "@/server/opportunities/service";

const MAX_BULK = 500;

const idSchema = z.string().uuid("Invalid application");
const idsSchema = z.array(idSchema).min(1, "Select at least one application").max(MAX_BULK);
const optionalId = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);

const createSchema = z.object({
  ...applicationFields,
  jobDescription: optionalText(50_000, "Job description"),
  resumeId: optionalId,
  coverLetterId: optionalId,
});

const pay = z.coerce
  .number()
  .int("Use whole numbers for pay")
  .nonnegative("Pay can't be negative")
  .max(10_000_000, "That pay looks too high")
  .nullable();

// Pay, workplace and employment type (migration 010). Only sent when the
// database has those columns.
const jobDetailsSchema = z
  .object({
    salaryMin: pay,
    salaryMax: pay,
    salaryCurrency: z.string().regex(/^[A-Z]{3}$/, "Pick a currency"),
    salaryPeriod: z.enum(["hour", "day", "week", "month", "year"]),
    workplaceType: z.enum(["", "remote", "hybrid", "onsite"]),
    employmentType: z.string().trim().max(40),
  })
  .refine((d) => d.salaryMin == null || d.salaryMax == null || d.salaryMin <= d.salaryMax, {
    message: "The lowest pay must be at most the highest",
  });

const updateSchema = z.object({
  ...applicationFields,
  jobDescription: optionalText(50_000, "Job description"),
  jobDetails: jobDetailsSchema.optional(),
});

function revalidateApplications(id) {
  revalidatePath("/");
  revalidatePath("/applications");
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

// The saved job for a posting link, if any. Filling from it is a convenience,
// so a lookup failure never blocks adding the application.
async function savedJobFor(supabase, userId, portalLink) {
  if (!portalLink) return null;
  try {
    return await getOpportunityForUrl(supabase, userId, portalLink);
  } catch (error) {
    console.error("createApplication saved job lookup:", error);
    return null;
  }
}

// The saved job's resume, if it still exists and is the user's
async function ownedResume(supabase, userId, resumeId) {
  if (!resumeId) return null;
  const { data, error } = await supabase
    .from("resumes")
    .select("id")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function createApplication(input) {
  return runAction("createApplication", async () => {
    const { supabase, user } = await requireUser();
    const fields = parseInput(createSchema, input);

    const [saved] = await Promise.all([
      savedJobFor(supabase, user.id, fields.portalLink),
      assertOwnsDocument(supabase, "resumes", fields.resumeId, user.id),
      assertOwnsDocument(supabase, "cover_letters", fields.coverLetterId, user.id),
    ]);
    // What the user left empty comes from the matching saved job; typed values win
    const savedPayload = saved?.payload || {};
    const resumeId = fields.resumeId || (await ownedResume(supabase, user.id, saved?.resume_id));

    const { id } = await insertApplication(
      supabase,
      user.id,
      {
        company: fields.company,
        role: fields.role,
        location: fields.location,
        portal_link: fields.portalLink,
        status: fields.status,
        comments: fields.comments,
        // Left out when blank so the column default (today) applies
        applied_date: fields.appliedDate,
        job_description: fields.jobDescription || savedPayload.job_description || "",
        resume_id: resumeId,
        cover_letter_id: fields.coverLetterId,
      },
      payloadDetailColumns(savedPayload)
    );

    revalidateApplications();
    if (saved) revalidatePath("/saved-jobs");
    return { id };
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
        ...(fields.jobDetails && {
          salary_min: fields.jobDetails.salaryMin,
          salary_max: fields.jobDetails.salaryMax,
          salary_currency: fields.jobDetails.salaryCurrency,
          salary_period: fields.jobDetails.salaryPeriod,
          workplace_type: fields.jobDetails.workplaceType || null,
          employment_type: fields.jobDetails.employmentType || null,
        }),
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
    revalidatePath("/applications");
    return { id: applicationId };
  });

  if (!result.ok) return result;
  redirect("/applications");
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
