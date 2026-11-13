import Link from "next/link";
import { Bookmark, ArrowLeft, ArrowRight, Puzzle, Radar } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { listOpportunities, listResumeChoices, SAVED_JOBS_PAGE_SIZE } from "@/server/opportunities/service";
import { fitForSavedJobs, rankSavedJobsByFit } from "@/server/fit/savedJobFit";
import SavedJobs from "@/features/opportunities/SavedJobs";
import { cn } from "@/lib/utils";

export const metadata = { title: "Saved jobs" };

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "fit", label: "Best fit" },
];

async function newestWithFit(supabase, userId, page, search) {
  const list = await listOpportunities(supabase, userId, page, search);
  const fits = await fitForSavedJobs(supabase, userId, list.jobs);
  return { ...list, fits, fitUnavailable: list.jobs.length > 0 && Object.keys(fits).length === 0 };
}

export default async function SavedJobsPage({ searchParams }) {
  const { supabase, user } = await requirePageUser();
  const page = Math.max(1, Math.min(100, Number.parseInt(searchParams.page, 10) || 1));
  const search = typeof searchParams.q === "string" ? searchParams.q.slice(0, 100).trim() : "";
  const sort = searchParams.sort === "fit" ? "fit" : "newest";
  const href = ({ page: p = 1, sort: s = sort } = {}) => {
    const params = new URLSearchParams();
    if (s === "fit") params.set("sort", "fit");
    if (search) params.set("q", search);
    if (p > 1) params.set("page", String(p));
    const query = params.toString();
    return query ? `/saved-jobs?${query}` : "/saved-jobs";
  };
  const [result, resumes] = await Promise.all([
    sort === "fit" ? rankSavedJobsByFit(supabase, user.id, { search, page }) : newestWithFit(supabase, user.id, page, search),
    listResumeChoices(supabase, user.id),
  ]);
  const { jobs, total, setupPending, fits, fitUnavailable } = result;
  // Best fit pages through the ranked jobs only
  const listed = sort === "fit" ? result.ranked : total;
  const pages = Math.ceil(listed / SAVED_JOBS_PAGE_SIZE);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-12 pt-[97px] sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/applications" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Applications</Link>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><Bookmark className="text-brand" size={23} /> Saved jobs <span className="text-base font-normal text-muted-foreground">{total}</span></h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Keep promising openings together. Review the details and choose your working resume before you apply.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/watchlist" className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm hover:bg-muted"><Radar size={16} /> Watchlist</Link>
          <Link href="/extension" className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm hover:bg-muted"><Puzzle size={16} /> Capture with extension</Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/saved-jobs" className="flex min-w-0 flex-[1_1_18rem] gap-2">
          {sort === "fit" ? <input type="hidden" name="sort" value="fit" /> : null}
          <input type="search" name="q" aria-label="Search saved jobs" defaultValue={search} maxLength={100} placeholder="Search company, role or location…" className="w-full max-w-md rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" /><button className="rounded-lg border bg-white px-4 text-sm hover:bg-muted">Search</button>
        </form>
        <nav aria-label="Sort saved jobs" className="flex shrink-0 rounded-lg border bg-white p-0.5 text-sm">
          {SORTS.map(option => (
            <Link key={option.value} href={href({ sort: option.value })} aria-current={sort === option.value ? "true" : undefined}
              className={cn("rounded-md px-3 py-1.5", sort === option.value ? "bg-brand/10 font-medium text-brand" : "text-muted-foreground hover:text-foreground")}>
              {option.label}
            </Link>
          ))}
        </nav>
      </div>
      {sort === "fit" && result.hasMore ? <p className="text-xs text-muted-foreground">Best fit is ranked among your {result.rankedLimit} most recent saved jobs.</p> : null}
      {fitUnavailable ? <p role="status" className="text-xs text-muted-foreground">Fit can&apos;t be shown right now. Your saved jobs are listed newest first.</p> : null}
      {setupPending ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Saved jobs setup is pending. Install migration 013 to start saving. Existing application tracking is available.</div>
        : <SavedJobs jobs={jobs} resumes={resumes} fits={fits} />}
      {pages > 1 ? <nav aria-label="Saved jobs pages" className="flex items-center justify-between border-t pt-4 text-sm">
        {page > 1 ? <Link href={href({ page: page - 1 })} className="flex items-center gap-1"><ArrowLeft size={14} /> Previous</Link> : <span />}
        <span className="text-muted-foreground">Page {page} of {pages}</span>
        {page < pages ? <Link href={href({ page: page + 1 })} className="flex items-center gap-1">Next <ArrowRight size={14} /></Link> : <span />}
      </nav> : null}
    </div>
  );
}
