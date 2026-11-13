import "server-only";
import { assessFit } from "@/server/fit/assessFit";
import { loadMasterCv } from "@/server/resume/loadCv";
import { listPostings } from "@/server/watchlist/service";

// Shorter than this, a description can't name requirements worth comparing
const MIN_DESCRIPTION = 40;
const BAND_LIMIT = 60;
// Postings first seen within this long of the company being added are its backlog, not news
const BACKLOG_MS = 3_600_000;

/**
 * How the 60 newest open watched postings fit the Master CV, for Today's
 * suggestions: [{ id, firstSeenAt, band }], band null without a usable
 * description. `cv` is the loaded Master CV (loaded here when left out);
 * `today` a Date or "YYYY-MM-DD". Fails soft: any failure logs and returns [].
 */
export async function watchedWithBands(supabase, userId, { cv, today = new Date() } = {}) {
  try {
    const { postings } = await listPostings(supabase, userId, { limit: BAND_LIMIT });
    if (!postings.length) return [];
    const masterCv = cv || (await loadMasterCv(supabase, userId));
    const day = typeof today === "string" ? new Date(`${today}T00:00:00Z`) : today;
    return postings
      .filter((posting) => {
        const added = Date.parse(posting.companyCreatedAt);
        const seen = Date.parse(posting.firstSeenAt);
        return !(Number.isFinite(added) && Number.isFinite(seen) && seen - added <= BACKLOG_MS);
      })
      .map((posting) => {
      let band = null;
      if (posting.description.trim().length >= MIN_DESCRIPTION) {
        try {
          band = assessFit({ jobDescription: posting.description, cv: masterCv, today: day }).band;
        } catch (error) {
          console.error("Fit for a watched posting:", error?.name || "error");
        }
      }
      return { id: posting.id, firstSeenAt: posting.firstSeenAt, band };
    });
  } catch (error) {
    console.error("Watched posting fits:", error?.name || "error");
    return [];
  }
}
