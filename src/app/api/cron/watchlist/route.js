import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runWatchlistCron } from "@/server/watchlist/service";
import { errorResponse, jsonError } from "@/server/http";
import { createAdminClient } from "@/server/supabaseAdmin";

// The Hobby plan's limit (more fails the deploy); runWatchlistCron stays inside it
export const maxDuration = 60;
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
    // Counts only: no company names or user ids in the response or the log
    return NextResponse.json(await runWatchlistCron(createAdminClient()));
  } catch (error) {
    return errorResponse(error, "Watchlist refresh error");
  }
}
