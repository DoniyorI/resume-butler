import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  GMAIL_SCOPE,
  exchangeGmailCode,
  gmailAuthUrl,
  gmailProfileEmail,
  isGmailConfigured,
  revokeGmailToken,
} from "@/server/email/gmailClient";
import { saveGmailConnection } from "@/server/email/connection";
import { HttpError } from "@/server/http";

// The OAuth round trip for "Connect with Google". The state is random, kept in an httpOnly cookie
// scoped to /api/gmail and bound to the signed-in user, so a callback started by someone else (or
// for another account in the same browser) is refused.
export const STATE_COOKIE = "rb_gmail_state";
export const STATE_MAX_AGE = 600;
export const CALLBACK_PATH = "/api/gmail/callback";

// Where each outcome lands: /email-sync?gmail=<outcome>
export const OUTCOMES = ["connected", "denied", "scope", "expired", "unavailable", "setup", "failed"];

export const callbackUrl = (origin) => `${origin}${CALLBACK_PATH}`;

export function startGmailConnect(userId, origin) {
  if (!isGmailConfigured()) return { outcome: "unavailable" };
  const nonce = randomBytes(32).toString("base64url");
  return {
    url: gmailAuthUrl({ state: nonce, redirectUri: callbackUrl(origin) }),
    cookie: `${nonce}.${userId}`,
  };
}

function sameText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Finish the round trip: check the state, exchange the code, confirm read-only Gmail was granted,
 * read the mailbox address and store the connection. Returns one of OUTCOMES; never throws for an
 * expected failure. A token is revoked whenever it ends up not stored.
 */
export async function finishGmailConnect(supabase, userId, { origin, params, cookie }, { fetchImpl = fetch } = {}) {
  if (!isGmailConfigured()) return "unavailable";
  const state = params.get("state");
  const [nonce, cookieUser] = String(cookie || "").split(".");
  if (!state || !nonce || cookieUser !== userId || !sameText(state, nonce)) return "expired";
  if (params.get("error")) return "denied";
  const code = params.get("code");
  if (!code) return "failed";

  let tokens;
  try {
    tokens = await exchangeGmailCode(code, callbackUrl(origin), { fetchImpl });
  } catch (error) {
    console.error("Gmail code exchange failed", { status: error?.status || "unknown" });
    return "failed";
  }
  const token = tokens.refreshToken;
  // Google's consent page lets the user untick the Gmail permission
  if (!tokens.scopes.includes(GMAIL_SCOPE) || !token || !tokens.accessToken) {
    await revokeGmailToken(token || tokens.accessToken, { fetchImpl });
    return tokens.scopes.includes(GMAIL_SCOPE) ? "failed" : "scope";
  }

  try {
    const emailAddress = await gmailProfileEmail(tokens.accessToken, { fetchImpl });
    await saveGmailConnection(supabase, userId, { emailAddress, refreshToken: token });
    return "connected";
  } catch (error) {
    await revokeGmailToken(token, { fetchImpl });
    if (error instanceof HttpError && error.status === 503) return "setup";
    console.error("Saving the Gmail connection failed", { status: error?.status || error?.code || "unknown" });
    return "failed";
  }
}
