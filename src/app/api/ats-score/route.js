import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreResume } from "@/server/ats/score";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";

const bodySchema = z.object({
  jobDescription: z.string().min(1).max(20_000),
  resumeContent: z.object({}).passthrough(),
});

// No rate limit: the score is computed locally without calling an LLM
export async function POST(request) {
  try {
    await requireUser();
    const { jobDescription, resumeContent } = await parseJson(request, bodySchema, { maxBytes: 200_000 });
    return NextResponse.json(scoreResume(jobDescription, resumeContent));
  } catch (error) {
    return errorResponse(error, "ATS score error");
  }
}
