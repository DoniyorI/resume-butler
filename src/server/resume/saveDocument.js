import "server-only";
import { resumeContentSchema } from "@/features/resumes/documentSchema";
import { parseInput } from "@/server/actionResult";
import { HttpError } from "@/server/http";

export async function saveResumeDocument(supabase, resumeId, value) {
  const content = parseInput(resumeContentSchema, value);
  const { data, error } = await supabase.rpc("save_resume_document", { p_resume_id: resumeId, p_content: content, p_expected_revision: content.revision });
  if (["PGRST202", "42883", "42703"].includes(error?.code)) throw new HttpError(503, "Resume saving setup is pending (migration 014). Keep this editor open and try again after setup.");
  if (error?.code === "55000") throw new HttpError(409, "This resume changed in another tab or uses a newer format. Copy your unsaved changes, then reload before saving.");
  if (error?.code === "P0002") throw new HttpError(404, "Resume not found");
  if (error) throw error;
  if (!Number.isInteger(data?.revision) || data.revision <= content.revision) throw new Error("Invalid resume save result");
  return data;
}
