// Rows an email scan added that look like job alerts or notifications instead
// of applications. Pure: the applications page lists them for the user to
// remove or keep. Nothing is ever removed without the user choosing it.

export const ALERT_REASONS = {
  alert: "The email was a job alert, not a message about an application",
  jobSite: "Sent by a job site, not by an employer",
  noRole: "The email named no role",
};

const MAX_ROWS = 100;
// A row still at one of these never became an application
const UNMOVED = new Set(["Reached Out", "Pending"]);
const FROM_EMAIL_NOTE = /^\s*(?:auto-detected from email|from email)\s*:/i;
const JOB_SITES = new Set([
  "linkedin",
  "indeed",
  "glassdoor",
  "ziprecruiter",
  "monster",
  "dice",
  "wellfound",
  "handshake",
  "otta",
  "simplify",
  "jobright",
  "builtin",
  "built in",
]);
// How the scan's own summaries describe alerts and digests
const ALERT_WORDING =
  /\bjob\s+alerts?\b|\bnew\s+job\s+(?:match(?:es)?|opportunit(?:y|ies))\b|\bmatch(?:es|ing)?\s+(?:the\s+recipient['’]s|their|your)\s+profile\b|\bsaved\s+job\b|\bis\s+hiring\b|\bhiring\s+opportunit(?:y|ies)\b|\bnewsletter\b|\bdigest\b/i;
const NO_ROLE = /^(?:unknown|n\/a|none|job title or unknown)?$/i;

const text = (value) => String(value ?? "").trim();

function reasonFor(app) {
  if (ALERT_WORDING.test(text(app.comments))) return ALERT_REASONS.alert;
  if (JOB_SITES.has(text(app.company).toLowerCase())) return ALERT_REASONS.jobSite;
  if (NO_ROLE.test(text(app.role))) return ALERT_REASONS.noRole;
  return null;
}

/**
 * The rows worth asking about, newest input order kept, at most 100. A row
 * counts only when an email scan created it, it never left Reached Out or
 * Pending, no resume is linked, and it reads like an alert.
 */
export function findAlertRows(applications, historyByApp) {
  const history = historyByApp instanceof Map ? historyByApp : new Map();
  const found = [];
  for (const app of applications || []) {
    if (!app?.id || !UNMOVED.has(app.status) || app.resume_id) continue;
    const fromEmail = app.source ? app.source === "email" : FROM_EMAIL_NOTE.test(text(app.comments));
    if (!fromEmail) continue;
    if ((history.get(app.id) || []).some((entry) => !UNMOVED.has(entry.status))) continue;
    const reason = reasonFor(app);
    if (!reason) continue;
    found.push({
      id: app.id,
      company: text(app.company),
      role: text(app.role),
      status: app.status,
      comment: text(app.comments),
      reason,
    });
    if (found.length === MAX_ROWS) break;
  }
  return found;
}
