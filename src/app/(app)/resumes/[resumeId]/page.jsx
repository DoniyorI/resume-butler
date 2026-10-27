import { notFound } from "next/navigation";
import { Source_Serif_4 } from "next/font/google";
import { requirePageUser } from "@/server/auth";
import { getJobOptions, getMasterCv, getResumeForEditor } from "@/features/resumes/data";
import ResumeStudio from "@/features/resumes/studio/ResumeStudio";

// The page's typeface; .rb-paper reads it from --font-paper
const paperFont = Source_Serif_4({ subsets: ["latin"], variable: "--font-paper", display: "swap" });

export async function generateMetadata({ params }) {
  const resume = await getResumeForEditor(params.resumeId);
  return { title: resume?.title || "Resume" };
}

// The resume editor: outline and page fit, the editable page, and the tailoring assistant
export default async function ResumeEditorPage({ params }) {
  const { supabase, user } = await requirePageUser();
  // All at once: none needs another's result (the ID is in the URL)
  const [resume, masterCv, jobOptions] = await Promise.all([
    getResumeForEditor(params.resumeId),
    getMasterCv(supabase, user.id),
    getJobOptions(supabase, user.id, { resumeId: params.resumeId }),
  ]);
  if (!resume) notFound();

  return (
    <div className={paperFont.variable}>
      <ResumeStudio resume={resume} masterCv={masterCv} jobOptions={jobOptions} />
    </div>
  );
}
