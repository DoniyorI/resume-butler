import { requirePageUser } from "@/server/auth";
import { listDocuments } from "@/features/documents/data";
import DocumentLibrary from "@/features/documents/DocumentLibrary";

export const metadata = { title: "Documents" };

// Resumes and cover letters in one library (/resumes and /coverletters redirect here)
export default async function DocumentsPage() {
  const { supabase, user } = await requirePageUser();
  const documents = await listDocuments(supabase, user.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-24 md:px-8">
      <DocumentLibrary documents={documents} />
    </div>
  );
}
