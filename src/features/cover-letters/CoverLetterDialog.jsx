"use client";
import { createCoverLetter } from "@/features/cover-letters/actions";
import { NewDocumentDialog } from "@/features/resumes/NewDocumentDialog";

export default function CoverLetterDialog() {
  return <NewDocumentDialog noun="Cover Letter" createAction={createCoverLetter} />;
}
