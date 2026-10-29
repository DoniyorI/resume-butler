"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { opportunityInput, saveOpportunity } from "@/server/opportunities/service";

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
    const jobId = parseInput(z.string().uuid(), id);
    const { error } = await supabase.from("job_opportunities").delete().eq("user_id", user.id).eq("id", jobId);
    if (error) throw error;
    revalidatePath("/saved-jobs");
  });
}
