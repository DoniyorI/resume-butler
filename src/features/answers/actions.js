"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { answerCommandInput, answerError, getApprovedAnswer, saveAnswer } from "@/server/answers/service";
const versionInput = z.object({ id: z.string().uuid(), revision: z.number().int().min(1) });

export async function saveReusableAnswer(raw) {
  return runAction("saveReusableAnswer", async () => {
    const { supabase } = await requireUser();
    const result = await saveAnswer(supabase, parseInput(answerCommandInput, raw));
    revalidatePath("/answers"); revalidatePath("/applications", "layout");
    return result;
  });
}

export async function copyApprovedAnswer(raw) {
  return runAction("copyApprovedAnswer", async () => {
    const { supabase, user } = await requireUser();
    const input = parseInput(versionInput, raw);
    return getApprovedAnswer(supabase, user.id, input.id, input.revision);
  });
}

export async function readLatestAnswer(raw) {
  return runAction("readLatestAnswer", async () => {
    const { supabase, user } = await requireUser();
    const id = parseInput(z.string().uuid(), raw);
    const { data, error } = await supabase.from("reusable_answers").select("*").eq("user_id", user.id).eq("id", id).maybeSingle();
    answerError(error);
    return data;
  });
}

export async function deleteReusableAnswer(raw) {
  return runAction("deleteReusableAnswer", async () => {
    const { supabase } = await requireUser();
    const input = parseInput(versionInput, raw);
    const { data, error } = await supabase.rpc("delete_reusable_answer", { p_answer_id: input.id, p_expected_revision: input.revision });
    answerError(error);
    revalidatePath("/answers"); revalidatePath("/applications", "layout");
    return data;
  });
}
