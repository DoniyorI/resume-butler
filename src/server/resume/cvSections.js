import "server-only";
import { cvSectionsSchema } from "@/features/resumes/documentSchema";
import { parseInput } from "@/server/actionResult";
import { HttpError } from "@/server/http";

export async function loadCvSections(supabase, userId) {
  const { data, error } = await supabase.from("profiles").select("cv_sections").eq("id", userId).maybeSingle();
  if (["42703", "PGRST204"].includes(error?.code)) return { revision: 0, titles: {}, customSections: [], setupPending: true };
  if (error) throw error;
  if (!data) throw new HttpError(404, "Profile not found");
  const parsed = cvSectionsSchema.safeParse(data.cv_sections);
  if (!parsed.success) throw new HttpError(409, "Your Master CV uses unsupported custom sections. Update the app before editing.");
  return { ...parsed.data, setupPending: false };
}

export async function saveCvSections(supabase, value) {
  const content = parseInput(cvSectionsSchema, value);
  const { data, error } = await supabase.rpc("save_cv_sections", { p_content: content, p_expected_revision: content.revision });
  if (["PGRST202", "42883", "42703"].includes(error?.code)) throw new HttpError(503, "Custom CV setup is pending (migration 014). Keep your changes and try again after setup.");
  if (error?.code === "55000") throw new HttpError(409, "Your Master CV sections changed in another tab. Copy your changes, then reload.");
  if (error) throw error;
  if (!Number.isInteger(data?.revision) || data.revision <= content.revision) throw new Error("Invalid CV save result");
  return data;
}
