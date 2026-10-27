import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { HttpError, errorResponse } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { MAX_RESUME_FILE_BYTES, parseResume } from "@/server/resume/parseResume";

const TOO_LARGE = "File is too large (max 5 MB)";

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();

    // Reject oversized uploads before buffering the multipart body
    if (Number(request.headers.get("content-length") || 0) > MAX_RESUME_FILE_BYTES + 10_000) {
      throw new HttpError(413, TOO_LARGE);
    }
    const file = (await request.formData()).get("file");
    if (!file || typeof file.arrayBuffer !== "function") throw new HttpError(400, "No file provided");
    if (file.size > MAX_RESUME_FILE_BYTES) throw new HttpError(413, TOO_LARGE);

    await enforceRateLimit(supabase, "parse-resume");

    const buffer = Buffer.from(await file.arrayBuffer());
    return NextResponse.json(await parseResume(supabase, user.id, { buffer, fileName: file.name }));
  } catch (error) {
    return errorResponse(error, "Error parsing resume");
  }
}
