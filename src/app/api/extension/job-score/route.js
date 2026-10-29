import { NextResponse } from "next/server";
import { authenticateExtension } from "@/server/extension/tokens";
import { errorResponse, parseJson } from "@/server/http";
import { getJobScore, jobScoreInput } from "@/server/extension/jobScore";

// Deterministic comparison, no AI provider calls or writes to application data.
export async function POST(request) {
  try {
    const { admin, userId } = await authenticateExtension(request);
    const input = await parseJson(request, jobScoreInput, { maxBytes: 210000 });
    return NextResponse.json(await getJobScore(admin, userId, input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, "Extension job comparison"); }
}
