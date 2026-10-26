import "server-only";

const PENDING_LIMIT = 100;

function toSuggestion(row) {
  return {
    id: row.id,
    kind: row.kind,
    applicationId: row.application_id,
    company: row.company,
    role: row.role || "",
    status: row.status,
    category: row.category,
    confidence: row.confidence,
    summary: row.summary || "",
    emailSubject: row.email_subject || "",
    emailFrom: row.email_from || "",
    emailDate: row.email_date,
  };
}

// Suggestions from email scans that the user hasn't approved or dismissed yet
export async function getPendingSuggestions(supabase, userId) {
  const { data, error } = await supabase
    .from("application_suggestions")
    .select(
      "id, kind, application_id, company, role, status, category, confidence, summary, email_subject, email_from, email_date"
    )
    .eq("user_id", userId)
    .eq("state", "pending")
    .order("email_date", { ascending: false, nullsFirst: false })
    .limit(PENDING_LIMIT);
  if (error) throw error;
  return data.map(toSuggestion);
}

// How many suggestions are waiting, and when the newest arrived (so a dismissed
// banner comes back only when a scan finds something new)
export async function getPendingSummary(supabase, userId) {
  const { data, count, error } = await supabase
    .from("application_suggestions")
    .select("created_at", { count: "exact" })
    .eq("user_id", userId)
    .eq("state", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  // The table comes from migration 005; don't break the applications page without it
  if (error) {
    console.warn("Could not count suggestions:", error.message);
    return { count: 0, latestAt: null };
  }
  return { count: count ?? 0, latestAt: data[0]?.created_at ?? null };
}
