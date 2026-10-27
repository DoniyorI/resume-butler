"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirects";
import { parseInput, runAction } from "@/server/actionResult";
import { HttpError } from "@/server/http";

// Sign-in, sign-up, password reset and sign-out run on the server, so the
// Supabase client never ships to the browser. The server client writes the
// session (and the OAuth code verifier) to cookies.

const email = z.string().trim().email("Please enter a valid email address.").max(320);
const credentials = z.object({ email, password: z.string().min(1, "Enter your password.").max(200) });

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
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) throw authError(error, "Couldn't sign you in. Please try again.");
    return { next: safeNextPath(input?.next) };
  });
}

// Returns { confirmEmail }: true when the account waits for the emailed link
export async function signUp(input) {
  return runAction("Sign up", async () => {
    const { email, password } = parseInput(credentials, input);
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

export async function sendPasswordReset(input) {
  return runAction("Password reset", async () => {
    const { email: address } = parseInput(z.object({ email }), input);
    const { error } = await createClient().auth.resetPasswordForEmail(address);
    if (error) throw authError(error, "Couldn't send the reset link. Please try again.");
    return null;
  });
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
