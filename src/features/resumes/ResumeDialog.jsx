"use client";
import { createResume } from "@/features/resumes/actions";
import { NewDocumentDialog } from "@/features/resumes/NewDocumentDialog";

export default function ResumeDialog() {
  return <NewDocumentDialog noun="Resume" createAction={createResume} />;
}
