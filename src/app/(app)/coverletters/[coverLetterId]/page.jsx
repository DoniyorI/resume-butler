import { notFound } from "next/navigation";
import { getCoverLetterForEditor } from "@/features/cover-letters/data";
import CoverLetterEditor from "@/features/cover-letters/CoverLetterEditor";

export async function generateMetadata({ params }) {
  const coverLetter = await getCoverLetterForEditor(params.coverLetterId);
  return { title: coverLetter?.title || "Cover Letter" };
}

// getCoverLetterForEditor checks the user (requirePageUser) and scopes the query to them
export default async function CoverLetterEditorPage({ params }) {
  const coverLetter = await getCoverLetterForEditor(params.coverLetterId);
  if (!coverLetter) notFound();

  return <CoverLetterEditor coverLetter={coverLetter} />;
}
