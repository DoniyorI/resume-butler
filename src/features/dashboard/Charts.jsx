"use client";

import { PieChart } from "@mui/x-charts/PieChart";
import { BarChart } from "@mui/x-charts/BarChart";
import { BRAND_COLOR } from "@/lib/constants";

export function StatusPieChart({ data }) {
  return (
    <div className="flex justify-center">
      <PieChart
        series={[
          {
            data,
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
  );
}

export function DailyApplicationsChart({ labels, counts }) {
  return (
    <div className="flex justify-center">
      <BarChart
        xAxis={[{ data: labels, scaleType: "band" }]}
        series={[{ data: counts, color: BRAND_COLOR }]}
        width={450}
        height={220}
      />
    </div>
  );
}
