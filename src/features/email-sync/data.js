import "server-only";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { EMAIL_CATEGORIES } from "@/lib/emailCategories";
import { getConnection } from "@/server/email/connection";
import { getPendingSuggestions } from "@/features/suggestions/data";

const CATEGORY_STATUS = Object.fromEntries(EMAIL_CATEGORIES.map((c) => [c.id, c.status]));

const HISTORY_LIMIT = 50;

export function toConnection(row) {
  if (!row) return null;
  return {
    emailAddress: row.email_address,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    lastScanAt: row.last_scan_at,
    autoSync: Boolean(row.auto_sync),
    lastAutoSyncAt: row.last_auto_sync_at,
    lastAutoSyncError: row.last_auto_sync_error,
  };
}

// classification is stored LLM output, so only a known status is passed on.
// Newer rows store a category; older ones stored a status directly.
function toHistoryItem(row) {
  const classification = row.classification || {};
  const candidate = CATEGORY_STATUS[classification.category] || classification.status;
  const status =
    row.action_taken !== "ignored" && APPLICATION_STATUSES.includes(candidate) ? candidate : null;
  return {
    id: row.id,
    subject: row.email_subject || "",
    from: row.email_from || "",
    status,
    action: row.action_taken,
  };
}

// The connection (without its password), recently processed emails and pending suggestions
export async function getEmailSyncData(supabase, userId) {
  const [connection, history, suggestions] = await Promise.all([
    getConnection(supabase, userId),
    supabase
      .from("processed_emails")
      .select("id, email_subject, email_from, classification, action_taken")
      .eq("user_id", userId)
      .order("processed_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    getPendingSuggestions(supabase, userId),
  ]);
  if (history.error) throw history.error;

  return {
    connection: toConnection(connection),
    history: history.data.map(toHistoryItem),
    suggestions,
  };
}
