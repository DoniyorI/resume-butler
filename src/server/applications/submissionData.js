import "server-only";
import { archiveError } from "./submissions";

export const ARTIFACT_METADATA = "id,title,filename,provenance,source_resume_id,size_bytes,sha256,created_at";
export const SUBMISSION_SUMMARY = "id,application_id,artifact_id,kind,submitted_on,resume_title,supersedes_id,created_at";

export async function submissionChoices(supabase, userId, applicationId) {
  const results = await Promise.all([
    supabase.from("application_submissions").select(SUBMISSION_SUMMARY).eq("user_id", userId).eq("application_id", applicationId).order("created_at", { ascending: false }),
    supabase.from("resume_artifacts").select(ARTIFACT_METADATA).eq("user_id", userId).eq("provenance", "export").order("created_at", { ascending: false }).limit(100),
    supabase.from("resumes").select("id,title").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
  ]);
  for (const result of results) archiveError(result.error);
  return { records: results[0].data || [], exports: results[1].data || [], resumes: results[2].data || [] };
}

export async function getSubmission(supabase, userId, id) {
  const { data: record, error } = await supabase.from("application_submissions").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  archiveError(error);
  if (!record) return null;
  let artifact = null;
  if (record.artifact_id) {
    const result = await supabase.from("resume_artifacts").select(ARTIFACT_METADATA + ",content").eq("user_id", userId).eq("id", record.artifact_id).maybeSingle();
    archiveError(result.error);
    artifact = result.data;
  }
  return { ...record, artifact };
}
