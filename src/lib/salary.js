// Pay ranges: read from posting text ("$120,000 - $150,000", "$120K–$150K/yr",
// "$45/hr", "USD 90k to 110k", "£50,000 – £60,000 a year") and formatted for
// display. Safe on client and server.

export const SALARY_PERIODS = ["hour", "day", "week", "month", "year"];

const SYMBOLS = { $: "USD", "£": "GBP", "€": "EUR" };
const CODES = ["USD", "CAD", "AUD", "GBP", "EUR", "INR", "SGD", "NZD", "CHF"];

const PERIOD_WORDS = [
  ["hour", /^\s*(?:\/\s*h(?:ou)?r|per\s+hour|an?\s+hour|hourly|\/\s*hour)/i],
  ["day", /^\s*(?:\/\s*day|per\s+day|a\s+day|daily)/i],
  ["week", /^\s*(?:\/\s*w(?:ee)?k|per\s+week|a\s+week|weekly)/i],
  ["month", /^\s*(?:\/\s*mo(?:nth)?|per\s+month|a\s+month|monthly)/i],
  ["year", /^\s*(?:\/\s*y(?:ea)?r|per\s+(?:year|annum)|a\s+year|annually|annual|yearly|p\.?a\.?\b)/i],
];

// "$" + amount, or "USD " + amount, with "k" for thousands
// Not funding or market sizes: "$40M", "$2 billion"
const NOT_MILLIONS = String.raw`(?!\d|\s?(?:[mMbB]\b|million|billion))`;
const AMOUNT = String.raw`(?:(?<cur>[$£€])|\b(?<code>${CODES.join("|")})\s?)\s?(?<n>\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s?(?<k>[kK])?${NOT_MILLIONS}`;
const RANGE = new RegExp(
  String.raw`${AMOUNT}(?:\s*(?:\/\s*(?:yr|year|hr|hour))?\s*(?:-|–|—|to)\s*(?:[$£€]|(?:${CODES.join("|")})\s?)?\s?(?<n2>\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s?(?<k2>[kK])?${NOT_MILLIONS})?`,
  "g"
);

function toNumber(digits, thousands) {
  const value = Number(digits.replace(/[,](?=\d{3})/g, "").replace(/\.(?=\d{3}\b)/g, ""));
  return Number.isFinite(value) ? Math.round(value * (thousands ? 1000 : 1)) : null;
}

// Pay that's plausible for its period, so "$5" off-hand or "$1,000,000 raised" don't count
function plausible(amount, period) {
  if (period === "hour") return amount >= 5 && amount <= 1000;
  if (period === "year") return amount >= 10_000 && amount <= 2_000_000;
  return amount >= 50 && amount <= 500_000;
}

/**
 * The first pay range in `text`, as { min, max, currency, period }, or null.
 * The period comes from words after the amount ("/hr", "per year"); without
 * one, only a yearly-sized amount counts.
 */
export function parseSalaryText(text) {
  if (typeof text !== "string" || !text) return null;
  const sample = text.slice(0, 20_000);
  for (const match of sample.matchAll(RANGE)) {
    const { cur, code, n, k, n2, k2 } = match.groups;
    // A trailing "k" also covers a short first number ("$120-150K"), not a
    // full one ("$80,000-150K")
    let min = toNumber(n, Boolean(k || (k2 && Number(n) < 1000)));
    let max = n2 ? toNumber(n2, Boolean(k2 || (k && Number(n2) < 1000))) : min;
    if (min == null || max == null) continue;
    if (min > max) [min, max] = [max, min];

    const after = sample.slice(match.index + match[0].length, match.index + match[0].length + 20);
    const stated =
      PERIOD_WORDS.find(([, pattern]) => pattern.test(after))?.[0] ||
      PERIOD_WORDS.find(([, pattern]) => pattern.test(match[0].replace(/^[^/]*?(?=\/)/, "")))?.[0];
    // Without a stated period only a yearly-sized amount counts; "$40" alone is too vague
    const period = stated || "year";
    if (!plausible(min, period) || !plausible(max, period)) continue;

    return { min, max, currency: code || SYMBOLS[cur] || "USD", period };
  }
  return null;
}

const PERIOD_LABELS = { hour: "/hr", day: "/day", week: "/wk", month: "/mo", year: "/yr" };

// "$120K – $150K /yr", "$45 – $55 /hr", "$95K /yr"
export function formatSalary({ min, max, currency = "USD", period = "year" } = {}) {
  if (min == null && max == null) return "";
  const format = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: value >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: value >= 10_000 ? 1 : 0,
    }).format(value);
  const low = min ?? max;
  const high = max ?? min;
  const range = low === high ? format(low) : `${format(low)} – ${format(high)}`;
  return `${range} ${PERIOD_LABELS[period] || ""}`.trim();
}
