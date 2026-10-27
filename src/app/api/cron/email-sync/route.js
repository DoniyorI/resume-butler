import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAutoSync } from "@/server/email/autoSync";
import { errorResponse, jsonError } from "@/server/http";
import { createAdminClient } from "@/server/supabaseAdmin";

// Several inboxes, each IMAP plus model calls
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel Cron calls this daily (vercel.json) with "Authorization: Bearer $CRON_SECRET"
function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request) {
  if (!isAuthorized(request)) return jsonError("Unauthorized", 401);
  try {
    // Failures are logged per user in runAutoSync; the summary shows in Vercel's cron log
    return NextResponse.json(await runAutoSync(createAdminClient()));
  } catch (error) {
    return errorResponse(error, "Email auto-sync error");
  }
}
