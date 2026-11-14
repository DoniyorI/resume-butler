import "server-only";
import { isSetupPending } from "@/server/activities/service";
import { toCsv } from "@/lib/csv";
import { formatSalary } from "@/lib/salary";

// "Download my data": everything the account holds, as one JSON document, and
// the applications as a CSV. Reads use the signed-in user's client, so row
// level security applies on top of the explicit filters here.

const APP_NAME = "Resume Butler";
const FORMAT_VERSION = 1;
const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;
const ID_CHUNK = 100; // 100 uuids keep the request line well under the gateway's 8 KB limit

// Columns that hold a credential, a hash of one, or ciphertext. Every table is
// read with select("*") so new columns are exported on their own, then these
// keys are deleted from every row before it is written.
export const NEVER_EXPORT = [
  "app_password", // email_connections: encrypted IMAP password
  "token_hash", // extension_tokens: hash of the extension's bearer token
  "lease_token", // email_sync_locks
  "request_hash", // application_submissions, reusable_answer_versions: idempotency hashes
  "payload_hash", // application_ingest_events
  "pdf_bytes", // resume_artifacts: the PDF file itself
];

// A section is one table. "user" tables are filtered by user_id; "profile" by
// id; "child" tables have no user_id and are read through the ids of the
// parent section already exported. `columns` replaces select("*") only where
// a column is large and not exported (file bytes, posting text).
const SECTIONS = [
  { name: "profile", table: "profiles", scope: "profile" },
  { name: "cvExperience", table: "cv_experience", scope: "user" },
  { name: "cvExperienceBullets", table: "cv_experience_bullets", scope: "child", parent: "cvExperience", key: "experience_id" },
  { name: "cvProjects", table: "cv_projects", scope: "user" },
  { name: "cvProjectBullets", table: "cv_project_bullets", scope: "child", parent: "cvProjects", key: "project_id" },
  { name: "cvEducation", table: "cv_education", scope: "user" },
  { name: "cvSkills", table: "cv_skills", scope: "user" },
  { name: "cvCertifications", table: "cv_certifications", scope: "user" },
  { name: "applications", table: "applications", scope: "user" },
  { name: "applicationStatusHistory", table: "application_status_history", scope: "child", parent: "applications", key: "application_id" },
  { name: "applicationActivities", table: "application_activities", scope: "user" },
  { name: "applicationOffers", table: "application_offers", scope: "user" },
  { name: "applicationSubmissions", table: "application_submissions", scope: "user" },
  { name: "resumes", table: "resumes", scope: "user" },
  { name: "resumeItems", table: "resume_items", scope: "child", parent: "resumes", key: "resume_id" },
  { name: "resumeSuggestions", table: "resume_suggestions", scope: "child", parent: "resumes", key: "resume_id" },
  { name: "coverLetters", table: "cover_letters", scope: "user" },
  {
    name: "resumeArtifacts",
    table: "resume_artifacts",
    scope: "user",
    columns: "id,user_id,event_id,source_resume_id,provenance,title,filename,content,size_bytes,sha256,created_at",
  },
  { name: "savedJobs", table: "job_opportunities", scope: "user" },
  { name: "watchedCompanies", table: "watched_companies", scope: "user" },
  {
    name: "watchedPostings",
    table: "watched_postings",
    scope: "user",
    columns:
      "id,user_id,company_id,posting_id,title,location,url,workplace_type,employment_type,posted_at,first_seen_at,last_seen_at,closed_at,dismissed_at,saved_at",
  },
  { name: "emailSuggestions", table: "application_suggestions", scope: "user" },
  { name: "reusableAnswers", table: "reusable_answers", scope: "user" },
  {
    name: "reusableAnswerVersions",
    table: "reusable_answer_versions",
    scope: "user",
    orderBy: ["answer_id", "revision"],
  },
  { name: "emailConnection", table: "email_connections", scope: "user" },
  { name: "extensionTokens", table: "extension_tokens", scope: "user" },
];

const NOT_INCLUDED = [
  "Email passwords and extension token hashes are never exported.",
  "Scanned email records (processed_emails) are not included.",
  "Rate-limit counters and email sync locks are not included.",
  "Application ingest events from the browser extension are not included.",
  "Deletion markers for removed answer-library entries are not included.",
  "The description text of watched postings is not included; it is public posting text.",
  "PDF files themselves are not included, only their details.",
];

// Only a missing TABLE (a migration not applied) is an empty section. A missing
// column or any other error means rows could not be read: the section is incomplete.
const isMissingTable = (error) => error?.code === "42P01" || error?.code === "PGRST205";

function stripped(row) {
  const copy = { ...row };
  for (const key of NEVER_EXPORT) delete copy[key];
  return copy;
}

function applyOrder(query, section) {
  const keys = section.orderBy || ["id"];
  return keys.reduce((q, key) => q.order(key), query);
}

// One page of rows, or the error the read ended with
async function readPage(supabase, section, userId, parentIds, from, to) {
  try {
    let query = supabase.from(section.table).select(section.columns || "*");
    if (section.scope === "profile") query = query.eq("id", userId);
    else if (section.scope === "user") query = query.eq("user_id", userId);
    else query = query.in(section.key, parentIds);
    const { data, error } = await applyOrder(query, section).range(from, to);
    if (error) return { error };
    return { rows: data || [] };
  } catch (error) {
    return { error };
  }
}

// Pages through one filter (the user, or one chunk of parent ids). Calls
// emit(rows) for each page; returns { count, truncated, error }.
async function* readAll(supabase, section, userId, parentIds, room) {
  let from = 0;
  let count = 0;
  while (true) {
    const size = Math.min(PAGE_SIZE, room - count);
    if (size <= 0) {
      // At the cap: is there anything beyond it?
      const probe = await readPage(supabase, section, userId, parentIds, from, from);
      if (probe.error) return { count, truncated: false, error: probe.error };
      return { count, truncated: probe.rows.length > 0 };
    }
    const page = await readPage(supabase, section, userId, parentIds, from, from + size - 1);
    if (page.error) return { count, truncated: false, error: page.error };
    if (page.rows.length) {
      count += page.rows.length;
      yield page.rows;
    }
    if (page.rows.length < size) return { count, truncated: false };
    from += size;
  }
}

// Yields string chunks that join into one JSON document. A section that fails
// to read keeps what was read and is named in summary.incomplete; the summary
// is written last so it can say what happened.
export async function* exportJsonChunks(supabase, userId, { now = new Date() } = {}) {
  const counts = {};
  const incomplete = [];
  const truncated = [];
  const ids = {}; // section name -> ids of the rows exported, for child sections

  yield `{"app":${JSON.stringify(APP_NAME)},"version":${FORMAT_VERSION},"exportedAt":${JSON.stringify(
    now.toISOString(),
  )},"data":{`;

  let firstSection = true;
  for (const section of SECTIONS) {
    yield `${firstSection ? "" : ","}${JSON.stringify(section.name)}:[`;
    firstSection = false;

    let count = 0;
    let failed = null;
    let wasTruncated = false;
    const collectIds = SECTIONS.some((other) => other.parent === section.name);
    if (collectIds) ids[section.name] = [];

    // A user table is one read; a child table is one read per chunk of parent ids
    const filters = [];
    if (section.scope === "child") {
      const parentIds = ids[section.parent] || [];
      for (let i = 0; i < parentIds.length; i += ID_CHUNK) filters.push(parentIds.slice(i, i + ID_CHUNK));
    } else {
      filters.push(null);
    }

    for (const parentIds of filters) {
      const reader = readAll(supabase, section, userId, parentIds, MAX_ROWS - count);
      while (true) {
        const step = await reader.next();
        if (step.done) {
          failed = step.value.error || null;
          wasTruncated = step.value.truncated;
          break;
        }
        const rows = step.value;
        if (collectIds) for (const row of rows) if (row.id != null) ids[section.name].push(row.id);
        yield `${count ? "," : ""}${rows.map((row) => JSON.stringify(stripped(row))).join(",")}`;
        count += rows.length;
      }
      if (failed || wasTruncated) break;
    }
    yield "]";

    counts[section.name] = count;
    if (wasTruncated) truncated.push(section.name);
    if (failed && !isMissingTable(failed)) {
      // Names the section only, never a row
      console.error("export_section_failed", { section: section.name, code: failed.code || "unknown" });
      incomplete.push(section.name);
    }
  }

  yield `},"summary":${JSON.stringify({ counts, incomplete, truncated, notIncluded: NOT_INCLUDED })}}`;
}

const CSV_HEADER = [
  "Company",
  "Role",
  "Status",
  "Applied date",
  "Location",
  "Link",
  "Pay",
  "Workplace",
  "Employment type",
  "Source",
  "Notes",
];
const CSV_COLUMNS =
  "id,company,role,status,applied_date,location,portal_link,salary_min,salary_max,salary_currency,salary_period,workplace_type,employment_type,source,comments";

function csvRow(row) {
  const pay = formatSalary({
    min: row.salary_min ?? undefined,
    max: row.salary_max ?? undefined,
    currency: row.salary_currency || undefined,
    period: row.salary_period || undefined,
  });
  return [
    row.company,
    row.role,
    row.status,
    row.applied_date ? String(row.applied_date).slice(0, 10) : "",
    row.location,
    row.portal_link,
    pay,
    row.workplace_type,
    row.employment_type,
    row.source,
    row.comments,
  ];
}

// All of the user's applications, newest applied date first
export async function applicationsCsv(supabase, userId) {
  const rows = [CSV_HEADER];
  let columns = CSV_COLUMNS;
  let from = 0;
  while (rows.length - 1 < MAX_ROWS) {
    const size = Math.min(PAGE_SIZE, MAX_ROWS - (rows.length - 1));
    let result = await supabase
      .from("applications")
      .select(columns)
      .eq("user_id", userId)
      .order("applied_date", { ascending: false })
      .order("id")
      .range(from, from + size - 1);
    if (result.error && columns !== "*" && isSetupPending(result.error)) {
      // A newer column is missing because a migration isn't applied: read what exists
      columns = "*";
      continue;
    }
    if (result.error) throw result.error;
    const page = result.data || [];
    for (const row of page) rows.push(csvRow(row));
    if (page.length < size) break;
    from += size;
  }
  return toCsv(rows);
}
