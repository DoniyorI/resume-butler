import { requirePageUser } from "@/server/auth";
import { deleteResume, renameResume } from "@/features/resumes/actions";
import { listResumes } from "@/features/resumes/data";
import { DocumentGrid } from "@/features/resumes/DocumentGrid";
import ResumeDialog from "@/features/resumes/ResumeDialog";

export const metadata = { title: "Resumes" };

export default async function ResumesPage() {
  const { supabase, user } = await requirePageUser();
  const resumes = await listResumes(supabase, user.id);

  return (
    <DocumentGrid
      heading="Resumes"
      noun="Resume"
      filterPlaceholder="Filter by Resume Name"
      hrefBase="/resumes"
      items={resumes}
      newItemCard={<ResumeDialog />}
      renameAction={renameResume}
      deleteAction={deleteResume}
    />
  );
}
