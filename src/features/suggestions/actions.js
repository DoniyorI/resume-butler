"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { HttpError } from "@/server/http";
import { resolutionChoice, resolutionResult } from "@/server/applications/review";

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

export async function approveSuggestion(id, edits) {
  return runAction("approveSuggestion", async () => {
    const { supabase } = await requireUser();
    const suggestionId = parseInput(idSchema, id);
    const fields = parseInput(editsSchema, edits);
    const { data, error } = await supabase.rpc("approve_application_suggestion", {
      p_suggestion_id: suggestionId, p_company: fields.company, p_role: fields.role,
      p_status: fields.status, p_identity_version: 1,
    });
    if (["PGRST202", "42883"].includes(error?.code)) throw new HttpError(503, "Application matching is being updated. Your suggestion is still waiting safely.");
    if (error?.code === "55000") throw new HttpError(409, "This email needs matching or its application changed. Review it before approving.");
    if (["P0002", "42501"].includes(error?.code)) throw new HttpError(404, "This suggestion or application is no longer available.");
    if (error) throw error;
    if (data === null) {
      revalidateAfterReview();
      throw new HttpError(409, "This email now needs matching. Choose the correct application in the review below.");
    }
    if (!idSchema.safeParse(data).success) throw new Error("Invalid approval result");
    revalidateAfterReview();
    return { applicationId: data };
  });
}

export async function resolveSuggestion(id, input) {
  return runAction("resolveSuggestion", async () => {
    const { supabase } = await requireUser();
    const suggestionId = parseInput(idSchema, id);
    const fields = parseInput(editsSchema, input);
    const choice = parseInput(resolutionChoice, input);
    const { data, error } = await supabase.rpc("resolve_application_suggestion", {
      p_suggestion_id: suggestionId, p_target_application_id: choice.applicationId,
      p_create_new: choice.createNew, p_company: fields.company, p_role: fields.role, p_status: fields.status,
    });
    const result = resolutionResult(data, error);
    revalidateAfterReview();
    return result;
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
