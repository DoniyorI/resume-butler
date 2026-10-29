import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { archiveError, decodeArtifact } from "@/server/applications/submissions";
import { HttpError, attachmentHeader, errorResponse } from "@/server/http";

export async function GET(request, { params }) {
  try {
    const { supabase, user } = await requireUser();
    if (!z.string().uuid().safeParse(params.id).success) throw new HttpError(404, "File not found");
    const { data, error } = await supabase.from("resume_artifacts").select("filename,pdf_bytes,size_bytes,sha256").eq("user_id", user.id).eq("id", params.id).maybeSingle();
    archiveError(error);
    if (!data) throw new HttpError(404, "File not found");
    return new NextResponse(decodeArtifact(data), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": attachmentHeader(data.filename.replace(/\.pdf$/i, ""), "pdf"), "Cache-Control": "private, no-store", "X-Resume-SHA256": data.sha256 },
    });
  } catch (error) { return errorResponse(error, "downloadResumeArtifact"); }
}
