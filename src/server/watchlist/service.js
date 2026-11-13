import "server-only";
import { z } from "zod";
import { parseInput } from "@/server/actionResult";
import { HttpError } from "@/server/http";
import { normalizePostingIdentity } from "@/lib/postingIdentity";
import { fetchBoard as fetchBoardFromWeb, parseBoardLink, postingUrl } from "@/server/watchlist/boards";
import { opportunityInput, saveOpportunity } from "@/server/opportunities/service";

// The watchlist (migration 021). Every query is scoped by user_id, including
// the ones run with the service-role client by the daily job. The composite
// foreign key (company_id, user_id) also stops a posting pointing at another
// user's company, and triggers cap each user at 20 companies and 2,500
// postings. Until the migration is applied, reads return setupPending and
// writes a 503.

const SETUP_CODES = ["42P01", "PGRST205", "PGRST200", "PGRST204", "42703", "PGRST202", "42883"];
const SETUP_MESSAGE = "Watchlist needs migration 021.";
export const MAX_COMPANIES = 20;
export const MAX_KEYWORDS = 12;
export const MAX_OPEN_PER_COMPANY = 100;
export const LIST_LIMIT = 300;
const CLOSED_KEEP_DAYS = 30;
const MIN_INTERVAL_MS = 10 * 60_000;
const FORCED_MIN_INTERVAL_MS = 60_000;
const DAY_MS = 86_400_000;

const COMPANY_COLUMNS = "id,platform,board_token,name,title_keywords,last_checked_at,last_error,open_count,created_at";
// The stored url column is never read: users can insert rows directly, so links are rebuilt from the company and posting id
const POSTING_COLUMNS =
  "id,company_id,posting_id,title,location,description,workplace_type,employment_type,posted_at,first_seen_at";
const UNREADABLE_MESSAGE = "Could not read that job board right now.";
// A company isn't started with less than this left of the run's budget
export const MIN_REMAINING_MS = 20_000;
const CHUNK = 100;
const CRON_WINDOW = 200;
const PER_USER_PER_RUN = 5;

export const isSetupPending = (error) => SETUP_CODES.includes(error?.code);

function check(error, capMessage = `You can watch up to ${MAX_COMPANIES} companies. Remove one first.`) {
  if (!error) return;
  if (isSetupPending(error)) throw new HttpError(503, SETUP_MESSAGE);
  if (error.code === "23505") throw new HttpError(409, "You already watch that company.");
  if (error.code === "54000") throw new HttpError(429, capMessage);
  if (error.code === "23503") throw new HttpError(404, "That company is no longer available.");
  throw error;
}

export function toCompany(row) {
  return {
    id: row.id,
    platform: row.platform,
    boardToken: row.board_token,
    name: row.name,
    keywords: row.title_keywords || [],
    lastCheckedAt: row.last_checked_at || null,
    lastError: row.last_error || "",
    openCount: row.open_count ?? null,
    createdAt: row.created_at,
  };
}

const toPosting = (row, company, url) => ({
  id: row.id,
  companyId: row.company_id,
  companyName: company?.name || "",
  companyCreatedAt: company?.created_at || null,
  platform: company?.platform || "",
  title: row.title,
  location: row.location || "",
  url,
  description: row.description || "",
  workplaceType: row.workplace_type || "",
  employmentType: row.employment_type || "",
  postedAt: row.posted_at || null,
  firstSeenAt: row.first_seen_at,
});

// ---------- input ----------

// Lower-case, de-duplicated title keywords: an array, or one string split on commas and new lines
export function normalizeKeywords(input) {
  const list = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,\n]/) : [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item !== "string") throw new HttpError(400, "Keywords must be text.");
    const word = item.trim().replace(/\s+/g, " ").toLowerCase();
    if (!word) continue;
    if (word.length > 60) throw new HttpError(400, "Keep each keyword under 60 characters.");
    seen.add(word);
  }
  if (seen.size > MAX_KEYWORDS) throw new HttpError(400, `Use up to ${MAX_KEYWORDS} keywords.`);
  return [...seen];
}

const idSchema = z.string().uuid("Unknown company or posting");
const addInput = z.object({
  link: z.string({ required_error: "Paste a job board link" }).trim().min(1, "Paste a job board link").max(300, "That link is too long"),
  keywords: z.union([z.array(z.string().max(200)).max(50), z.string().max(2000)]).default([]),
  name: z.string().trim().max(200, "Keep the name under 200 characters").optional(),
});

const timeOf = (value) => (value instanceof Date ? value.getTime() : Number(value));

// ---------- reads ----------

export async function listWatchlist(supabase, userId) {
  const { data, error } = await supabase
    .from("watched_companies")
    .select(COMPANY_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(MAX_COMPANIES);
  if (isSetupPending(error)) return { companies: [], setupPending: true };
  if (error) throw error;
  return { companies: data.map(toCompany), setupPending: false };
}

/** Open postings the user hasn't dismissed or saved, newest first: { postings, setupPending }. */
export async function listPostings(supabase, userId, { limit = 100 } = {}) {
  const size = Math.max(1, Math.min(Math.floor(Number(limit)) || 100, LIST_LIMIT));
  const { data, error } = await supabase
    .from("watched_postings")
    .select(POSTING_COLUMNS)
    .eq("user_id", userId)
    .is("closed_at", null)
    .is("dismissed_at", null)
    .is("saved_at", null)
    .order("first_seen_at", { ascending: false })
    .limit(size);
  if (isSetupPending(error)) return { postings: [], setupPending: true };
  if (error) throw error;
  if (!data.length) return { postings: [], setupPending: false };

  const ids = [...new Set(data.map((row) => row.company_id))];
  const companies = await supabase.from("watched_companies").select("id,name,platform,board_token,created_at").eq("user_id", userId).in("id", ids);
  if (isSetupPending(companies.error)) return { postings: [], setupPending: true };
  if (companies.error) throw companies.error;
  const byId = new Map(companies.data.map((company) => [company.id, company]));
  const postings = [];
  for (const row of data) {
    const owner = byId.get(row.company_id);
    const url = owner && postingUrl(owner.platform, owner.board_token, row.posting_id);
    if (url) postings.push(toPosting(row, owner, url));
  }
  return { postings, setupPending: false };
}

async function ownedCompany(supabase, userId, companyId) {
  if (!idSchema.safeParse(companyId).success) throw new HttpError(404, "That company is no longer available.");
  const { data, error } = await supabase
    .from("watched_companies")
    .select(COMPANY_COLUMNS)
    .eq("user_id", userId)
    .eq("id", companyId)
    .maybeSingle();
  check(error);
  if (!data) throw new HttpError(404, "That company is no longer available.");
  return data;
}

// ---------- refreshing one company ----------

const matchesKeywords = (title, keywords) => {
  const lower = title.toLowerCase();
  return keywords.some((word) => lower.includes(word));
};

// The postings to keep for one company: matching its keywords (none = all),
// newest posted first then board order, at most 100
export function selectPostings(postings, keywords) {
  return postings
    .map((posting, index) => ({ posting, index }))
    .filter(({ posting }) => !keywords.length || matchesKeywords(posting.title, keywords))
    .sort((a, b) => {
      const at = a.posting.postedAt ? Date.parse(a.posting.postedAt) : -Infinity;
      const bt = b.posting.postedAt ? Date.parse(b.posting.postedAt) : -Infinity;
      return bt - at || a.index - b.index;
    })
    .slice(0, MAX_OPEN_PER_COMPANY)
    .map(({ posting }) => posting);
}

const sameTime = (stored, incoming) => (stored ? Date.parse(stored) : null) === (incoming ? Date.parse(incoming) : null);

// last_checked_at, last_error and open_count are written only by this database
// function (users have no UPDATE right on them): it stamps the time itself
async function recordCheck(supabase, companyId, errorText, openCount = null) {
  const { error } = await supabase.rpc("record_watch_check", { p_company_id: companyId, p_error: errorText, p_open_count: openCount });
  check(error);
}

const chunks = (list) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

async function failure(supabase, userId, companyId, nowIso, message, close = false) {
  let closed = 0;
  try {
    if (close) {
      const result = await supabase
        .from("watched_postings")
        .update({ closed_at: nowIso })
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .is("closed_at", null)
        .select("id");
      if (!result.error) closed = result.data?.length || 0;
    }
    await recordCheck(supabase, companyId, message.slice(0, 300));
  } catch (error) {
    console.error("Recording a watchlist failure:", error?.name || "error");
  }
  return { added: 0, updated: 0, closed, error: message };
}

/**
 * Read one company's board and bring its stored postings in line with it.
 * Skips (returning { skipped: true }) a company checked in the last 10
 * minutes, or the last minute when `force` is set. A failure after the
 * ownership check never throws: it is recorded on the company (last_error,
 * last_checked_at) and returned as { error }. A board that is gone (404) also
 * closes the company's open postings; any other failure closes nothing.
 * Returns { added, updated, closed }.
 * `board` lets a caller that has already read the board pass it in.
 */
export async function refreshCompany(supabase, userId, company, { force = false, now = Date.now(), fetchBoard = fetchBoardFromWeb, board } = {}) {
  const current = await ownedCompany(supabase, userId, company?.id);
  const nowMs = timeOf(now);
  const nowIso = new Date(nowMs).toISOString();
  const last = current.last_checked_at ? Date.parse(current.last_checked_at) : null;
  if (last !== null && nowMs - last < (force ? FORCED_MIN_INTERVAL_MS : MIN_INTERVAL_MS)) return { skipped: true };

  try {
    let read = board;
    if (!read) {
      try {
        read = await fetchBoard({ platform: current.platform, token: current.board_token });
      } catch (error) {
        if (error instanceof HttpError) return await failure(supabase, userId, current.id, nowIso, error.message, error.status === 404);
        console.error("Watchlist board read:", error?.name || "error");
        return await failure(supabase, userId, current.id, nowIso, UNREADABLE_MESSAGE);
      }
    }
    // The board says it has postings but none could be read: a broken read, not an empty board
    if (read.total > 0 && read.postings.length === 0) {
      return await failure(supabase, userId, current.id, nowIso, UNREADABLE_MESSAGE);
    }
    return await applyBoard(supabase, userId, current, read, nowMs);
  } catch (error) {
    if (!(error instanceof HttpError)) console.error("Watchlist refresh:", error?.name || "error");
    return await failure(supabase, userId, current.id, nowIso, error instanceof HttpError ? error.message : UNREADABLE_MESSAGE);
  }
}

async function applyBoard(supabase, userId, current, read, nowMs) {
  const nowIso = new Date(nowMs).toISOString();
  const keep = selectPostings(read.postings, current.title_keywords || []);
  const kept = new Map(keep.map((posting) => [posting.postingId, posting]));

  // Only the rows the diff needs: those for the postings just read, and every open one
  const storedColumns = "id,posting_id,title,location,description,workplace_type,employment_type,posted_at,closed_at";
  const storedById = new Map();
  for (const ids of chunks([...kept.keys()])) {
    const { data, error } = await supabase
      .from("watched_postings")
      .select(storedColumns)
      .eq("user_id", userId)
      .eq("company_id", current.id)
      .in("posting_id", ids);
    check(error);
    for (const row of data) storedById.set(row.posting_id, row);
  }
  const open = await supabase
    .from("watched_postings")
    .select(storedColumns)
    .eq("user_id", userId)
    .eq("company_id", current.id)
    .is("closed_at", null)
    .order("id")
    .limit(1000);
  check(open.error);
  for (const row of open.data) storedById.set(row.posting_id, row);

  const fresh = [];
  const touchedIds = [];
  const changed = [];
  let updated = 0;
  for (const posting of keep) {
    const row = storedById.get(posting.postingId);
    const values = {
      title: posting.title,
      location: posting.location,
      url: posting.url,
      description: posting.description,
      workplace_type: posting.workplaceType,
      employment_type: posting.employmentType,
      posted_at: posting.postedAt,
    };
    if (!row) {
      fresh.push({ user_id: userId, company_id: current.id, posting_id: posting.postingId, ...values, first_seen_at: nowIso, last_seen_at: nowIso });
      continue;
    }
    if (row.closed_at) updated++; // back on the board
    const differs =
      row.title !== posting.title ||
      (row.location || "") !== posting.location ||
      (row.description || "") !== posting.description ||
      (row.workplace_type || "") !== posting.workplaceType ||
      (row.employment_type || "") !== posting.employmentType ||
      !sameTime(row.posted_at, posting.postedAt);
    if (differs) {
      changed.push({ user_id: userId, company_id: current.id, posting_id: posting.postingId, ...values, last_seen_at: nowIso, closed_at: null });
      if (!row.closed_at) updated++;
    } else {
      touchedIds.push(row.id);
    }
  }

  // An empty board while we hold open postings is believed only on the second
  // check in a row (open_count remembers the first); a broken read looks the same
  const emptyBoard = read.total === 0 && current.open_count !== 0;
  const closing = emptyBoard ? [] : [...storedById.values()].filter((row) => !row.closed_at && !kept.has(row.posting_id)).map((row) => row.id);

  let error = "";
  if (fresh.length) {
    // ignoreDuplicates: a refresh running at the same time may have stored some of these first
    const result = await supabase.from("watched_postings").upsert(fresh, { onConflict: "company_id,posting_id", ignoreDuplicates: true });
    if (result.error?.code === "54000") error = "Too many stored postings. Narrow your keywords or dismiss some.";
    else check(result.error);
  }
  if (changed.length) {
    const result = await supabase.from("watched_postings").upsert(changed, { onConflict: "company_id,posting_id" });
    check(result.error);
  }
  for (const ids of chunks(touchedIds)) {
    const result = await supabase
      .from("watched_postings")
      .update({ last_seen_at: nowIso, closed_at: null })
      .eq("user_id", userId)
      .eq("company_id", current.id)
      .in("id", ids);
    check(result.error);
  }
  for (const ids of chunks(closing)) {
    const result = await supabase
      .from("watched_postings")
      .update({ closed_at: nowIso })
      .eq("user_id", userId)
      .eq("company_id", current.id)
      .in("id", ids);
    check(result.error);
  }
  // Postings that closed over 30 days ago and were never saved are forgotten
  const cleanup = await supabase
    .from("watched_postings")
    .delete()
    .eq("user_id", userId)
    .eq("company_id", current.id)
    .lt("closed_at", new Date(nowMs - CLOSED_KEEP_DAYS * DAY_MS).toISOString())
    .is("saved_at", null);
  check(cleanup.error);

  await recordCheck(supabase, current.id, error, read.total);
  return { added: fresh.length, updated, closed: closing.length, ...(error ? { error } : {}) };
}

// ---------- writes ----------

export async function addCompany(supabase, userId, input, { now = Date.now(), fetchBoard = fetchBoardFromWeb } = {}) {
  const { link, keywords, name } = parseInput(addInput, input);
  const { platform, token } = parseBoardLink(link);
  const title_keywords = normalizeKeywords(keywords);
  const board = await fetchBoard({ platform, token });

  const { data, error } = await supabase
    .from("watched_companies")
    .insert({
      user_id: userId,
      platform,
      board_token: token,
      name: name || board.name || token,
      title_keywords,
    })
    .select(COMPANY_COLUMNS)
    .single();
  check(error);
  // The company stays whatever happens next: a failed first check is shown on it, so a retry isn't a 409 with nothing to see
  let result;
  try {
    result = await refreshCompany(supabase, userId, data, { force: true, now, board });
  } catch (error) {
    if (!(error instanceof HttpError)) console.error("First watchlist check:", error?.name || "error");
    result = { added: 0, updated: 0, closed: 0, error: error instanceof HttpError ? error.message : UNREADABLE_MESSAGE };
  }
  let stored = data;
  try {
    stored = await ownedCompany(supabase, userId, data.id);
  } catch {
    // keep the row just inserted
  }
  return { company: toCompany(stored), ...result };
}

export async function updateKeywords(supabase, userId, companyId, keywords) {
  if (!idSchema.safeParse(companyId).success) throw new HttpError(404, "That company is no longer available.");
  const { data, error } = await supabase
    .from("watched_companies")
    .update({ title_keywords: normalizeKeywords(keywords) })
    .eq("user_id", userId)
    .eq("id", companyId)
    .select(COMPANY_COLUMNS);
  check(error);
  if (!data?.length) throw new HttpError(404, "That company is no longer available.");
  return toCompany(data[0]);
}

export async function removeCompany(supabase, userId, companyId) {
  if (!idSchema.safeParse(companyId).success) throw new HttpError(404, "That company is no longer available.");
  const { data, error } = await supabase
    .from("watched_companies")
    .delete()
    .eq("user_id", userId)
    .eq("id", companyId)
    .select("id");
  check(error);
  if (!data?.length) throw new HttpError(404, "That company is no longer available.");
  return { id: companyId };
}

/** Check one company now (at most once a minute). Returns what refreshCompany returns. */
export async function checkCompany(supabase, userId, companyId, options = {}) {
  const company = await ownedCompany(supabase, userId, companyId);
  return refreshCompany(supabase, userId, company, { ...options, force: true });
}

async function ownedPosting(supabase, userId, postingId) {
  if (!idSchema.safeParse(postingId).success) throw new HttpError(404, "That posting is no longer available.");
  const { data, error } = await supabase
    .from("watched_postings")
    .select(POSTING_COLUMNS)
    .eq("user_id", userId)
    .eq("id", postingId)
    .maybeSingle();
  check(error);
  if (!data) throw new HttpError(404, "That posting is no longer available.");
  return data;
}

export async function dismissPosting(supabase, userId, postingId) {
  const posting = await ownedPosting(supabase, userId, postingId);
  const { error } = await supabase
    .from("watched_postings")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", posting.id);
  check(error);
  return { id: posting.id };
}

/**
 * Save a watched posting as a saved job (never an application). Returns the
 * saved job's id. The posting's link is the canonical one built when it was
 * read, never one the board supplied.
 */
export async function savePosting(supabase, userId, postingId) {
  const posting = await ownedPosting(supabase, userId, postingId);
  const company = await ownedCompany(supabase, userId, posting.company_id);
  // Rebuilt, never the stored url column (users can insert rows directly)
  const url = postingUrl(company.platform, company.board_token, posting.posting_id);
  let identity = null;
  try {
    identity = url ? normalizePostingIdentity({ url }) : null;
  } catch {
    identity = null;
  }
  if (!identity || identity.platform !== company.platform || identity.namespace !== company.board_token || identity.postingId !== posting.posting_id.toLowerCase()) {
    throw new HttpError(400, "This posting's link could not be verified, so it was not saved.");
  }
  const input = parseInput(opportunityInput, {
    company: company.name,
    role: posting.title.slice(0, 200),
    location: posting.location.slice(0, 200),
    url,
    postingId: posting.posting_id.toLowerCase(),
    detectedBy: company.platform,
    jobDescription: posting.description,
    workplaceType: posting.workplace_type,
    employmentType: posting.employment_type,
  });
  const saved = await saveOpportunity(supabase, userId, input, { keepStored: true });
  const { error } = await supabase
    .from("watched_postings")
    .update({ saved_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", posting.id)
    .is("saved_at", null); // a second save running at the same time keeps the first one's time
  check(error);
  return saved.id;
}

// ---------- batches ----------

const addTotals = (totals, result) => {
  totals.added += result.added || 0;
  totals.updated += result.updated || 0;
  totals.closed += result.closed || 0;
};

/** Refresh the user's companies not checked within `olderThanHours`, oldest first. */
export async function refreshStale(supabase, userId, { max = 5, olderThanHours = 12, deadlineMs = 40_000, minRemainingMs = MIN_REMAINING_MS, now = Date.now(), clock = Date.now, fetchBoard } = {}) {
  const { companies, setupPending } = await listWatchlist(supabase, userId);
  const totals = { refreshed: 0, failed: 0, added: 0, updated: 0, closed: 0, setupPending };
  const cutoff = timeOf(now) - olderThanHours * 3_600_000;
  const stale = companies
    .filter((company) => !company.lastCheckedAt || Date.parse(company.lastCheckedAt) < cutoff)
    .sort((a, b) => (a.lastCheckedAt ? Date.parse(a.lastCheckedAt) : -Infinity) - (b.lastCheckedAt ? Date.parse(b.lastCheckedAt) : -Infinity));
  const started = clock();
  for (const company of stale) {
    if (totals.refreshed + totals.failed >= max || deadlineMs - (clock() - started) < minRemainingMs) break;
    try {
      const result = await refreshCompany(supabase, userId, company, { now, ...(fetchBoard ? { fetchBoard } : {}) });
      if (result.skipped) continue;
      if (result.error) totals.failed++;
      else totals.refreshed++;
      addTotals(totals, result);
    } catch (error) {
      totals.failed++; // one company's failure never stops the others
      console.error("Watchlist refresh:", error?.name || "error");
    }
  }
  return totals;
}

/**
 * The daily job: the companies (across users) checked longest ago, each
 * refreshed under its own user_id. One company's failure never stops the run,
 * and no company is started with less than 20 seconds of the budget left.
 * Returns counts only.
 */
export async function runWatchlistCron(admin, { maxCompanies = 30, deadlineMs = 40_000, minRemainingMs = MIN_REMAINING_MS, now = Date.now(), clock = Date.now, fetchBoard } = {}) {
  // A window of the oldest-checked companies, then at most PER_USER_PER_RUN of
  // each user's in that order, so one user's backlog can't fill the run
  const { data: window, error } = await admin
    .from("watched_companies")
    .select("id,user_id")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(CRON_WINDOW);
  if (isSetupPending(error)) return { setupPending: true };
  if (error) throw error;
  const perUser = new Map();
  const data = [];
  for (const row of window) {
    const taken = perUser.get(row.user_id) || 0;
    if (taken >= PER_USER_PER_RUN || data.length >= maxCompanies) continue;
    perUser.set(row.user_id, taken + 1);
    data.push(row);
  }

  const totals = { companies: data.length, refreshed: 0, skipped: 0, failed: 0, added: 0, updated: 0, closed: 0 };
  const started = clock();
  for (const row of data) {
    if (deadlineMs - (clock() - started) < minRemainingMs) break;
    try {
      const result = await refreshCompany(admin, row.user_id, row, { now, ...(fetchBoard ? { fetchBoard } : {}) });
      if (result.skipped) totals.skipped++;
      else if (result.error) totals.failed++;
      else totals.refreshed++;
      addTotals(totals, result);
    } catch (failure) {
      totals.failed++;
      console.error("Watchlist refresh:", failure?.name || "error");
    }
  }
  return totals;
}
