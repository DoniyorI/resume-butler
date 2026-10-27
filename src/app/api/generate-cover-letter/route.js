import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { coverLetterInput, generateCoverLetter } from "@/server/resume/coverLetter";

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const input = await parseJson(request, coverLetterInput);
    await enforceRateLimit(supabase, "generate-cover-letter");
    return NextResponse.json(await generateCoverLetter(supabase, user.id, input));
  } catch (error) {
    return errorResponse(error, "Cover letter generation error");
  }
}
