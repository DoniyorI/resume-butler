import "server-only";
import { getConnection } from "@/server/email/connection";

const HISTORY_LIMIT = 50;

export function toConnection(row) {
  if (!row) return null;
  return {
    emailAddress: row.email_address,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    lastScanAt: row.last_scan_at,
  };
}

// classification is stored LLM output, so only a string status is passed on
function toHistoryItem(row) {
  const classification = row.classification || {};
  const status =
    classification.is_job_related !== false && typeof classification.status === "string"
      ? classification.status
      : null;
  return {
    id: row.id,
    subject: row.email_subject || "",
    from: row.email_from || "",
    status,
    action: row.action_taken,
  };
}

// The connection (without its password) and the most recently processed emails
export async function getEmailSyncData(supabase, userId) {
  const [connection, history] = await Promise.all([
    getConnection(supabase, userId),
    supabase
      .from("processed_emails")
      .select("id, email_subject, email_from, classification, action_taken")
      .eq("user_id", userId)
      .order("processed_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  if (history.error) throw history.error;

  return { connection: toConnection(connection), history: history.data.map(toHistoryItem) };
}
