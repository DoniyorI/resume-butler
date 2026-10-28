import "server-only";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/server/http";

const active = new Set();
let warned = false;
const missingFunction = (error) => ["PGRST202", "42883"].includes(error?.code);

// Migration 011 makes the lease work across server instances. The local guard
// also covers a double click while the database request is still in flight.
export async function withEmailSyncLock(supabase, userId, scan) {
  if (active.has(userId)) throw new HttpError(409, "An email scan is already running. Try again shortly.");
  active.add(userId);
  const token = randomUUID();
  let databaseLease = false;
  try {
    const { data, error } = await supabase.rpc("acquire_email_sync_lock", { p_user_id: userId, p_token: token });
    if (missingFunction(error)) {
      if (!warned) {
        console.warn("Email sync is using process-local locking until migration 011 is applied.");
        warned = true;
      }
    } else {
      if (error) throw new HttpError(503, "Email sync locking is temporarily unavailable. Try again shortly.");
      if (!data) throw new HttpError(409, "An email scan is already running. Try again shortly.");
      databaseLease = true;
    }
    return await scan();
  } finally {
    if (databaseLease) {
      try {
        const { error } = await supabase.rpc("release_email_sync_lock", { p_user_id: userId, p_token: token });
        if (error) console.warn("Could not release email sync lease:", error.code);
      } catch { console.warn("Could not release email sync lease; it will expire automatically."); }
    }
    active.delete(userId);
  }
}
