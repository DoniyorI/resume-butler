import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Imap from "imap";
import { IMAP_PORT, isAllowedImapHost, normalizeImapHost } from "@/lib/imapHosts";

const STATUSES = ["Applied", "Interviewed", "Pending", "Offered", "Rejected", "Withdrew", "Reached Out"];

// Keywords and sender patterns for filtering job emails
const JOB_KEYWORDS = [
  "application", "interview", "offer", "position", "candidate",
  "hiring", "recruiter", "recruiting", "talent", "career",
  "job", "role", "opportunity", "phone screen", "onsite",
  "technical assessment", "coding challenge", "next steps",
  "move forward", "unfortunately", "regret", "not selected",
  "pleased to inform", "congratulations", "background check",
  "we are excited", "your application", "applied for",
  "schedule an interview", "assessment", "take-home",
  "reaching out", "reach out", "sourcing", "interested in your profile",
  "great fit", "open role",
];

const JOB_SENDERS = [
  "greenhouse.io", "lever.co", "workday", "icims",
  "smartrecruiters", "jobvite", "ashbyhq.com", "breezy.hr",
  "bamboohr", "linkedin.com", "indeed.com", "glassdoor.com",
  "hired.com", "wellfound.com", "myworkday", "taleo",
  "successfactors", "recruiting", "talent", "careers",
  "hiring", "hr@", "recruit",
];

function isJobRelated(subject, from, bodySnippet) {
  const text = `${subject} ${from} ${bodySnippet}`.toLowerCase();
  for (const pattern of JOB_SENDERS) {
    if (from.toLowerCase().includes(pattern)) return true;
  }
  const matches = JOB_KEYWORDS.filter((kw) => text.includes(kw));
  return matches.length >= 2;
}

// Fetch emails via IMAP (returns promise)
function fetchEmails(config, daysBack = 7) {
  return new Promise((resolve, reject) => {
    const host = normalizeImapHost(config.imap_host);
    const imap = new Imap({
      user: config.email_address,
      password: config.app_password,
      host,
      port: IMAP_PORT,
      tls: true,
      tlsOptions: { servername: host },
      connTimeout: 15000,
      authTimeout: 15000,
    });

    const emails = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err) => {
        if (err) { imap.end(); return reject(err); }

        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - daysBack);
        const since = sinceDate.toISOString().split("T")[0].replace(/-/g, "-");
        // IMAP date format: DD-Mon-YYYY
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const imapDate = `${sinceDate.getDate()}-${months[sinceDate.getMonth()]}-${sinceDate.getFullYear()}`;

        imap.search([["SINCE", imapDate]], (err, results) => {
          if (err) { imap.end(); return reject(err); }
          if (!results || results.length === 0) { imap.end(); return resolve([]); }

          // Limit to most recent 100 emails to avoid timeout
          const recentIds = results.slice(-100);

          const fetch = imap.fetch(recentIds, {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)", "TEXT"],
            struct: true,
          });

          fetch.on("message", (msg) => {
            const emailData = { headers: {}, body: "" };

            msg.on("body", (stream, info) => {
              let buffer = "";
              stream.on("data", (chunk) => { buffer += chunk.toString("utf8"); });
              stream.once("end", () => {
                if (info.which.includes("HEADER")) {
                  // Parse headers
                  const lines = buffer.split("\r\n");
                  lines.forEach((line) => {
                    if (line.startsWith("From: ")) emailData.headers.from = line.slice(6).trim();
                    if (line.startsWith("Subject: ")) emailData.headers.subject = line.slice(9).trim();
                    if (line.startsWith("Date: ")) emailData.headers.date = line.slice(6).trim();
                    if (line.startsWith("Message-ID: ") || line.startsWith("Message-Id: ")) {
                      emailData.headers.messageId = line.split(": ").slice(1).join(": ").trim();
                    }
                  });
                } else {
                  // Body — strip HTML tags, limit size
                  let text = buffer
                    .replace(/<[^>]+>/g, " ")
                    .replace(/&nbsp;/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                  emailData.body = text.slice(0, 2000);
                }
              });
            });

            msg.once("end", () => {
              if (emailData.headers.from) {
                emails.push(emailData);
              }
            });
          });

          fetch.once("error", (err) => { imap.end(); reject(err); });
          fetch.once("end", () => { imap.end(); resolve(emails); });
        });
      });
    });

    imap.once("error", (err) => reject(err));
    imap.once("end", () => {});
    imap.connect();
  });
}

// Classify email using OpenAI
async function classifyEmail(emailData) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Analyze this email and determine if it's related to a job application or recruiter outreach.
If it IS job-related, extract the following. If NOT, respond with {"is_job_related": false}.

EMAIL:
From: ${emailData.headers.from || ""}
Subject: ${emailData.headers.subject || ""}
Body (snippet):
${emailData.body.slice(0, 1500)}

Respond ONLY with valid JSON (no markdown):
{
  "is_job_related": true,
  "company": "Company Name",
  "position": "Job Title or Unknown",
  "status": "ONE OF: Applied, Interviewed, Pending, Offered, Rejected, Reached Out",
  "confidence": 0.95,
  "summary": "One-line summary of what this email says"
}

Status guide:
- Applied: Confirmation that application was received
- Pending: Under review, acknowledged
- Interviewed: Invited to or scheduled for interview/phone screen/technical
- Offered: Job offer extended
- Rejected: Application rejected or position filled
- Reached Out: A recruiter/company proactively reaching out to the user about a role (the user did NOT apply first)

If a recruiter is cold-emailing about a role the user didn't apply to, use "Reached Out".`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You classify emails related to job applications. Respond only with valid JSON." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", await response.text());
      return null;
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return result;
  } catch (error) {
    console.error("Error classifying email:", error);
    return null;
  }
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's email connection
    const { data: connection, error: connErr } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (connErr) throw connErr;
    if (!connection) {
      return NextResponse.json(
        { error: "No email connection configured. Go to Email Sync to connect your email." },
        { status: 400 }
      );
    }

    // Re-check stored settings, since rows saved before validation may hold any host
    if (!isAllowedImapHost(connection.imap_host)) {
      return NextResponse.json(
        { error: "Your email connection uses an unsupported IMAP server. Reconnect your email in Email Sync." },
        { status: 400 }
      );
    }

    // Get already-processed message IDs
    const { data: processed } = await supabase
      .from("processed_emails")
      .select("message_id")
      .eq("user_id", user.id);

    const processedIds = new Set((processed || []).map((p) => p.message_id));

    // Fetch emails via IMAP
    let rawEmails;
    try {
      rawEmails = await fetchEmails(connection, 14);
    } catch (imapErr) {
      console.error("IMAP error:", imapErr);
      return NextResponse.json(
        { error: "Failed to connect to email. Check your credentials and ensure you're using an App Password for Gmail." },
        { status: 400 }
      );
    }

    // Filter to unprocessed, job-related emails
    const newEmails = rawEmails.filter((e) => {
      const msgId = e.headers.messageId || "";
      if (!msgId || processedIds.has(msgId)) return false;
      return isJobRelated(e.headers.subject || "", e.headers.from || "", e.body);
    });

    // Get existing applications to match against
    const { data: existingApps } = await supabase
      .from("applications")
      .select("id, company, role, status")
      .eq("user_id", user.id);

    const results = {
      emails_scanned: rawEmails.length,
      job_emails_found: newEmails.length,
      new_applications: 0,
      status_updates: 0,
      reached_out: 0,
      skipped: 0,
      details: [],
    };

    // Process each job email
    for (const email of newEmails) {
      const classification = await classifyEmail(email);

      if (!classification || !classification.is_job_related) {
        // Record as skipped
        await supabase.from("processed_emails").upsert({
          user_id: user.id,
          message_id: email.headers.messageId,
          email_subject: (email.headers.subject || "").slice(0, 500),
          email_from: (email.headers.from || "").slice(0, 255),
          email_date: email.headers.date ? new Date(email.headers.date).toISOString() : null,
          classification: { is_job_related: false },
          action_taken: "skipped",
        }, { onConflict: "user_id,message_id" });
        results.skipped++;
        continue;
      }

      // Validate status
      let status = classification.status || "Pending";
      if (!STATUSES.includes(status)) status = "Pending";

      // Try to match to existing application (fuzzy company match)
      const companyLower = (classification.company || "").toLowerCase();
      const matchedApp = (existingApps || []).find((app) =>
        app.company && (
          app.company.toLowerCase().includes(companyLower) ||
          companyLower.includes(app.company.toLowerCase())
        )
      );

      let applicationId = null;
      let actionTaken = "skipped";

      if (matchedApp) {
        // Update existing application status if it progressed
        const statusOrder = ["Applied", "Reached Out", "Pending", "Interviewed", "Offered"];
        const oldIdx = statusOrder.indexOf(matchedApp.status);
        const newIdx = statusOrder.indexOf(status);

        // Allow update if: new status is further along, or it's a terminal status (Rejected)
        if (
          (newIdx > oldIdx && newIdx >= 0 && oldIdx >= 0) ||
          status === "Rejected" ||
          status === "Offered"
        ) {
          await supabase
            .from("applications")
            .update({ status })
            .eq("id", matchedApp.id);

          results.status_updates++;
          actionTaken = "updated";
        } else {
          actionTaken = "skipped";
        }
        applicationId = matchedApp.id;
      } else {
        // Create new application
        const { data: newApp, error: insertErr } = await supabase
          .from("applications")
          .insert({
            user_id: user.id,
            company: classification.company || "Unknown",
            role: classification.position || "Unknown",
            status,
            applied_date: email.headers.date
              ? new Date(email.headers.date).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
            comments: `Auto-detected from email: ${classification.summary || ""}`,
          })
          .select("id")
          .single();

        if (!insertErr && newApp) {
          applicationId = newApp.id;
          actionTaken = "created";
          results.new_applications++;
          if (status === "Reached Out") results.reached_out++;
        }
      }

      // Record processed email
      await supabase.from("processed_emails").upsert({
        user_id: user.id,
        message_id: email.headers.messageId,
        email_subject: (email.headers.subject || "").slice(0, 500),
        email_from: (email.headers.from || "").slice(0, 255),
        email_date: email.headers.date ? new Date(email.headers.date).toISOString() : null,
        classification,
        application_id: applicationId,
        action_taken: actionTaken,
      }, { onConflict: "user_id,message_id" });

      results.details.push({
        subject: (email.headers.subject || "").slice(0, 100),
        company: classification.company,
        position: classification.position,
        status,
        action: actionTaken,
        confidence: classification.confidence,
      });
    }

    // Update last scan timestamp
    await supabase
      .from("email_connections")
      .update({ last_scan_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error scanning emails:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
