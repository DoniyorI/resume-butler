import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requirePageUser } from "@/server/auth";
import { APPLICATION_STATUSES, DEFAULT_STATUS } from "@/lib/constants";
import { formatShortDate } from "@/lib/dates";
import { APPLICATIONS_PAGE_SIZE, hasActiveFilters } from "@/features/applications/listParams";

const LIST_COLUMNS = "id, company, role, status, location, applied_date, comments, portal_link";
const SEARCH_COLUMNS = ["company", "role", "location"];

function toListItem(row) {
  return {
    id: row.id,
    companyName: row.company || "",
    role: row.role || "",
    status: row.status || DEFAULT_STATUS,
    location: row.location || "",
    appliedDate: row.applied_date || "",
    date: formatShortDate(row.applied_date),
    comments: row.comments || "",
    portalLink: row.portal_link || "",
  };
}

// An or=(...) filter matching the text anywhere in company, role or location.
// %, _ and \ are escaped for LIKE, then the value is double-quoted (escaping
// " and \) so commas and parentheses can't end the PostgREST filter early.
function searchFilter(text) {
  const pattern = `%${text.replace(/[\\%_]/g, "\\$&")}%`;
  const quoted = `"${pattern.replace(/["\\]/g, "\\$&")}"`;
  return SEARCH_COLUMNS.map((column) => `${column}.ilike.${quoted}`).join(",");
}

// The user's rows narrowed by the list filters. The status counts pass
// withStatus: false so each count ignores the status filter itself.
function filtered(query, userId, params, { withStatus = true } = {}) {
  let result = query.eq("user_id", userId);
  if (params.q) result = result.or(searchFilter(params.q));
  if (params.from) result = result.gte("applied_date", params.from);
  if (params.to) result = result.lte("applied_date", params.to);
  if (withStatus && params.statuses.length) result = result.in("status", params.statuses);
  return result;
}

const countOnly = (supabase) => supabase.from("applications").select("id", { count: "exact", head: true });

// One page of the user's applications for the parsed list params (see
// listParams.js), with the filtered total, the unfiltered total and a count
// per status. Every query is scoped by user_id and runs in parallel.
export async function getApplicationsPage(supabase, userId, params) {
  const from = (params.page - 1) * APPLICATIONS_PAGE_SIZE;
  const to = from + APPLICATIONS_PAGE_SIZE - 1;
  const ascending = params.sort.dir === "asc";

  let listQuery = filtered(supabase.from("applications").select(LIST_COLUMNS), userId, params).order(
    params.sort.field,
    { ascending, nullsFirst: false }
  );
  if (params.sort.field !== "applied_date") {
    listQuery = listQuery.order("applied_date", { ascending: false, nullsFirst: false });
  }
  listQuery = listQuery.order("created_at", { ascending: false }).order("id").range(from, to);

  // The total comes from a separate head count: asking the ranged query for a
  // count makes PostgREST fail with 416 when the page is past the end.
  const [countRes, listRes, allRes, ...statusRes] = await Promise.all([
    filtered(countOnly(supabase), userId, params),
    listQuery,
    hasActiveFilters(params) ? countOnly(supabase).eq("user_id", userId) : null,
    ...APPLICATION_STATUSES.map((status) =>
      filtered(countOnly(supabase), userId, params, { withStatus: false }).eq("status", status)
    ),
  ]);

  for (const res of [countRes, listRes, allRes, ...statusRes]) {
    if (res?.error) throw res.error;
  }

  const total = countRes.count || 0;
  return {
    applications: (listRes.data || []).map(toListItem),
    total,
    allTotal: allRes ? allRes.count || 0 : total,
    statusCounts: Object.fromEntries(
      APPLICATION_STATUSES.map((status, i) => [status, statusRes[i].count || 0])
    ),
  };
}

function toDetail(row) {
  return {
    id: row.id,
    company: row.company || "",
    role: row.role || "",
    location: row.location || "",
    portalLink: row.portal_link || "",
    status: row.status || DEFAULT_STATUS,
    comments: row.comments || "",
    jobDescription: row.job_description || "",
    appliedDate: row.applied_date || "",
    resumeId: row.resume_id || null,
    coverLetterId: row.cover_letter_id || null,
  };
}

// The application, its status history and the linked resume's content, or
// null when the row doesn't exist or isn't the user's. cache() lets the page
// and generateMetadata share one fetch per request.
export const getApplicationDetail = cache(async (id) => {
  if (!z.string().uuid().safeParse(id).success) return null;

  const { supabase, user } = await requirePageUser();

  const { data: row, error } = await supabase
    .from("applications")
    .select(
      "id, company, role, location, portal_link, status, comments, job_description, applied_date, resume_id, cover_letter_id"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const [historyRes, resumeRes] = await Promise.all([
    supabase
      .from("application_status_history")
      .select("id, status, changed_at")
      .eq("application_id", id)
      .order("changed_at", { ascending: true }),
    row.resume_id
      ? supabase
          .from("resumes")
          .select("content")
          .eq("id", row.resume_id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (historyRes.error) throw historyRes.error;

  return {
    application: toDetail(row),
    statusHistory: (historyRes.data || []).map((entry) => ({
      id: entry.id,
      status: entry.status,
      changedAt: entry.changed_at,
    })),
    resumeContent: resumeRes.data?.content || null,
  };
});
