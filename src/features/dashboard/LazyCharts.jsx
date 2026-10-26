"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// The chart libraries measure the DOM, so they only render in the browser
const chartSkeleton = (height) =>
  function ChartSkeleton() {
    return <Skeleton className="w-full" style={{ height }} />;
  };

export const StatusPieChart = dynamic(
  () => import("@/features/dashboard/Charts").then((mod) => mod.StatusPieChart),
  { ssr: false, loading: chartSkeleton(260) }
);

export const DailyApplicationsChart = dynamic(
  () => import("@/features/dashboard/Charts").then((mod) => mod.DailyApplicationsChart),
  { ssr: false, loading: chartSkeleton(220) }
);

export const SankeyDiagram = dynamic(() => import("@/features/dashboard/SankeyDiagram"), {
  ssr: false,
  loading: chartSkeleton(250),
});
