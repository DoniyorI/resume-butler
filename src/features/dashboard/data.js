import "server-only";
import { APPLICATION_STATUSES, STATUS_COLORS } from "@/lib/constants";
import { parseDate } from "@/lib/dates";

const DAY_MS = 1000 * 60 * 60 * 24;

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function groupHistoryByApplication(statusHistory) {
  const byApp = new Map();
  for (const entry of statusHistory) {
    if (!byApp.has(entry.application_id)) byApp.set(entry.application_id, []);
    byApp.get(entry.application_id).push(entry);
  }
  return byApp;
}

// Statuses that mean an employer replied. "Reached Out" is a recruiter
// reaching out, so it counts as a reply too.
export const RESPONSE_STATUSES = ["Reached Out", "Interviewed", "Offered"];

// True when the current status or any status in the history is one of `statuses`
export function everHad(app, historyByApp, statuses) {
  const wanted = new Set(statuses);
  return wanted.has(app.status) || (historyByApp.get(app.id) || []).some((h) => wanted.has(h.status));
}

// Rates only count applications old enough to have had a reply
export const RESPONSE_WINDOW_DAYS = 14;

// Applied at least RESPONSE_WINDOW_DAYS ago (whole days, local calendar date)
export function isInResponseWindow(app, now = Date.now()) {
  const applied = parseDate(app.applied_date);
  return Boolean(applied) && Math.floor((now - applied.getTime()) / DAY_MS) >= RESPONSE_WINDOW_DAYS;
}

// Counts behind the response and offer rates. Both use the same applications:
// the ones applied RESPONSE_WINDOW_DAYS or more ago. A rate is null when there
// are none, so the card never shows a made-up 0%. A reply is the current status
// or any earlier one in the history (interviewed then rejected still heard back).
export function responseSummary(applications, historyByApp = new Map(), now = Date.now()) {
  const eligible = applications.filter((app) => isInResponseWindow(app, now));
  const responses = eligible.filter((app) => everHad(app, historyByApp, RESPONSE_STATUSES)).length;
  const offers = eligible.filter((app) => everHad(app, historyByApp, ["Offered"])).length;
  return {
    eligible: eligible.length,
    responses,
    responseRate: eligible.length ? percent(responses, eligible.length) : null,
    offers,
    offerRate: eligible.length ? percent(offers, eligible.length) : null,
  };
}

// Median of a list of numbers, or null when empty (even counts average the middle two)
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// No reply after this long is worth a follow-up email
export const FOLLOW_UP_AFTER_DAYS = 14;
const RECENT_LIMIT = 6;

// Applications still at "Applied" (never moved on) two weeks or more after
// applying, oldest first: the ones to nudge. Also the rule behind the
// dashboard's "Suggested next steps" (server/activities/suggest.js).
export function waitingOnReply(applications, historyByApp, now = Date.now()) {
  return applications
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
}

// Days from applying to the first reply (Reached Out, Interviewed or Offered
// entry in the history). Only for applications whose history shows them at
// "Applied" first: one added straight at a later status has a backdated apply
// date, and that gap is not a response time.
export function responseTimes(applications, historyByApp) {
  const times = [];
  for (const app of applications) {
    const applied = parseDate(app.applied_date);
    if (!applied) continue;
    const history = [...(historyByApp.get(app.id) || [])].sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at));
    if (history[0]?.status !== "Applied") continue;
    const reply = history.find((h) => RESPONSE_STATUSES.includes(h.status));
    if (!reply) continue;
    const days = Math.round((new Date(reply.changed_at) - applied) / DAY_MS);
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
    const outcome = current;
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
    { id: "outcome:Reached Out", name: "Employer reached out", kind: "outcome", status: "Reached Out" },
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

// Every application and status history row of the user. The dashboard loads
// them once and shares them between the stats and the suggested next steps.
// The Search report on /insights also needs the columns it groups by (`forReport`).
const REPORT_COLUMNS = ", source, source_site, workplace_type, resume_id";
export async function loadDashboardRows(supabase, userId, { forReport = false } = {}) {
  const [applications, history] = await Promise.all([
    fetchAll(() =>
      supabase
        .from("applications")
        .select(`id, company, role, status, applied_date${forReport ? REPORT_COLUMNS : ""}`)
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
  return { applications, history };
}

// Everything the dashboard shows, computed from the user's applications and
// history (pass loadDashboardRows' result to reuse rows already loaded)
export async function getDashboardStats(supabase, userId, rows) {
  const { applications, history } = rows || (await loadDashboardRows(supabase, userId));
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
  const medianResponseDays = median(times);
  const { eligible, responses, responseRate, offers, offerRate } = responseSummary(applications, historyByApp);

  return {
    total,
    statusCounts,
    responseRate,
    responses,
    responseEligible: eligible,
    offerRate,
    offers,
    thisWeek,
    medianResponseDays,
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
    daily: dailyCounts(applications),
    flow: buildFlow(applications, historyByApp),
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

// Resume titles for the search report ([] if they can't be read)
export async function loadResumeTitles(supabase, userId) {
  const { data, error } = await supabase.from("resumes").select("id, title").eq("user_id", userId);
  if (error) {
    console.warn("Could not load resume titles:", error.message);
    return [];
  }
  return data || [];
}
