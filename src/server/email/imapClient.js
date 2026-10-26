import "server-only";
import Imap from "imap";
import { IMAP_PORT, isAllowedImapHost, normalizeImapHost } from "@/server/email/imapHosts";

// Stop buffering a message part past this many bytes (bodies can carry large attachments)
const MAX_PART_BYTES = 32 * 1024;
const MAX_BODY_CHARS = 2000;
const MAX_MESSAGES = 100;
const SCAN_TIMEOUT_MS = 60_000;
const IMAP_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// IMAP SEARCH wants DD-Mon-YYYY
function imapSinceDate(daysBack) {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return `${date.getDate()}-${IMAP_MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

function parseHeaders(raw) {
  const headers = {};
  raw.split("\r\n").forEach((line) => {
    if (line.startsWith("From: ")) headers.from = line.slice(6).trim();
    if (line.startsWith("Subject: ")) headers.subject = line.slice(9).trim();
    if (line.startsWith("Date: ")) headers.date = line.slice(6).trim();
    if (line.startsWith("Message-ID: ") || line.startsWith("Message-Id: ")) {
      headers.messageId = line.split(": ").slice(1).join(": ").trim();
    }
  });
  return headers;
}

function bodyText(raw) {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_BODY_CHARS);
}

/**
 * Read the most recent INBOX messages (read-only) from the last `daysBack` days.
 * Connects only to allow-listed hosts on port 993 with TLS certificate checks.
 * @returns {Promise<Array<{ headers: { from, subject, date, messageId }, body: string }>>}
 */
export function fetchEmails({ host, user, password }, { daysBack = 7 } = {}) {
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
      tlsOptions: { servername },
      connTimeout: 15_000,
      authTimeout: 15_000,
    });

    const timer = setTimeout(() => {
      imap.destroy();
      reject(new Error("IMAP scan timed out"));
    }, SCAN_TIMEOUT_MS);
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

    const emails = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (openErr) => {
        if (openErr) return fail(openErr);

        imap.search([["SINCE", imapSinceDate(daysBack)]], (searchErr, results) => {
          if (searchErr) return fail(searchErr);
          if (!results || results.length === 0) return succeed([]);

          const fetch = imap.fetch(results.slice(-MAX_MESSAGES), {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)", "TEXT"],
            struct: true,
          });

          fetch.on("message", (msg) => {
            const email = { headers: {}, body: "" };

            msg.on("body", (stream, info) => {
              let buffer = "";
              // Keep draining the stream so IMAP can continue, but stop storing past the cap
              stream.on("data", (chunk) => {
                if (buffer.length < MAX_PART_BYTES) {
                  buffer += chunk.toString("utf8").slice(0, MAX_PART_BYTES - buffer.length);
                }
              });
              stream.once("end", () => {
                if (info.which.includes("HEADER")) email.headers = parseHeaders(buffer);
                else email.body = bodyText(buffer);
              });
            });

            msg.once("end", () => {
              if (email.headers.from) emails.push(email);
            });
          });

          fetch.once("error", fail);
          fetch.once("end", () => succeed(emails));
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
