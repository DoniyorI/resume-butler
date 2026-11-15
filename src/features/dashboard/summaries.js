export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

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

export function activitySummary(series, today) {
  return `${plural(countRecent(series, today), "application")} in the last 30 days`;
}

// The "Pipeline and timing" line: the median wait for a first reply, or why there is none yet
export function timingSummary(medianResponseDays) {
  if (medianResponseDays === null || medianResponseDays === undefined) return "No replies yet";
  return `Median ${plural(medianResponseDays, "day")} to first reply`;
}
