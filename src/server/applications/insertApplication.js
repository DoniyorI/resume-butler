import "server-only";
import { normalizePostingIdentity } from "@/lib/postingIdentity";

// Columns added after the initial schema (migrations 010 and 012). An insert
// that names one before its migration is applied fails with one of these codes.
const MISSING_COLUMN = ["42703", "PGRST204"];

// Job detail columns (migration 010) a saved job's payload may carry
export const JOB_DETAIL_KEYS = ["salary_min", "salary_max", "salary_currency", "salary_period", "workplace_type", "employment_type", "source_site"];

/** The job detail columns a saved job's payload has values for. */
export function payloadDetailColumns(payload) {
  const columns = {};
  for (const key of JOB_DETAIL_KEYS) {
    const value = payload?.[key];
    if (value != null && value !== "") columns[key] = value;
  }
  return columns;
}

/** Posting identity columns (migration 012) for a link, as the extension writes them. Empty when the link has none. */
export function postingIdentityColumns(portalLink) {
  if (!portalLink) return {};
  try {
    const identity = normalizePostingIdentity({ url: portalLink });
    return { posting_platform: identity.platform, posting_namespace: identity.namespace, posting_id: identity.postingId, posting_url_key: identity.urlKey };
  } catch {
    return {};
  }
}

/**
 * Insert one application for userId and return { id }. `fields` are columns of
 * the initial schema; `details` are optional job detail columns. Posting
 * identity columns are derived from portal_link. When the database doesn't
 * have the newer columns yet, the row is written without the identity columns
 * (012), then without the job details too (010) (fail open). Each attempt
 * failed, so at most one row is written.
 * A missing applied_date is left out so the column default (today) applies.
 */
export async function insertApplication(supabase, userId, fields, details = {}) {
  const base = { ...fields, user_id: userId };
  if (base.applied_date == null) delete base.applied_date;
  const withDetails = { ...base, ...details };
  const attempts = [{ ...withDetails, ...postingIdentityColumns(base.portal_link) }, withDetails, base]
    .filter((row, i, all) => i === 0 || Object.keys(row).length < Object.keys(all[i - 1]).length);
  let result;
  for (const row of attempts) {
    result = await supabase.from("applications").insert(row).select("id").single();
    if (!MISSING_COLUMN.includes(result.error?.code)) break;
  }
  if (result.error) throw result.error;
  return { id: result.data.id };
}
