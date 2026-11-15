import "server-only";
import { z } from "zod";
import { recordApplicationInput } from "@/server/extension/applications";
import { normalizePostingIdentity } from "@/lib/postingIdentity";
import { safeHttpUrl } from "@/lib/safeUrl";
import { jobDetailColumns } from "@/lib/jobDetails";
import { normalizeResumeContent } from "@/features/resumes/resumeDocument";
import { readOwnedPages } from "@/server/applications/readOwnedPages";
import { insertApplication, JOB_DETAIL_KEYS, payloadDetailColumns } from "@/server/applications/insertApplication";
import { HttpError } from "@/server/http";
import { isSameCycle } from "@/server/email/matching";

// resumeId: a uuid chooses that resume, null clears the choice ("Master CV /
// decide later"), and leaving it out keeps the stored choice.
export const opportunityInput = recordApplicationInput.omit({ eventId: true, appliedDate: true }).extend({
  url: z.string().trim().min(1, "A job link is required").max(2000).refine(value => Boolean(safeHttpUrl(value)), "Use an http or https job link"),
  resumeId: z.string().uuid().nullable().optional(),
});

const TABLE_MISSING = ["42P01", "PGRST205"];
const SAVED_JOB_TARGETS_LIMIT = 100;
const SALARY_KEYS = ["salary_min", "salary_max", "salary_currency", "salary_period"];

export function opportunityError(error) {
  if (["42P01", "PGRST202", "42703", "PGRST204", "42883"].includes(error?.code)) throw new HttpError(503, "Saved jobs setup is pending. Your changes have not been saved. Please try again after migration 013 is installed.");
  if (error?.code === "54000") throw new HttpError(429, "You have reached 2,000 saved jobs. Remove older jobs before adding more.");
  if (error?.code === "P0002") throw new HttpError(404, "That resume or saved job is no longer available.");
  if (error?.code === "55000") throw new HttpError(409, "This posting changed. Reload and review its details before saving.");
  if (error) throw error;
}

export async function listResumeChoices(supabase, userId) {
  return readOwnedPages(supabase, userId, "resumes", "id,title");
}

// The resume ID if it still exists and belongs to userId, otherwise null
async function ownedResumeId(supabase, userId, resumeId) {
  if (!resumeId) return null;
  const { data, error } = await supabase.from("resumes").select("id").eq("user_id", userId).eq("id", resumeId).maybeSingle();
  if (error) throw error;
  return data ? data.id : null;
}

// A re-capture never erases what is stored: an empty role, location or
// description, and pay, workplace or employment values the new capture lacks,
// keep the stored ones. (The resume choice is kept by saveOpportunity.)
export function mergeSavedPayload(stored, incoming) {
  if (!stored) return incoming;
  const merged = { ...incoming };
  for (const key of ["role", "location", "job_description"]) {
    if (!`${incoming[key] || ""}`.trim() && stored[key]) merged[key] = stored[key];
  }
  const hasPay = incoming.salary_min != null || incoming.salary_max != null;
  for (const key of JOB_DETAIL_KEYS) {
    if (SALARY_KEYS.includes(key) && hasPay) continue;
    if ((merged[key] == null || merged[key] === "") && stored[key] != null && stored[key] !== "") merged[key] = stored[key];
  }
  return merged;
}

// keepStored: a capture (the extension) never erases stored description or job
// details. The web editor sends the whole form and is authoritative, so it doesn't pass it.
export async function saveOpportunity(supabase, userId, input, { keepStored = false } = {}) {
  let identity;
  try {
    identity = normalizePostingIdentity({ url: input.url, platform: input.postingId ? input.detectedBy : undefined, postingId: input.postingId });
  } catch {
    throw new HttpError(400, "The posting details do not match its link. Reload the job and try again.");
  }
  if (input.resumeId) {
    const { data, error } = await supabase.from("resumes").select("id").eq("user_id", userId).eq("id", input.resumeId).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Choose a resume from your own documents.");
  }
  const existing = await getOpportunityForUrl(supabase, userId, identity.urlKey);
  const captured = {
    company: input.company, role: input.role, location: input.location,
    portal_link: identity.urlKey, job_description: input.jobDescription,
    ...jobDetailColumns({ salary: input.salary, employmentType: input.employmentType, workplaceType: input.workplaceType, location: input.location, description: input.jobDescription, site: input.detectedBy }),
  };
  const payload = keepStored ? mergeSavedPayload(existing?.payload, captured) : captured;
  const resumeId = input.resumeId === undefined ? existing?.resume_id ?? null : input.resumeId;
  const { data, error } = await supabase.rpc("save_job_opportunity", { p_user_id: userId, p_payload: payload, p_resume_id: resumeId });
  opportunityError(error);
  if (!z.string().uuid().safeParse(data?.id).success) throw new Error("Invalid saved job result");
  return data;
}

export const SAVED_JOBS_PAGE_SIZE = 20;

/**
 * The user's saved jobs, newest first, matching `search` on company, role or
 * location, with an exact count. Callers add .range() or .limit().
 */
export function savedJobsQuery(supabase, userId, search = "") {
  let query = supabase.from("job_opportunities")
    .select("id,payload,resume_id,application_id,created_at,updated_at", { count: "exact" })
    .eq("user_id", userId).order("updated_at", { ascending: false }).order("id");
  if (search) {
    const pattern = "%" + search.slice(0, 100).replace(/[\\%_]/g, "\\$&") + "%";
    const quoted = '"' + pattern.replace(/["\\]/g, "\\$&") + '"';
    query = query.or(["company", "role", "location"].map(key => `payload->>${key}.ilike.${quoted}`).join(","));
  }
  return query;
}

export function savedJobsResult({ data, error, count }) {
  if (TABLE_MISSING.includes(error?.code)) return { jobs: [], total: 0, setupPending: true };
  if (error) throw error;
  return { jobs: data, total: count ?? data.length, setupPending: false };
}

export async function listOpportunities(supabase, userId, page = 1, search = "") {
  const size = SAVED_JOBS_PAGE_SIZE;
  return savedJobsResult(await savedJobsQuery(supabase, userId, search).range((page - 1) * size, page * size - 1));
}

export async function getOpportunityForUrl(supabase, userId, url) {
  if (!safeHttpUrl(url) || url.length > 2000) return null;
  let identity;
  try { identity = normalizePostingIdentity({ url }); } catch { return null; }
  const key = identity.platform ? [identity.platform, identity.namespace, identity.postingId].join(":") : "url:" + identity.urlKey;
  const { data, error } = await supabase.from("job_opportunities").select("id,payload,resume_id").eq("user_id", userId).eq("identity_key", key).maybeSingle();
  if (TABLE_MISSING.includes(error?.code)) return null;
  if (error) throw error;
  return data;
}

/**
 * Saved jobs a resume or cover letter can be tailored to: those with a
 * description, newest first, as [{ id, company, role, applicationId }].
 * Empty before migration 013.
 */
export async function listSavedJobTargets(supabase, userId) {
  const { data, error } = await supabase.from("job_opportunities")
    .select("id,application_id,company:payload->>company,role:payload->>role")
    .eq("user_id", userId).neq("payload->>job_description", "")
    .order("updated_at", { ascending: false }).limit(SAVED_JOB_TARGETS_LIMIT);
  if (TABLE_MISSING.includes(error?.code)) return [];
  if (error) throw error;
  return data.map(job => ({ id: job.id, company: job.company || "", role: job.role || "", applicationId: job.application_id || null }));
}

// One of the user's saved jobs, or null (also before migration 013)
export async function readSavedJob(supabase, userId, opportunityId) {
  if (!z.string().uuid().safeParse(opportunityId).success) return null;
  const { data, error } = await supabase.from("job_opportunities")
    .select("id,payload,resume_id,application_id").eq("user_id", userId).eq("id", opportunityId).maybeSingle();
  if (TABLE_MISSING.includes(error?.code)) return null;
  if (error) throw error;
  return data;
}

/** A saved job as a document's tailoring target. */
export function savedJobTarget(job) {
  const p = job.payload || {};
  return { opportunityId: job.id, applicationId: job.application_id || null, company: p.company || "", role: p.role || "", jobDescription: p.job_description || "" };
}

export async function loadSavedJob(supabase, userId, opportunityId) {
  const job = await readSavedJob(supabase, userId, opportunityId);
  if (!job) throw new HttpError(404, "Saved job not found");
  return savedJobTarget(job);
}

/**
 * Start tailoring a resume to a saved job. Returns its working resume when it
 * has one; otherwise creates "<Company> – <Role>" carrying the job as its
 * target and records it as the working resume. No AI runs here.
 * Returns { resumeId, created }.
 */
export async function startTailoredResume(supabase, userId, opportunityId) {
  const job = await readSavedJob(supabase, userId, opportunityId);
  if (!job) throw new HttpError(404, "Saved job not found");
  const existing = await ownedResumeId(supabase, userId, job.resume_id);
  if (existing) return { resumeId: existing, created: false };

  const target = savedJobTarget(job);
  const title = ([target.company, target.role].filter(Boolean).join(" – ") || "Tailored resume").slice(0, 200);
  const content = normalizeResumeContent({
    target: { ...target, jobDescription: target.jobDescription.slice(0, 50_000), company: target.company.slice(0, 200), role: target.role.slice(0, 200) },
  });
  const { data, error } = await supabase.from("resumes").insert({ user_id: userId, title, content }).select("id").single();
  if (error) throw error;

  // Saved jobs are written only through this function (013), with the stored payload unchanged.
  // If it can't be recorded, remove the new resume so a retry doesn't leave another one behind.
  const { error: linkError } = await supabase.rpc("save_job_opportunity", { p_user_id: userId, p_payload: job.payload, p_resume_id: data.id });
  if (linkError) {
    console.error("Recording the working resume:", linkError);
    const { error: cleanupError } = await supabase.from("resumes").delete().eq("user_id", userId).eq("id", data.id);
    if (cleanupError) console.error("Removing the unrecorded resume:", cleanupError);
    throw new HttpError(503, "Couldn't link a new resume to this saved job. Nothing was created. Please try again.");
  }
  return { resumeId: data.id, created: true };
}

const CYCLE_COLUMNS = "id,status,applied_date,created_at";

// An application already tracked for this posting: the saved job's link (the
// 013 trigger only sets it within the hiring cycle), or an open, recent
// application with the same posting link. An old or closed one doesn't count:
// a reposted job is a new cycle.
async function existingApplicationFor(supabase, userId, job) {
  if (job.application_id) {
    const { data, error } = await supabase.from("applications").select("id").eq("user_id", userId).eq("id", job.application_id).maybeSingle();
    if (error) throw error;
    if (data) return data.id;
  }
  const link = job.payload?.portal_link;
  if (!link) return null;
  const { data, error } = await supabase.from("applications").select(CYCLE_COLUMNS).eq("user_id", userId).eq("portal_link", link);
  if (error) throw error;
  const byLink = data.find(app => isSameCycle(app));
  if (byLink) return byLink.id;
  const byKey = await supabase.from("applications").select(CYCLE_COLUMNS).eq("user_id", userId).eq("posting_url_key", link);
  if (["42703", "PGRST204"].includes(byKey.error?.code)) return null;
  if (byKey.error) throw byKey.error;
  return byKey.data.find(app => isSameCycle(app))?.id ?? null;
}

/**
 * "I applied" on a saved job: track it as an application with its
 * description, job details and working resume (if still owned). When the
 * posting already has an application, returns that one instead.
 * Returns { applicationId, created }.
 */
export async function applyToSavedJob(supabase, userId, { opportunityId, appliedDate }) {
  const job = await readSavedJob(supabase, userId, opportunityId);
  if (!job) throw new HttpError(404, "Saved job not found");
  const tracked = await existingApplicationFor(supabase, userId, job);
  if (tracked) return { applicationId: tracked, created: false };

  const p = job.payload || {};
  const { id } = await insertApplication(supabase, userId, {
    company: p.company, role: p.role || "", location: p.location || "", portal_link: p.portal_link || "",
    status: "Applied", applied_date: appliedDate || null, job_description: p.job_description || "",
    resume_id: await ownedResumeId(supabase, userId, job.resume_id),
  }, payloadDetailColumns(p));

  // Double submit (two tabs): with no lock available, the earliest row for
  // this posting in the current cycle wins and a later duplicate removes itself
  if (p.portal_link) {
    const { data: rows, error } = await supabase.from("applications").select(`${CYCLE_COLUMNS},created_at`).eq("user_id", userId).eq("portal_link", p.portal_link);
    if (error) throw error;
    const order = (a, b) => `${a.created_at}`.localeCompare(`${b.created_at}`) || `${a.id}`.localeCompare(`${b.id}`);
    const first = rows.filter(app => app.id === id || isSameCycle(app)).sort(order)[0];
    if (first && first.id !== id) {
      const { error: removeError } = await supabase.from("applications").delete().eq("user_id", userId).eq("id", id);
      if (removeError) throw removeError;
      return { applicationId: first.id, created: false };
    }
  }
  return { applicationId: id, created: true };
}
