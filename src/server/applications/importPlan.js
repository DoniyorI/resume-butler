import "server-only";
import { z } from "zod";
import { parseCsv, unguardFormula } from "@/lib/csv";
import { DEFAULT_STATUS } from "@/lib/constants";
import { normalizeHttpUrl } from "@/lib/safeUrl";
import { parseSalaryText } from "@/lib/salary";
import { applicationFields } from "@/features/applications/schema";
import { normalizeCompany, normalizeRole } from "@/server/email/matching";
import { HttpError } from "@/server/http";

// Planning a spreadsheet import. Pure: no database, no clock. Nothing here
// invents a value: what the file lacks stays empty, or the row is skipped.

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_COLUMNS = 40;
export const FIELDS = ["company", "role", "status", "appliedDate", "location", "link", "pay", "workplace", "employmentType", "notes"];

const SYNONYMS = {
  company: ["company", "employer", "organization", "organisation", "company name"],
  role: ["role", "title", "position", "job title", "job", "role title"],
  status: ["status", "stage", "state"],
  appliedDate: ["applied date", "date applied", "applied", "applied on", "date", "application date"],
  location: ["location", "city", "where"],
  link: ["link", "url", "portal link", "job link", "posting", "job url", "job posting"],
  pay: ["pay", "salary", "compensation", "comp", "pay range", "salary range"],
  workplace: ["workplace", "remote", "work type", "workplace type"],
  employmentType: ["employment type", "type", "job type"],
  notes: ["notes", "comments", "note", "comment"],
};

const squash = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const SYNONYM_KEYS = Object.fromEntries(Object.entries(SYNONYMS).map(([field, names]) => [field, names.map(squash)]));

function detectMapping(headers, given) {
  const mapping = {};
  const used = new Set();
  const explicit = given && typeof given === "object" ? given : {};
  for (const field of FIELDS) {
    if (!(field in explicit)) continue;
    const index = explicit[field];
    mapping[field] = Number.isInteger(index) && index >= 0 && index < headers.length ? index : null;
    if (mapping[field] !== null) used.add(mapping[field]);
  }
  const keys = headers.map(squash);
  for (const field of FIELDS) {
    if (field in mapping) continue;
    const index = keys.findIndex((key, i) => !used.has(i) && key && SYNONYM_KEYS[field].includes(key));
    mapping[field] = index === -1 ? null : index;
    if (index !== -1) used.add(index);
  }
  return mapping;
}

const STATUS_WORDS = {
  applied: "Applied", submitted: "Applied", sent: "Applied",
  "reached out": "Reached Out", recruiter: "Reached Out", contacted: "Reached Out", "phone screen": "Reached Out", screen: "Reached Out", screening: "Reached Out",
  pending: "Pending", "in progress": "Pending", "in review": "Pending", "under review": "Pending", waiting: "Pending",
  interviewed: "Interviewed", interview: "Interviewed", interviewing: "Interviewed", onsite: "Interviewed", "on-site": "Interviewed", "final round": "Interviewed", technical: "Interviewed",
  offered: "Offered", offer: "Offered", accepted: "Offered",
  rejected: "Rejected", declined: "Rejected", no: "Rejected", closed: "Rejected", "not selected": "Rejected", "turned down": "Rejected",
  withdrew: "Withdrew", withdrawn: "Withdrew", cancelled: "Withdrew", canceled: "Withdrew",
};

/** The status a cell means, or null when it is not one we know. */
export function parseStatusCell(value) {
  return STATUS_WORDS[String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim()] ?? null;
}

const WORKPLACE_WORDS = { remote: "remote", hybrid: "hybrid", onsite: "onsite", "on-site": "onsite", "on site": "onsite", "in office": "onsite", "in-office": "onsite" };

// ---- Dates ----

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const ISO_DATE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:T.*|\s+\d.*)?$/;
const NUMERIC_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:\s+\d.*)?$/;
const DAY_FIRST_NAMED = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,9})\.?,?[\s-]+(\d{4}|\d{2})$/;
const MONTH_FIRST_NAMED = /^([a-z]{3,9})\.?[\s-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s-]+(\d{4}|\d{2})$/;

function monthNumber(word) {
  if (word === "sept") return 9;
  const index = MONTHS.findIndex((name) => name.startsWith(word));
  return word.length >= 3 && index !== -1 ? index + 1 : null;
}

function fullYear(text) {
  const year = Number(text);
  if (text.length === 4) return year;
  return year < 70 ? 2000 + year : 1900 + year;
}

function build(year, month, day, today) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const limit = Number(String(today).slice(0, 4)) + 1;
  if (year < 1990 || year > limit || month < 1 || month > 12 || day < 1) return null;
  const real = new Date(Date.UTC(year, month - 1, day));
  if (real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** YYYY-MM-DD for a date cell, or null. Spreadsheet serial numbers are never guessed. */
export function parseDateCell(value, order = "mdy", today = new Date().toISOString().slice(0, 10)) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  let match = ISO_DATE.exec(text);
  if (match) return build(Number(match[1]), Number(match[2]), Number(match[3]), today);
  match = NUMERIC_DATE.exec(text);
  if (match) {
    const [first, second] = [Number(match[1]), Number(match[2])];
    const [month, day] = order === "dmy" ? [second, first] : [first, second];
    return build(fullYear(match[3]), month, day, today);
  }
  const lower = text.toLowerCase();
  match = DAY_FIRST_NAMED.exec(lower);
  if (match) return build(fullYear(match[3]), monthNumber(match[2]), Number(match[1]), today);
  match = MONTH_FIRST_NAMED.exec(lower);
  if (match) return build(fullYear(match[3]), monthNumber(match[1]), Number(match[2]), today);
  return null;
}

/** Whether numeric dates read day-first or month-first, and whether the file leaves that open. */
export function detectDateOrder(values) {
  let numeric = 0;
  let dayFirst = false;
  let monthFirst = false;
  for (const value of values) {
    const match = NUMERIC_DATE.exec(String(value ?? "").trim());
    if (!match) continue;
    numeric++;
    if (Number(match[1]) > 12) dayFirst = true;
    else if (Number(match[2]) > 12) monthFirst = true;
  }
  if (dayFirst) return { order: "dmy", ambiguous: false };
  if (monthFirst) return { order: "mdy", ambiguous: false };
  return { order: "mdy", ambiguous: numeric > 0 };
}

// ---- Duplicates ----

const nameKey = (company, role, date) => {
  const name = normalizeCompany(company);
  return name && date ? `${name}|${normalizeRole(role)}|${date}` : "";
};

// A link without its fragment or trailing slash, so the same posting matches
function linkKey(link) {
  const normalized = normalizeHttpUrl(link || "");
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    url.hash = "";
    return url.href.replace(/\/+$/, "").toLowerCase();
  } catch {
    return "";
  }
}

// ---- The plan ----

const rowSchema = z.object(applicationFields);

function fieldProblem(row, link) {
  const parsed = rowSchema.safeParse({
    company: row.company, role: row.role, location: row.location, portalLink: link,
    status: row.status, comments: row.notes, appliedDate: row.appliedDate,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { reason: `${issue.message}.`, data: null };
  }
  if (link && !parsed.data.portalLink) return { reason: "The link is not a web address (http or https).", data: null };
  return { reason: "", data: parsed.data };
}

function emptyPlan(extra) {
  return {
    headers: [], delimiter: ",", mapping: {}, needsMapping: false, dateOrder: "mdy", dateOrderAmbiguous: false,
    totals: { rows: 0, ready: 0, duplicates: 0, undated: 0, errors: 0, truncated: false },
    unknownStatuses: [], rows: [], ...extra,
  };
}

/**
 * Plan an import from CSV text. `existing` is [{ company, role, appliedDate, link }]
 * for the user's current applications; `today` is YYYY-MM-DD.
 */
export function planImport({ text, options = {}, existing = [], today }) {
  const parsed = parseCsv(text, { maxRows: MAX_IMPORT_ROWS + 1, maxColumns: MAX_IMPORT_COLUMNS });
  if (!parsed.rows.length) throw new HttpError(400, "This file is empty. The first row must hold the column headings.");
  const clean = (value) => unguardFormula(String(value ?? "").trim()).trim();
  const headers = parsed.rows[0].map(clean);
  const dataRows = parsed.rows.slice(1);
  if (!dataRows.length) throw new HttpError(400, "This file has headings but no rows to import.");

  const mapping = detectMapping(headers, options.mapping);
  if (mapping.company === null) return emptyPlan({ headers, delimiter: parsed.delimiter, mapping, needsMapping: true });

  const cells = dataRows.slice(0, MAX_IMPORT_ROWS).map((record) => record.map(clean));
  const pick = (record, field) => (mapping[field] === null ? "" : record[mapping[field]] ?? "");

  const detected = detectDateOrder(mapping.appliedDate === null ? [] : cells.map((record) => pick(record, "appliedDate")));
  const dateOrder = options.dateOrder === "dmy" || options.dateOrder === "mdy" ? options.dateOrder : detected.order;

  const seenNames = new Set();
  const seenLinks = new Set();
  for (const item of existing) {
    const key = nameKey(item.company, item.role, item.appliedDate);
    if (key) seenNames.add(key);
    const link = linkKey(item.link);
    if (link) seenLinks.add(link);
  }

  const totals = { rows: 0, ready: 0, duplicates: 0, undated: 0, errors: 0, truncated: parsed.truncated || dataRows.length > MAX_IMPORT_ROWS };
  const unknown = new Map();
  const rows = [];

  cells.forEach((record, index) => {
    const line = index + 2;
    const rawStatus = pick(record, "status");
    const rawDate = pick(record, "appliedDate");
    const rawPay = pick(record, "pay");
    const rawWorkplace = pick(record, "workplace");
    const noteLines = [];
    const notes = pick(record, "notes");
    if (notes) noteLines.push(notes);

    let status = DEFAULT_STATUS;
    if (rawStatus) {
      const known = parseStatusCell(rawStatus);
      if (known) status = known;
      else {
        noteLines.push(`Imported status: ${rawStatus}`);
        const key = rawStatus.toLowerCase();
        const entry = unknown.get(key);
        if (entry) entry.count++;
        else if (unknown.size < 20) unknown.set(key, { value: rawStatus, count: 1 });
      }
    }

    let pay = "";
    if (rawPay) {
      if (parseSalaryText(rawPay)) pay = rawPay;
      else noteLines.push(`Imported pay: ${rawPay}`);
    }
    let workplace = "";
    if (rawWorkplace) {
      workplace = WORKPLACE_WORDS[rawWorkplace.toLowerCase().replace(/\s+/g, " ")] || "";
      if (!workplace) noteLines.push(`Imported workplace: ${rawWorkplace}`);
    }

    const row = {
      line, company: pick(record, "company"), role: pick(record, "role"), status,
      appliedDate: rawDate ? parseDateCell(rawDate, dateOrder, today) : null,
      location: pick(record, "location"), link: pick(record, "link"), pay, workplace,
      employmentType: pick(record, "employmentType"), notes: noteLines.join("\n"),
      outcome: "ready", reason: "",
    };
    totals.rows++;

    const checked = fieldProblem(row, row.link);
    if (!checked.data) {
      row.outcome = "error";
      row.reason = checked.reason;
    } else if (row.employmentType.length > 40) {
      row.outcome = "error";
      row.reason = "Employment type is too long.";
    } else {
      // Keep what the shared rules cleaned up (trimmed text, a link with https://)
      row.company = checked.data.company;
      row.role = checked.data.role;
      row.location = checked.data.location;
      row.link = checked.data.portalLink;
      row.notes = checked.data.comments;
    }

    if (row.outcome === "ready" && !row.appliedDate) {
      if (options.undated === "today" && today) {
        row.appliedDate = today;
        row.usedToday = true;
      } else {
        row.outcome = "undated";
        row.reason = rawDate ? `Could not read the date "${rawDate}"` : "No applied date in the file";
      }
    }

    if (row.outcome === "ready") {
      const name = nameKey(row.company, row.role, row.appliedDate);
      const link = linkKey(row.link);
      const alike = (name && seenNames.has(name)) || (link && seenLinks.has(link));
      if (alike && options.includeDuplicates !== true) {
        row.outcome = "duplicate";
        row.reason = "Looks the same as an application already tracked or earlier in this file";
      } else {
        if (name) seenNames.add(name);
        if (link) seenLinks.add(link);
      }
    }

    if (row.outcome === "ready") totals.ready++;
    else if (row.outcome === "duplicate") totals.duplicates++;
    else if (row.outcome === "undated") totals.undated++;
    else totals.errors++;
    rows.push(row);
  });

  return {
    headers, delimiter: parsed.delimiter, mapping, needsMapping: false,
    dateOrder, dateOrderAmbiguous: mapping.appliedDate !== null && detected.ambiguous,
    totals, unknownStatuses: [...unknown.values()], rows,
  };
}
