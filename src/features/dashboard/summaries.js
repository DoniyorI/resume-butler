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

// A median of fewer replies than this says more about one application than about the search
export const MIN_TIMING_SAMPLES = 5;

// The "Pipeline and timing" line: the median wait for a first reply, or why there is none yet
export function timingSummary(medianResponseDays, samples) {
  if (medianResponseDays === null || medianResponseDays === undefined) return "No replies yet";
  if (!(samples >= MIN_TIMING_SAMPLES)) return "Too few replies for a typical wait";
  return `Median ${plural(medianResponseDays, "day")} to first reply`;
}

// The same, in full, for the Insights page
export function timingLine(medianResponseDays, samples) {
  if (medianResponseDays === null || medianResponseDays === undefined)
    return "No replies with a recorded date yet, so no median time to first reply.";
  if (!(samples >= MIN_TIMING_SAMPLES))
    return `${plural(samples || 0, "reply").replace("replys", "replies")} with a recorded date so far: too few to give a typical time from Applied to first reply.`;
  return `Median ${medianResponseDays} days from Applied to first reply, from ${samples} replies.`;
}
