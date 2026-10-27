import "server-only";
import { APPLICATION_STATUSES, STATUS_PROGRESSION } from "@/lib/constants";

const COMPANY_SUFFIXES = /\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc)\b/g;

// Normalize a company name for exact comparison; returns "" if unusable.
// Exact on purpose: a substring match would let an email from "Meta" update "Metabase".
export function normalizeCompany(name) {
  if (typeof name !== "string" || name.length > 100) return "";
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9& ]/g, " ")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length >= 2 && normalized !== "unknown" ? normalized : "";
}

export function normalizeRole(role) {
  return typeof role === "string"
    ? role
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    : "";
}

function sameRole(a, b) {
  const left = normalizeRole(a);
  const right = normalizeRole(b);
  return Boolean(left && right) && (left === right || left.includes(right) || right.includes(left));
}

const TERMINAL_STATUSES = ["Rejected", "Withdrew"];
const DAY_MS = 24 * 60 * 60 * 1000;
// Applying again to a role this long after the last time is a new hiring cycle
export const NEW_CYCLE_DAYS = 120;

const isOpen = (app) => !TERMINAL_STATUSES.includes(app.status);
// When it was applied to; rows without a date (pending suggestions) count as now
const appliedAt = (app) => {
  const time = new Date(app.applied_date || app.created_at || NaN).getTime();
  return Number.isNaN(time) ? Date.now() : time;
};
// Open applications first, then the most recently applied
const mostRelevantFirst = (a, b) => Number(isOpen(b)) - Number(isOpen(a)) || appliedAt(b) - appliedAt(a);

/**
 * True when a new submission or "thanks for applying" belongs to `app`: it's
 * still open and was applied to recently. A closed application (rejected,
 * withdrawn) or one from months ago means this is a new hiring cycle.
 */
export function isSameCycle(app, now = Date.now()) {
  return isOpen(app) && now - appliedAt(app) <= NEW_CYCLE_DAYS * DAY_MS;
}

/**
 * The tracked application an email is about, or null if it's a new one.
 * Matches the company exactly (after normalizing), then the role when both
 * sides name one, so two roles at the same company stay separate; an exact
 * role beats a similar one, and open, recent applications beat old ones. A
 * confirmation for a role whose application is closed or long past starts a
 * new cycle. An email that names no role (common for rejections) goes to the
 * company's only open application.
 */
export function findTargetApplication(applications, { company, role, category, now = Date.now() }) {
  const atCompany = applications
    .filter((app) => normalizeCompany(app.company) === company)
    .sort(mostRelevantFirst);
  if (atCompany.length === 0) return null;

  const wanted = normalizeRole(role);
  const exact = wanted ? atCompany.filter((app) => normalizeRole(app.role) === wanted) : [];
  const byRole = exact.length ? exact : atCompany.filter((app) => sameRole(app.role, role));
  if (byRole.length) {
    const target = byRole[0];
    return category === "application_received" && !isSameCycle(target, now) ? null : target;
  }
  if (wanted && category === "application_received") return null;

  const open = atCompany.filter(isOpen);
  return open.length === 1 ? open[0] : null;
}

// Date headers come from the sender and may be malformed; return null instead of throwing
export function parseEmailDate(header) {
  if (!header) return null;
  const date = new Date(header);
  return isNaN(date.getTime()) ? null : date;
}

// The LLM's status is untrusted; anything unknown becomes Pending
export function toKnownStatus(status) {
  return APPLICATION_STATUSES.includes(status) ? status : "Pending";
}

// An email may move an open application forward, or reject it. It never touches
// a terminal application (Rejected, Withdrew) and never turns an offer into a rejection.
export function shouldUpdateStatus(currentStatus, emailStatus) {
  const currentIdx = STATUS_PROGRESSION.indexOf(currentStatus);
  if (currentIdx < 0) return false;
  if (emailStatus === "Rejected") return currentStatus !== "Offered";
  return STATUS_PROGRESSION.indexOf(emailStatus) > currentIdx;
}
