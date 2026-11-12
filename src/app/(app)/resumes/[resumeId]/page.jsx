import ReadOnlyResume from "@/features/resumes/ReadOnlyResume";
import { notFound } from "next/navigation";
import { Source_Serif_4 } from "next/font/google";
import { requirePageUser } from "@/server/auth";
import { getDeepLinkedJob, getJobOptions, getMasterCv, getResumeForEditor } from "@/features/resumes/data";
import ResumeStudio from "@/features/resumes/studio/ResumeStudio";

// The page's typeface; .rb-paper reads it from --font-paper
const paperFont = Source_Serif_4({ subsets: ["latin"], variable: "--font-paper", display: "swap" });

export async function generateMetadata({ params }) {
  const resume = await getResumeForEditor(params.resumeId);
  return { title: resume?.title || "Resume" };
}

// The resume editor: outline and page fit, the editable page, and the tailoring assistant.
// ?job=<saved job id> aims it at one of the user's saved jobs.
export default async function ResumeEditorPage({ params, searchParams }) {
  const { supabase, user } = await requirePageUser();
  const resume = await getResumeForEditor(params.resumeId);
  if (!resume) notFound();
  if (resume.readOnly) return <ReadOnlyResume resume={resume} />;
  const [masterCv, jobOptions, linkedJob] = await Promise.all([
    getMasterCv(supabase, user.id), getJobOptions(supabase, user.id, { resumeId: params.resumeId }),
    getDeepLinkedJob(supabase, user.id, searchParams?.job, resume.content.target),
  ]);

  return (
    <div className={paperFont.variable}>
      <ResumeStudio resume={resume} masterCv={masterCv} jobOptions={jobOptions} linkedJob={linkedJob} />
    </div>
  );
}
