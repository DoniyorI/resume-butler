import "server-only";
import { APPLICATION_STATUSES, STATUS_COLORS } from "@/lib/constants";
import { parseDate } from "@/lib/dates";

const DAY_MS = 1000 * 60 * 60 * 24;

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function groupHistoryByApplication(statusHistory) {
  const byApp = new Map();
  for (const entry of statusHistory) {
    if (!byApp.has(entry.application_id)) byApp.set(entry.application_id, []);
    byApp.get(entry.application_id).push(entry);
  }
  return byApp;
}

// Applied -> first "Interviewed" entry, in whole days
function responseTimes(applications, historyByApp) {
  const times = [];
  for (const app of applications) {
    const applied = parseDate(app.applied_date);
    if (!applied) continue;
    const interview = historyByApp.get(app.id)?.find((h) => h.status === "Interviewed");
    if (!interview) continue;
    const days = Math.round((new Date(interview.changed_at) - applied) / DAY_MS);
    if (days >= 0) times.push(days);
  }
  return times;
}

// Nodes and links for the Sankey chart: status-to-status transitions from the
// history, or Applied -> current status when nothing has moved yet.
function buildFlow(applications, historyByApp) {
  const transitions = {};
  for (const history of historyByApp.values()) {
    const sorted = [...history].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i].status;
      const to = sorted[i + 1].status;
      if (from === to) continue;
      const key = `${from}→${to}`;
      transitions[key] = (transitions[key] || 0) + 1;
    }
  }

  const currentCounts = {};
  for (const app of applications) {
    currentCounts[app.status] = (currentCounts[app.status] || 0) + 1;
  }

  const active = new Set(Object.keys(currentCounts));
  for (const key of Object.keys(transitions)) {
    const [from, to] = key.split("→");
    active.add(from);
    active.add(to);
  }

  const nodes = APPLICATION_STATUSES.filter((status) => active.has(status)).map((name) => ({
    name,
  }));
  const index = Object.fromEntries(nodes.map((node, i) => [node.name, i]));

  // Nodes follow APPLICATION_STATUSES order. Keeping only forward links keeps the
  // graph acyclic: d3-sankey throws on cycles, e.g. when a status is moved back.
  const links = [];
  if (Object.keys(transitions).length > 0) {
    for (const [key, value] of Object.entries(transitions)) {
      const [from, to] = key.split("→");
      if (index[from] !== undefined && index[to] !== undefined && index[from] < index[to]) {
        links.push({ source: index[from], target: index[to], value });
      }
    }
  } else if (index.Applied !== undefined) {
    for (const [status, count] of Object.entries(currentCounts)) {
      if (status !== "Applied" && index[status] !== undefined) {
        links.push({ source: index.Applied, target: index[status], value: count });
      }
    }
  }

  return { nodes, links };
}

function dailyCounts(applications) {
  const perDay = {};
  for (const app of applications) {
    if (app.applied_date) perDay[app.applied_date] = (perDay[app.applied_date] || 0) + 1;
  }
  const days = Object.keys(perDay).sort();
  return {
    labels: days.map((day) => {
      const [, month, date] = day.split("-");
      return `${Number(month)}/${Number(date)}`;
    }),
    counts: days.map((day) => perDay[day]),
    // [{ date: "YYYY-MM-DD", count }] for charts that pick their own range
    series: days.map((day) => ({ date: day, count: perDay[day] })),
  };
}

// Supabase returns at most 1,000 rows per request, so page through with range()
// to compute stats from every row
const PAGE_SIZE = 1000;

async function fetchAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Everything the dashboard shows, computed from the user's applications and history
export async function getDashboardStats(supabase, userId) {
  const [applications, history] = await Promise.all([
    fetchAll(() =>
      supabase
        .from("applications")
        .select("id, status, applied_date")
        .eq("user_id", userId)
        .order("applied_date", { ascending: false })
        .order("id")
    ),
    fetchAll(() =>
      supabase
        .from("application_status_history")
        .select("application_id, status, changed_at, applications!inner(user_id)")
        .eq("applications.user_id", userId)
        .order("changed_at", { ascending: true })
        .order("id")
    ),
  ]);

  const historyByApp = groupHistoryByApplication(history);
  const total = applications.length;

  const statusCounts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0]));
  for (const app of applications) {
    if (statusCounts[app.status] !== undefined) statusCounts[app.status]++;
  }

  const oneWeekAgo = new Date(Date.now() - 7 * DAY_MS);
  const thisWeek = applications.filter((app) => {
    const applied = parseDate(app.applied_date);
    return applied && applied >= oneWeekAgo;
  }).length;

  const times = responseTimes(applications, historyByApp);
  const avgResponseDays =
    times.length > 0 ? Math.round(times.reduce((sum, days) => sum + days, 0) / times.length) : null;

  return {
    total,
    statusCounts,
    statusPercents: Object.fromEntries(
      Object.entries(statusCounts).map(([status, count]) => [status, percent(count, total)])
    ),
    responseRate: percent(
      statusCounts.Interviewed + statusCounts.Offered + statusCounts["Reached Out"],
      total
    ),
    responses: statusCounts.Interviewed + statusCounts.Offered,
    offerRate: percent(statusCounts.Offered, total),
    thisWeek,
    avgResponseDays,
    responseTimeSamples: times.length,
    funnel: [
      { label: "Applied", count: total, color: STATUS_COLORS.Applied },
      {
        label: "Reached Out",
        count: statusCounts["Reached Out"],
        color: STATUS_COLORS["Reached Out"],
      },
      {
        label: "Interviewed",
        count: statusCounts.Interviewed + statusCounts.Offered,
        color: STATUS_COLORS.Interviewed,
      },
      { label: "Offered", count: statusCounts.Offered, color: STATUS_COLORS.Offered },
    ].map((stage) => ({ ...stage, percent: percent(stage.count, total) })),
    pie: Object.entries(statusCounts)
      .filter(([, count]) => count > 0)
      .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] })),
    daily: dailyCounts(applications),
    flow: buildFlow(applications, historyByApp),
  };
}
