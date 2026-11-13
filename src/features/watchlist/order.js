// Ordering and paging of watched postings. Pure, so it runs on the server and in tests.

export const PAGE_SIZE = 30;
const BAND_RANK = { strong: 0, good: 1, stretch: 2, low: 3, unknown: 4 };
const NO_FIT_RANK = 5;

/** Share of the required terms the Master CV backs: (demonstrated + 0.5 * listed) / total. 0 when none are required. */
export function coverage(fit) {
  const required = fit?.counts?.required;
  if (!required || !required.total) return 0;
  return ((required.demonstrated || 0) + 0.5 * (required.listed || 0)) / required.total;
}

const seenAt = (posting) => {
  const time = Date.parse(posting.firstSeenAt);
  return Number.isNaN(time) ? 0 : time;
};

const bandRank = (posting) => (posting.fit ? (BAND_RANK[posting.fit.band] ?? BAND_RANK.unknown) : NO_FIT_RANK);

/**
 * "fit": strong, good, stretch, low, unknown, then no fit; within a band by
 * required coverage, then newest first. "newest": first seen, newest first.
 * Returns a new array.
 */
export function sortPostings(postings, sort = "fit") {
  const byNewest = (a, b) => seenAt(b) - seenAt(a);
  if (sort === "newest") return [...postings].sort(byNewest);
  return [...postings].sort(
    (a, b) => bandRank(a) - bandRank(b) || coverage(b.fit) - coverage(a.fit) || byNewest(a, b)
  );
}

/** One page (1-based, clamped) of a list: { items, page, pages, total }. */
export function paginate(list, page, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(Math.max(1, Math.floor(Number(page)) || 1), pages);
  return { items: list.slice((current - 1) * size, current * size), page: current, pages, total: list.length };
}

/** True when a company was never checked, or last checked more than `hours` ago. */
export function isStale(lastCheckedAt, now = Date.now(), hours = 12) {
  if (!lastCheckedAt) return true;
  const time = Date.parse(lastCheckedAt);
  return Number.isNaN(time) || now - time > hours * 3_600_000;
}
