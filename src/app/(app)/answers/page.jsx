import { requirePageUser } from "@/server/auth";
import { listAnswers } from "@/server/answers/data";
import { ANSWER_CATEGORIES } from "@/server/answers/service";
import AnswerLibrary from "@/features/answers/AnswerLibrary";

export const metadata = { title: "Answer library" };
export default async function AnswersPage({ searchParams }) {
  const { supabase, user } = await requirePageUser();
  const page = Math.min(100000,Math.max(1,Math.floor(Number(searchParams.page)||1)));
  const search = String(searchParams.q || "").trim().slice(0,100), archived = searchParams.archived === "1";
  let result, message;
  try { result = await listAnswers(supabase,user.id,{page,search,archived}); }
  catch (error) { message = error.status === 503 ? error.message : "Your answer library could not be loaded. Refresh to try again."; }
  return <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-24 md:px-8">{message ? <div className="space-y-4"><h1 className="text-2xl font-semibold">Answer library</h1><p role="alert" className="text-sm text-red-700">{message}</p></div> : <AnswerLibrary {...result} categories={ANSWER_CATEGORIES} page={page} search={search} archived={archived} />}</div>;
}
