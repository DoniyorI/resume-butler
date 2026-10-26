import { requirePageUser } from "@/server/auth";
import { deleteCoverLetter, renameCoverLetter } from "@/features/cover-letters/actions";
import { listCoverLetters } from "@/features/cover-letters/data";
import CoverLetterDialog from "@/features/cover-letters/CoverLetterDialog";
import { DocumentGrid } from "@/features/resumes/DocumentGrid";

export const metadata = { title: "Cover Letters" };

export default async function CoverLettersPage() {
  const { supabase, user } = await requirePageUser();
  const coverLetters = await listCoverLetters(supabase, user.id);

  return (
    <DocumentGrid
      heading="Cover Letters"
      noun="Cover letter"
      filterPlaceholder="Filter by Cover Letter Name"
      hrefBase="/coverletters"
      items={coverLetters}
      newItemCard={<CoverLetterDialog />}
      renameAction={renameCoverLetter}
      deleteAction={deleteCoverLetter}
    />
  );
}
