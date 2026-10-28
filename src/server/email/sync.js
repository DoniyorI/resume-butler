import "server-only";
import { CATEGORY_STATUS, MIN_CONFIDENCE, classifyEmail, isCandidateEmail } from "@/server/email/classify";
import { encryptStoredPassword, getConnectionCredentials, markScanned } from "@/server/email/connection";
import { fetchEmails } from "@/server/email/imapClient";
import { isAllowedImapHost } from "@/server/email/imapHosts";
import { findTargetApplication, normalizeCompany, shouldUpdateStatus } from "@/server/email/matching";
import { resolveScanOptions } from "@/server/email/scanOptions";
import { HttpError } from "@/server/http";
import { withEmailSyncLock } from "@/server/email/syncLock";

// Each candidate email is one model call; run several at a time so a full
// scan fits in the route's 60 seconds
const CLASSIFY_CONCURRENCY = 10;
const MAX_CLASSIFIED_PER_SCAN = 100;

async function loadProcessedIds(supabase, userId, messageIds) {
  if (messageIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("processed_emails")
    .select("message_id, action_taken")
    .eq("user_id", userId)
    .in("message_id", messageIds);
  if (error) throw error;
  return new Set(data.filter((row) => row.action_taken !== "error").map((row) => row.message_id));
}

async function loadApplications(supabase, userId) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, role, status, applied_date, created_at")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

// Pending suggestions, so a scan extends them instead of suggesting the same
// application twice ("Thanks for applying" followed by a rejection becomes one
// new application with the latest status)
async function loadPendingSuggestions(supabase, userId) {
  const { data, error } = await supabase
    .from("application_suggestions")
    .select("id, kind, application_id, company, role, status, email_date, created_at")
    .eq("user_id", userId)
    .eq("state", "pending");
  if (error) throw error;
  return data;
}

async function recordProcessed(supabase, record) {
  const { error } = await supabase
    .from("processed_emails")
    .upsert(record, { onConflict: "user_id,message_id" });
  if (error) console.error("Could not record processed email:", error);
  return !error;
}

async function mapWithConcurrency(items, limit, fn, deadlineAt = Infinity) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      if (Date.now() + 10_000 >= deadlineAt) break;
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

// Decide what one classified email should do. Returns { outcome } plus either
// `suggestion` (insert a new row) or `merge` (advance a pending row's status).
// outcome is "suggested", "merged" or "ignored:<reason>".
function planSuggestion(classification, { categories, applications, pending, emailDate }) {
  if (!classification) return { outcome: "ignored:error" };

  const status = CATEGORY_STATUS[classification.category];
  if (!status) return { outcome: `ignored:${classification.category}` };
  if (!categories.has(classification.category)) return { outcome: "ignored:not_selected" };
  if (classification.confidence < MIN_CONFIDENCE) return { outcome: "ignored:low_confidence" };

  const company = normalizeCompany(classification.company);
  if (!company) return { outcome: "ignored:no_company" };

  const match = { company, role: classification.role, category: classification.category, emailDate };
  const target = findTargetApplication(applications, match);

  // A pending suggestion about the same application: advance it, or skip
  const pendingTarget = target
    ? pending.find((p) => p.kind === "update" && p.application_id === target.id)
    : findTargetApplication(
        pending.filter((p) => p.kind === "new"),
        match
      );
  if (pendingTarget) {
    return shouldUpdateStatus(pendingTarget.status, status)
      ? { outcome: "merged", merge: { target: pendingTarget, status } }
      : { outcome: "ignored:duplicate" };
  }

  if (target && !shouldUpdateStatus(target.status, status)) return { outcome: "ignored:no_change" };

  return {
    outcome: "suggested",
    suggestion: {
      kind: target ? "update" : "new",
      application_id: target?.id ?? null,
      company: target ? target.company : classification.company,
      role: target ? target.role || "" : classification.role,
      status,
    },
  };
}

/**
 * Scan the user's inbox and suggest applications (new ones or status changes)
 * for the user to approve. Nothing is written to `applications` here.
 * Works with any Supabase client acting as `userId`, so a Route Handler,
 * Server Action or scheduled job can call it.
 * Throws HttpError(400) with a user-safe message for connection and input problems.
 */
export async function syncEmailsForUser(supabase, userId, options = {}) {
  return withEmailSyncLock(supabase, userId, () => scanEmailsForUser(supabase, userId, options));
}

async function scanEmailsForUser(supabase, userId, options) {
  const { since, before, categories } = resolveScanOptions(options);
  const deadlineAt = Math.min(options.deadlineAt ?? Infinity, Date.now() + 50_000);

  const credentials = await getConnectionCredentials(supabase, userId);
  if (!credentials) {
    throw new HttpError(400, "No email connection configured. Go to Inbox to connect your email.");
  }
  // Re-check stored settings, since rows saved before validation may hold any host
  if (!isAllowedImapHost(credentials.host)) {
    throw new HttpError(
      400,
      "Your email connection uses an unsupported IMAP server. Reconnect your email in Inbox."
    );
  }

  let emails;
  try {
    emails = await fetchEmails(credentials, { since, before, timeoutMs: Math.max(1, deadlineAt - Date.now() - 10_000) });
  } catch (imapErr) {
    console.error("IMAP error:", imapErr);
    throw new HttpError(
      400,
      "Failed to connect to email. Check your credentials and ensure you're using an App Password for Gmail."
    );
  }

  // Encrypt a legacy plaintext password now that we know it works
  if (credentials.needsEncryption) {
    await encryptStoredPassword(supabase, userId, credentials.password);
  }

  const [processedIds, applications, pending] = await Promise.all([
    loadProcessedIds(supabase, userId, emails.map((email) => email.messageId)),
    loadApplications(supabase, userId),
    loadPendingSuggestions(supabase, userId),
  ]);

  const includeOutreach = categories.has("recruiter_outreach");
  const uniqueEmails = [...new Map(emails.map((email) => [email.messageId, email])).values()];
  const available = uniqueEmails
    .filter((email) => !processedIds.has(email.messageId))
    .filter((email) => isCandidateEmail(email, { includeOutreach }))
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
  const candidates = available.slice(0, MAX_CLASSIFIED_PER_SCAN);
  const classifications = await mapWithConcurrency(
    candidates,
    CLASSIFY_CONCURRENCY,
    (email) => classifyEmail(email, { timeoutMs: Math.max(1, Math.min(8_000, deadlineAt - Date.now() - 10_000)) }),
    deadlineAt
  );

  const results = {
    emails_scanned: emails.length,
    candidates: candidates.length,
    suggestions: 0,
    ignored: 0,
    errors: 0,
    truncated: emails.truncated || 0,
    deferred: available.length - candidates.length + (emails.truncated || 0),
    details: [],
  };

  // Sequential from here: later emails must see suggestions made for earlier ones
  for (const [index, email] of candidates.entries()) {
    if (Date.now() + 3_000 >= deadlineAt) {
      results.deferred += candidates.length - index;
      break;
    }
    const classification = classifications[index];
    if (classification === undefined) {
      results.deferred++;
      continue;
    }
    const processed = {
      user_id: userId,
      message_id: email.messageId,
      email_subject: email.subject.slice(0, 500),
      email_from: email.from.slice(0, 255),
      email_date: email.date ? email.date.toISOString() : null,
      classification,
    };

    const { outcome, suggestion, merge } = planSuggestion(classification, {
      categories,
      applications,
      pending,
      emailDate: processed.email_date,
    });

    if (suggestion || merge) {
      const details = {
        category: classification.category,
        confidence: classification.confidence,
        summary: classification.summary,
        email_subject: processed.email_subject,
        email_from: processed.email_from,
      };
      // A merge keeps the original email date: for a new application it's the applied date
      const { data: saved, error } = suggestion
        ? await supabase
            .from("application_suggestions")
            .insert({
              user_id: userId,
              message_id: email.messageId,
              ...suggestion,
              ...details,
              email_date: processed.email_date,
            })
            .select("id, kind, application_id, company, role, status, email_date, created_at")
            .single()
        : await supabase
            .from("application_suggestions")
            .update({ status: merge.status, ...details })
            .eq("id", merge.target.id)
            .eq("user_id", userId)
            .eq("state", "pending")
            .eq("status", merge.target.status)
            .select("id")
            .single();
      if (error) {
        // The suggestion may have committed before a previous processed-log write
        // failed. Its unique message ID is durable evidence of ingestion, even
        // after the user has approved or dismissed it.
        if (suggestion && error.code === "23505") {
          const existing = await supabase.from("application_suggestions").select("id")
            .eq("user_id", userId).eq("message_id", email.messageId).maybeSingle();
          if (!existing.error && existing.data) {
            results.ignored++;
            if (!(await recordProcessed(supabase, { ...processed, action_taken: "suggested" }))) results.errors++;
            continue;
          }
        }
        console.error("Could not save suggestion:", error);
        results.errors++;
        continue;
      }
      if (suggestion) {
        pending.push(saved);
        results.suggestions++;
      } else {
        merge.target.status = merge.status;
      }
    } else if (outcome === "ignored:error") {
      results.errors++;
    } else {
      results.ignored++;
    }

    // A failed classification isn't recorded, so the next scan retries it
    if (outcome !== "ignored:error") {
      const action = outcome === "merged" ? "suggested" : outcome.split(":")[0];
      if (!(await recordProcessed(supabase, { ...processed, action_taken: action }))) results.errors++;
    }

    results.details.push({
      subject: email.subject.slice(0, 100),
      company: suggestion?.company || classification?.company || "",
      role: suggestion?.role || classification?.role || "",
      category: classification?.category || null,
      status: suggestion?.status || merge?.status || null,
      outcome,
    });
  }

  await markScanned(supabase, userId);
  return results;
}
