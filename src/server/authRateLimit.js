import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { HttpError } from "@/server/http";
import { createAdminClient } from "@/server/supabaseAdmin";

// Attempts allowed per visitor IP and per email address, for the signed-out
// auth actions (supabase/migrations/009_auth_rate_limits.sql). Sign-in allows
// a few typos; sign-up and password reset send email, so they're tighter.
const LIMITS = {
  "sign-in": { ip: [20, 15 * 60], email: [10, 15 * 60] },
  "sign-up": { ip: [5, 60 * 60], email: [3, 60 * 60] },
  "password-reset": { ip: [5, 60 * 60], email: [3, 60 * 60] },
};

// The visitor's IP. On Vercel the first X-Forwarded-For entry is set by the
// platform, not the client; locally there is none.
function clientIp() {
  return headers().get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

const bucket = (kind, scope, value) =>
  createHash("sha256").update(`${kind}:${scope}:${value.toLowerCase()}`).digest("hex");

/**
 * Count an attempt at `kind` ("sign-in", "sign-up", "password-reset") for this
 * visitor's IP and `email`, throwing a 429 HttpError past the limit. Fails open
 * (logs, allows) if the migration isn't applied or the service role key is
 * missing, so sign-in never breaks because of the limiter itself.
 */
export async function enforceAuthRateLimit(kind, email) {
  const limits = LIMITS[kind];
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.warn(`Auth rate limit skipped for ${kind}:`, error.message);
    return;
  }

  const checks = [
    ["ip", clientIp(), limits.ip],
    ["email", email, limits.email],
  ];
  const results = await Promise.all(
    checks.map(([scope, value, [limit, windowSeconds]]) =>
      admin.rpc("consume_auth_rate_limit", {
        p_bucket: bucket(kind, scope, value),
        p_limit: limit,
        p_window_seconds: windowSeconds,
      })
    )
  );

  const failed = results.find((result) => result.error);
  if (failed) {
    console.warn(`Auth rate limit skipped for ${kind}:`, failed.error.message);
    return;
  }
  if (results.some((result) => result.data === false)) {
    throw new HttpError(429, "Too many attempts. Please wait a few minutes and try again.");
  }
}
