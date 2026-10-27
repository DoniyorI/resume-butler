import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/server/auth";
import { getConnection } from "@/server/email/connection";
import { getDashboardStats, getGoalAndName } from "@/features/dashboard/data";
import FollowUps from "@/features/dashboard/FollowUps";
import GoalCard from "@/features/dashboard/GoalCard";
import RecentApplications from "@/features/dashboard/RecentApplications";
import SyncCard from "@/features/dashboard/SyncCard";
import SectionCards from "@/features/dashboard/SectionCards";
import {
  ApplicationFlow,
  ApplicationsOverTime,
  Pipeline,
  StatusBreakdown,
} from "@/features/dashboard/LazyCharts";
import { toConnection } from "@/features/email-sync/data";
import { getPendingSummary } from "@/features/suggestions/data";

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

// The home page: today's to-dos first (goal, email updates, follow-ups),
// then the newest applications, then the trends
export default async function DashboardPage() {
  const { supabase, user } = await requirePageUser();
  const [stats, { firstName, goal }, connection, pending] = await Promise.all([
    getDashboardStats(supabase, user.id),
    getGoalAndName(supabase, user.id),
    loadConnection(supabase, user.id),
    getPendingSummary(supabase, user.id),
  ]);

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <GoalCard goal={goal} series={stats.daily.series} />
        <SyncCard connection={connection} pendingCount={pending.count} />
        <FollowUps followUps={stats.followUps} className="md:col-span-2 xl:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <RecentApplications items={stats.recent} total={stats.total} className="xl:col-span-2" />
        <Pipeline funnel={stats.funnel} total={stats.total} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ApplicationsOverTime series={stats.daily.series} />
        </div>
        <StatusBreakdown pie={stats.pie} total={stats.total} />
      </div>

      <ApplicationFlow flow={stats.flow} />
    </div>
  );
}
