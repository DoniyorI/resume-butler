import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { scanOptionsSchema } from "@/server/email/scanOptions";
import { syncEmailsForUser } from "@/server/email/sync";
import { errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

// IMAP plus one model call per candidate email can take a while. 60s is the
// most Vercel's Hobby plan allows (without Fluid Compute); more fails the deploy.
export const maxDuration = 60;

// Body (all optional): { from: "YYYY-MM-DD", to: "YYYY-MM-DD", categories: [...] }
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const hasBody = Number(request.headers.get("content-length") || 0) > 0;
    const options = hasBody ? await parseJson(request, scanOptionsSchema, { maxBytes: 2_000 }) : {};
    await enforceRateLimit(supabase, "scan-emails");
    return NextResponse.json(await syncEmailsForUser(supabase, user.id, options));
  } catch (error) {
    return errorResponse(error, "Error scanning emails");
  }
}
