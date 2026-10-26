import "server-only";
import { classifyEmail, isJobRelated } from "@/server/email/classify";
import { encryptStoredPassword, getConnectionCredentials, markScanned } from "@/server/email/connection";
import { fetchEmails } from "@/server/email/imapClient";
import { isAllowedImapHost } from "@/server/email/imapHosts";
import {
  findApplicationByCompany,
  normalizeCompany,
  parseEmailDate,
  shouldUpdateStatus,
  toKnownStatus,
} from "@/server/email/matching";
import { HttpError } from "@/server/http";

async function loadProcessedIds(supabase, userId) {
  const { data, error } = await supabase.from("processed_emails").select("message_id").eq("user_id", userId);
  if (error) throw error;
  return new Set(data.map((row) => row.message_id));
}

async function loadApplications(supabase, userId) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, role, status")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

function recordProcessed(supabase, record) {
  return supabase.from("processed_emails").upsert(record, { onConflict: "user_id,message_id" });
}

// Create or update the application an email is about. Returns the
// processed_emails action and the application ID. `applications` is updated in
// place so later emails in the same scan see the change.
async function applyClassification(
  supabase,
  userId,
  { emailDate, classification, company, status, applications }
) {
  const existing = findApplicationByCompany(applications, company);

  if (existing) {
    if (!shouldUpdateStatus(existing.status, status)) {
      return { action: "skipped", applicationId: existing.id };
    }
    const { error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) throw error;
    existing.status = status;
    return { action: "updated", applicationId: existing.id };
  }

  const { data: created, error } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      company: classification.company.trim(),
      role: String(classification.position || "Unknown").slice(0, 200),
      status,
      applied_date: (emailDate || new Date()).toISOString().split("T")[0],
      comments: `Auto-detected from email: ${String(classification.summary || "").slice(0, 500)}`,
    })
    .select("id, company, role, status")
    .single();
  if (error) throw error;
  applications.push(created);
  return { action: "created", applicationId: created.id };
}

/**
 * Scan the user's inbox and create or update applications from job emails.
 * Works with any Supabase client acting as (or allowed to act for) `userId`,
 * so a Route Handler, Server Action or scheduled job can call it.
 * Throws HttpError(400) with a user-safe message for connection problems.
 */
export async function syncEmailsForUser(supabase, userId, { daysBack = 14 } = {}) {
  const credentials = await getConnectionCredentials(supabase, userId);
  if (!credentials) {
    throw new HttpError(400, "No email connection configured. Go to Email Sync to connect your email.");
  }
  // Re-check stored settings, since rows saved before validation may hold any host
  if (!isAllowedImapHost(credentials.host)) {
    throw new HttpError(
      400,
      "Your email connection uses an unsupported IMAP server. Reconnect your email in Email Sync."
    );
  }

  const processedIds = await loadProcessedIds(supabase, userId);

  let rawEmails;
  try {
    rawEmails = await fetchEmails(credentials, { daysBack });
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

  const newEmails = rawEmails.filter((e) => {
    const msgId = e.headers.messageId || "";
    if (!msgId || processedIds.has(msgId)) return false;
    return isJobRelated(e.headers.subject || "", e.headers.from || "", e.body);
  });

  const applications = await loadApplications(supabase, userId);

  const results = {
    emails_scanned: rawEmails.length,
    job_emails_found: newEmails.length,
    new_applications: 0,
    status_updates: 0,
    reached_out: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  for (const email of newEmails) {
    const emailDate = parseEmailDate(email.headers.date);
    const processedRecord = {
      user_id: userId,
      message_id: email.headers.messageId,
      email_subject: (email.headers.subject || "").slice(0, 500),
      email_from: (email.headers.from || "").slice(0, 255),
      email_date: emailDate ? emailDate.toISOString() : null,
    };

    // One bad email must not fail the whole scan; it is recorded as processed so it isn't retried forever
    try {
      const classification = await classifyEmail(email);
      const company = classification?.is_job_related ? normalizeCompany(classification.company) : "";

      if (!company) {
        await recordProcessed(supabase, {
          ...processedRecord,
          classification: classification || { is_job_related: false },
          action_taken: "skipped",
        });
        results.skipped++;
        continue;
      }

      const status = toKnownStatus(classification.status);
      const { action, applicationId } = await applyClassification(supabase, userId, {
        emailDate,
        classification,
        company,
        status,
        applications,
      });

      if (action === "updated") results.status_updates++;
      if (action === "created") {
        results.new_applications++;
        if (status === "Reached Out") results.reached_out++;
      }

      await recordProcessed(supabase, {
        ...processedRecord,
        classification,
        application_id: applicationId,
        action_taken: action,
      });

      results.details.push({
        subject: (email.headers.subject || "").slice(0, 100),
        company: classification.company,
        position: classification.position,
        status,
        action,
        confidence: classification.confidence,
      });
    } catch (emailErr) {
      console.error("Error processing email:", email.headers.messageId, emailErr);
      await recordProcessed(supabase, { ...processedRecord, classification: null, action_taken: "error" });
      results.errors++;
    }
  }

  await markScanned(supabase, userId);

  return results;
}
