import "server-only";
import { answerError } from "./service.js";

export async function listAnswers(supabase, userId, { page = 1, search = "", archived = false } = {}) {
  let query = supabase.from("reusable_answers").select("*", { count: "exact" }).eq("user_id", userId);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (search) query = query.ilike("label", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const result = await query.order("updated_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  answerError(result.error);
  return { answers: result.data || [], count: result.count || 0 };
}

export async function approvedAnswerChoices(supabase, userId) {
  const { data, error } = await supabase.from("reusable_answers").select("id,label,question,revision")
    .eq("user_id", userId).is("archived_at", null).not("approved_at", "is", null).order("updated_at", { ascending: false }).limit(100);
  answerError(error);
  return data || [];
}
