import { Suspense } from "react";
import { requirePageUser } from "@/server/auth";
import ApplicationTable from "@/features/applications/ApplicationTable";
import ApplicationTableSkeleton from "@/features/applications/ApplicationTableSkeleton";
import { APPLICATIONS_PAGE_SIZE, getApplicationsPage } from "@/features/applications/data";

export const metadata = { title: "Applications" };

// ?page=2 is the second page; anything invalid falls back to the first
function pageIndexFrom(searchParams) {
  const page = Number.parseInt(searchParams?.page, 10);
  return Number.isFinite(page) && page > 1 ? page - 1 : 0;
}

async function ApplicationsList({ pageIndex }) {
  const { supabase, user } = await requirePageUser();
  const { applications, total } = await getApplicationsPage(supabase, user.id, pageIndex);

  return (
    <ApplicationTable
      applications={applications}
      total={total}
      page={pageIndex}
      pageSize={APPLICATIONS_PAGE_SIZE}
    />
  );
}

export default function ApplicationsPage({ searchParams }) {
  const pageIndex = pageIndexFrom(searchParams);

  return (
    <div className="flex flex-col w-full min-h-screen py-16 px-10 my-10">
      <h1 className="text-2xl font-semibold text-brand">Your Applications</h1>
      <Suspense key={pageIndex} fallback={<ApplicationTableSkeleton />}>
        <ApplicationsList pageIndex={pageIndex} />
      </Suspense>
    </div>
  );
}
