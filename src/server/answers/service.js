import "server-only";
import { z } from "zod";
import { HttpError } from "@/server/http";

export const ANSWER_CATEGORIES = ["general", "project", "behavioral", "availability", "compensation", "eligibility", "other"];
export const answerContentInput = z.object({
  label: z.string().trim().min(1, "Give this answer a short label.").max(120),
  question: z.string().trim().min(1, "Add the question this answer addresses.").max(1000),
  answer: z.string().trim().min(1, "Write your own answer before saving.").max(10000),
  category: z.enum(ANSWER_CATEGORIES).default("general"),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).default([]),
  sourceNote: z.string().trim().max(2000).default(""),
  sourceUrl: z.string().trim().max(2000).refine(value => {
    if (!value) return true;
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  }, "Use an http or https reference link.").default(""),
}).strict();
const commandBase = z.object({ id: z.string().uuid(), eventId: z.string().uuid(), expectedRevision: z.number().int().min(0).max(1000000000) });
export const answerCommandInput = z.discriminatedUnion("action", [
  commandBase.extend({ action: z.literal("draft"), content: answerContentInput }).strict(),
  commandBase.extend({ action: z.literal("approve"), content: answerContentInput }).strict(),
  commandBase.extend({ action: z.literal("archive") }).strict(),
  commandBase.extend({ action: z.literal("restore") }).strict(),
]);

export function answerError(error) {
  if (!error) return;
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(error.code)) throw new HttpError(503, "Answer library setup is pending (migration 016). Your input is kept; retry after setup.");
  if (error.code === "55000") throw new HttpError(409, "This answer changed elsewhere. Your input is kept. Review the latest version before saving again.");
  if (error.code === "P0002") throw new HttpError(404, "That answer is no longer available.");
  if (["22023", "23514"].includes(error.code)) throw new HttpError(400, "Check the answer details and try again.");
  throw new Error(`Answer library operation failed (${error.code || "unknown"})`);
}

export async function saveAnswer(supabase, input) {
  const { data, error } = await supabase.rpc("save_reusable_answer", {
    p_answer_id: input.id, p_event_id: input.eventId, p_expected_revision: input.expectedRevision,
    p_action: input.action, p_content: input.content || {},
  });
  answerError(error);
  if (!z.string().uuid().safeParse(data?.id).success || !Number.isInteger(data.revision) || data.revision < 1) throw new Error("Invalid answer save result");
  return data;
}

export async function getApprovedAnswer(supabase, userId, id, expectedRevision) {
  const { data, error } = await supabase.from("reusable_answers")
    .select("id,label,question,answer,revision,approved_at,archived_at")
    .eq("user_id", userId).eq("id", id).maybeSingle();
  answerError(error);
  if (!data) throw new HttpError(404, "That answer is no longer available.");
  if (data.revision !== expectedRevision || !data.approved_at || data.archived_at) throw new HttpError(409, "This version is no longer available for reuse. Review and approve the latest version in your answer library.");
  return data;
}
