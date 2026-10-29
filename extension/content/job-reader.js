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
  doc.querySelectorAll("script, style, button, [hidden], [aria-hidden=\"true\"]").forEach((el) => el.remove());
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p, li, h1, h2, h3, h4, div").forEach((el) => el.append("\n"));
  return (doc.body.textContent || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

function jsonLdPosting(doc, site, url) {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : data["@graph"] || [data];
      for (const posting of items.filter(item => item && [].concat(item["@type"] || []).includes("JobPosting"))) {
        if (posting.url && site && url) {
          try {
            const target = new URL(posting.url, url);
            if (target.origin !== url.origin || site.jobId(target) !== site.jobId(url)) continue;
          } catch { continue; }
        }
        return posting;
      }
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

function readableElement(el) {
  if (!el || el.closest('[hidden], [aria-hidden="true"]')) return false;
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  for (let node = el; node; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

// LinkedIn's server-driven layout uses generated classes. Its metadata links
// still identify the posting, and its description has a semantic heading.
function linkedInDetails(doc, url, site, jobId) {
  const sameJob = anchor => {
    try {
      const target = new URL(anchor.getAttribute("href"), url);
      return target.origin === url.origin && site.jobId(target) === jobId;
    } catch { return false; }
  };
  const about = [...doc.querySelectorAll("h2, h3")].filter(el => readableElement(el) && /^about the job$/i.test(clean(el.textContent)));
  let detailRoot = doc;
  const generatedDescription = about.some(heading => {
    let root = heading.parentElement;
    for (let depth = 0; root && depth < 3; depth++, root = root.parentElement) {
      if (root.querySelector('[data-testid="expandable-text-box"]')) return true;
    }
    return false;
  });
  if (about.length && generatedDescription) {
    if (about.length !== 1) return { stale: true };
    let root = about[0].parentElement, bound = false;
    // Use the nearest panel with identifiable metadata. A SPA may update the
    // URL/title before its detail panel; do not cache the old panel under B.
    for (let depth = 0; root && root !== doc.body && depth < 6; depth++, root = root.parentElement) {
      const metadata = [...root.querySelectorAll("a[href]")].filter(a =>
        readableElement(a) && !a.closest("aside, nav, [role=listitem]") &&
        (salaryChip(clean(a.textContent)) || /^(remote|hybrid|on[ -]?site|full[ -]?time|part[ -]?time|contract|temporary|internship|volunteer|per diem)$/i.test(clean(a.textContent)))
      );
      if (!metadata.length) continue;
      if (!metadata.every(sameJob)) return { stale: true };
      detailRoot = root; bound = true; break;
    }
    if (!bound) return { stale: true };
  }
  const links = [...detailRoot.querySelectorAll("a[href]")].filter(a => readableElement(a) && sameJob(a));
  const labels = [...new Set(links.map(a => clean(a.textContent)).filter(Boolean))];
  const workplace = labels.find(label => /^(remote|hybrid|on[ -]?site)$/i.test(label)) || "";
  const employment = labels.find(label => /^(full[ -]?time|part[ -]?time|contract|temporary|internship|volunteer|per diem)$/i.test(label)) || "";
  const salaries = labels.map(salaryChip).filter(Boolean);
  const distinctPay = [...new Map(salaries.map(pay => [JSON.stringify(pay), pay])).values()];
  let description = "";
  const descriptions = [];
  for (const heading of doc.querySelectorAll("h2, h3")) {
    if (!readableElement(heading) || !/^about the job$/i.test(clean(heading.textContent))) continue;
    let root = heading.parentElement;
    for (let depth = 0; root && depth < 3; depth++, root = root.parentElement) {
      const boxes = [...root.querySelectorAll('[data-testid="expandable-text-box"]')].filter(readableElement);
      if (boxes.length === 1) { descriptions.push(htmlToText(boxes[0].innerHTML)); break; }
      if (boxes.length > 1) break;
    }
  }
  if (descriptions.length === 1) description = descriptions[0];
  const heading = [...doc.querySelectorAll("h1, h2")].find(el =>
    readableElement(el) && [...el.querySelectorAll("a[href]")].some(sameJob)
  ) || (url.pathname.startsWith("/jobs/view/") ? doc.querySelector("main h1") : null);
  let company = "";
  if (heading) {
    let root = heading.parentElement;
    for (let depth = 0; root && depth < 3; depth++, root = root.parentElement) {
      const names = [...new Set([...root.querySelectorAll('a[href*="/company/"]')]
        .filter(readableElement).map(el => clean(el.textContent)).filter(Boolean))];
      if (names.length === 1) { company = names[0]; break; }
      if (names.length > 1) break;
    }
  }
  return {
    role: heading ? clean(heading.textContent) : "", company, description,
    salary: distinctPay.length === 1 ? distinctPay[0] : null,
    location: workplace,
    workplaceType: workplace ? (/^on/i.test(workplace) ? "onsite" : workplace.toLowerCase()) : "",
    employmentType: employment,
  };
}

// Only whole, short metadata labels with an explicit currency and pay period
// qualify. Never interpret arbitrary job-list text or guess hourly/yearly.
function salaryChip(label) {
  const pattern = /^(USD|CAD|AUD|EUR|GBP|US\$|CA\$|AU\$|[$€£])\s*([\d,]+(?:\.\d+)?)\s*([kK])?\s*\/\s*(yr|year|hr|hour|mo|month|wk|week|day)(?:\s*[-–—]\s*(USD|CAD|AUD|EUR|GBP|US\$|CA\$|AU\$|[$€£])?\s*([\d,]+(?:\.\d+)?)\s*([kK])?\s*\/\s*(yr|year|hr|hour|mo|month|wk|week|day))?$/i;
  const match = label.match(pattern);
  if (!match) return null;
  const currencies = { USD: "USD", CAD: "CAD", AUD: "AUD", EUR: "EUR", GBP: "GBP", "US$": "USD", "CA$": "CAD", "AU$": "AUD", $: "USD", "€": "EUR", "£": "GBP" };
  const periods = { yr: "year", year: "year", hr: "hour", hour: "hour", mo: "month", month: "month", wk: "week", week: "week", day: "day" };
  const currency = currencies[match[1].toUpperCase()];
  const period = periods[match[4].toLowerCase()];
  if (match[5] && currencies[match[5].toUpperCase()] !== currency) return null;
  if (match[8] && periods[match[8].toLowerCase()] !== period) return null;
  const amount = (n, k) => Math.round(Number(n.replaceAll(",", "")) * (k ? 1000 : 1));
  const min = amount(match[2], match[3]), max = match[6] ? amount(match[6], match[7]) : min;
  return min > 0 && max >= min && max <= 10000000 ? { min, max, currency, period } : null;
}

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

  const details = site.id === "linkedin" ? linkedInDetails(doc, url, site, jobId) : {};
  if (details.stale) return null;
  const posting = jsonLdPosting(doc, site, url);
  const company = clean(posting?.hiringOrganization?.name) || details.company || clean(site.company(doc, url));
  const role = clean(posting?.title) || details.role || clean(textOf(doc, site.title)) || clean(site.roleFromTitle?.(doc));
  if (!company && !role) return null;

  const description = posting?.description
    ? htmlToText(posting.description)
    : details.description || htmlToText(doc.querySelector(site.description || ":not(*)")?.innerHTML || "");

  // The posting's own page, without the /apply, /application or /confirmation step
  const postingUrl = url.origin + url.pathname.replace(/\/(apply|application|thanks|confirmation)\/?$/, "");

  return {
    site: site.id,
    jobId,
    company,
    role,
    location: clean(postingLocation(posting)) || clean(textOf(doc, site.location)) || details.location || "",
    url: site.postingUrl ? site.postingUrl(jobId) : url.searchParams.get("token") ? url.href : postingUrl,
    description,
    salary: details.salary || postingSalary(posting),
    employmentType: details.employmentType || postingEmploymentType(posting),
    workplaceType: details.workplaceType || (posting?.jobLocationType === "TELECOMMUTE" ? "remote" : ""),
  };
};
