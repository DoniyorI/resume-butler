"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/actionResult";
import { requireUser } from "@/server/auth";
import { createExtensionToken } from "@/server/extension/tokens";

// A new token for connecting the extension. Returns { id, token }; the token
// is shown to the user (or handed to the extension) once.
export async function connectExtension() {
  return runAction("Error connecting the extension", async () => {
    const { supabase, user } = await requireUser();
    const result = await createExtensionToken(supabase, user.id);
    revalidatePath("/extension");
    return result;
  });
}

// Disconnect a browser: its token stops working right away
export async function revokeExtensionToken(tokenId) {
  return runAction("Error disconnecting", async () => {
    const { supabase, user } = await requireUser();
    const id = parseInput(z.string().uuid("Invalid token"), tokenId);
    const { error } = await supabase
      .from("extension_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/extension");
    return { id };
  });
}
