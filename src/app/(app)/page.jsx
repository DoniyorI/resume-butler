import { requirePageUser } from "@/server/auth";
import { getConnection } from "@/server/email/connection";
import {
  getDashboardStats,
  getGoalAndName,
  groupHistoryByApplication,
  loadDashboardRows,
} from "@/features/dashboard/data";
import DashboardHeader from "@/features/dashboard/DashboardHeader";
import TodayCard from "@/features/dashboard/TodayCard";
import InsightsCard from "@/features/dashboard/InsightsCard";
import RecentApplications from "@/features/dashboard/RecentApplications";
import SyncCard from "@/features/dashboard/SyncCard";
import SectionCards from "@/features/dashboard/SectionCards";
import { ActivityOverview } from "@/features/dashboard/LazyCharts";
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

// The Overview tab: the headline numbers and the goal, today's to-dos, a compact activity chart and the
// newest applications, with the inbox and links to /insights in a sidebar.
export default async function DashboardPage() {
  const { supabase, user } = await requirePageUser();
  const [rows, { goal }, connection, pending, upcoming, activities, decideJobs, fitJobs, watched, offers] = await Promise.all([
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
    // No pendingEmailCount: the Inbox card already shows updates waiting for review, so Today doesn't repeat it
    today: todayKey(),
  });

  // One column on a phone, in DOM order: stats, Today, Activity, Recent applications, Inbox, More insights.
  // From xl up the last two move to a sticky sidebar beside the main column. Inbox updates waiting for
  // review show only on the Inbox card.
  return (
    <div className="flex w-full flex-col gap-4 px-4 pb-10 pt-[85px] md:px-6">
      <DashboardHeader active="overview" />

      <SectionCards stats={stats} goal={goal} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <TodayCard
            upcoming={upcoming.items}
            olderOverdue={upcoming.olderOverdue}
            suggestions={suggestions}
            setupPending={upcoming.setupPending}
          />
          <ActivityOverview series={stats.daily.series} />
          <RecentApplications items={stats.recent} total={stats.total} />
        </div>
        <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-[85px]">
          <SyncCard connection={connection} pendingCount={pending.count} />
          <InsightsCard total={stats.total} medianResponseDays={stats.medianResponseDays} />
        </div>
      </div>
    </div>
  );
}
