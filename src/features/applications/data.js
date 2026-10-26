import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requirePageUser } from "@/server/auth";
import { DEFAULT_STATUS } from "@/lib/constants";
import { parseDate } from "@/lib/dates";

export const APPLICATIONS_PAGE_SIZE = 50;

const LIST_COLUMNS = "id, company, role, status, location, applied_date, comments, portal_link";

function toListItem(row) {
  return {
    id: row.id,
    companyName: row.company || "",
    role: row.role || "",
    status: row.status || DEFAULT_STATUS,
    location: row.location || "",
    appliedDate: row.applied_date || "",
    date: parseDate(row.applied_date)?.toLocaleDateString("en-US") || "",
    comments: row.comments || "",
    portalLink: row.portal_link || "",
  };
}

// One page of the user's applications, newest first, plus the total count
export async function getApplicationsPage(supabase, userId, pageIndex) {
  const from = pageIndex * APPLICATIONS_PAGE_SIZE;
  const to = from + APPLICATIONS_PAGE_SIZE - 1;

  const [countRes, listRes] = await Promise.all([
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("applications")
      .select(LIST_COLUMNS)
      .eq("user_id", userId)
      .order("applied_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to),
  ]);

  if (countRes.error) throw countRes.error;
  if (listRes.error) throw listRes.error;

  return {
    applications: (listRes.data || []).map(toListItem),
    total: countRes.count || 0,
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
