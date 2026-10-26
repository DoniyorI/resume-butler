import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { rewriteBullet, rewriteBulletInput } from "@/server/resume/rewriteBullet";

export async function POST(request) {
  try {
    const { supabase } = await requireUser();
    const input = await parseJson(request, rewriteBulletInput, { maxBytes: 100_000 });
    await enforceRateLimit(supabase, "rewrite-bullet");
    return NextResponse.json(await rewriteBullet(input));
  } catch (error) {
    return errorResponse(error, "Error rewriting bullet");
  }
}
