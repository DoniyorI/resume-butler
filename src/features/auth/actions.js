"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { safeNextPath } from "@/lib/redirects";
import { parseInput, runAction } from "@/server/actionResult";
import { enforceAuthRateLimit } from "@/server/authRateLimit";
import { HttpError } from "@/server/http";

// Sign-in, sign-up, password reset and sign-out run on the server, so the
// Supabase client never ships to the browser. The server client writes the
// session (and the OAuth code verifier) to cookies. Supabase now sees the
// server's IP for everyone, so attempts are rate limited here per visitor IP
// and email (enforceAuthRateLimit).

const email = z.string().trim().email("Please enter a valid email address.").max(320);
const credentials = z.object({ email, password: z.string().min(1, "Enter your password.").max(200) });
// New passwords: long enough (NIST SP 800-63B), long passphrases welcome.
// Supabase also applies the project's own password rules.
const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(200, "Use at most 200 characters.");

// This site's origin, for the links Supabase emails and redirects back to.
// Next.js only runs a Server Action when its Origin header matches the host.
function siteOrigin() {
  const requestHeaders = headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;
  const proto = requestHeaders.get("x-forwarded-proto") || "https";
  return `${proto}://${requestHeaders.get("host")}`;
}

// Supabase auth errors are written for end users (e.g. "Invalid login
// credentials", "Password should be at least 6 characters"), so pass them on
function authError(error, fallback) {
  if (error?.status === 429) {
    return new HttpError(429, "Too many attempts right now. Please wait a few minutes and try again.");
  }
  if (error?.message?.includes("already registered")) {
    return new HttpError(400, "This email is already in use by another account.");
  }
  if (error?.name === "AuthRetryableFetchError") {
    return new HttpError(503, "Couldn't reach the server. Check your connection and try again.");
  }
  return new HttpError(error?.status || 400, error?.message || fallback);
}

// Returns { next }: where to go now (the ?next= page, or the dashboard)
export async function signIn(input) {
  return runAction("Sign in", async () => {
    const { email, password } = parseInput(credentials, input);
    await enforceAuthRateLimit("sign-in", email);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) throw authError(error, "Couldn't sign you in. Please try again.");
    return { next: safeNextPath(input?.next) };
  });
}

// Returns { confirmEmail }: true when the account waits for the emailed link
export async function signUp(input) {
  return runAction("Sign up", async () => {
    const { email, password } = parseInput(credentials.extend({ password: newPassword }), input);
    await enforceAuthRateLimit("sign-up", email);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${siteOrigin()}/auth/callback?next=/profile` },
    });
    if (error) throw authError(error, "Failed to create account. Please try again later.");
    // The profile row is created by a database trigger
    return { confirmEmail: !data.session };
  });
}

// The emailed link goes through /auth/callback, which signs the user in with
// the one-time code, then to /reset-password to choose a new password. The
// code only works in the browser that asked for it (PKCE).
export async function sendPasswordReset(input) {
  return runAction("Password reset", async () => {
    const { email: address } = parseInput(z.object({ email }), input);
    await enforceAuthRateLimit("password-reset", address);
    const { error } = await createClient().auth.resetPasswordForEmail(address, {
      redirectTo: `${siteOrigin()}/auth/callback?next=/reset-password`,
    });
    // Supabase answers the same whether or not the account exists, so this
    // doesn't reveal who has one; only rate limits and outages fail here
    if (error) throw authError(error, "Couldn't send the reset link. Please try again.");
    return null;
  });
}

// From /reset-password, signed in by the emailed link
export async function updatePassword(input) {
  const result = await runAction("Update password", async () => {
    const { password } = parseInput(z.object({ password: newPassword }), input);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new HttpError(401, "This reset link has expired. Request a new one.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw authError(error, "Couldn't update your password. Please try again.");
    return null;
  });
  if (!result.ok) return result;
  redirect("/");
}

// Returns { url }: Google's sign-in page. The callback route exchanges the
// code for a session, then goes to `next`.
export async function startGoogleSignIn(input) {
  return runAction("Google sign in", async () => {
    const next = safeNextPath(input?.next);
    const { data, error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) throw authError(error, "Couldn't start Google sign-in. Please try again.");
    return { url: data.url };
  });
}

export async function signOut() {
  const { error } = await createClient().auth.signOut();
  if (error) console.error("Sign out:", error.message);
  redirect("/login");
}
