"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PieChart } from "@mui/x-charts/PieChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  TrendingUp,
  Target,
  Clock,
  ArrowRight,
} from "lucide-react";
import SankeyDiagram from "@/components/SankeyDiagram";

const STATUS_COLORS = {
  applied: "#B5DCF2",
  interviewed: "#F3F5A3",
  pending: "#FFFACD",
  rejected: "#F2B5B5",
  offered: "#D8F1AE",
  withdrew: "#D0B5F2",
};

export default function DashboardPage() {
  const { user, loading, supabase } = useAuth({ redirect: true });
  const [applications, setApplications] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchData = async () => {
      const [appsRes, historyRes] = await Promise.all([
        supabase
          .from("applications")
          .select("*")
          .eq("user_id", user.id)
          .order("applied_date", { ascending: false }),
        supabase
          .from("application_status_history")
          .select("*, applications!inner(user_id)")
          .eq("applications.user_id", user.id)
          .order("changed_at", { ascending: true }),
      ]);

      setApplications(appsRes.data || []);
      setStatusHistory(historyRes.data || []);
      setDataLoading(false);
    };

    fetchData();
  }, [user, loading, supabase]);

  if (dataLoading || loading) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-32 px-5 md:pt-24 md:pb-10 md:px-10">
        <h1 className="text-2xl font-semibold text-[#559F87]">Dashboard</h1>
        <p className="text-gray-400 mt-4">Loading...</p>
      </div>
    );
  }

  const total = applications.length;

  // --- Stats ---
  const statusCounts = { Applied: 0, Interviewed: 0, Pending: 0, Rejected: 0, Offered: 0, Withdrew: 0 };
  applications.forEach((app) => {
    if (statusCounts[app.status] !== undefined) statusCounts[app.status]++;
  });

  const responseRate = total > 0
    ? Math.round(((statusCounts.Interviewed + statusCounts.Offered) / total) * 100)
    : 0;

  const offerRate = total > 0
    ? Math.round((statusCounts.Offered / total) * 100)
    : 0;

  // Applications this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const thisWeek = applications.filter(
    (app) => app.applied_date && new Date(app.applied_date) >= oneWeekAgo
  ).length;

  // Average time to response (applied → interviewed)
  let avgResponseDays = null;
  const responseTimes = [];
  applications.forEach((app) => {
    if (!app.applied_date) return;
    const history = statusHistory.filter((h) => h.application_id === app.id);
    const interviewEntry = history.find((h) => h.status === "Interviewed");
    if (interviewEntry) {
      const days = Math.round(
        (new Date(interviewEntry.changed_at) - new Date(app.applied_date)) / (1000 * 60 * 60 * 24)
      );
      if (days >= 0) responseTimes.push(days);
    }
  });
  if (responseTimes.length > 0) {
    avgResponseDays = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
  }

  // --- Pie chart data ---
  const pieData = Object.entries(statusCounts)
    .filter(([_, v]) => v > 0)
    .map(([label, value]) => ({
      label,
      value,
      color: STATUS_COLORS[label.toLowerCase()],
    }));

  // --- Applications over time (daily) ---
  const dailyData = {};
  applications.forEach((app) => {
    if (!app.applied_date) return;
    dailyData[app.applied_date] = (dailyData[app.applied_date] || 0) + 1;
  });
  const sortedDays = Object.keys(dailyData).sort();
  const barYData = sortedDays.map((d) => dailyData[d]);

  // --- Funnel data ---
  const funnelStages = [
    { label: "Applied", count: total, color: "#B5DCF2" },
    { label: "Interviewed", count: statusCounts.Interviewed + statusCounts.Offered, color: "#F3F5A3" },
    { label: "Offered", count: statusCounts.Offered, color: "#D8F1AE" },
  ];

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 px-5 md:px-10 pb-10">
      <h1 className="text-2xl font-semibold text-[#559F87] mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Briefcase}
          label="Total Applications"
          value={total}
        />
        <StatCard
          icon={TrendingUp}
          label="Response Rate"
          value={`${responseRate}%`}
          sub={`${statusCounts.Interviewed + statusCounts.Offered} responses`}
        />
        <StatCard
          icon={Target}
          label="Offer Rate"
          value={`${offerRate}%`}
          sub={`${statusCounts.Offered} offers`}
        />
        <StatCard
          icon={Clock}
          label="Avg. Response Time"
          value={avgResponseDays !== null ? `${avgResponseDays}d` : "—"}
          sub={avgResponseDays !== null ? `${responseTimes.length} data points` : "No data yet"}
        />
      </div>

      {/* This week + funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#559F87]">{thisWeek}</div>
            <p className="text-sm text-gray-500 mt-1">applications submitted</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Application Funnel</CardTitle>
            <CardDescription>Conversion from applied to offered</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-around">
              {funnelStages.map((stage, i) => (
                <div key={stage.label} className="flex items-center">
                  <div className="text-center">
                    <div
                      className="text-2xl font-bold rounded-full w-16 h-16 flex items-center justify-center mx-auto"
                      style={{ backgroundColor: stage.color }}
                    >
                      {stage.count}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{stage.label}</p>
                    {i > 0 && total > 0 && (
                      <p className="text-xs text-gray-400">
                        {Math.round((stage.count / total) * 100)}%
                      </p>
                    )}
                  </div>
                  {i < funnelStages.length - 1 && (
                    <ArrowRight size={20} className="text-gray-300 mx-3" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex justify-center">
                <PieChart
                  series={[
                    {
                      data: pieData,
                      innerRadius: 30,
                      outerRadius: 100,
                      paddingAngle: 5,
                      cornerRadius: 5,
                      startAngle: -90,
                      endAngle: 270,
                      cx: 100,
                      cy: 120,
                    },
                  ]}
                  height={260}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-10">No applications yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications Per Day</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedDays.length > 0 ? (
              <div className="flex justify-center">
                <BarChart
                  xAxis={[
                    {
                      data: sortedDays.map((d) => {
                        const parts = d.split("-");
                        return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
                      }),
                      scaleType: "band",
                    },
                  ]}
                  series={[{ data: barYData, color: "#559F87" }]}
                  width={450}
                  height={220}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-10">No applications yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sankey flow diagram */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Application Flow</CardTitle>
          <CardDescription>How your applications move between statuses</CardDescription>
        </CardHeader>
        <CardContent>
          <SankeyDiagram applications={applications} statusHistory={statusHistory} />
        </CardContent>
      </Card>

      {/* Status breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="text-center p-3 rounded-lg bg-gray-50">
                <Badge variant={status.toLowerCase()} className="mb-2">
                  {status}
                </Badge>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-gray-400">
                  {total > 0 ? `${Math.round((count / total) * 100)}%` : "0%"}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50">
            <Icon size={18} className="text-[#559F87]" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
