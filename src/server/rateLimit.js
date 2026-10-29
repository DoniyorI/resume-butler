import "server-only";
import { HttpError } from "@/server/http";

// Counts this request against the caller's per-user limit for `key`. The limits
// themselves live in the consume_rate_limit database function
// (supabase/migrations/004_security_hardening.sql, 006_rewrite_bullet_limit.sql)
// so callers can't change them. Keys: generate-resume, generate-cover-letter,
// suggest-bullets, rewrite-bullet, parse-resume, scan-emails, download-resume.
export async function enforceRateLimit(supabase, key) {
  let result;
  try { result = await supabase.rpc("consume_rate_limit", { p_key: key }); }
  catch (error) { result = { error }; }
  if (result.error || typeof result.data !== "boolean") {
    console.warn("rate_limit_unavailable", { key, code: result.error?.code || "transport_or_invalid_result" });
    // PDF checks remain available during quota-service outages. AI and email
    // classification require an explicit quota grant before spending credit.
    if (key === "download-resume") return;
    throw new HttpError(503, "Usage checks are temporarily unavailable. Please try again shortly.");
  }
  if (!result.data) throw new HttpError(429, "Too many requests. Please wait a while and try again.");
}
