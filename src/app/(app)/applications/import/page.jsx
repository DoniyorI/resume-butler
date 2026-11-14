import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import ImportApplications from "@/features/applications/import/ImportApplications";

export const metadata = { title: "Import applications" };

export default async function ImportApplicationsPage() {
  await requirePageUser();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-12 pt-[85px] sm:px-6">
      <div>
        <Link href="/applications" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Applications</Link>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><FileSpreadsheet className="text-brand" size={23} /> Import applications</h1>
      </div>
      <ImportApplications />
    </div>
  );
}
