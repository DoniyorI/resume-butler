import "server-only";
import { assessFit } from "@/server/fit/assessFit";
import { fitSummary } from "@/server/fit/fitSummary";
import { loadMasterCv } from "@/server/resume/loadCv";

// Shorter than this, a description can't name requirements worth comparing
const MIN_DESCRIPTION = 40;

/**
 * Each posting with `fit`: the fit summary (band, reason, counts, missing,
 * listed, checks) against the Master CV, or null without a usable description.
 * The CV is loaded once. Any failure logs and leaves every fit null, so the
 * page still lists the postings.
 */
export async function postingsWithFit(supabase, userId, postings, { today = new Date() } = {}) {
  const none = postings.map((posting) => ({ ...posting, fit: null }));
  if (!postings.length) return none;
  try {
    const cv = await loadMasterCv(supabase, userId);
    return postings.map((posting) => {
      if (posting.description.trim().length < MIN_DESCRIPTION) return { ...posting, fit: null };
      try {
        return { ...posting, fit: fitSummary(assessFit({ jobDescription: posting.description, cv, today })) };
      } catch (error) {
        console.error("Fit for a watched posting:", error?.name || "error");
        return { ...posting, fit: null };
      }
    });
  } catch (error) {
    console.error("Watchlist fit:", error?.name || "error");
    return none;
  }
}

// What the client needs of a posting: never the description
export function toClientPosting(posting) {
  const { fit } = posting;
  return {
    id: posting.id,
    companyId: posting.companyId,
    companyName: posting.companyName,
    title: posting.title,
    location: posting.location,
    workplaceType: posting.workplaceType,
    firstSeenAt: posting.firstSeenAt,
    url: posting.url,
    fit: fit ? { band: fit.band, reason: fit.reason, missing: fit.missing, listed: fit.listed, checks: fit.checks } : null,
  };
}
