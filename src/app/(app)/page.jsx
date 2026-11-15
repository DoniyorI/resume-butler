import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/server/auth";
import { getConnection } from "@/server/email/connection";
import {
  getDashboardStats,
  getGoalAndName,
  groupHistoryByApplication,
  loadDashboardRows,
  loadResumeTitles,
} from "@/features/dashboard/data";
import FollowUps from "@/features/dashboard/FollowUps";
import TodayCard from "@/features/dashboard/TodayCard";
import GoalCard from "@/features/dashboard/GoalCard";
import RecentApplications from "@/features/dashboard/RecentApplications";
import SyncCard from "@/features/dashboard/SyncCard";
import SearchReport from "@/features/dashboard/SearchReport";
import { searchReport } from "@/features/dashboard/report";
import CollapsibleSection from "@/features/dashboard/CollapsibleSection";
import { REPORT_SUMMARY, activitySummary, flowSummary, recentSummary } from "@/features/dashboard/summaries";
import SectionCards from "@/features/dashboard/SectionCards";
import {
  ApplicationFlow,
  ApplicationsOverTime,
  Pipeline,
} from "@/features/dashboard/LazyCharts";
import { toConnection } from "@/features/email-sync/data";
import { getPendingSummary } from "@/features/suggestions/data";
import {
  listForSuggestions,
  listSavedJobsToDecide,
  listUpcoming,
  todayKey,
} from "@/server/activities/service";
import { suggestNextSteps } from "@/server/activities/suggest";
import { listOffersForSuggestions } from "@/server/offers/service";
import { savedJobsWithBands } from "@/server/fit/savedJobFit";
import { watchedWithBands } from "@/server/watchlist/fit";

export const metadata = { title: "Dashboard" };

// The email connection fails soft so the dashboard still loads if it can't be read
async function loadConnection(supabase, userId) {
  try {
    return toConnection(await getConnection(supabase, userId));
  } catch (error) {
    console.warn("Could not load the email connection:", error.message);
    return null;
  }
}

// Next steps and the saved jobs behind a suggestion fail soft as well
async function softly(load, fallback, what) {
  try {
    return await load;
  } catch (error) {
    console.warn(`Could not load ${what}:`, error.message);
    return fallback;
  }
}

// The home page: the headline numbers, then today's to-dos (next steps beside follow-ups,
// goal and inbox), then collapsible sections: newest applications open, trends and reports closed
export default async function DashboardPage() {
  const { supabase, user } = await requirePageUser();
  const [rows, { firstName, goal }, connection, pending, upcoming, activities, decideJobs, fitJobs, watched, offers, resumeTitles] = await Promise.all([
    loadDashboardRows(supabase, user.id),
    getGoalAndName(supabase, user.id),
    loadConnection(supabase, user.id),
    getPendingSummary(supabase, user.id),
    // Before migration 020 these two are { items: [], setupPending: true }
    softly(
      listUpcoming(supabase, user.id, { withinDays: 7 }),
      { items: [], olderOverdue: 0, setupPending: false },
      "next steps"
    ),
    softly(listForSuggestions(supabase, user.id), { items: [], setupPending: false }, "next steps"),
    softly(listSavedJobsToDecide(supabase, user.id), [], "saved jobs"),
    // Fit bands for the newest unapplied saved jobs; without them there is just no fit suggestion
    softly(savedJobsWithBands(supabase, user.id), [], "saved job fit"),
    // New postings at watched companies with their fit band; [] before migration 021
    softly(watchedWithBands(supabase, user.id), [], "watched postings"),
    // Offers and their decisions; [] before migration 022, null if they can't be read
    softly(listOffersForSuggestions(supabase, user.id), null, "offers"),
    loadResumeTitles(supabase, user.id),
  ]);
  const withBands = new Set(fitJobs.map((job) => job.id));
  const savedJobs = [...fitJobs, ...decideJobs.filter((job) => !withBands.has(job.id))];
  const stats = await getDashboardStats(supabase, user.id, rows);
  const suggestions = suggestNextSteps({
    applications: rows.applications,
    historyByApp: groupHistoryByApplication(rows.history),
    activities: activities.items,
    savedJobs,
    watched,
    offers,
    pendingEmailCount: pending.count,
    today: todayKey(),
  });

  // An inbox with updates waiting is an action, so it leads the right column; otherwise it goes last
  const syncFirst = Boolean(connection) && pending.count > 0;
  const syncCard = <SyncCard connection={connection} pendingCount={pending.count} />;

  return (
    <div className="flex w-full flex-col gap-4 px-4 pb-10 pt-[85px] md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{firstName ? `Welcome back, ${firstName}` : "Dashboard"}</h1>
          <p className="text-sm text-muted-foreground">Where your job search stands today</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/applications">
            All applications <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <SectionCards stats={stats} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <TodayCard
          className="xl:col-span-2"
          upcoming={upcoming.items}
          olderOverdue={upcoming.olderOverdue}
          suggestions={suggestions}
          setupPending={upcoming.setupPending}
        />
        <div className="flex flex-col gap-4">
          {syncFirst && syncCard}
          <FollowUps followUps={stats.followUps} />
          <GoalCard goal={goal} series={stats.daily.series} />
          {!syncFirst && syncCard}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <CollapsibleSection
          id="recent"
          title="Recent applications"
          summary={recentSummary(stats.total, stats.recent.length)}
          defaultOpen
        >
          <RecentApplications bare items={stats.recent} total={stats.total} />
        </CollapsibleSection>

        <CollapsibleSection id="activity" title="Activity" summary={activitySummary(stats.daily.series, todayKey())}>
          <div className="grid grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ApplicationsOverTime bare series={stats.daily.series} />
            </div>
            <Pipeline bare funnel={stats.funnel} total={stats.total} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="flow" title="Application flow" summary={flowSummary(stats.total)}>
          <div className="px-4 sm:px-6">
            <ApplicationFlow bare flow={stats.flow} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="search-report-section" title="Search report" summary={REPORT_SUMMARY}>
          <div className="px-4 sm:px-6">
            <SearchReport bare report={searchReport(rows.applications, rows.history, resumeTitles)} />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
