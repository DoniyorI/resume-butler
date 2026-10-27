// Reads a job posting from the page: the JSON-LD JobPosting many sites include
// for search engines, then the site's selectors (content/sites.js), then the
// page title. Page content is untrusted: everything is plain text, trimmed and
// capped, and HTML is parsed into a detached document, never inserted.

const MAX_DESCRIPTION = 50_000;
const MAX_FIELD = 200;

function clean(text, max = MAX_FIELD) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Paragraph breaks kept, everything else plain
function htmlToText(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p, li, h1, h2, h3, h4, div").forEach((el) => el.append("\n"));
  return (doc.body.textContent || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

function jsonLdPosting(doc) {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : data["@graph"] || [data];
      const posting = items.find((item) => item && item["@type"] === "JobPosting");
      if (posting) return posting;
    } catch {
      // Malformed JSON-LD: try the next one
    }
  }
  return null;
}

function postingLocation(posting) {
  const places = [].concat(posting?.jobLocation || []);
  const parts = places
    .map((place) => {
      const address = place?.address || {};
      return [
        address.addressLocality,
        address.addressRegion,
        address.addressCountry?.name || address.addressCountry,
      ]
        .filter((part) => typeof part === "string" && part.trim())
        .join(", ");
    })
    .filter(Boolean);
  if (parts.length) return parts.join("; ");
  return posting?.jobLocationType === "TELECOMMUTE" ? "Remote" : "";
}

// JSON-LD pay: baseSalary (or estimatedSalary) as
// { currency, value: { minValue, maxValue, value, unitText: "YEAR" | "HOUR" | ... } }
const PERIODS = { HOUR: "hour", DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year" };
function postingSalary(posting) {
  const pay = [].concat(posting?.baseSalary || posting?.estimatedSalary || [])[0];
  const value = pay?.value && typeof pay.value === "object" ? pay.value : pay;
  const number = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : null);
  const min = number(value?.minValue ?? value?.value);
  const max = number(value?.maxValue ?? value?.value);
  if (min == null && max == null) return null;
  const currency =
    typeof pay?.currency === "string" && /^[A-Z]{3}$/.test(pay.currency) ? pay.currency : "USD";
  return { min, max, currency, period: PERIODS[String(value?.unitText || "").toUpperCase()] || null };
}

// "FULL_TIME" or ["FULL_TIME", "CONTRACTOR"] -> "Full-time"
const EMPLOYMENT = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACTOR: "Contract",
  TEMPORARY: "Temporary",
  INTERN: "Internship",
  PER_DIEM: "Per diem",
  VOLUNTEER: "Volunteer",
};
function postingEmploymentType(posting) {
  const type = [].concat(posting?.employmentType || [])[0];
  return typeof type === "string" ? EMPLOYMENT[type.toUpperCase()] || clean(type, 40) : "";
}

const textOf = (doc, selector) => (selector ? doc.querySelector(selector)?.textContent || "" : "");

/**
 * The job on this page for `site` (an entry of RB_SITES), or null when the
 * page doesn't show enough to identify one.
 * Returns { site, jobId, company, role, location, url, description, salary,
 * employmentType, workplaceType } (salary and the types only when the posting
 * says; the app fills gaps from the description).
 */
globalThis.RB_readJob = function readJob(site, doc = document, location = window.location) {
  const url = new URL(location.href);
  const jobId = site.jobId(url);
  if (!jobId) return null;

  const posting = jsonLdPosting(doc);
  const company = clean(posting?.hiringOrganization?.name) || clean(site.company(doc, url));
  const role = clean(posting?.title) || clean(textOf(doc, site.title)) || clean(site.roleFromTitle?.(doc));
  if (!company && !role) return null;

  const description = posting?.description
    ? htmlToText(posting.description)
    : htmlToText(doc.querySelector(site.description || ":not(*)")?.innerHTML || "");

  // The posting's own page, without the /apply, /application or /confirmation step
  const postingUrl = url.origin + url.pathname.replace(/\/(apply|application|thanks|confirmation)\/?$/, "");

  return {
    site: site.id,
    jobId,
    company,
    role,
    location: clean(postingLocation(posting)) || clean(textOf(doc, site.location)),
    url: site.postingUrl ? site.postingUrl(jobId) : url.searchParams.get("token") ? url.href : postingUrl,
    description,
    salary: postingSalary(posting),
    employmentType: postingEmploymentType(posting),
    workplaceType: posting?.jobLocationType === "TELECOMMUTE" ? "remote" : "",
  };
};
