"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/actionResult";
import { requireUser } from "@/server/auth";
import { deleteConnection, parseConnectionInput, saveConnection } from "@/server/email/connection";
import { toConnection } from "@/features/email-sync/data";

export async function saveEmailConnection(input) {
  return runAction("saveEmailConnection", async () => {
    const { supabase, user } = await requireUser();
    const fields = parseConnectionInput({
      email_address: input?.emailAddress,
      app_password: input?.appPassword,
      imap_host: input?.imapHost,
      imap_port: input?.imapPort,
    });
    const saved = await saveConnection(supabase, user.id, fields);
    revalidatePath("/email-sync");
    return toConnection(saved);
  });
}

export async function disconnectEmail() {
  return runAction("disconnectEmail", async () => {
    const { supabase, user } = await requireUser();
    await deleteConnection(supabase, user.id);
    revalidatePath("/email-sync");
    return null;
  });
}
