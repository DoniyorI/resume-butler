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
    needsMatching: Boolean(row.match_reason),
    candidates: row.candidates || [],
    emailSubject: row.email_subject || "",
    emailFrom: row.email_from || "",
    emailDate: row.email_date,
    // For a status update: the tracked application it changes, as it is now
    current: row.application ? { status: row.application.status, role: row.application.role || "" } : null,
  };
}

// Suggestions from email scans that the user hasn't approved or dismissed yet
export async function getPendingSuggestions(supabase, userId) {
  const { data, error } = await supabase
    .from("application_suggestions")
    .select(
      "*, application:applications(status, role)"
    )
    .eq("user_id", userId)
    .eq("state", "pending")
    .order("email_date", { ascending: false, nullsFirst: false })
    .limit(PENDING_LIMIT);
  if (error) throw error;
  const ids = [...new Set(data.flatMap(row => row.match_candidate_ids || []))];
  const candidates = new Map();
  for (let start = 0; start < ids.length; start += 100) {
    const result = await supabase.from("applications").select("id,company,role,status,applied_date,portal_link").eq("user_id", userId).in("id", ids.slice(start, start + 100));
    if (result.error) throw result.error;
    for (const row of result.data) candidates.set(row.id, { id: row.id, company: row.company, role: row.role, status: row.status, appliedDate: row.applied_date, url: row.portal_link });
  }
  return data.map(row => toSuggestion({ ...row, candidates: (row.match_candidate_ids || []).map(id => candidates.get(id)).filter(Boolean) }));
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
