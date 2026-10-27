import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { generateResume, generateResumeInput } from "@/server/resume/generateResume";

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const input = await parseJson(request, generateResumeInput);
    await enforceRateLimit(supabase, "generate-resume");
    return NextResponse.json(await generateResume(supabase, user.id, input));
  } catch (error) {
    return errorResponse(error, "Error generating resume");
  }
}
