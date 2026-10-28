"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { findTargetApplication, normalizeCompany, normalizeRole, shouldUpdateStatus } from "@/server/email/matching";
import { HttpError } from "@/server/http";

const idSchema = z.string().uuid("Invalid suggestion");

// The user can correct what the scan detected before approving it
const editsSchema = z.object({
  company: z.string().trim().min(1, "Company name is required").max(200, "Company name is too long"),
  role: z.string().trim().max(200, "Role is too long"),
  status: z.enum(APPLICATION_STATUSES, { errorMap: () => ({ message: "Unknown status" }) }),
});

function revalidateAfterReview() {
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/email-sync");
}

async function loadPending(supabase, userId, id) {
  const { data, error } = await supabase
    .from("application_suggestions")
    .select("id, kind, application_id, summary, email_date")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("state", "pending")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "This suggestion was already handled. Reload the page.");
  return data;
}

async function createApplication(supabase, userId, suggestion, edits) {
  const appliedDate = (suggestion.email_date ? new Date(suggestion.email_date) : new Date())
    .toISOString()
    .split("T")[0];
  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      company: edits.company,
      role: edits.role,
      status: edits.status,
      applied_date: appliedDate,
      comments: suggestion.summary ? `From email: ${suggestion.summary}` : "",
      source: "email",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Status changes require the owned application the scan matched to still exist.
// Conditional writes protect a newer status from a stale email approval.
async function updateApplication(supabase, userId, suggestion, edits) {
  const { data: current, error: readError } = await supabase
    .from("applications")
    .select("id, status")
    .eq("id", suggestion.application_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) throw new HttpError(404, "This application was deleted. Dismiss this suggestion.");
  if (current.status === edits.status) return current.id;
  if (!shouldUpdateStatus(current.status, edits.status)) {
    throw new HttpError(409, "The application status changed since this email was scanned. Review it before approving.");
  }
  const { data, error } = await supabase
    .from("applications")
    .update({ status: edits.status })
    .eq("id", current.id)
    .eq("user_id", userId)
    .eq("status", current.status)
    .select("id");
  if (error) throw error;
  if (!data.length) throw new HttpError(409, "The application changed while this update was saving. Try again.");
  return data[0].id;
}

// A "new" suggestion whose application was added since (by approving another
// suggestion, or by hand) updates that application instead of duplicating it
async function findExisting(supabase, userId, fields, suggestion) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, role, status, applied_date, created_at")
    .eq("user_id", userId);
  if (error) throw error;
  const wanted = normalizeRole(fields.role);
  const candidates = wanted ? data.filter((app) => normalizeRole(app.role) === wanted) : data;
  return findTargetApplication(candidates, {
    company: normalizeCompany(fields.company),
    role: fields.role,
    category: "application_received",
    emailDate: suggestion.email_date,
  });
}

async function applySuggestion(supabase, userId, suggestion, fields) {
  if (suggestion.kind === "update" && suggestion.application_id) {
    return updateApplication(supabase, userId, suggestion, fields);
  }
  const existing = await findExisting(supabase, userId, fields, suggestion);
  if (!existing) return createApplication(supabase, userId, suggestion, fields);
  if (shouldUpdateStatus(existing.status, fields.status)) {
    return updateApplication(supabase, userId, { ...suggestion, application_id: existing.id }, fields);
  }
  return existing.id;
}

export async function approveSuggestion(id, edits) {
  return runAction("approveSuggestion", async () => {
    const { supabase, user } = await requireUser();
    const suggestionId = parseInput(idSchema, id);
    const fields = parseInput(editsSchema, edits);
    const { data: committed, error: rpcError } = await supabase.rpc("approve_application_suggestion", {
      p_suggestion_id: suggestionId,
      p_company: fields.company,
      p_role: fields.role,
      p_status: fields.status,
    });
    if (!["PGRST202", "42883"].includes(rpcError?.code)) {
      if (rpcError?.code === "55000") throw new HttpError(409, "This suggestion or application changed. Reload and review its current status.");
      if (["P0002", "42501"].includes(rpcError?.code)) throw new HttpError(404, "This suggestion or application is no longer available.");
      if (rpcError) throw rpcError;
      if (!idSchema.safeParse(committed).success) throw new Error("Invalid approval result");
      revalidateAfterReview();
      return { applicationId: committed };
    }
    // Compatibility before migration 011: guarded writes, without a cross-request transaction.
    const suggestion = await loadPending(supabase, user.id, suggestionId);

    const applicationId = await applySuggestion(supabase, user.id, suggestion, fields);

    const { error } = await supabase
      .from("application_suggestions")
      .update({ state: "approved", resolved_at: new Date().toISOString(), application_id: applicationId })
      .eq("id", suggestionId)
      .eq("user_id", user.id);
    if (error) throw error;

    revalidateAfterReview();
    return { applicationId };
  });
}

export async function dismissSuggestion(id) {
  return runAction("dismissSuggestion", async () => {
    const { supabase, user } = await requireUser();
    const suggestionId = parseInput(idSchema, id);
    const { error } = await supabase
      .from("application_suggestions")
      .update({ state: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", suggestionId)
      .eq("user_id", user.id)
      .eq("state", "pending");
    if (error) throw error;
    revalidateAfterReview();
    return null;
  });
}

export async function dismissAllSuggestions() {
  return runAction("dismissAllSuggestions", async () => {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("application_suggestions")
      .update({ state: "dismissed", resolved_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("state", "pending");
    if (error) throw error;
    revalidateAfterReview();
    return null;
  });
}
