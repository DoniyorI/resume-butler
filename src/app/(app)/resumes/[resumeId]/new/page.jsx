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

// The redesigned resume editor, beside the classic one at /resumes/[id] for comparison
export default async function ResumeStudioPage({ params }) {
  const { supabase, user } = await requirePageUser();
  const resume = await getResumeForEditor(params.resumeId);
  if (!resume) notFound();

  const [masterCv, jobOptions] = await Promise.all([
    getMasterCv(supabase, user.id),
    getJobOptions(supabase, user.id, resume.id),
  ]);

  return (
    <div className={paperFont.variable}>
      <ResumeStudio resume={resume} masterCv={masterCv} jobOptions={jobOptions} />
    </div>
  );
}
