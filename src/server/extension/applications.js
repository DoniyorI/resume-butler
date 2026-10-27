import "server-only";
import { z } from "zod";
import { jobDetailColumns, sourceSiteLabel } from "@/lib/jobDetails";
import { normalizeHttpUrl } from "@/lib/safeUrl";
import { HttpError } from "@/server/http";
import { isSameCycle, normalizeCompany, normalizeRole } from "@/server/email/matching";

// Guards against a runaway content script; real use is a few a day
const MAX_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;
// Undo is offered right after an application is added, not forever
const UNDO_WINDOW_MS = 24 * HOUR_MS;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// What a content script reads from a job posting. Page content is untrusted:
// everything is capped, and the URL must be http(s).
export const recordApplicationInput = z.object({
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

// Postgres "undefined column" (or PostgREST's schema cache missing it): the
// job-detail columns of migration 010 aren't there yet
const missingColumn = (error) => error?.code === "42703" || error?.code === "PGRST204";

// Insert or update with the job details, and again without them if the
// database doesn't have those columns yet, so the extension keeps working
async function writeWithDetails(write, row, details) {
  const result = await write({ ...row, ...details });
  if (result.error && missingColumn(result.error) && Object.keys(details).length) {
    console.warn("Job details not saved; apply supabase/migrations/010_job_details.sql");
    return write(row);
  }
  return result;
}

function toRecord(row) {
  return {
    id: row.id,
    company: row.company,
    role: row.role || "",
    status: row.status,
    appliedDate: row.applied_date,
  };
}

/**
 * Add an application the extension saw the user submit, or update the one
 * already tracked for that posting (same link, or same company and role).
 * `admin` is a service-role client, so every query is scoped by userId.
 * Returns { application, created }.
 */
export async function recordApplication(admin, userId, input) {
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const { count, error: countError } = await admin
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "extension")
    .gte("created_at", since);
  if (countError) throw countError;
  if (count >= MAX_PER_HOUR)
    throw new HttpError(429, "Too many applications from the extension. Try again later.");

  const url = normalizeHttpUrl(input.url);
  const { data: existing, error: listError } = await admin
    .from("applications")
    .select("*")
    .eq("user_id", userId);
  if (listError) throw listError;

  // The user just submitted it, so it's a new application unless it's the same
  // posting (same link), or the same company and exactly the same role, and
  // that application is still open and recent. Looser rules, like the email
  // matcher's, would fold a new job into another one at that company (such as
  // when the page didn't show the role); a closed or months-old match means
  // they're applying again in a new hiring cycle.
  const company = normalizeCompany(input.company);
  const role = normalizeRole(input.role);
  const current = existing.filter((app) => isSameCycle(app));
  const match =
    (url && current.find((app) => app.portal_link === url)) ||
    (role &&
      current.find((app) => normalizeCompany(app.company) === company && normalizeRole(app.role) === role));

  const details = jobDetailColumns({
    salary: input.salary,
    employmentType: input.employmentType,
    workplaceType: input.workplaceType,
    location: input.location,
    description: input.jobDescription,
    site: input.detectedBy,
  });

  if (match) {
    // Fill in what's missing; never overwrite what the user or email sync set
    const changes = {};
    if (!match.portal_link && url) changes.portal_link = url;
    if (!match.job_description && input.jobDescription) changes.job_description = input.jobDescription;
    if (!match.location && input.location) changes.location = input.location;
    // Columns from migration 010 are only on the row once it's applied
    const missingDetails = Object.fromEntries(
      Object.entries(details).filter(([column]) => column in match && match[column] == null)
    );
    if (missingDetails.salary_min != null && (match.salary_min != null || match.salary_max != null)) {
      for (const column of ["salary_min", "salary_max", "salary_currency", "salary_period"])
        delete missingDetails[column];
    }
    if (Object.keys(changes).length === 0 && Object.keys(missingDetails).length === 0) {
      return { application: toRecord(match), created: false };
    }

    const { data, error } = await writeWithDetails(
      (values) =>
        admin
          .from("applications")
          .update(values)
          .eq("id", match.id)
          .eq("user_id", userId)
          .select("id, company, role, status, applied_date")
          .single(),
      changes,
      missingDetails
    );
    if (error) throw error;
    return { application: toRecord(data), created: false };
  }

  const site = sourceSiteLabel(input.detectedBy);
  const { data, error } = await writeWithDetails(
    (values) =>
      admin.from("applications").insert(values).select("id, company, role, status, applied_date").single(),
    {
      user_id: userId,
      company: input.company,
      role: input.role,
      location: input.location,
      portal_link: url || null,
      job_description: input.jobDescription || null,
      status: "Applied",
      ...(input.appliedDate ? { applied_date: input.appliedDate } : {}),
      source: "extension",
      comments: site ? `Added by the browser extension from ${site}` : "Added by the browser extension",
    },
    details
  );
  if (error) throw error;
  return { application: toRecord(data), created: true };
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
