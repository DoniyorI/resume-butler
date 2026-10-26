import { deleteCoverLetter, renameCoverLetter } from "@/features/cover-letters/actions";
import { deleteResume, renameResume } from "@/features/resumes/actions";

export const TYPE_LABELS = { resume: "Resume", coverLetter: "Cover letter" };

// Badge tints: quiet enough that the thumbnails carry the page
export const TYPE_BADGE_CLASS = {
  resume: "bg-slate-100 text-slate-700",
  coverLetter: "bg-[#E6F2EE] text-[#2F6B58]",
};

export const RENAME = { resume: renameResume, coverLetter: renameCoverLetter };
export const DELETE = { resume: deleteResume, coverLetter: deleteCoverLetter };
