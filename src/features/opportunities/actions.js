"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { applyToSavedJob, opportunityInput, saveOpportunity, startTailoredResume } from "@/server/opportunities/service";

const jobId = z.string().uuid("Invalid saved job");

export async function saveJob(input) {
  return runAction("saveJob", async () => {
    const { supabase, user } = await requireUser();
    const result = await saveOpportunity(supabase, user.id, parseInput(opportunityInput, input));
    revalidatePath("/saved-jobs");
    return result;
  });
}

export async function removeSavedJob(id) {
  return runAction("removeSavedJob", async () => {
    const { supabase, user } = await requireUser();
    const opportunityId = parseInput(jobId, id);
    const { error } = await supabase.from("job_opportunities").delete().eq("user_id", user.id).eq("id", opportunityId);
    if (error) throw error;
    revalidatePath("/saved-jobs");
  });
}

// "Tailor resume" on a saved job without a working resume: create one that
// already targets the job, then open it in the studio
export async function tailorSavedJob(id) {
  const result = await runAction("tailorSavedJob", async () => {
    const { supabase, user } = await requireUser();
    const opportunityId = parseInput(jobId, id);
    const started = await startTailoredResume(supabase, user.id, opportunityId);
    revalidatePath("/saved-jobs");
    revalidatePath("/documents");
    return { ...started, opportunityId };
  });
  if (!result.ok) return result;
  redirect(`/resumes/${result.data.resumeId}?job=${result.data.opportunityId}`);
}

const applySchema = z.object({
  opportunityId: jobId,
  appliedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date you applied"),
});

// "I applied": track the saved job as an application, keeping its context
export async function markSavedJobApplied(input) {
  return runAction("markSavedJobApplied", async () => {
    const { supabase, user } = await requireUser();
    const result = await applyToSavedJob(supabase, user.id, parseInput(applySchema, input));
    revalidatePath("/saved-jobs");
    revalidatePath("/applications");
    revalidatePath("/");
    return result;
  });
}
