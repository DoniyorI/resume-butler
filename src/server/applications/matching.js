import "server-only";
import { normalizePostingIdentity, samePostingIdentity } from "@/lib/postingIdentity";
import { isSameCycle, normalizeCompany, normalizeRole } from "@/server/email/matching";

function rowIdentity(row) {
  let derived;
  try { derived = normalizePostingIdentity({ url: row.portal_link || "" }); }
  catch { derived = { platform: null, namespace: null, postingId: null, urlKey: row.portal_link || "" }; }
  const stored = row.posting_platform && row.posting_namespace && row.posting_id
    ? { platform: row.posting_platform, namespace: row.posting_namespace, postingId: row.posting_id, urlKey: row.posting_url_key || derived.urlKey }
    : null;
  return { identity: stored || derived, inconsistent: Boolean(stored && derived.platform && !samePostingIdentity(stored, derived)) };
}

export function matchSubmittedOpening(applications, { identity, company, role, now = Date.now() }) {
  const companyKey = normalizeCompany(company), roleKey = normalizeRole(role);
  const rows = applications.filter(row => isSameCycle(row, now));
  const strong = [], weak = [], conflicts = [];
  for (const row of rows) {
    const { identity: candidate, inconsistent } = rowIdentity(row);
    const sameId = samePostingIdentity(identity, candidate);
    const sameUrl = Boolean(identity.urlKey && identity.urlKey === candidate.urlKey);
    const sameNames = Boolean(companyKey && roleKey) && normalizeCompany(row.company) === companyKey && normalizeRole(row.role) === roleKey;
    if (inconsistent && (sameId || sameUrl || sameNames)) { conflicts.push(row.id); continue; }
    if (identity.platform && candidate.platform && !sameId) continue;
    if (sameId || sameUrl) { strong.push(row.id); continue; }
    if (identity.urlKey && candidate.urlKey && identity.urlKey !== candidate.urlKey) continue;
    if (sameNames) weak.push(row.id);
  }
  if (conflicts.length) return { kind: "ambiguous", candidateIds: [...new Set([...conflicts, ...strong])], reason: "conflicting_identity" };
  const candidates = strong.length ? strong : weak;
  if (candidates.length > 1) return { kind: "ambiguous", candidateIds: candidates, reason: "multiple_candidates" };
  if (candidates.length === 1) return { kind: "matched", applicationId: candidates[0], reason: strong.length ? "posting_identity" : "legacy_unique" };
  return { kind: "new", reason: "distinct_opening" };
}
