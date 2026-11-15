import { notFound } from "next/navigation";
import PrepareView from "@/features/interviews/PrepareView";
import { requirePageUser } from "@/server/auth";
import { loadInterviewPrep } from "@/server/interviews/service";

export const metadata = { title: "Prepare for the interview" };

export default async function PreparePage({ params }) {
  const { supabase, user } = await requirePageUser();
  const prep = await loadInterviewPrep(supabase, user.id, params.id, { now: new Date() });
  if (!prep) notFound();
  return <PrepareView prep={prep} applicationId={params.id} />;
}
