import "server-only";
import { z } from "zod";
import { normalizeHttpUrl } from "@/lib/safeUrl";
import { HttpError } from "@/server/http";
import { normalizeCompany, normalizeRole } from "@/server/email/matching";

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
  // Which site adapter detected it (e.g. "greenhouse"), for debugging misdetections
  detectedBy: z.string().trim().max(50).default(""),
});

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
    .select("id, company, role, status, applied_date, portal_link, job_description, location")
    .eq("user_id", userId);
  if (listError) throw listError;

  // The user just submitted it, so it's a new application unless it's the same
  // posting (same link), or the same company and exactly the same role. Looser
  // rules, like the email matcher's, would fold a new job into another one at
  // that company, such as when the page didn't show the role.
  const company = normalizeCompany(input.company);
  const role = normalizeRole(input.role);
  const match =
    (url && existing.find((app) => app.portal_link === url)) ||
    (role &&
      existing.find((app) => normalizeCompany(app.company) === company && normalizeRole(app.role) === role));

  if (match) {
    // Fill in what's missing; never overwrite what the user or email sync set
    const changes = {};
    if (!match.portal_link && url) changes.portal_link = url;
    if (!match.job_description && input.jobDescription) changes.job_description = input.jobDescription;
    if (!match.location && input.location) changes.location = input.location;
    if (Object.keys(changes).length === 0) return { application: toRecord(match), created: false };

    const { data, error } = await admin
      .from("applications")
      .update(changes)
      .eq("id", match.id)
      .eq("user_id", userId)
      .select("id, company, role, status, applied_date")
      .single();
    if (error) throw error;
    return { application: toRecord(data), created: false };
  }

  const { data, error } = await admin
    .from("applications")
    .insert({
      user_id: userId,
      company: input.company,
      role: input.role,
      location: input.location,
      portal_link: url || null,
      job_description: input.jobDescription || null,
      status: "Applied",
      ...(input.appliedDate ? { applied_date: input.appliedDate } : {}),
      source: "extension",
      comments: "Added by the browser extension",
    })
    .select("id, company, role, status, applied_date")
    .single();
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
