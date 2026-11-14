"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { undoImport } from "@/server/applications/importApplications";

const idsSchema = z.array(z.string().uuid("Invalid application")).min(1, "Nothing to undo").max(500, "Too many applications to undo at once");

// Removes what an import just added (only the user's own, from the last hour)
export async function undoImportAction(input) {
  return runAction("undoImportAction", async () => {
    const { supabase, user } = await requireUser();
    const ids = parseInput(idsSchema, input?.ids);
    const removed = await undoImport(supabase, user.id, ids);
    revalidatePath("/applications");
    revalidatePath("/");
    return { removed };
  });
}
