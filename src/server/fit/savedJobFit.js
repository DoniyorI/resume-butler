import "server-only";
import { assessFit } from "@/server/fit/assessFit";
import { loadMasterCv } from "@/server/resume/loadCv";
import { readResumeForEditing } from "@/features/resumes/resumeDocument";
import { SAVED_JOBS_PAGE_SIZE, savedJobsQuery, savedJobsResult } from "@/server/opportunities/service";

// Shorter than this, a description can't name requirements worth comparing
const MIN_DESCRIPTION = 40;
export const RANKED_LIMIT = 200;
const BAND_ORDER = ["strong", "good", "stretch", "low", "unknown"];

const describedText = (job) => {
  const text = job?.payload?.job_description;
  return typeof text === "string" && text.trim().length >= MIN_DESCRIPTION ? text : "";
};

// Working resumes these jobs point to, by id: only the user's, only editable formats
async function workingResumes(supabase, userId, jobs) {
  const ids = [...new Set(jobs.map((job) => job.resume_id).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from("resumes")
    .select("id,content")
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw error;
  const resumes = new Map();
  for (const row of data || []) {
    const { readOnly, content } = readResumeForEditing(row.content);
    if (!readOnly) resumes.set(row.id, content);
  }
  return resumes;
}

/**
 * How each saved job fits the user's Master CV: { [jobId]: fit | null }, null
 * for a job without a usable description. Loads the CV and the jobs' working
 * resumes once. On any failure it logs and returns {} so the page still lists jobs.
 */
export async function fitForSavedJobs(supabase, userId, jobs, { today = new Date() } = {}) {
  if (!jobs?.length) return {};
  try {
    const [cv, resumes] = await Promise.all([
      loadMasterCv(supabase, userId),
      workingResumes(supabase, userId, jobs),
    ]);
    const fits = {};
    for (const job of jobs) {
      const jobDescription = describedText(job);
      if (!jobDescription) {
        fits[job.id] = null;
        continue;
      }
      try {
        fits[job.id] = assessFit({
          jobDescription,
          cv,
          resumeContent: resumes.get(job.resume_id) || null,
          today,
        });
      } catch (error) {
        console.error("Assessing fit for a saved job:", error);
        fits[job.id] = null;
      }
    }
    return fits;
  } catch (error) {
    console.error("Assessing fit for saved jobs:", error);
    return {};
  }
}

// Required coverage, the engine's own measure: backed counts fully, listed half
function coverage(fit) {
  const { total, demonstrated, listed } = fit.counts?.required || {};
  return total ? (demonstrated + 0.5 * listed) / total : 0;
}

// strong, good, stretch, low, unknown, then jobs without a fit (no description last)
function rankOf(job, fit) {
  if (fit)
    return BAND_ORDER.includes(fit.band) ? BAND_ORDER.indexOf(fit.band) : BAND_ORDER.indexOf("unknown");
  return describedText(job) ? BAND_ORDER.length : BAND_ORDER.length + 1;
}

const newest = (a, b) =>
  `${b.updated_at || ""}`.localeCompare(`${a.updated_at || ""}`) || `${a.id}`.localeCompare(`${b.id}`);

/**
 * One page of the user's newest RANKED_LIMIT saved jobs (matching `search`),
 * best fit first. Same shape as listOpportunities plus { fits, rankedLimit,
 * ranked (how many were ranked), hasMore (saved jobs beyond the limit),
 * fitUnavailable }. If fit can't be computed, the jobs come newest first.
 */
export async function rankSavedJobsByFit(
  supabase,
  userId,
  { search = "", page = 1, today = new Date() } = {}
) {
  const { jobs, total, setupPending } = savedJobsResult(
    await savedJobsQuery(supabase, userId, search).limit(RANKED_LIMIT)
  );
  const base = {
    rankedLimit: RANKED_LIMIT,
    ranked: jobs.length,
    hasMore: total > RANKED_LIMIT,
    total,
    setupPending,
  };
  const fits = await fitForSavedJobs(supabase, userId, jobs, { today });
  const fitUnavailable = jobs.length > 0 && Object.keys(fits).length === 0;

  const ordered = [...jobs].sort(newest);
  if (!fitUnavailable) {
    ordered.sort((a, b) => {
      const fa = fits[a.id],
        fb = fits[b.id];
      return rankOf(a, fa) - rankOf(b, fb) || (fa && fb ? coverage(fb) - coverage(fa) : 0) || newest(a, b);
    });
  }
  const start = (page - 1) * SAVED_JOBS_PAGE_SIZE;
  const pageJobs = ordered.slice(start, start + SAVED_JOBS_PAGE_SIZE);
  return {
    ...base,
    jobs: pageJobs,
    fits: Object.fromEntries(pageJobs.filter((job) => job.id in fits).map((job) => [job.id, fits[job.id]])),
    fitUnavailable,
  };
}
