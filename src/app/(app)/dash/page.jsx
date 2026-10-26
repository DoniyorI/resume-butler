import { Briefcase, Clock, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser } from "@/server/auth";
import { getDashboardStats } from "@/features/dashboard/data";
import StatCard from "@/features/dashboard/StatCard";
import ApplicationFunnel from "@/features/dashboard/ApplicationFunnel";
import StatusSummary from "@/features/dashboard/StatusSummary";
import ChartCard, { EmptyChart } from "@/features/dashboard/ChartCard";
import {
  DailyApplicationsChart,
  SankeyDiagram,
  StatusPieChart,
} from "@/features/dashboard/LazyCharts";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, user } = await requirePageUser();
  const stats = await getDashboardStats(supabase, user.id);
  const hasResponseTime = stats.avgResponseDays !== null;

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 px-5 md:px-10 pb-10">
      <h1 className="text-2xl font-semibold text-brand mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Briefcase} label="Total Applications" value={stats.total} />
        <StatCard
          icon={TrendingUp}
          label="Response Rate"
          value={`${stats.responseRate}%`}
          sub={`${stats.responses} responses`}
        />
        <StatCard
          icon={Target}
          label="Offer Rate"
          value={`${stats.offerRate}%`}
          sub={`${stats.statusCounts.Offered} offers`}
        />
        <StatCard
          icon={Clock}
          label="Avg. Response Time"
          value={hasResponseTime ? `${stats.avgResponseDays}d` : "—"}
          sub={hasResponseTime ? `${stats.responseTimeSamples} data points` : "No data yet"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-brand">{stats.thisWeek}</div>
            <p className="text-sm text-gray-500 mt-1">applications submitted</p>
          </CardContent>
        </Card>
        <ApplicationFunnel stages={stats.funnel} total={stats.total} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Status Breakdown">
          {stats.pie.length > 0 ? <StatusPieChart data={stats.pie} /> : <EmptyChart />}
        </ChartCard>
        <ChartCard title="Applications Per Day">
          {stats.daily.labels.length > 0 ? (
            <DailyApplicationsChart labels={stats.daily.labels} counts={stats.daily.counts} />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Application Flow"
        description="How your applications move between statuses"
        className="mb-6"
      >
        {stats.total > 0 ? (
          <SankeyDiagram nodes={stats.flow.nodes} links={stats.flow.links} />
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <StatusSummary counts={stats.statusCounts} percents={stats.statusPercents} />
    </div>
  );
}
