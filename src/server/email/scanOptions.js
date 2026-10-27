import "server-only";
import { z } from "zod";
import { DEFAULT_SCAN_CATEGORIES, EMAIL_CATEGORIES } from "@/lib/emailCategories";
import { HttpError } from "@/server/http";

const SCAN_CATEGORIES = EMAIL_CATEGORIES.map((c) => c.id);

const DEFAULT_DAYS = 14;
const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const scanOptionsSchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    categories: z.array(z.enum(SCAN_CATEGORIES)).min(1, "Pick at least one email type").optional(),
  })
  .default({});

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Turn validated options into the IMAP search window [since, before) and the
 * categories to suggest. Defaults: the last 14 days, everything but outreach.
 */
export function resolveScanOptions({ from, to, categories } = {}) {
  const today = startOfUtcDay(new Date());
  const end = to ? new Date(`${to}T00:00:00Z`) : today;
  const start = from ? new Date(`${from}T00:00:00Z`) : new Date(end.getTime() - (DEFAULT_DAYS - 1) * DAY_MS);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new HttpError(400, "Invalid date");
  if (start > end) throw new HttpError(400, "The start date must be before the end date");
  if (start > today) throw new HttpError(400, "The start date can't be in the future");
  if ((end - start) / DAY_MS + 1 > MAX_DAYS) throw new HttpError(400, "Scan at most one year at a time");

  return {
    since: start,
    // IMAP BEFORE / Gmail before: are exclusive, so add a day to include `to`
    before: new Date(Math.min(end.getTime(), today.getTime()) + DAY_MS),
    categories: new Set(categories?.length ? categories : DEFAULT_SCAN_CATEGORIES),
  };
}
