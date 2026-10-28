import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { jobDetailColumns } from "@/lib/jobDetails";
import { normalizePostingIdentity } from "@/lib/postingIdentity";
import { HttpError } from "@/server/http";
const HOUR_MS = 60 * 60 * 1000;
// Undo is offered right after an application is added, not forever
const UNDO_WINDOW_MS = 24 * HOUR_MS;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// What a content script reads from a job posting. Page content is untrusted:
// everything is capped, and the URL must be http(s).
export const recordApplicationInput = z.object({
  eventId: z.string().uuid().optional(),
  postingId: z.string().trim().max(200).optional(),
  company: z.string().trim().min(1, "Company is required").max(200),
  role: z.string().trim().max(200).default(""),
  location: z.string().trim().max(200).default(""),
  url: z.string().trim().max(2000).default(""),
  jobDescription: z.string().max(50_000).default(""),
  // The extension sends the user's local date, since "today" depends on their timezone
  appliedDate: isoDate.optional(),
  // Which site adapter detected it (e.g. "greenhouse"): shown as where it was applied
  detectedBy: z.string().trim().max(50).default(""),
  // From the posting's structured data, when it has any
  salary: z
    .object({
      min: z.number().int().nonnegative().max(10_000_000).nullable(),
      max: z.number().int().nonnegative().max(10_000_000).nullable(),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .default("USD"),
      period: z.enum(["hour", "day", "week", "month", "year"]).nullable().default(null),
    })
    .nullable()
    .default(null),
  employmentType: z.string().trim().max(40).default(""),
  workplaceType: z.enum(["", "remote", "hybrid", "onsite"]).default(""),
});

/**
 * Add an application the extension saw the user submit, or update the one
 * already tracked for that posting (same link, or same company and role).
 * `admin` is a service-role client, so every query is scoped by userId.
 * Returns { application, created }.
 */
export async function recordApplication(admin, userId, input) {
  let identity;
  try {
    identity = normalizePostingIdentity({ url: input.url, platform: input.postingId ? input.detectedBy : undefined, postingId: input.postingId });
  } catch {
    throw new HttpError(400, "The posting details do not match its link. Reload the job and try again.");
  }
  const payload = {
    company: input.company, role: input.role || "", location: input.location || "",
    portal_link: identity.urlKey, job_description: input.jobDescription || "",
    applied_date: input.appliedDate || new Date().toISOString().slice(0, 10),
    posting_platform: identity.platform, posting_namespace: identity.namespace,
    posting_id: identity.postingId, posting_url_key: identity.urlKey,
    ...jobDetailColumns({ salary: input.salary, employmentType: input.employmentType, workplaceType: input.workplaceType, location: input.location, description: input.jobDescription, site: input.detectedBy }),
  };
  const eventId = input.eventId || randomUUID();
  const { data, error } = await admin.rpc("record_extension_application", { p_user_id: userId, p_event_id: eventId, p_payload: payload });
  if (["PGRST202", "42883", "42703", "PGRST204"].includes(error?.code)) throw new HttpError(503, "Application tracking is being updated. Your extension will retry shortly.");
  if (error?.code === "55000") throw new HttpError(409, "This submission changed or was removed. Review it in Resume Butler.");
  if (error?.code === "54000") throw new HttpError(429, "Too many submissions. Try again later.");
  if (error) throw error;
  if (data?.status === "needs_matching" && data.eventId === eventId) return data;
  if (!z.string().uuid().safeParse(data?.application?.id).success || typeof data.created !== "boolean") throw new Error("Invalid application record result");
  return data;
}

/**
 * Undo: remove an application the extension added, within a day of adding it
 * and only while it's still untouched at "Applied". Anything older or already
 * moved on is the user's to delete in the app.
 */
export async function undoApplication(admin, userId, applicationId) {
  const { data, error } = await admin
    .from("applications")
    .select("id, source, status, created_at")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Application not found");
  if (data.source !== "extension")
    throw new HttpError(400, "Only applications the extension added can be undone");
  if (data.status !== "Applied" || Date.now() - new Date(data.created_at).getTime() > UNDO_WINDOW_MS) {
    throw new HttpError(
      400,
      "This application has changed since it was added. Remove it in Resume Butler instead."
    );
  }

  const { error: deleteError } = await admin
    .from("applications")
    .delete()
    .eq("id", applicationId)
    .eq("user_id", userId);
  if (deleteError) throw deleteError;
  return { id: applicationId };
}
