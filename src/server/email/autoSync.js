import "server-only";
import { syncEmailsForUser } from "@/server/email/sync";
import { HttpError } from "@/server/http";

// Leave room inside the function's time limit (see the cron route's maxDuration);
// whoever isn't reached today is first in line tomorrow
const TIME_BUDGET_MS = 240_000;
const MAX_USERS_PER_RUN = 50;
// First run, or a long gap: look back this far at most
const MAX_LOOKBACK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (date) => date.toISOString().slice(0, 10);

// Scan from the day of the last sync (emails already seen are skipped), or the
// last few days on the first run
function scanWindow(lastSyncAt) {
  const now = new Date();
  const earliest = new Date(now.getTime() - (MAX_LOOKBACK_DAYS - 1) * DAY_MS);
  const last = lastSyncAt ? new Date(lastSyncAt) : null;
  const from = last && last > earliest ? last : earliest;
  return { from: isoDay(from), to: isoDay(now) };
}

/**
 * The daily auto-sync: scan the inbox of everyone who turned it on, oldest
 * sync first, creating suggestions for them to review (nothing is applied).
 * `admin` is a service-role client, so every query here and in
 * syncEmailsForUser is scoped by user_id. Returns a summary for the logs.
 */
export async function runAutoSync(admin) {
  const startedAt = Date.now();
  const { data: connections, error } = await admin
    .from("email_connections")
    .select("user_id, last_auto_sync_at")
    .eq("auto_sync", true)
    .eq("is_active", true)
    .order("last_auto_sync_at", { ascending: true, nullsFirst: true })
    .limit(MAX_USERS_PER_RUN);
  if (error) throw error;

  const summary = { users: connections.length, synced: 0, failed: 0, skipped: 0, suggestions: 0 };
  for (const connection of connections) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      summary.skipped++;
      continue;
    }
    let result = null;
    let failure = null;
    try {
      result = await syncEmailsForUser(admin, connection.user_id, scanWindow(connection.last_auto_sync_at));
    } catch (err) {
      // HttpError messages are user-safe (bad password, unsupported host); others aren't
      failure = err instanceof HttpError ? err.message : "The scan failed. It will try again tomorrow.";
      console.error(`Auto-sync failed for ${connection.user_id}:`, err);
    }

    const { error: saveError } = await admin
      .from("email_connections")
      .update({
        last_auto_sync_at: new Date().toISOString(),
        last_auto_sync_error: failure,
      })
      .eq("user_id", connection.user_id);
    if (saveError) console.error("Could not record auto-sync:", saveError);

    if (failure) summary.failed++;
    else {
      summary.synced++;
      summary.suggestions += result.suggestions;
    }
  }
  return summary;
}
