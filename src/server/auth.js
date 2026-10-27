import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HttpError } from "@/server/http";

// For Server Components: the Supabase client and verified user (or null).
// Cached per request, so layouts, pages and generateMetadata share one
// getUser() round-trip.
export const getCurrentUser = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

// For Server Components: returns the Supabase client and user, or sends the
// visitor to /login. (app)/layout.js already guards these pages; this keeps
// each page self-contained.
export async function requirePageUser() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// For Route Handlers and Server Actions: returns the Supabase client and verified user,
// or throws a 401 HttpError.
// getUser() validates the session with Supabase, unlike getSession().
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new HttpError(401, "Unauthorized");
  return { supabase, user };
}

// How long after following a password reset link the new password can be set
const RECOVERY_WINDOW_SECONDS = 15 * 60;

/**
 * True when this session came from a password reset (or other one-time) email
 * link in the last few minutes. Only such a session may set a new password
 * without the current one, so an unattended signed-in browser can't be used
 * to take over the account.
 */
export async function hasRecentRecovery(supabase) {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return false;
  const now = Math.floor(Date.now() / 1000);
  // Supabase sends amr as [{ method, timestamp }]. Only an entry's own
  // timestamp says when that sign-in happened (iat changes on every refresh),
  // so the bare RFC 8176 string form never counts.
  return (claims.amr || []).some(
    (entry) =>
      typeof entry === "object" &&
      ["recovery", "otp"].includes(entry?.method) &&
      now - Number(entry.timestamp) <= RECOVERY_WINDOW_SECONDS
  );
}
