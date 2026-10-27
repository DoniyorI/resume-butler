import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/server/auth";
import ApplicationsHeader from "@/features/applications/ApplicationsHeader";
import ApplicationTable from "@/features/applications/ApplicationTable";
import ApplicationTableSkeleton from "@/features/applications/ApplicationTableSkeleton";
import { getApplicationsPage } from "@/features/applications/data";
import {
  APPLICATIONS_PAGE_SIZE,
  hasActiveFilters,
  listHref,
  parseListParams,
} from "@/features/applications/listParams";
import SuggestionsBanner from "@/features/suggestions/SuggestionsBanner";
import { getPendingSummary } from "@/features/suggestions/data";

export const metadata = { title: "Applications" };

async function ApplicationsList({ params }) {
  const { supabase, user } = await requirePageUser();
  const [{ applications, total, allTotal, statusCounts }, pendingSuggestions] = await Promise.all([
    getApplicationsPage(supabase, user.id, params),
    getPendingSummary(supabase, user.id),
  ]);

  // Past the last page (e.g. after deleting every row on it): go to the last
  // real page with the same filters and sort
  if (applications.length === 0 && params.page > 1) {
    const lastPage = Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE));
    redirect(listHref(params, { page: lastPage }));
  }

  return (
    <>
      <ApplicationsHeader total={total} allTotal={allTotal} filtered={hasActiveFilters(params)} />
      <SuggestionsBanner count={pendingSuggestions.count} latestAt={pendingSuggestions.latestAt} />
      <ApplicationTable
        applications={applications}
        total={total}
        allTotal={allTotal}
        statusCounts={statusCounts}
        params={params}
      />
    </>
  );
}

// No Suspense key: changing a filter, the sort or the page is a transition,
// so the current rows stay on screen (dimmed) until the new ones arrive.
export default function ApplicationsPage({ searchParams }) {
  const params = parseListParams(searchParams);

  return (
    <div className="flex w-full flex-col gap-3 px-3 pb-6 pt-[85px] sm:px-4">
      <Suspense fallback={<ApplicationTableSkeleton />}>
        <ApplicationsList params={params} />
      </Suspense>
    </div>
  );
}
