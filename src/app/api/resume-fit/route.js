import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { assessFit } from "@/server/fit/assessFit";
import { planTailoring, resumeGaps } from "@/server/fit/tailorPlan";
import { errorResponse, parseJson } from "@/server/http";
import { loadMasterCv } from "@/server/resume/loadCv";

const bodySchema = z.object({
  jobDescription: z.string().min(1).max(50_000),
  resumeContent: z.object({}).passthrough(),
});

// No rate limit: the fit, plan and gaps are computed locally without calling an LLM.
// The response carries the user's own Master CV text (quoted lines, the entries,
// education and skills the plan picks, the bullets to add), so it only ever goes
// to the signed-in owner and is never cached.
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const { jobDescription, resumeContent } = await parseJson(request, bodySchema, { maxBytes: 200_000 });
    const cv = await loadMasterCv(supabase, user.id);
    const fit = assessFit({ jobDescription, cv, resumeContent });
    return NextResponse.json(
      { fit, plan: planTailoring({ fit, cv }), gaps: resumeGaps({ fit, cv, resumeContent }) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error, "Resume fit error");
  }
}
