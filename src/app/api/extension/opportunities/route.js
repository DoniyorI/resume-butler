import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authenticateExtension } from "@/server/extension/tokens";
import { errorResponse, parseJson } from "@/server/http";
import { getOpportunityForUrl, listResumeChoices, opportunityInput, saveOpportunity } from "@/server/opportunities/service";

export async function GET(request) {
  try {
    const { admin, userId } = await authenticateExtension(request);
    const [resumes, opportunity] = await Promise.all([
      listResumeChoices(admin, userId), getOpportunityForUrl(admin, userId, new URL(request.url).searchParams.get("url") || ""),
    ]);
    return NextResponse.json({ resumes, opportunity }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error, "Extension resume choices"); }
}

export async function POST(request) {
  try {
    const { admin, userId } = await authenticateExtension(request);
    const input = await parseJson(request, opportunityInput, { maxBytes: 120_000 });
    const opportunity = await saveOpportunity(admin, userId, input);
    revalidatePath("/saved-jobs");
    return NextResponse.json({ opportunity });
  } catch (error) { return errorResponse(error, "Extension save job"); }
}
