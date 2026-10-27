import { APPLICATION_STATUSES, BRAND_COLOR, STATUS_COLORS } from "@/lib/constants";

// Chart config keys become CSS variables (--color-<key>), so statuses like
// "Reached Out" need an identifier-safe key
export const statusKey = (status) => status.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Status colors match the status badges everywhere else in the app
export const statusChartConfig = Object.fromEntries(
  APPLICATION_STATUSES.map((status) => [statusKey(status), { label: status, color: STATUS_COLORS[status] }])
);

export const applicationsChartConfig = {
  count: { label: "Applications", color: BRAND_COLOR },
};

// Darker stroke for pale status fills on white backgrounds
export const CHART_STROKE = "hsl(var(--border))";
