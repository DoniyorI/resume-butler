// IMAP servers the email sync is allowed to connect to. Restricting this keeps
// users from pointing the server at internal or arbitrary hosts (SSRF).
export const ALLOWED_IMAP_HOSTS = [
  "imap.gmail.com",
  "imap-mail.outlook.com",
  "outlook.office365.com",
  "imap.mail.yahoo.com",
  "imap.mail.me.com",
];

export const IMAP_PORT = 993;

export function normalizeImapHost(host) {
  return String(host || "").trim().toLowerCase();
}

export function isAllowedImapHost(host) {
  return ALLOWED_IMAP_HOSTS.includes(normalizeImapHost(host));
}
