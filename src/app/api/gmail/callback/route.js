import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { STATE_COOKIE, finishGmailConnect } from "@/server/email/gmailConnect";

export const dynamic = "force-dynamic";

// GET - Google returns here with ?code and ?state (or ?error). The outcome goes back to Inbox.
export async function GET(request) {
  const url = new URL(request.url);
  let session;
  try {
    session = await getCurrentUser();
  } catch {
    // Sign-in verification is down; nothing was stored
    return NextResponse.redirect(`${url.origin}/email-sync?gmail=failed`);
  }
  const { supabase, user } = session;
  if (!user) return NextResponse.redirect(`${url.origin}/login?next=${encodeURIComponent("/email-sync")}`);

  const outcome = await finishGmailConnect(supabase, user.id, {
    origin: url.origin,
    params: url.searchParams,
    cookie: request.cookies.get(STATE_COOKIE)?.value,
  });
  const response = NextResponse.redirect(`${url.origin}/email-sync?gmail=${outcome}`);
  response.cookies.set(STATE_COOKIE, "", { path: "/api/gmail", maxAge: 0 });
  return response;
}
