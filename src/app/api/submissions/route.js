import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { createAdminClient } from "@/server/supabaseAdmin";
import { HttpError, errorResponse } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { captureSubmission, readSubmissionRequest } from "@/server/applications/submissions";

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new HttpError(403, "Record the version from this app's submission form.");
    await enforceRateLimit(supabase, "submission-capture");
    const { input, file } = await readSubmissionRequest(request);
    const record = await captureSubmission(createAdminClient(), user.id, input, file ? { bytes: Buffer.from(await file.arrayBuffer()), fileName: file.name } : undefined);
    revalidatePath(`/applications/${input.applicationId}`);
    revalidatePath("/submissions");
    return NextResponse.json(record, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error, "recordSubmission"); }
}
