import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { tailorInput, tailorResume } from "@/server/resume/tailorResume";

// Picks the master CV entries that fit a job; the editor previews and applies them
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const input = await parseJson(request, tailorInput);
    // Same cost as creating a tailored resume, so it shares that limit
    await enforceRateLimit(supabase, "generate-resume");
    return NextResponse.json(await tailorResume(supabase, user.id, input));
  } catch (error) {
    return errorResponse(error, "Error tailoring resume");
  }
}
