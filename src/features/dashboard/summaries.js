const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// "2026-11-14" minus `days`, as a calendar date key (no time zone involved)
function minusDays(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

// Applications made in the last `days` days, today included, from daily.series
export function countRecent(series, today, days = 30) {
  const first = minusDays(today, days - 1);
  return series.reduce((sum, point) => (point.date >= first && point.date <= today ? sum + point.count : sum), 0);
}

export function recentSummary(total, shown) {
  if (total === 0) return "No applications yet";
  return shown >= total ? plural(total, "application") : `Last ${shown} applications`;
}

export function activitySummary(series, today) {
  return `${plural(countRecent(series, today), "application")} in the last 30 days`;
}

export function flowSummary(total) {
  return total === 0
    ? "How your applications move from Applied to now"
    : `How your ${plural(total, "application")} moved from Applied to now`;
}

export const REPORT_SUMMARY = "Outcomes by source, job site, resume, month and workplace";
