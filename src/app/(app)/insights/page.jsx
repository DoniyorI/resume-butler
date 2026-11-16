import { requirePageUser } from "@/server/auth";
import { getDashboardStats, loadDashboardRows, loadResumeTitles } from "@/features/dashboard/data";
import { searchReport } from "@/features/dashboard/report";
import { parseInsightTab } from "@/features/dashboard/insightTabs";
import { timingLine } from "@/features/dashboard/summaries";
import DashboardHeader from "@/features/dashboard/DashboardHeader";
import InsightsTabs from "@/features/dashboard/InsightsTabs";
import SearchReport from "@/features/dashboard/SearchReport";
import { ApplicationFlow, ApplicationsOverTime, Pipeline } from "@/features/dashboard/LazyCharts";

export const metadata = { title: "Insights" };

// Charts and a report of the user's own records, one tab at a time (?tab=activity|flow|report).
// Only the open tab is rendered, so its charts load on demand.
export default async function InsightsPage({ searchParams }) {
  const raw = searchParams?.tab;
  const tab = parseInsightTab(Array.isArray(raw) ? raw[0] : raw);
  const { supabase, user } = await requirePageUser();
  // The report groups by columns and resume titles the other tabs never read
  const rows = await loadDashboardRows(supabase, user.id, { forReport: tab === "report" });
  const stats = await getDashboardStats(supabase, user.id, rows);

  let content;
  if (tab === "flow") {
    content = <ApplicationFlow flow={stats.flow} />;
  } else if (tab === "report") {
    const resumeTitles = await loadResumeTitles(supabase, user.id);
    content = <SearchReport report={searchReport(rows.applications, rows.history, resumeTitles)} />;
  } else {
    content = (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ApplicationsOverTime series={stats.daily.series} />
        </div>
        <Pipeline funnel={stats.funnel} total={stats.total} timing={timingLine(stats.medianResponseDays, stats.responseTimeSamples)} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 px-4 pb-10 pt-[85px] md:px-6">
      <DashboardHeader active="insights" />
      <InsightsTabs tab={tab}>{content}</InsightsTabs>
    </div>
  );
}
