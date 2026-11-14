import "server-only";
import { HttpError } from "@/server/http";

// Counts this request against the caller's per-user limit for `key`. The limits
// and the keys they accept live in the consume_rate_limit database function so
// callers can't change them; the latest migration that defines it is
// supabase/migrations/022_*.sql.
export async function enforceRateLimit(supabase, key) {
  let result;
  try { result = await supabase.rpc("consume_rate_limit", { p_key: key }); }
  catch (error) { result = { error }; }
  if (result.error || typeof result.data !== "boolean") {
    console.warn("rate_limit_unavailable", { key, code: result.error?.code || "transport_or_invalid_result" });
    // PDF checks remain available during quota-service outages. AI and email
    // classification require an explicit quota grant before spending credit.
    if (key === "download-resume") return;
    if (result.error?.code === "P0001" && String(result.error.message || "").includes("Unknown rate limit key")) {
      throw new HttpError(503, "This feature needs the latest database migration. See supabase/migrations.");
    }
    throw new HttpError(503, "Usage checks are temporarily unavailable. Please try again shortly.");
  }
  if (!result.data) throw new HttpError(429, "Too many requests. Please wait a while and try again.");
}
