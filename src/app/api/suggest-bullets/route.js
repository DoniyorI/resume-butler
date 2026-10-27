import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { suggestBullets, suggestBulletsInput } from "@/server/resume/suggestBullets";

export async function POST(request) {
  try {
    const { supabase } = await requireUser();
    const input = await parseJson(request, suggestBulletsInput, { maxBytes: 200_000 });
    await enforceRateLimit(supabase, "suggest-bullets");
    return NextResponse.json(await suggestBullets(input));
  } catch (error) {
    return errorResponse(error, "Suggest bullets error");
  }
}
