"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Layer,
  Pie,
  PieChart,
  Rectangle,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BRAND_COLOR, STATUS_COLORS } from "@/lib/constants";
import { parseDate } from "@/lib/dates";
import {
  applicationsChartConfig,
  statusChartConfig,
  statusKey,
} from "@/features/dashboard/next/statusChartConfig";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All" },
];

function EmptyState({ children = "No applications yet" }) {
  return <p className="py-16 text-center text-sm text-muted-foreground">{children}</p>;
}

const shortDate = (iso) =>
  parseDate(iso)?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? iso;

function toIso(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

// One point per day across the range, including days with no applications
function fillDays(series, range) {
  if (series.length === 0) return [];
  const counts = new Map(series.map((point) => [point.date, point.count]));
  const end = new Date();
  const start =
    range === "all" ? parseDate(series[0].date) : new Date(end.getTime() - (Number(range) - 1) * DAY_MS);
  const days = [];
  for (let day = new Date(start); day <= end; day = new Date(day.getTime() + DAY_MS)) {
    const date = toIso(day);
    days.push({ date, count: counts.get(date) ?? 0 });
  }
  return days;
}

// Applications per day, with a range switcher (shadcn's interactive area chart)
export function ApplicationsOverTime({ series }) {
  const [range, setRange] = useState("30");
  const data = useMemo(() => fillDays(series, range), [series, range]);
  const total = data.reduce((sum, day) => sum + day.count, 0);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="text-lg">Applications over time</CardTitle>
          <CardDescription>
            {total} {total === 1 ? "application" : "applications"}
            {range === "all" ? " in total" : ` in the last ${range} days`}
          </CardDescription>
        </div>
        <Tabs value={range} onValueChange={setRange}>
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r.value} value={r.value} className="text-xs">
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer config={applicationsChartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={data} margin={{ left: 0, right: 12 }}>
              <defs>
                <linearGradient id="fillApplications" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={shortDate}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => shortDate(payload?.[0]?.payload?.date)}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="count"
                type="monotone"
                fill="url(#fillApplications)"
                stroke="var(--color-count)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// Current status of every application, as a donut with the total in the middle
export function StatusBreakdown({ pie, total }) {
  const data = pie.map((slice) => ({
    status: statusKey(slice.label),
    count: slice.value,
    fill: `var(--color-${statusKey(slice.label)})`,
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Status breakdown</CardTitle>
        <CardDescription>Where every application stands today</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer config={statusChartConfig} className="mx-auto aspect-square max-h-[300px]">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="status" hideLabel />} />
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                innerRadius={65}
                strokeWidth={4}
                stroke="hsl(var(--background))"
              >
                <Label
                  content={({ viewBox }) =>
                    viewBox && "cx" in viewBox ? (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                          {total}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 22} className="fill-muted-foreground">
                          Applications
                        </tspan>
                      </text>
                    ) : null
                  }
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="status" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// Single-line value label to the right of a bar (recharts' default wraps to the bar width)
function BarValueLabel({ x, y, width, height, value }) {
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      dominantBaseline="middle"
      fontSize={12}
      className="fill-foreground"
    >
      {value}
    </text>
  );
}

// Applied → Reached Out → Interviewed → Offered, as horizontal bars with conversion
export function Pipeline({ funnel, total }) {
  const data = funnel.map((stage) => ({
    stage: stage.label,
    count: stage.count,
    label: stage.label === "Applied" ? `${stage.count}` : `${stage.count} · ${stage.percent}%`,
    fill: STATUS_COLORS[stage.label],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pipeline</CardTitle>
        <CardDescription>How far your applications get, out of everything you applied to</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer config={statusChartConfig} className="aspect-auto h-[220px] w-full">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 64 }}>
              <YAxis
                dataKey="stage"
                type="category"
                tickLine={false}
                axisLine={false}
                width={88}
                tickMargin={4}
              />
              <XAxis type="number" hide domain={[0, Math.max(total, 1)]} />
              <Bar dataKey="count" radius={6} barSize={28}>
                {data.map((entry) => (
                  <Cell key={entry.stage} fill={entry.fill} />
                ))}
                <LabelList dataKey="label" content={BarValueLabel} />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const FLOW_MARGIN = { top: 12, bottom: 12, left: 8, right: 8 };

function FlowNode({ x, y, width, height, payload }) {
  // First-column nodes are labelled on their right, every other node on its left,
  // so labels stay inside the chart
  const isRight = x > FLOW_MARGIN.left + 1;
  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={3}
        fill={STATUS_COLORS[payload.name] || BRAND_COLOR}
        fillOpacity={1}
      />
      <text
        x={isRight ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={isRight ? "end" : "start"}
        dominantBaseline="middle"
        fontSize={12}
        className="fill-foreground"
      >
        {payload.name}
        <tspan className="fill-muted-foreground"> ({payload.value})</tspan>
      </text>
    </Layer>
  );
}

function FlowLink({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  payload,
}) {
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={STATUS_COLORS[payload.source.name] || BRAND_COLOR}
      strokeOpacity={0.45}
      strokeWidth={Math.max(1, linkWidth)}
    />
  );
}

function FlowTooltip({ active, payload }) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  const text = item.source ? `${item.source.name} → ${item.target.name}` : item.name;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="text-muted-foreground">{text}</span>{" "}
      <span className="font-mono font-medium tabular-nums">{item.value}</span>
    </div>
  );
}

// Only statuses that appear in a move; recharts would draw the rest as stray zero-height nodes
function linkedFlow(flow) {
  const used = [...new Set(flow.links.flatMap((link) => [link.source, link.target]))].sort((a, b) => a - b);
  const newIndex = new Map(used.map((oldIndex, i) => [oldIndex, i]));
  return {
    nodes: used.map((i) => flow.nodes[i]),
    links: flow.links.map((link) => ({
      ...link,
      source: newIndex.get(link.source),
      target: newIndex.get(link.target),
    })),
  };
}

// How applications moved between statuses (from the status history)
export function ApplicationFlow({ flow }) {
  const data = useMemo(() => linkedFlow(flow), [flow]);
  const hasFlow = data.links.length > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Application flow</CardTitle>
        <CardDescription>How your applications moved between statuses</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasFlow ? (
          <EmptyState>No status changes yet</EmptyState>
        ) : (
          <ChartContainer config={statusChartConfig} className="aspect-auto h-[300px] w-full">
            <Sankey
              data={data}
              node={<FlowNode />}
              link={<FlowLink />}
              nodePadding={28}
              nodeWidth={12}
              margin={FLOW_MARGIN}
            >
              <Tooltip content={<FlowTooltip />} />
            </Sankey>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
