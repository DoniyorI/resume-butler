// Parse a stored date. Date-only strings ("2023-01-01", "2023-01") are read as
// local dates: new Date("2023-01-01") is UTC midnight, which shows as December
// 2022 in US time zones.
export function parseDate(value) {
  if (!value) return null;
  const text = String(value).split(" at ")[0].trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3] || 1))
    : new Date(text);
  return isNaN(date.getTime()) ? null : date;
}

// "January 2023" (or "Jan 2023" with month: "short"). Unparseable values are
// returned as typed, so free text like "Summer 2023" still shows.
export function formatMonthYear(value, { month = "long" } = {}) {
  if (!value) return "";
  const date = parseDate(value);
  return date ? date.toLocaleDateString("en-US", { month, year: "numeric" }) : String(value);
}

// "Oct 26, 2026" for a stored date or a Date; "" when there's no valid date
export function formatShortDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}
