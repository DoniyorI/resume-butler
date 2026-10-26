import "server-only";
import { HttpError } from "@/server/http";

// Counts this request against the caller's per-user limit for `key`. The limits
// themselves live in the consume_rate_limit database function
// (supabase/migrations/004_security_hardening.sql, 006_rewrite_bullet_limit.sql)
// so callers can't change them. Keys: generate-resume, generate-cover-letter,
// suggest-bullets, rewrite-bullet, parse-resume, scan-emails, download-resume.
export async function enforceRateLimit(supabase, key) {
  const { data: allowed, error } = await supabase.rpc("consume_rate_limit", { p_key: key });

  if (error) {
    // Fail open so the app keeps working if the migration hasn't been applied yet
    console.warn(`Rate limit check skipped for ${key}:`, error.message);
    return;
  }
  if (allowed === false) {
    throw new HttpError(429, "Too many requests. Please wait a while and try again.");
  }
}
