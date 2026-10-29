import Link from "next/link";
import { Bookmark, ArrowLeft, ArrowRight, Puzzle } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { listOpportunities, listResumeChoices } from "@/server/opportunities/service";
import SavedJobs from "@/features/opportunities/SavedJobs";

export const metadata = { title: "Saved jobs" };

export default async function SavedJobsPage({ searchParams }) {
  const { supabase, user } = await requirePageUser();
  const page = Math.max(1, Math.min(100, Number.parseInt(searchParams.page, 10) || 1));
  const search = typeof searchParams.q === "string" ? searchParams.q.slice(0, 100).trim() : "";
  const pageHref = value => `/saved-jobs?page=${value}&q=${encodeURIComponent(search)}`;
  const [{ jobs, total, setupPending }, resumes] = await Promise.all([
    listOpportunities(supabase, user.id, page, search), listResumeChoices(supabase, user.id),
  ]);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-12 pt-[97px] sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/applications" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Applications</Link>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><Bookmark className="text-brand" size={23} /> Saved jobs <span className="text-base font-normal text-muted-foreground">{total}</span></h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Keep promising openings together. Review the details and choose your working resume before you apply.</p>
        </div>
        <Link href="/extension" className="mt-8 inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm hover:bg-muted"><Puzzle size={16} /> Capture with extension</Link>
      </div>
      <form action="/saved-jobs" className="flex gap-2"><input type="search" name="q" aria-label="Search saved jobs" defaultValue={search} maxLength={100} placeholder="Search company, role or location…" className="w-full max-w-md rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" /><button className="rounded-lg border bg-white px-4 text-sm hover:bg-muted">Search</button></form>
      {setupPending ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Saved jobs setup is pending. Install migration 013 to start saving. Existing application tracking is available.</div>
        : <SavedJobs jobs={jobs} resumes={resumes} />}
      {total > 20 ? <nav aria-label="Saved jobs pages" className="flex items-center justify-between border-t pt-4 text-sm">
        {page > 1 ? <Link href={pageHref(page - 1)} className="flex items-center gap-1"><ArrowLeft size={14} /> Previous</Link> : <span />}
        <span className="text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span>
        {page * 20 < total ? <Link href={pageHref(page + 1)} className="flex items-center gap-1">Next <ArrowRight size={14} /></Link> : <span />}
      </nav> : null}
    </div>
  );
}
