import "server-only";

const DAY = 24 * 60 * 60 * 1000;
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const SEASONS = { winter: 1, spring: 3, summer: 6, fall: 9, autumn: 9 };
const PRESENT = /^(?:present|current|currently|now|today|ongoing)$/i;

function utcDay(year, month, day = 1) {
  if (!(year >= 1900 && year <= 2200 && month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  const time = Date.UTC(year, month - 1, day);
  return new Date(time).getUTCMonth() === month - 1 ? time : null;
}

/**
 * A stored CV date as a UTC day (ms), "present", or null. The CV stores
 * "YYYY-MM-DD" (Postgres dates); older or imported values may be "YYYY-MM",
 * a year, "MM/YYYY", "Jan 2023", "Summer 2023", an ISO timestamp, or
 * "Present". A year alone is read as January 1, a season as its first month.
 */
export function parseCvDate(value) {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (PRESENT.test(text)) return "present";

  let m = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T\s].*)?$/);
  if (m) return utcDay(Number(m[1]), Number(m[2]), Number(m[3] || 1));
  m = text.match(/^(\d{4})$/);
  if (m) return utcDay(Number(m[1]), 1);
  m = text.match(/^(\d{1,2})[/.](\d{4})$/);
  if (m) return utcDay(Number(m[2]), Number(m[1]));
  m = text.match(/^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m) {
    const word = m[1].toLowerCase();
    const month = MONTHS.findIndex((name) => name.startsWith(word === "sept" ? "sep" : word)) + 1;
    if (month) return utcDay(Number(m[2]), month);
    if (SEASONS[word]) return utcDay(Number(m[2]), SEASONS[word]);
  }
  return null;
}

/**
 * Years covered by dated experience entries, overlapping periods merged,
 * in 365-day years rounded down to one decimal. A current role, a "Present" end, or a missing
 * end on the most recent entry runs to `today`; an earlier entry with no end
 * can't be measured and is left out. null when no entry has a start date.
 */
export function experienceYears(experience, today = new Date()) {
  const now = parseCvDate(today instanceof Date ? today : new Date(today));
  const dated = (experience || [])
    .map((entry) => ({ entry, start: parseCvDate(entry?.startDate) }))
    .filter((item) => typeof item.start === "number");
  if (!dated.length || typeof now !== "number") return null;

  const latestStart = Math.max(...dated.map((item) => item.start));
  const periods = [];
  for (const { entry, start } of dated) {
    let end = entry.currentlyWorking ? "present" : parseCvDate(entry.endDate);
    if (end === null && start === latestStart) end = "present";
    if (end === "present") end = now;
    if (typeof end !== "number") continue;
    end = Math.min(end, now);
    if (start >= end) continue;
    periods.push([start, end]);
  }

  periods.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current = null;
  for (const [start, end] of periods) {
    if (current && start <= current[1]) {
      current[1] = Math.max(current[1], end);
    } else {
      if (current) total += current[1] - current[0];
      current = [start, end];
    }
  }
  if (current) total += current[1] - current[0];

  // 365-day years: two calendar years read as 2.0, not 1.9
  return Math.floor((total / DAY / 365) * 10 + 1e-9) / 10;
}
