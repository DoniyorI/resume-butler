import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { rewriteParagraph, rewriteParagraphInput } from "@/server/resume/rewriteParagraph";

// Three rewrites of one cover letter paragraph. Shares the rewrite-bullet
// limit: both are small edits made often while editing.
export async function POST(request) {
  try {
    const { supabase } = await requireUser();
    const input = await parseJson(request, rewriteParagraphInput, { maxBytes: 100_000 });
    await enforceRateLimit(supabase, "rewrite-bullet");
    return NextResponse.json(await rewriteParagraph(input));
  } catch (error) {
    return errorResponse(error, "Error rewriting paragraph");
  }
}
