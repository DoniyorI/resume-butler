import "server-only";

// Shared by the IMAP and Gmail readers so both hand the scan the same message shape

export const MAX_BODY_CHARS = 3000;

export function htmlToText(html) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Mailing-list and bulk headers mark newsletters and job alerts. `has` and `get` read a header by
// its lower-case name.
export function isBulkMail({ has, get }) {
  const precedence = String(get("precedence") || "").toLowerCase();
  return has("list") || ["bulk", "list", "junk"].includes(precedence);
}

export const bodyText = (text) => String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_BODY_CHARS);

// Gmail tabs that never hold application emails (confirmations land in Primary or Updates)
const GMAIL_EXCLUDED_CATEGORIES = "-category:promotions -category:social -category:forums";
const gmailDate = (d) => `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

// Gmail search for [since, before) (before: is exclusive), used over IMAP (X-GM-RAW) and the Gmail API
export const gmailSearch = ({ since, before }) =>
  `after:${gmailDate(since)} before:${gmailDate(before)} ${GMAIL_EXCLUDED_CATEGORIES}`;
