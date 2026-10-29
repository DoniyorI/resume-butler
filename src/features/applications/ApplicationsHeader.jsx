import Link from "next/link";
import { Bookmark } from "lucide-react";
import ScanEmailsButton from "@/features/applications/ScanEmailsButton";

// Title row: how many applications there are and, with filters on, how many match
export default function ApplicationsHeader({ total, allTotal, filtered }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-brand">Applications</h1>
        <span className="text-sm tabular-nums text-muted-foreground">{allTotal}</span>
        {filtered && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium tabular-nums text-brand">
            {total} matching
          </span>
        )}
      </div>
      <div className="flex items-center gap-3"><Link href="/saved-jobs" className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-xs font-medium hover:bg-muted"><Bookmark size={14} /> Saved jobs</Link><ScanEmailsButton /></div>
    </div>
  );
}
