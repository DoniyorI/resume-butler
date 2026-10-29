import "server-only";
import Imap from "imap";
import { simpleParser } from "mailparser";
import { IMAP_PORT, isAllowedImapHost, normalizeImapHost } from "@/server/email/imapHosts";

// Stop buffering a message past this many bytes (large attachments come after the text)
const MAX_MESSAGE_BYTES = 64 * 1024;
const MAX_BODY_CHARS = 3000;
const DEFAULT_MAX_MESSAGES = 300;
const SCAN_TIMEOUT_MS = 25_000;
const IMAP_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Gmail tabs that never hold application emails (confirmations land in Primary or Updates)
const GMAIL_EXCLUDED_CATEGORIES = "-category:promotions -category:social -category:forums";

// IMAP SEARCH wants DD-Mon-YYYY; Gmail search wants YYYY/MM/DD. Both use UTC dates here.
const imapDate = (d) => `${d.getUTCDate()}-${IMAP_MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
const gmailDate = (d) => `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

// `before` is exclusive in both IMAP BEFORE and Gmail before:
function searchCriteria(imap, { since, before }) {
  if (imap.serverSupports("X-GM-EXT-1")) {
    return [
      ["X-GM-RAW", `after:${gmailDate(since)} before:${gmailDate(before)} ${GMAIL_EXCLUDED_CATEGORIES}`],
    ];
  }
  return [
    ["SINCE", imapDate(since)],
    ["BEFORE", imapDate(before)],
  ];
}

function htmlToText(html) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Mailing-list and bulk headers mark newsletters and job alerts
function isBulkMail(headers) {
  const precedence = String(headers.get("precedence") || "").toLowerCase();
  return headers.has("list") || ["bulk", "list", "junk"].includes(precedence);
}

async function parseMessage(raw) {
  const parsed = await simpleParser(raw, { skipImageLinks: true, skipTextToHtml: true });
  const sender = parsed.from?.value?.[0] || {};
  const text = parsed.text || (typeof parsed.html === "string" ? htmlToText(parsed.html) : "");
  return {
    messageId: parsed.messageId || "",
    subject: parsed.subject || "",
    fromName: sender.name || "",
    fromAddress: (sender.address || "").toLowerCase(),
    from: parsed.from?.text || "",
    date: parsed.date || null,
    body: text.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_CHARS),
    bulk: isBulkMail(parsed.headers),
  };
}

/**
 * Read INBOX messages (read-only) received in [since, before). On Gmail the
 * Promotions, Social and Forums tabs are excluded at the server. Connects only
 * to allow-listed hosts on port 993 with TLS certificate checks.
 * @returns {Promise<Array<{ messageId, subject, fromName, fromAddress, from, date, body, bulk }>>}
 */
export function fetchEmails({ host, user, password }, { since, before, maxMessages = DEFAULT_MAX_MESSAGES, timeoutMs = SCAN_TIMEOUT_MS }) {
  const servername = normalizeImapHost(host);
  if (!isAllowedImapHost(servername)) {
    return Promise.reject(new Error("IMAP host is not allowed"));
  }

  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user,
      password,
      host: servername,
      port: IMAP_PORT,
      tls: true,
      tlsOptions: { servername, rejectUnauthorized: true },
      connTimeout: 15_000,
      authTimeout: 15_000,
    });

    const timer = setTimeout(() => {
      imap.destroy();
      reject(new Error("IMAP scan timed out"));
    }, Math.max(1, Math.min(timeoutMs, SCAN_TIMEOUT_MS)));
    const succeed = (value) => {
      clearTimeout(timer);
      imap.end();
      resolve(value);
    };
    const fail = (err) => {
      clearTimeout(timer);
      imap.end();
      reject(err);
    };

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (openErr) => {
        if (openErr) return fail(openErr);

        imap.search(searchCriteria(imap, { since, before }), (searchErr, results) => {
          if (searchErr) return fail(searchErr);
          if (!results || results.length === 0) return succeed([]);

          const rawMessages = [];
          // Message numbers ascend with arrival, so the tail is the newest
          const fetch = imap.fetch(results.slice(-maxMessages), { bodies: "" });

          fetch.on("message", (msg) => {
            const chunks = [];
            let size = 0;
            msg.on("body", (stream) => {
              // Keep draining the stream so IMAP can continue, but stop storing past the cap
              stream.on("data", (chunk) => {
                if (size < MAX_MESSAGE_BYTES) {
                  const part = chunk.subarray(0, MAX_MESSAGE_BYTES - size);
                  chunks.push(part);
                  size += part.length;
                }
              });
            });
            msg.once("end", () => rawMessages.push(Buffer.concat(chunks)));
          });

          fetch.once("error", fail);
          fetch.once("end", async () => {
            const parsed = await Promise.all(rawMessages.map((raw) => parseMessage(raw).catch(() => null)));
            const emails = parsed.filter((email) => email && email.messageId && email.fromAddress);
            // Preserve the array API, but never report a capped mailbox as complete.
            emails.truncated = Math.max(0, results.length - maxMessages);
            succeed(emails);
          });
        });
      });
    });

    // "on", not "once": a second socket error after settling must not go unhandled
    imap.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    imap.connect();
  });
}
