import "server-only";
import { z } from "zod";
import { parseInput } from "@/server/actionResult";
import { HttpError } from "@/server/http";
import { normalizeHttpUrl } from "@/lib/safeUrl";
import {
  ACTIVITY_KINDS,
  ACTIVITY_STATUSES,
  CONTACT_CHANNELS,
  SETUP_PENDING_MESSAGE,
  addDays,
  isValidDateKey,
  isValidTimeZone,
  localDateKey,
  wallTimeInZone,
  zonedTimeToIso,
} from "@/features/activities/kinds";

// Application activities (migration 020). Every query is scoped by user_id;
// the composite foreign key (application_id, user_id) also stops an activity
// pointing at someone else's application, and a trigger caps each user at
// 2,000. Until the migration is applied, reads return
// { items: [], setupPending: true } and writes a 503.

const TABLE = "application_activities";
const COLUMNS =
  "id,application_id,kind,title,due_on,starts_at,time_zone,status,completed_at,notes,contact_name,contact_channel,link,created_at,updated_at";
// The table or one of its columns is missing: the migration isn't applied
const SETUP_CODES = ["42P01", "PGRST205", "PGRST200", "PGRST204", "42703"];
// Supabase returns at most 1,000 rows per request; every read stays under it
const READ_LIMIT = 1000;
const OVERDUE_LIMIT = 20;
const UPCOMING_LIMIT = 50;
// Done steps this recent still count for the suggestion rules
const RECENT_DAYS = 14;

export const isSetupPending = (error) => SETUP_CODES.includes(error?.code);

function check(error) {
  if (!error) return;
  if (isSetupPending(error)) throw new HttpError(503, SETUP_PENDING_MESSAGE);
  if (error.code === "23503") throw new HttpError(404, "That application is no longer available.");
  if (error.code === "54000") {
    throw new HttpError(429, "You have 2,000 next steps. Delete finished ones before adding more.");
  }
  throw error;
}

export function toActivity(row) {
  return {
    id: row.id,
    applicationId: row.application_id,
    kind: row.kind,
    title: row.title,
    dueOn: row.due_on || null,
    startsAt: row.starts_at || null,
    timeZone: row.time_zone || null,
    status: row.status,
    completedAt: row.completed_at || null,
    notes: row.notes || "",
    contactName: row.contact_name || "",
    contactChannel: row.contact_channel || "",
    link: row.link || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const id = z.string().uuid("Unknown step");
const optional = (schema) =>
  z
    .union([schema, z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null);

const fieldShape = {
  kind: z.enum(ACTIVITY_KINDS, { errorMap: () => ({ message: "Choose what kind of step this is" }) }),
  title: z
    .string({ required_error: "Add a title" })
    .trim()
    .min(1, "Add a title")
    .max(200, "Keep the title under 200 characters"),
  // Round-tripped, so 2026-02-30 is refused rather than rolled into March
  dueOn: optional(z.string().refine(isValidDateKey, "That date doesn't exist. Pick a real calendar date.")),
  // A wall-clock time ("14:30") on dueOn in timeZone; the server works out the instant
  time: optional(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time")),
  // Or the instant itself, which must fall on dueOn in timeZone
  startsAt: optional(z.string().datetime({ offset: true, message: "Use a valid time" })),
  timeZone: optional(z.string().max(64, "Unknown time zone").refine(isValidTimeZone, "Unknown time zone")),
  notes: z.string().max(4000, "Keep notes under 4,000 characters").default(""),
  contactName: z.string().trim().max(200, "Keep the contact name under 200 characters").default(""),
  contactChannel: z
    .union([z.enum(CONTACT_CHANNELS), z.literal("")], { errorMap: () => ({ message: "Unknown contact channel" }) })
    .default(""),
  link: z
    .string()
    .max(2000, "Keep the link under 2,000 characters")
    .default("")
    .transform((value, ctx) => {
      if (!value.trim()) return "";
      const normalized = normalizeHttpUrl(value);
      if (!normalized || normalized.length > 2000) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use an http or https link" });
        return z.NEVER;
      }
      return normalized;
    }),
};

// A time belongs to a day in a zone: resolve it to starts_at, or refuse it
function resolveTime(value, ctx) {
  const timed = value.time || value.startsAt;
  if (!timed) return { ...value, startsAt: null, timeZone: null };
  const fail = (message) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["time"] });
    return z.NEVER;
  };
  if (!value.dueOn) return fail("Pick a date before adding a time");
  if (!value.timeZone) return fail("A time needs its time zone");
  if (value.time) {
    const startsAt = zonedTimeToIso(value.dueOn, value.time, value.timeZone);
    if (!startsAt) {
      return fail(`${value.time} doesn't exist on that date in ${value.timeZone} (the clocks change). Pick another time.`);
    }
    return { ...value, startsAt };
  }
  if (wallTimeInZone(value.startsAt, value.timeZone).date !== value.dueOn) {
    return fail(`That time falls on a different day than the date in ${value.timeZone}.`);
  }
  return { ...value, startsAt: new Date(value.startsAt).toISOString() };
}

const fields = z.object(fieldShape).transform(resolveTime);
const createInput = z
  .object({ applicationId: z.string().uuid("Unknown application"), ...fieldShape })
  .transform(resolveTime);
const statusInput = z.enum(ACTIVITY_STATUSES, { errorMap: () => ({ message: "Unknown step status" }) });

// Input fields -> database columns. A timed event keeps its zone; an untimed
// one has none.
function toColumns(input) {
  return {
    kind: input.kind,
    title: input.title,
    due_on: input.dueOn,
    starts_at: input.startsAt,
    time_zone: input.startsAt ? input.timeZone : null,
    notes: input.notes,
    contact_name: input.contactName,
    contact_channel: input.contactChannel,
    link: input.link,
  };
}

// The server's calendar day (as the dashboard's follow-up rule counts days);
// the browser regroups by the viewer's own day where it matters
export const todayKey = () => localDateKey();

/** One application's activities: { items, setupPending }. */
export async function listActivities(supabase, userId, { applicationId }) {
  if (!z.string().uuid().safeParse(applicationId).success) return { items: [], setupPending: false };
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(READ_LIMIT);
  if (isSetupPending(error)) return { items: [], setupPending: true };
  if (error) throw error;
  return { items: data.map(toActivity), setupPending: false };
}

async function withApplications(supabase, userId, rows) {
  const ids = [...new Set(rows.map((row) => row.application_id))];
  const apps = new Map();
  if (ids.length) {
    const res = await supabase.from("applications").select("id,company,role").eq("user_id", userId).in("id", ids);
    if (res.error) throw res.error;
    for (const app of res.data) apps.set(app.id, app);
  }
  return rows
    .filter((row) => apps.has(row.application_id))
    .map((row) => ({
      ...toActivity(row),
      company: apps.get(row.application_id).company || "Unknown company",
      role: apps.get(row.application_id).role || "",
    }));
}

/**
 * Open, dated steps for the Today card: the 20 most recently due overdue ones
 * (and how many older ones there are), then today's and the next
 * `withinDays` (plus two spare days for viewers ahead of the server's date),
 * soonest first. `items` is overdue then upcoming, all ascending; the page
 * groups them by the viewer's own day.
 */
export async function listUpcoming(supabase, userId, { withinDays = 7 } = {}) {
  const today = todayKey();
  const open = (columns, options) =>
    supabase.from(TABLE).select(columns, options).eq("user_id", userId).eq("status", "open");
  const [overdueRes, countRes, upcomingRes] = await Promise.all([
    open(COLUMNS).lt("due_on", today).order("due_on", { ascending: false }).limit(OVERDUE_LIMIT),
    open("id", { count: "exact", head: true }).lt("due_on", today),
    open(COLUMNS)
      .gte("due_on", today)
      .lt("due_on", addDays(today, withinDays + 2))
      .order("due_on", { ascending: true })
      .limit(UPCOMING_LIMIT),
  ]);
  for (const res of [overdueRes, countRes, upcomingRes]) {
    if (isSetupPending(res.error)) return { items: [], olderOverdue: 0, setupPending: true };
    if (res.error) throw res.error;
  }
  const overdueTotal = countRes.count ?? countRes.data?.length ?? overdueRes.data.length;
  const items = await withApplications(supabase, userId, [...overdueRes.data.reverse(), ...upcomingRes.data]);
  return { items, olderOverdue: Math.max(0, overdueTotal - overdueRes.data.length), setupPending: false };
}

const forSuggestion = (row) => ({
  id: row.id,
  applicationId: row.application_id,
  kind: row.kind,
  status: row.status,
  dueOn: row.due_on || null,
  completedAt: row.completed_at || null,
});

/**
 * What suggestNextSteps needs: every open step, and done ones dated or
 * completed in the last 14 days (cancelled ones never count).
 */
export async function listForSuggestions(supabase, userId) {
  const since = addDays(todayKey(), -RECENT_DAYS);
  const columns = "id,application_id,kind,status,due_on,completed_at";
  const mine = () => supabase.from(TABLE).select(columns).eq("user_id", userId);
  const results = await Promise.all([
    mine().eq("status", "open").order("due_on", { ascending: true }).limit(READ_LIMIT),
    mine().eq("status", "done").gte("completed_at", `${since}T00:00:00Z`).order("completed_at", { ascending: false }).limit(READ_LIMIT),
    mine().eq("status", "done").gte("due_on", since).order("due_on", { ascending: false }).limit(READ_LIMIT),
  ]);
  const byId = new Map();
  for (const { data, error } of results) {
    if (isSetupPending(error)) return { items: [], setupPending: true };
    if (error) throw error;
    for (const row of data) byId.set(row.id, forSuggestion(row));
  }
  return { items: [...byId.values()], setupPending: false };
}

export async function createActivity(supabase, userId, input) {
  const value = parseInput(createInput, input);

  // A user-safe 404 for someone else's (or a deleted) application; the
  // composite foreign key refuses it in the database as well
  const owner = await supabase
    .from("applications")
    .select("id")
    .eq("id", value.applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (owner.error) throw owner.error;
  if (!owner.data) throw new HttpError(404, "That application is no longer available.");

  // The 2,000-step cap is the database trigger's (54000 -> 429 in check)
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, application_id: value.applicationId, status: "open", completed_at: null, ...toColumns(value) })
    .select(COLUMNS)
    .single();
  check(error);
  return toActivity(data);
}

async function readOwned(supabase, userId, activityId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("id", activityId)
    .eq("user_id", userId)
    .maybeSingle();
  check(error);
  if (!data) throw new HttpError(404, "That step is no longer available.");
  return toActivity(data);
}

async function updateOwned(supabase, userId, activityId, patch, narrow = (query) => query) {
  const { data, error } = await narrow(
    supabase.from(TABLE).update(patch).eq("id", activityId).eq("user_id", userId)
  )
    .select(COLUMNS)
    .maybeSingle();
  check(error);
  return data ? toActivity(data) : null;
}

/** Edit or reschedule: every editable field is replaced. */
export async function updateActivity(supabase, userId, activityId, input) {
  const activity = parseInput(id, activityId);
  const updated = await updateOwned(supabase, userId, activity, toColumns(parseInput(fields, input)));
  if (!updated) throw new HttpError(404, "That step is no longer available.");
  return updated;
}

/**
 * Done, cancelled or reopened; completed_at is set only while done. Marking a
 * step done twice keeps the first completed_at.
 */
export async function setActivityStatus(supabase, userId, activityId, status) {
  const activity = parseInput(id, activityId);
  const next = parseInput(statusInput, status);
  const updated = await updateOwned(
    supabase,
    userId,
    activity,
    { status: next, completed_at: next === "done" ? new Date().toISOString() : null },
    (query) => (next === "done" ? query.neq("status", "done") : query)
  );
  // Nothing changed: already done (returned as it is), or not the user's
  return updated || readOwned(supabase, userId, activity);
}

export async function deleteActivity(supabase, userId, activityId) {
  const activity = parseInput(id, activityId);
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", activity)
    .eq("user_id", userId)
    .select("id,application_id")
    .maybeSingle();
  check(error);
  if (!data) throw new HttpError(404, "That step is no longer available.");
  return { id: data.id, applicationId: data.application_id };
}

/**
 * Saved jobs not applied to yet that were saved more than a week ago, oldest
 * first, for the "decide on it" suggestion. Empty before migration 013.
 */
export async function listSavedJobsToDecide(supabase, userId, { olderThanDays = 7, limit = 20 } = {}) {
  const cutoff = `${addDays(todayKey(), -olderThanDays)}T00:00:00Z`;
  const { data, error } = await supabase
    .from("job_opportunities")
    .select("id,application_id,created_at,company:payload->>company,role:payload->>role")
    .eq("user_id", userId)
    .is("application_id", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (isSetupPending(error)) return [];
  if (error) throw error;
  return data.map((job) => ({
    id: job.id,
    company: job.company || "",
    role: job.role || "",
    createdAt: job.created_at,
    applicationId: job.application_id || null,
  }));
}
