import ViewSwitch from "@/components/shared/ViewSwitch";
import { requirePageUser } from "@/server/auth";
import { listDocuments } from "@/features/documents/data";
import DocumentLibrary from "@/features/documents/DocumentLibrary";

export const metadata = { title: "Documents" };

// Redesign under review: replaces /resumes and /coverletters once approved
const VIEWS = [
  { href: "/resumes", label: "Classic resumes" },
  { href: "/coverletters", label: "Classic cover letters" },
  { href: "/documents", label: "New" },
];

export default async function DocumentsPage() {
  const { supabase, user } = await requirePageUser();
  const documents = await listDocuments(supabase, user.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-24 md:px-8">
      <div className="mb-6 flex justify-end">
        <ViewSwitch views={VIEWS} current="/documents" />
      </div>
      <DocumentLibrary documents={documents} />
    </div>
  );
}
