import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/auth";
import { getMasterCv, getResumeForEditor } from "@/features/resumes/data";
import ResumeEditor from "@/features/resumes/editor/ResumeEditor";

export async function generateMetadata({ params }) {
  const resume = await getResumeForEditor(params.resumeId);
  return { title: resume?.title || "Resume" };
}

export default async function ResumeEditorPage({ params }) {
  const { supabase, user } = await requirePageUser();
  const [resume, masterCv] = await Promise.all([
    getResumeForEditor(params.resumeId),
    getMasterCv(supabase, user.id),
  ]);
  if (!resume) notFound();

  return <ResumeEditor resume={resume} masterCv={masterCv} />;
}
