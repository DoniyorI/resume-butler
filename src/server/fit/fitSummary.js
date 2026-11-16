import "server-only";
import { skillLabel } from "@/server/ats/skills";

// Caps keep the extension popup short; the full list stays in the app
const MAX_REQUIRED_NAMES = 8;
const MAX_PREFERRED_NAMES = 6;

const labelOf = (req) => req.label || skillLabel(req.term);
const names = (list, max) => list.slice(0, max).map(labelOf);

/**
 * The part of an assessFit result the browser extension may show: counts,
 * readable names of the requirements the posting asks for, and quotes from the
 * posting itself. Never any text from the user's CV (no evidence quotes, entry
 * titles or skill rows), since the extension also reads pages the user does not
 * control. Pure.
 */
export function fitSummary(fit) {
  if (!fit || !Array.isArray(fit.requirements)) return null;
  const required = fit.requirements.filter((req) => req.importance === "required");
  const preferred = fit.requirements.filter((req) => req.importance === "preferred");
  const labels = new Map(fit.requirements.map((req) => [req.term, labelOf(req)]));
  const degree = fit.degree || { required: null, status: "not-stated" };

  return {
    band: fit.band,
    reason: fit.reason,
    counts: fit.counts,
    missing: names(required.filter((req) => req.strength === "missing"), MAX_REQUIRED_NAMES),
    listed: names(required.filter((req) => req.strength === "listed"), MAX_REQUIRED_NAMES),
    preferredMissing: names(preferred.filter((req) => req.strength === "missing"), MAX_PREFERRED_NAMES),
    notShown: fit.resume
      ? fit.resume.notShown.slice(0, MAX_REQUIRED_NAMES).map((term) => labels.get(term) || skillLabel(term))
      : null,
    years: { required: fit.years.required, have: fit.years.have, status: fit.years.status },
    degree: {
      required: degree.required ? skillLabel(degree.required) : null,
      status: degree.status,
      ...(degree.inProgress ? { inProgress: true } : {}),
    },
    // Language names come from the posting; only whether the CV mentions them is sent
    language: {
      required: (fit.language?.required || []).slice(0, MAX_PREFERRED_NAMES),
      missing: (fit.language?.missing || []).slice(0, MAX_PREFERRED_NAMES),
      status: fit.language?.status || "not-stated",
    },
    checks: (fit.checks || []).filter((check) => check?.quote).map(({ kind, quote }) => ({ kind, quote })),
  };
}
