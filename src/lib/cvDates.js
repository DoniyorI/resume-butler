// CV fields have month precision in the UI, but Postgres stores full dates.
export function isCalendarDate(value) {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeCvDate(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (isCalendarDate(text)) return text;
  if (/^[1-9]\d{3}-\d{2}$/.test(text) && isCalendarDate(`${text}-01`)) return `${text}-01`;
  // Year-only, absent, Present and invalid dates have no known month.
  return null;
}
