import "server-only";
import { jobDetailColumns } from "@/lib/jobDetails";
import { parseSalaryText } from "@/lib/salary";
import { HttpError } from "@/server/http";
import { insertApplication } from "@/server/applications/insertApplication";

const PAGE = 1000;
const MAX_EXISTING = 20_000;
const CONCURRENCY = 8;
const COMMIT_BUDGET_MS = 40_000;
const UNDO_CHUNK = 100;
const MAX_UNDO = 500;
const UNDO_WINDOW_MS = 60 * 60 * 1000;
const UNIQUE_VIOLATION = "23505";

/** Company, role, date and link of every application the user has, for spotting duplicates. */
export async function loadExistingForImport(supabase, userId) {
  const existing = [];
  for (let from = 0; from < MAX_EXISTING; from += PAGE) {
    const { data, error } = await supabase
      .from("applications")
      .select("company, role, applied_date, portal_link")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data || [])
      existing.push({ company: row.company, role: row.role, appliedDate: row.applied_date, link: row.portal_link });
    if (!data || data.length < PAGE) break;
  }
  return existing;
}

// The same fields and job details a manual add passes, from one planned row
function insertArgs(row) {
  return [
    {
      company: row.company,
      role: row.role,
      location: row.location,
      portal_link: row.link,
      status: row.status,
      comments: row.notes,
      applied_date: row.appliedDate,
      job_description: "",
      resume_id: null,
      cover_letter_id: null,
    },
    jobDetailColumns({
      salary: parseSalaryText(row.pay),
      employmentType: row.employmentType,
      workplaceType: row.workplace,
      location: "",
      description: "",
    }),
  ];
}

/**
 * Insert every ready row of a plan. A row that fails does not stop the others.
 * No new batch starts once `budgetMs` has passed; `notAttempted` counts the
 * ready rows left untried (importing the file again skips the ones added).
 */
export async function commitImport(supabase, userId, plan, { now = Date.now, budgetMs = COMMIT_BUDGET_MS } = {}) {
  const ready = plan.rows.filter((row) => row.outcome === "ready");
  const result = { imported: 0, failed: 0, duplicates: 0, notAttempted: 0, ids: [] };
  const started = now();
  for (let i = 0; i < ready.length; i += CONCURRENCY) {
    if (now() - started >= budgetMs) {
      result.notAttempted = ready.length - i;
      break;
    }
    const outcomes = await Promise.all(
      ready.slice(i, i + CONCURRENCY).map(async (row) => {
        try {
          return { id: (await insertApplication(supabase, userId, ...insertArgs(row))).id };
        } catch (error) {
          return { code: error?.code || "unknown" };
        }
      })
    );
    for (const outcome of outcomes) {
      if (outcome.id) {
        result.imported++;
        result.ids.push(outcome.id);
      } else if (outcome.code === UNIQUE_VIOLATION) result.duplicates++;
      else {
        result.failed++;
        console.error("importApplications row failed:", outcome.code);
      }
    }
  }
  return result;
}

/** Remove applications a recent import created. Only the user's own, and only from the last hour. */
export async function undoImport(supabase, userId, ids) {
  if (!Array.isArray(ids) || ids.length > MAX_UNDO) throw new HttpError(400, "Too many applications to undo at once");
  const since = new Date(Date.now() - UNDO_WINDOW_MS).toISOString();
  let removed = 0;
  for (let i = 0; i < ids.length; i += UNDO_CHUNK) {
    const { data, error } = await supabase
      .from("applications")
      .delete()
      .in("id", ids.slice(i, i + UNDO_CHUNK))
      .eq("user_id", userId)
      .gte("created_at", since)
      .select("id");
    if (error) throw error;
    removed += data?.length ?? 0;
  }
  return removed;
}
