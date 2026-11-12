import "server-only";

const ELLIPSIS = "…";

/**
 * `text` trimmed to at most `cap` characters around [start, end), cut at word
 * boundaries where it can be, with an ellipsis where text was cut. Apart from
 * the ellipses the result is always a substring of `text`: nothing is
 * rephrased.
 */
export function clipAround(text, start, end, cap) {
  const source = String(text || "");
  const lead = source.length - source.trimStart().length;
  const body = source.trim();
  if (body.length <= cap) return body;

  const room = cap - 2; // both ellipses
  const matchStart = Math.max(0, Math.min(body.length, start - lead));
  const matchEnd = Math.max(matchStart, Math.min(body.length, end - lead));
  let from = Math.max(0, matchStart - Math.floor((room - (matchEnd - matchStart)) / 2));
  let to = Math.min(body.length, from + room);
  from = Math.max(0, to - room);

  // Prefer whole words when the cut lands mid-word and a space is near
  if (from > 0) {
    const space = body.indexOf(" ", from);
    if (space !== -1 && space - from <= 15 && space < matchStart) from = space + 1;
  }
  if (to < body.length) {
    const space = body.lastIndexOf(" ", to);
    if (space !== -1 && to - space <= 15 && space > matchEnd) to = space;
  }

  const slice = body.slice(from, to).trim();
  return `${from > 0 ? ELLIPSIS : ""}${slice}${to < body.length ? ELLIPSIS : ""}`;
}

// Where `spellings` first occur in `text` (case-insensitive), or [0, 0]
export function locate(text, spellings) {
  const lower = String(text || "").toLowerCase();
  let best = null;
  for (const spelling of spellings) {
    const at = lower.indexOf(String(spelling).toLowerCase());
    if (at !== -1 && (!best || at < best[0])) best = [at, at + spelling.length];
  }
  return best || [0, 0];
}
