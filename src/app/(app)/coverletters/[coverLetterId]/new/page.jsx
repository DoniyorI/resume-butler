import { notFound } from "next/navigation";
import { Source_Serif_4 } from "next/font/google";
import { requirePageUser } from "@/server/auth";
import { getCoverLetterForEditor } from "@/features/cover-letters/data";
import { getJobOptions } from "@/features/resumes/data";
import LetterStudio from "@/features/cover-letters/studio/LetterStudio";

// The page's typeface; .rb-paper reads it from --font-paper
const paperFont = Source_Serif_4({ subsets: ["latin"], variable: "--font-paper", display: "swap" });

export async function generateMetadata({ params }) {
  const coverLetter = await getCoverLetterForEditor(params.coverLetterId);
  return { title: coverLetter?.title || "Cover Letter" };
}

// The redesigned cover letter editor, beside the classic one at /coverletters/[id] for comparison
export default async function LetterStudioPage({ params }) {
  const { supabase, user } = await requirePageUser();
  const coverLetter = await getCoverLetterForEditor(params.coverLetterId);
  if (!coverLetter) notFound();
  const jobOptions = await getJobOptions(supabase, user.id, { coverLetterId: coverLetter.id });

  return (
    <div className={paperFont.variable}>
      <LetterStudio coverLetter={coverLetter} jobOptions={jobOptions} />
    </div>
  );
}
