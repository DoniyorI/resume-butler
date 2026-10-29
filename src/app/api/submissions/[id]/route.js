import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getSubmission } from "@/server/applications/submissionData";
import { HttpError, attachmentHeader, errorResponse } from "@/server/http";

export async function GET(request, { params }) {
  try {
    const { supabase, user } = await requireUser();
    if (!z.string().uuid().safeParse(params.id).success) throw new HttpError(404, "Record not found");
    const record = await getSubmission(supabase, user.id, params.id);
    if (!record) throw new HttpError(404, "Record not found");
    return new NextResponse(JSON.stringify({ schemaVersion: 1, ...record }, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": attachmentHeader(`submission-${record.submitted_on}`, "json"), "Cache-Control": "private, no-store" },
    });
  } catch (error) { return errorResponse(error, "downloadSubmissionRecord"); }
}
