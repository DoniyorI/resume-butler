import Link from "next/link";
import { ArrowLeft, ArrowRight, Radar } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { LIST_LIMIT, listPostings, listWatchlist } from "@/server/watchlist/service";
import { postingsWithFit, toClientPosting } from "@/features/watchlist/data";
import { isStale, paginate, sortPostings } from "@/features/watchlist/order";
import AddCompanyForm from "@/features/watchlist/AddCompanyForm";
import CompanyList from "@/features/watchlist/CompanyList";
import PostingsList from "@/features/watchlist/PostingsList";
import StaleRefresher from "@/features/watchlist/StaleRefresher";
import { cn } from "@/lib/utils";

export const metadata = { title: "Watchlist" };

const SORTS = [
  { value: "fit", label: "Best fit" },
  { value: "newest", label: "Newest" },
];

function Header() {
  return (
    <div>
      <Link href="/saved-jobs" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Saved jobs</Link>
      <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><Radar className="text-brand" size={23} /> Watchlist</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Resume Butler reads the public job boards of the companies you name and scores their open roles against your Master CV. It does not search the wider job market.</p>
    </div>
  );
}

const shell = "mx-auto w-full max-w-6xl space-y-6 px-4 pb-12 pt-[85px] sm:px-6";

export default async function WatchlistPage({ searchParams }) {
  const { supabase, user } = await requirePageUser();
  const [{ companies, setupPending: noCompanies }, { postings, setupPending: noPostings }] = await Promise.all([
    listWatchlist(supabase, user.id),
    listPostings(supabase, user.id, { limit: LIST_LIMIT }),
  ]);
  if (noCompanies || noPostings)
    return (
      <div className={shell}>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><Radar className="text-brand" size={23} /> Watchlist</h1>
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Watchlist needs migration 021.</div>
      </div>
    );

  const sort = searchParams.sort === "newest" ? "newest" : "fit";
  const company = companies.find((item) => item.id === searchParams.company)?.id || "";
  const href = ({ page = 1, sort: s = sort, company: c = company } = {}) => {
    const params = new URLSearchParams();
    if (s === "newest") params.set("sort", "newest");
    if (c) params.set("company", c);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/watchlist?${query}` : "/watchlist";
  };

  const keptByCompany = {};
  for (const posting of postings) keptByCompany[posting.companyId] = (keptByCompany[posting.companyId] || 0) + 1;
  const withFit = await postingsWithFit(supabase, user.id, company ? postings.filter((posting) => posting.companyId === company) : postings);
  const { items, page, pages } = paginate(sortPostings(withFit, sort), Number.parseInt(searchParams.page, 10));
  const staleCount = companies.filter((item) => isStale(item.lastCheckedAt)).length;

  return (
    <div className={shell}>
      <Header />
      <AddCompanyForm />
      {companies.length ? (
        <>
          <StaleRefresher staleCount={staleCount} />
          <CompanyList companies={companies} keptByCompany={keptByCompany} />
        </>
      ) : (
        <p className="rounded-xl border border-dashed bg-white px-6 py-8 text-center text-sm leading-relaxed text-muted-foreground">
          You are not watching any company yet. Add a company&apos;s job board above and Resume Butler will keep the open roles whose titles match your keywords, and show how each fits your Master CV.
        </p>
      )}
      {companies.length ? (
        <section className="space-y-4" aria-label="Open roles">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Open roles <span className="text-base font-normal text-muted-foreground">{withFit.length}</span></h2>
            <nav aria-label="Sort watched roles" className="flex shrink-0 rounded-lg border bg-white p-0.5 text-sm">
              {SORTS.map((option) => (
                <Link key={option.value} href={href({ sort: option.value })} aria-current={sort === option.value ? "true" : undefined}
                  className={cn("rounded-md px-3 py-1.5", sort === option.value ? "bg-brand/10 font-medium text-brand" : "text-muted-foreground hover:text-foreground")}>
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>
          {companies.length > 1 ? (
            <nav aria-label="Filter by company" className="flex flex-wrap gap-2 text-xs">
              {[{ id: "", name: "All companies" }, ...companies].map((item) => (
                <Link key={item.id || "all"} href={href({ company: item.id })} aria-current={company === item.id ? "true" : undefined}
                  className={cn("rounded-full border px-3 py-1", company === item.id ? "border-brand/30 bg-brand/10 font-medium text-brand" : "bg-white text-muted-foreground hover:text-foreground")}>
                  {item.name}
                </Link>
              ))}
            </nav>
          ) : null}
          {items.length ? (
            <>
              <PostingsList key={`${sort}:${company}:${page}`} postings={items.map(toClientPosting)} />
              <p className="text-xs text-muted-foreground">Fit compares each posting with your Master CV. It is not a prediction of an interview.</p>
            </>
          ) : (
            <p className="rounded-xl border border-dashed bg-white px-6 py-10 text-center text-sm text-muted-foreground">No open roles match your titles yet.</p>
          )}
          {pages > 1 ? (
            <nav aria-label="Watchlist pages" className="flex items-center justify-between border-t pt-4 text-sm">
              {page > 1 ? <Link href={href({ page: page - 1 })} className="flex items-center gap-1"><ArrowLeft size={14} /> Previous</Link> : <span />}
              <span className="text-muted-foreground">Page {page} of {pages}</span>
              {page < pages ? <Link href={href({ page: page + 1 })} className="flex items-center gap-1">Next <ArrowRight size={14} /></Link> : <span />}
            </nav>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
