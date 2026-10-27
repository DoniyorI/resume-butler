import { format } from "date-fns";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { formatShortDate, parseDate } from "@/lib/dates";

// The applications list is driven by its URL, e.g.
// /applications?status=Applied,Interviewed&q=acme&from=2026-01-01&to=2026-10-31&sort=applied_date.desc&page=2
// This module parses and builds those URLs on both the server and the client.

export const APPLICATIONS_PATH = "/applications";
export const APPLICATIONS_PAGE_SIZE = 50;

// Database columns the list can be sorted by
export const SORT_FIELDS = ["company", "role", "status", "location", "applied_date"];
export const DEFAULT_SORT = { field: "applied_date", dir: "desc" };

const MAX_QUERY_LENGTH = 100;

// Next gives an array when a param is repeated (?q=a&q=b); use the first
function single(value) {
  return Array.isArray(value) ? value[0] : value;
}

// Known statuses only, deduplicated and in the usual order. Matching ignores case.
function parseStatuses(value) {
  const wanted = new Set(
    String(single(value) || "")
      .split(",")
      .map((status) => status.trim().toLowerCase())
  );
  return APPLICATION_STATUSES.filter((status) => wanted.has(status.toLowerCase()));
}

// "YYYY-MM-DD" for a real calendar date, otherwise "" (2026-02-30 is rejected)
function parseIsoDate(value) {
  const text = String(single(value) || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = parseDate(text);
  return date && format(date, "yyyy-MM-dd") === text ? text : "";
}

function parseSort(value) {
  const [field, dir] = String(single(value) || "").split(".");
  if (!SORT_FIELDS.includes(field) || !["asc", "desc"].includes(dir)) return DEFAULT_SORT;
  return { field, dir };
}

function parsePage(value) {
  const page = Number.parseInt(single(value), 10);
  return Number.isFinite(page) && page > 1 ? page : 1;
}

// Page searchParams -> list params. Anything invalid falls back to its default.
export function parseListParams(searchParams = {}) {
  let from = parseIsoDate(searchParams.from);
  let to = parseIsoDate(searchParams.to);
  if (from && to && from > to) [from, to] = [to, from];

  return {
    statuses: parseStatuses(searchParams.status),
    q: String(single(searchParams.q) || "")
      .trim()
      .slice(0, MAX_QUERY_LENGTH),
    from,
    to,
    sort: parseSort(searchParams.sort),
    page: parsePage(searchParams.page),
  };
}

export function hasActiveFilters(params) {
  return Boolean(params.statuses.length || params.q || params.from || params.to);
}

// The list URL with some params changed. Any change goes back to page 1
// unless it sets the page itself; defaults are left out of the URL.
export function listHref(params, changes = {}) {
  const next = { ...params, page: 1, ...changes };
  const query = new URLSearchParams();

  if (next.statuses.length) query.set("status", next.statuses.join(","));
  if (next.q) query.set("q", next.q);
  if (next.from) query.set("from", next.from);
  if (next.to) query.set("to", next.to);
  if (next.sort.field !== DEFAULT_SORT.field || next.sort.dir !== DEFAULT_SORT.dir) {
    query.set("sort", `${next.sort.field}.${next.sort.dir}`);
  }
  if (next.page > 1) query.set("page", String(next.page));

  // Commas are fine in a query string and keep ?status=Applied,Offered readable
  const text = query.toString().replace(/%2C/g, ",");
  return text ? `${APPLICATIONS_PATH}?${text}` : APPLICATIONS_PATH;
}

// "Jan 1, 2026 - Oct 31, 2026", "Since Jan 1, 2026" or "Until Oct 31, 2026"
export function dateRangeLabel(from, to) {
  if (from && to) return `${formatShortDate(from)} - ${formatShortDate(to)}`;
  if (from) return `Since ${formatShortDate(from)}`;
  if (to) return `Until ${formatShortDate(to)}`;
  return "";
}
