import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { syncEmailsForUser } from "@/server/email/sync";
import { errorResponse } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

export async function POST() {
  try {
    const { supabase, user } = await requireUser();
    await enforceRateLimit(supabase, "scan-emails");
    return NextResponse.json(await syncEmailsForUser(supabase, user.id, { daysBack: 14 }));
  } catch (error) {
    return errorResponse(error, "Error scanning emails");
  }
}
