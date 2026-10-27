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

// The cover letter editor: the editable letter page and the tailoring assistant
export default async function CoverLetterEditorPage({ params }) {
  const { supabase, user } = await requirePageUser();
  // Both at once: the ID is in the URL
  const [coverLetter, jobOptions] = await Promise.all([
    getCoverLetterForEditor(params.coverLetterId),
    getJobOptions(supabase, user.id, { coverLetterId: params.coverLetterId }),
  ]);
  if (!coverLetter) notFound();

  return (
    <div className={paperFont.variable}>
      <LetterStudio coverLetter={coverLetter} jobOptions={jobOptions} />
    </div>
  );
}
