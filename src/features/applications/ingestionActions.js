"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { resolutionChoice, resolutionResult } from "@/server/applications/review";

export async function resolveExtensionEvent(eventId, input) {
  return runAction("resolveExtensionEvent", async () => {
    const { supabase } = await requireUser();
    const id = parseInput(z.string().uuid(), eventId);
    const choice = parseInput(resolutionChoice, input);
    const { data, error } = await supabase.rpc("resolve_extension_application_event", {
      p_event_id: id, p_target_application_id: choice.applicationId, p_create_new: choice.createNew,
    });
    const result = resolutionResult(data, error);
    revalidatePath("/"); revalidatePath("/applications");
    return result;
  });
}
