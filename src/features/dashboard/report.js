import { sourceSiteLabel } from "@/lib/jobDetails";
import { parseDate } from "@/lib/dates";
import {
  groupHistoryByApplication,
  everHad,
  isInResponseWindow,
  startedAsOutreach,
  RESPONSE_STATUSES,
  RESPONSE_WINDOW_DAYS,
} from "@/features/dashboard/data";

// Groups with fewer applications than this show counts only, no percentage
export const MIN_GROUP_SIZE = 5;
export const REPORT_MONTHS = 6;

const SOURCE_LABELS = { manual: "Added manually", email: "From email", extension: "Browser extension" };
const WORKPLACE_LABELS = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function row(key, label, apps, historyByApp, extra = {}) {
  const responses = apps.filter((app) => everHad(app, historyByApp, RESPONSE_STATUSES)).length;
  const interviews = apps.filter((app) => everHad(app, historyByApp, ["Interviewed", "Offered"])).length;
  const offers = apps.filter((app) => everHad(app, historyByApp, ["Offered"])).length;
  const tooFew = apps.length < MIN_GROUP_SIZE;
  return {
    key,
    label,
    applications: apps.length,
    responses,
    interviews,
    offers,
    tooFew,
    responseRate: tooFew ? null : Math.round((responses / apps.length) * 100),
    ...extra,
  };
}

function groupBy(apps, keyOf) {
  const groups = new Map();
  for (const app of apps) {
    const key = keyOf(app);
    if (key === null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(app);
  }
  return groups;
}

// "YYYY-MM" keys of the last `count` calendar months, oldest first
function lastMonths(now, count) {
  const today = new Date(now);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (count - 1 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, d };
  });
}

function monthEnd(d) {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

// Counts of the user's own applications, over those applied RESPONSE_WINDOW_DAYS
// or more ago, split four ways. Descriptive only: the rows add up to records the
// user can list, and a group under MIN_GROUP_SIZE has no percentage.
export function searchReport(applications, history, resumes = [], now = Date.now()) {
  const historyByApp = history instanceof Map ? history : groupHistoryByApplication(history);
  // Rows that began with a recruiter reaching out were never applied to: counted apart
  const inWindow = applications.filter((app) => isInResponseWindow(app, now));
  const eligible = inWindow.filter((app) => !startedAsOutreach(app, historyByApp));
  const make = (key, label, apps, extra) => row(key, label, apps, historyByApp, extra);

  const sources = groupBy(eligible, (app) => app.source || "none");
  const bySource = ["manual", "email", "extension", "none"]
    .filter((key) => sources.has(key))
    .map((key) => make(key, SOURCE_LABELS[key] || "Not recorded", sources.get(key)));
  // Any other stored value is shown as it is rather than dropped
  for (const [key, apps] of sources) {
    if (!["manual", "email", "extension", "none"].includes(key)) bySource.push(make(key, key, apps));
  }

  const sites = groupBy(eligible, (app) => sourceSiteLabel(app.source_site) || null);
  const bySite = [...sites].sort(([a], [b]) => a.localeCompare(b)).map(([label, apps]) => make(label, label, apps));

  const titles = new Map(resumes.map((resume) => [resume.id, resume.title || "Untitled resume"]));
  const resumeGroups = groupBy(eligible, (app) => (app.resume_id && titles.has(app.resume_id) ? app.resume_id : "none"));
  const byResume = [...resumeGroups]
    .map(([key, apps]) => make(key, key === "none" ? "No resume linked" : titles.get(key), apps))
    .sort((a, b) => (a.key === "none") - (b.key === "none") || b.applications - a.applications || a.label.localeCompare(b.label));

  const months = lastMonths(now, REPORT_MONTHS);
  const monthGroups = groupBy(eligible, (app) => {
    const applied = parseDate(app.applied_date);
    return applied ? `${applied.getFullYear()}-${String(applied.getMonth() + 1).padStart(2, "0")}` : null;
  });
  const byMonth = months.map(({ key, d }) =>
    make(key, `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, monthGroups.get(key) || [], {
      // The applications list filters by applied date, so a month can link there
      href: `/applications?from=${key}-01&to=${monthEnd(d)}`,
    })
  );

  const workplaces = groupBy(eligible, (app) => app.workplace_type || "none");
  const byWorkplace = [...workplaces]
    .map(([key, apps]) => make(key, key === "none" ? "Not recorded" : WORKPLACE_LABELS[key] || key, apps))
    .sort((a, b) => (a.key === "none") - (b.key === "none") || b.applications - a.applications || a.label.localeCompare(b.label));

  return {
    windowDays: RESPONSE_WINDOW_DAYS,
    minGroupSize: MIN_GROUP_SIZE,
    total: applications.length,
    included: eligible.length,
    outreach: inWindow.length - eligible.length,
    bySource,
    bySite,
    byResume,
    byMonth,
    byWorkplace,
  };
}
