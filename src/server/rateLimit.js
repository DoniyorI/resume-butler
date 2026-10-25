import "server-only";
import { HttpError } from "@/server/http";

// Per-user limits for expensive routes (requests per window)
export const RATE_LIMITS = {
  "generate-resume": { limit: 20, windowSeconds: 3600 },
  "generate-cover-letter": { limit: 20, windowSeconds: 3600 },
  "suggest-bullets": { limit: 30, windowSeconds: 3600 },
  "parse-resume": { limit: 10, windowSeconds: 3600 },
  "scan-emails": { limit: 10, windowSeconds: 3600 },
  "download-resume": { limit: 60, windowSeconds: 3600 },
};

// Counts this request against the caller's limit using the consume_rate_limit
// database function (supabase/migrations/004_security_hardening.sql)
export async function enforceRateLimit(supabase, key) {
  const { limit, windowSeconds } = RATE_LIMITS[key];
  const { data: allowed, error } = await supabase.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Fail open so the app keeps working if the migration hasn't been applied yet
    console.warn(`Rate limit check skipped for ${key}:`, error.message);
    return;
  }
  if (allowed === false) {
    throw new HttpError(429, "Too many requests. Please wait a while and try again.");
  }
}
