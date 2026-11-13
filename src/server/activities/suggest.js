import "server-only";
import { formatShortDate, parseDate } from "@/lib/dates";
import { waitingOnReply } from "@/features/dashboard/data";
import { addDays, daysBetween } from "@/features/activities/kinds";

// Rule-based next steps (no AI), computed on every load and never stored.
// The rules run in order of urgency; within a rule the oldest comes first.
// An open activity on the application for the same purpose suppresses a
// suggestion, so recording the step makes it go away.

export const SUGGESTION_LIMIT = 8;
// An interview step counts as recent for this many days
const RECENT_DAYS = 14;
// Saved jobs older than this ask for a decision
const SAVED_JOB_DAYS = 7;
// Saved jobs that fit the Master CV well enough to suggest applying, strongest first
const FIT_SUGGESTION_LIMIT = 2;
const FIT_BANDS = ["strong", "good"];

const DAY_MS = 86_400_000;
const companyOf = (app) => app.company || "this company";
const appHref = (id, kind) => `/applications/${id}?step=${kind}#next-steps`;

/**
 * @param {object} input
 * @param {Array} input.applications rows with id, company, role, status, applied_date
 * @param {Map} input.historyByApp application id -> [{ status, changed_at }]
 * @param {Array} input.activities [{ applicationId, kind, status, dueOn, completedAt }] (empty before migration 020)
 * @param {Array} input.savedJobs [{ id, company, role, createdAt, applicationId, band? }]; `band` is the
 *   fit band from assessFit when the caller could compute it (never computed here)
 * @param {number} input.pendingEmailCount inbox suggestions waiting for review
 * @param {string} input.today "YYYY-MM-DD"
 * @returns {Array<{ id, kind, title, reason, href, applicationId? }>}
 */
export function suggestNextSteps({
  applications = [],
  historyByApp = new Map(),
  activities = [],
  savedJobs = [],
  pendingEmailCount = 0,
  today,
}) {
  const open = new Map();
  const recent = new Set();
  const recentFrom = addDays(today, -RECENT_DAYS);
  for (const activity of activities) {
    if (activity.status === "open") {
      if (!open.has(activity.applicationId)) open.set(activity.applicationId, new Set());
      open.get(activity.applicationId).add(activity.kind);
    } else if (activity.status === "done") {
      const completed = activity.completedAt ? String(activity.completedAt).slice(0, 10) : null;
      if ((activity.dueOn && activity.dueOn >= recentFrom) || (completed && completed >= recentFrom)) {
        recent.add(activity.applicationId);
      }
    }
  }
  const hasOpen = (appId, kind) => {
    const kinds = open.get(appId);
    return Boolean(kinds && (kind ? kinds.has(kind) : kinds.size));
  };

  const offers = [];
  const interviews = [];
  const recruiters = [];
  for (const app of applications) {
    if (app.status === "Offered" && !hasOpen(app.id, "offer_deadline")) {
      offers.push({
        id: `offer:${app.id}`,
        kind: "offer_deadline",
        title: "Record your offer deadline",
        reason: `Record the decision deadline for your offer from ${companyOf(app)}.`,
        href: appHref(app.id, "offer_deadline"),
        applicationId: app.id,
      });
    } else if (app.status === "Interviewed" && !hasOpen(app.id) && !recent.has(app.id)) {
      interviews.push({
        id: `interview:${app.id}`,
        kind: "interview",
        title: "Plan the next round",
        reason: `Add your next round or a thank-you follow-up for ${companyOf(app)}.`,
        href: appHref(app.id, "interview"),
        applicationId: app.id,
      });
    } else if (app.status === "Reached Out" && !hasOpen(app.id)) {
      recruiters.push({
        id: `recruiter:${app.id}`,
        kind: "recruiter_screen",
        title: "Reply to the recruiter",
        reason: `Reply to the recruiter at ${companyOf(app)}.`,
        href: appHref(app.id, "recruiter_screen"),
        applicationId: app.id,
      });
    }
  }

  // The dashboard's follow-up rule, measured from the given day (noon, so a
  // daylight-saving change can't round a day away)
  // The reason names the applied date, not a day count that the server's
  // zone could put one day off
  const now = (parseDate(today)?.getTime() ?? Date.now()) + DAY_MS / 2;
  const appliedOn = new Map(applications.map((app) => [app.id, app.applied_date]));
  const followUps = waitingOnReply(applications, historyByApp, now)
    .filter((app) => !hasOpen(app.id, "follow_up"))
    .map((app) => ({
      id: `follow-up:${app.id}`,
      kind: "follow_up",
      title: "Send a follow-up",
      reason: `No reply from ${companyOf(app)} since you applied on ${formatShortDate(appliedOn.get(app.id))}. Send a follow-up or set a date to check again.`,
      href: appHref(app.id, "follow_up"),
      applicationId: app.id,
    }));

  const inbox =
    pendingEmailCount > 0
      ? [
          {
            id: "inbox",
            kind: "inbox",
            title: "Review inbox updates",
            reason: `Review ${pendingEmailCount} inbox ${pendingEmailCount === 1 ? "update" : "updates"}.`,
            href: "/email-sync",
          },
        ]
      : [];

  const fitting = savedJobs
    .filter((job) => !job.applicationId && FIT_BANDS.includes(job.band))
    .map((job, i) => ({ job, i }))
    .sort(
      (a, b) =>
        FIT_BANDS.indexOf(a.job.band) - FIT_BANDS.indexOf(b.job.band) ||
        String(b.job.createdAt || "").localeCompare(String(a.job.createdAt || "")) ||
        a.i - b.i
    )
    .slice(0, FIT_SUGGESTION_LIMIT)
    .map(({ job }) => job);
  const suggestedToApply = new Set(fitting.map((job) => job.id));
  const fits = fitting.map((job) => ({
    id: `saved-fit:${job.id}`,
    kind: "saved_job_fit",
    title: "Apply to a saved job that fits",
    reason: `${job.role && job.company ? `${job.role} at ${job.company}` : job.role || job.company || "A saved job"} looks like ${
      job.band === "strong" ? "a strong" : "a good"
    } fit. Tailor a resume and apply.`,
    href: "/saved-jobs?sort=fit",
  }));

  const saved = savedJobs
    .filter((job) => !job.applicationId && job.createdAt && !suggestedToApply.has(job.id))
    .map((job) => ({ job, age: daysBetween(String(job.createdAt).slice(0, 10), today) }))
    .filter(({ age }) => age > SAVED_JOB_DAYS)
    .sort((a, b) => b.age - a.age)
    .map(({ job }) => ({
      id: `saved:${job.id}`,
      kind: "saved_job",
      title: "Decide on a saved job",
      reason: `Decide on ${job.company || "a saved job"}${job.role ? ` (${job.role})` : ""}: apply or remove it.`,
      href: "/saved-jobs",
    }));

  return [...offers, ...interviews, ...recruiters, ...followUps, ...inbox, ...fits, ...saved].slice(0, SUGGESTION_LIMIT);
}
