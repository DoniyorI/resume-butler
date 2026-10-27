import { parseSalaryText, SALARY_PERIODS } from "@/lib/salary";

// Job details kept with an application (migration 010): pay range, employment
// and workplace type, and the site it was applied on. Safe on client and server.

// The extension's site adapters (extension/content/sites.js) by id
export const SOURCE_SITES = {
  linkedin: "LinkedIn",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
};

export const sourceSiteLabel = (id) => SOURCE_SITES[id] || "";

export const WORKPLACE_TYPES = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

// "Remote" / "Hybrid" / "On-site" from the location line, or plain statements in the description
function inferWorkplace(location, description) {
  const where = `${location || ""}`.toLowerCase();
  if (/\bhybrid\b/.test(where)) return "hybrid";
  if (/\bremote\b/.test(where)) return "remote";
  if (/\bon-?site\b|\bin[- ]office\b/.test(where)) return "onsite";
  const text = (description || "").slice(0, 20_000).toLowerCase();
  if (/\b(this (role|position) is|we are|fully) hybrid\b|\bhybrid (role|position|schedule|work)\b/.test(text))
    return "hybrid";
  if (
    /\b(fully|100%) remote\b|\bremote[- ](first|role|position)\b|\bthis (role|position) is remote\b/.test(
      text
    )
  )
    return "remote";
  return "";
}

function inferEmployment(description) {
  const text = (description || "").slice(0, 20_000).toLowerCase();
  if (/\bintern(ship)?\b/.test(text) && /\b(summer|internship program|intern role)\b/.test(text))
    return "Internship";
  if (/\bcontract(-to-hire| role| position)\b|\b(w2|1099) contract\b/.test(text)) return "Contract";
  if (/\bpart[- ]time\b/.test(text)) return "Part-time";
  if (/\bfull[- ]time\b/.test(text)) return "Full-time";
  return "";
}

/**
 * Database columns for what a posting says: the extension's structured values
 * first (from the posting's JSON-LD), then what the description and location
 * text say. Unknown values are left out, so they never overwrite anything.
 */
export function jobDetailColumns({ salary, employmentType, workplaceType, location, description, site }) {
  const pay = salary && (salary.min != null || salary.max != null) ? salary : parseSalaryText(description);
  const columns = {};
  if (pay) {
    columns.salary_min = pay.min ?? pay.max;
    columns.salary_max = pay.max ?? pay.min;
    columns.salary_currency = /^[A-Z]{3}$/.test(pay.currency || "") ? pay.currency : "USD";
    // JSON-LD sometimes leaves out the unit: guess from the size, as the text parser does
    columns.salary_period = SALARY_PERIODS.includes(pay.period)
      ? pay.period
      : (pay.max ?? pay.min) < 1000
        ? "hour"
        : "year";
  }
  const workplace = WORKPLACE_TYPES[workplaceType] ? workplaceType : inferWorkplace(location, description);
  if (workplace) columns.workplace_type = workplace;
  const employment = (employmentType || inferEmployment(description)).slice(0, 40);
  if (employment) columns.employment_type = employment;
  if (SOURCE_SITES[site]) columns.source_site = site;
  return columns;
}
