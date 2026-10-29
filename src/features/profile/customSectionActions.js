"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { runAction } from "@/server/actionResult";
import { saveCvSections } from "@/server/resume/cvSections";

export async function saveCustomCvSections(content) {
  return runAction("saveCustomCvSections", async () => {
    const { supabase } = await requireUser();
    const result = await saveCvSections(supabase, content);
    revalidatePath("/profile");
    return result;
  });
}
