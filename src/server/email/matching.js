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

export function findApplicationByCompany(applications, normalizedCompany) {
  return applications.find((app) => normalizeCompany(app.company) === normalizedCompany);
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
