"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Recharts measures the DOM, so the charts render in the browser only
const cardSkeleton = (height) =>
  function ChartCardSkeleton() {
    return <Skeleton className="w-full rounded-xl" style={{ height }} />;
  };

const load = (name, height) =>
  dynamic(() => import("@/features/dashboard/Charts").then((mod) => mod[name]), {
    ssr: false,
    loading: cardSkeleton(height),
  });

export const ApplicationsOverTime = load("ApplicationsOverTime", 420);
export const StatusBreakdown = load("StatusBreakdown", 420);
export const Pipeline = load("Pipeline", 330);
export const ApplicationFlow = load("ApplicationFlow", 480);
