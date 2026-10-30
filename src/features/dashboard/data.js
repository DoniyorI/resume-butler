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
// No reply after this long is worth a follow-up email
export const FOLLOW_UP_AFTER_DAYS = 14;
const FOLLOW_UP_LIMIT = 6;
const RECENT_LIMIT = 8;

// Applications still at "Applied" (never moved on) two weeks or more after
// applying, oldest first: the ones to nudge
function followUps(applications, historyByApp) {
  const now = Date.now();
  const waiting = applications
    .filter((app) => app.status === "Applied")
    .filter((app) => (historyByApp.get(app.id) || []).every((h) => h.status === "Applied"))
    .map((app) => {
      const applied = parseDate(app.applied_date);
      return (
        applied && {
          id: app.id,
          company: app.company || "Unknown company",
          role: app.role || "",
          daysWaiting: Math.floor((now - applied.getTime()) / DAY_MS),
        }
      );
    })
    .filter((app) => app && app.daysWaiting >= FOLLOW_UP_AFTER_DAYS)
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
  return { total: waiting.length, items: waiting.slice(0, FOLLOW_UP_LIMIT) };
}

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

// Summarize entry → recorded interview milestone → current outcome.
// Each application enters and exits once; repeated edits cannot create cycles.
export function buildFlow(applications, historyByApp = new Map()) {
  const known = new Set(APPLICATION_STATUSES);
  const edges = new Map();
  let unknownStarts = 0;
  const add = (source, target) => {
    const key = `${source}|${target}`;
    const edge = edges.get(key) || { source, target, value: 0 };
    edge.value++;
    edges.set(key, edge);
  };
  for (const app of applications) {
    const history = [...(historyByApp.get(app.id) || [])]
      .filter((row) => typeof row.changed_at === "string" && Number.isFinite(Date.parse(row.changed_at)))
      .sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at));
    const first = history.length ? history[0].status : app.status;
    const start = first === "Applied" || first === "Reached Out" ? first : "unknown";
    if (start === "unknown") unknownStarts++;
    const current = known.has(app.status) ? app.status : "unknown";
    const outcome = current === "Reached Out" ? "Applied" : current;
    const source = `entry:${start}`,
      target = `outcome:${outcome}`;
    if (current === "Interviewed" || history.some((row) => row.status === "Interviewed")) {
      add(source, "milestone:Interviewed");
      add("milestone:Interviewed", target);
    } else {
      add(source, target);
    }
  }
  const definitions = [
    { id: "entry:Applied", name: "Applied", kind: "entry", status: "Applied" },
    { id: "entry:Reached Out", name: "Reached Out", kind: "entry", status: "Reached Out" },
    { id: "entry:unknown", name: "Unknown start", kind: "entry" },
    { id: "milestone:Interviewed", name: "Interviewed", kind: "milestone", status: "Interviewed" },
    { id: "outcome:Applied", name: "Awaiting response", kind: "outcome", status: "Applied" },
    { id: "outcome:Pending", name: "Pending", kind: "outcome", status: "Pending" },
    { id: "outcome:Interviewed", name: "Still interviewing", kind: "outcome", status: "Interviewed" },
    { id: "outcome:Offered", name: "Offered", kind: "outcome", status: "Offered" },
    { id: "outcome:Rejected", name: "Rejected", kind: "outcome", status: "Rejected" },
    { id: "outcome:Withdrew", name: "Withdrew", kind: "outcome", status: "Withdrew" },
    { id: "outcome:unknown", name: "Unknown status", kind: "outcome" },
  ];
  const used = new Set([...edges.values()].flatMap((edge) => [edge.source, edge.target]));
  const nodes = definitions.filter((node) => used.has(node.id));
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  return {
    total: applications.length,
    unknownStarts,
    nodes,
    links: [...edges.values()].map((edge) => ({
      source: index.get(edge.source),
      target: index.get(edge.target),
      value: edge.value,
    })),
  };
}

function dailyCounts(applications) {
  const perDay = {};
  for (const app of applications) {
    if (app.applied_date) perDay[app.applied_date] = (perDay[app.applied_date] || 0) + 1;
  }
  const days = Object.keys(perDay).sort();
  // [{ date: "YYYY-MM-DD", count }]; the chart and the goal pick their own range
  return { series: days.map((day) => ({ date: day, count: perDay[day] })) };
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
        .select("id, company, role, status, applied_date")
        .eq("user_id", userId)
        .order("applied_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
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
    followUps: followUps(applications, historyByApp),
    // Newest first (the query's order), for the dashboard's mini table
    recent: applications.slice(0, RECENT_LIMIT).map((app) => ({
      id: app.id,
      company: app.company || "Unknown company",
      role: app.role || "",
      status: app.status,
      appliedDate: app.applied_date,
    })),
  };
}

// The user's first name and application goal ({ period: "day" | "week",
// target } or null). The goal columns come from migration 007; without them
// the dashboard just shows no goal.
export async function getGoalAndName(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, goal_period, goal_target")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("Could not load the goal:", error.message);
    return { firstName: "", goal: null };
  }
  return {
    firstName: data?.first_name || "",
    goal:
      data?.goal_period && data?.goal_target ? { period: data.goal_period, target: data.goal_target } : null,
  };
}
