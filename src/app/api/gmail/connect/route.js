import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { STATE_COOKIE, STATE_MAX_AGE, startGmailConnect } from "@/server/email/gmailConnect";

export const dynamic = "force-dynamic";

// GET - send the signed-in user to Google's consent page for read-only Gmail access
export async function GET(request) {
  const { origin } = new URL(request.url);
  let session;
  try {
    session = await getCurrentUser();
  } catch {
    // Sign-in verification is down; nothing was stored
    return NextResponse.redirect(`${origin}/email-sync?gmail=failed`);
  }
  const { user } = session;
  if (!user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent("/email-sync")}`);

  const start = startGmailConnect(user.id, origin);
  if (!start.url) return NextResponse.redirect(`${origin}/email-sync?gmail=${start.outcome}`);

  const response = NextResponse.redirect(start.url);
  response.cookies.set(STATE_COOKIE, start.cookie, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: STATE_MAX_AGE,
  });
  return response;
}
