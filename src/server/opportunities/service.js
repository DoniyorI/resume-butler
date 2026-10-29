import "server-only";
import { z } from "zod";
import { recordApplicationInput } from "@/server/extension/applications";
import { normalizePostingIdentity } from "@/lib/postingIdentity";
import { safeHttpUrl } from "@/lib/safeUrl";
import { jobDetailColumns } from "@/lib/jobDetails";
import { readOwnedPages } from "@/server/applications/readOwnedPages";
import { HttpError } from "@/server/http";

export const opportunityInput = recordApplicationInput.omit({ eventId: true, appliedDate: true }).extend({
  url: z.string().trim().min(1, "A job link is required").max(2000).refine(value => Boolean(safeHttpUrl(value)), "Use an http or https job link"),
  resumeId: z.string().uuid().nullable().default(null),
});

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

export async function saveOpportunity(supabase, userId, input) {
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
  const payload = {
    company: input.company, role: input.role, location: input.location,
    portal_link: identity.urlKey, job_description: input.jobDescription,
    ...jobDetailColumns({ salary: input.salary, employmentType: input.employmentType, workplaceType: input.workplaceType, location: input.location, description: input.jobDescription, site: input.detectedBy }),
  };
  const { data, error } = await supabase.rpc("save_job_opportunity", { p_user_id: userId, p_payload: payload, p_resume_id: input.resumeId });
  opportunityError(error);
  if (!z.string().uuid().safeParse(data?.id).success) throw new Error("Invalid saved job result");
  return data;
}

export async function listOpportunities(supabase, userId, page = 1, search = "") {
  const size = 20;
  let query = supabase.from("job_opportunities")
    .select("id,payload,resume_id,application_id,created_at,updated_at", { count: "exact" })
    .eq("user_id", userId).order("updated_at", { ascending: false }).order("id")
    .range((page - 1) * size, page * size - 1);
  if (search) {
    const pattern = "%" + search.slice(0, 100).replace(/[\\%_]/g, "\\$&") + "%";
    const quoted = '"' + pattern.replace(/["\\]/g, "\\$&") + '"';
    query = query.or(["company", "role", "location"].map(key => `payload->>${key}.ilike.${quoted}`).join(","));
  }
  const { data, error, count } = await query;
  if (["42P01", "PGRST205"].includes(error?.code)) return { jobs: [], total: 0, setupPending: true };
  if (error) throw error;
  return { jobs: data, total: count || 0, setupPending: false };
}

export async function getOpportunityForUrl(supabase, userId, url) {
  if (!safeHttpUrl(url) || url.length > 2000) return null;
  const identity = normalizePostingIdentity({ url });
  const key = identity.platform ? [identity.platform, identity.namespace, identity.postingId].join(":") : "url:" + identity.urlKey;
  const { data, error } = await supabase.from("job_opportunities").select("id,payload,resume_id").eq("user_id", userId).eq("identity_key", key).maybeSingle();
  if (["42P01", "PGRST205"].includes(error?.code)) return null;
  if (error) throw error;
  return data;
}
