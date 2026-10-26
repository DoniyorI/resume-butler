import { requirePageUser } from "@/server/auth";
import { getDashboardStats } from "@/features/dashboard/data";
import DashboardSwitch from "@/features/dashboard/DashboardSwitch";
import FollowUps from "@/features/dashboard/FollowUps";
import SectionCards from "@/features/dashboard/next/SectionCards";
import {
  ApplicationFlow,
  ApplicationsOverTime,
  Pipeline,
  StatusBreakdown,
} from "@/features/dashboard/next/LazyCharts";

export const metadata = { title: "Dashboard (new)" };

// shadcn-based dashboard, kept beside the classic /dash for comparison
export default async function NewDashboardPage() {
  const { supabase, user } = await requirePageUser();
  const stats = await getDashboardStats(supabase, user.id);

  return (
    <div className="flex min-h-screen w-full flex-col gap-4 px-5 pb-10 pt-24 md:gap-6 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand">Dashboard</h1>
          <p className="text-sm text-muted-foreground">How your job search is going</p>
        </div>
        <DashboardSwitch current="/dash/new" />
      </div>

      <SectionCards stats={stats} />

      <ApplicationsOverTime series={stats.daily.series} />

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <StatusBreakdown pie={stats.pie} total={stats.total} />
        <Pipeline funnel={stats.funnel} total={stats.total} />
      </div>

      <FollowUps followUps={stats.followUps} />

      <ApplicationFlow flow={stats.flow} />
    </div>
  );
}
