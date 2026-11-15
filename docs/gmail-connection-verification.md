# Gmail connection verification (M10)

November 15, 2026. "Connect Gmail with Google" reads the inbox through the read-only Gmail API, next to the existing IMAP app-password connection. Scans, the daily auto-sync, classification, matching and the review queue are shared; only the reader differs.

## What was built

- `GET /api/gmail/connect` sends the signed-in user to Google's consent page asking for `gmail.readonly` only, with `access_type=offline` and `prompt=consent`. The state is 32 random bytes, kept with the user's ID in an httpOnly, SameSite=Lax cookie scoped to `/api/gmail` for 10 minutes.
- `GET /api/gmail/callback` refuses a missing, forged, expired or other user's state, reports a denial, exchanges the code, refuses a grant without the Gmail permission (and revokes it), reads the mailbox address from the Gmail profile and stores the connection. Outcomes go back to `/email-sync?gmail=connected|denied|scope|expired|unavailable|setup|failed`; the page shows known outcomes only.
- `email_connections` gains `provider` and `oauth_refresh_token` (migration 023). The refresh token is AES-256-GCM encrypted with `APP_ENCRYPTION_KEY`, never selected for the browser and listed in `NEVER_EXPORT`. A database check requires the secret that matches the provider.
- `fetchGmailEmails` refreshes an access token per scan, lists `in:inbox` with the same Gmail search the IMAP reader uses over X-GM-RAW (date window, Promotions/Social/Forums excluded), reads up to 300 newest messages with `format=full` (6 at a time, one start every 45 ms, about half of Gmail's roughly 250 units a second per user; the listing is retried the same way; retrying a rate limit up to three times with 1, 2 and 4 second waits and leaving a message still refused for the next scan; a 32-second budget, after which the messages already read are kept and the rest wait for the next scan), skips attachments, honors each part's charset and keeps the `Message-ID` header, so mail already processed over IMAP is not processed again. It calls only `oauth2.googleapis.com` and `gmail.googleapis.com`.
- Revoked or expired access (`invalid_grant`, 401, 403) gives "Reconnect Gmail in Inbox"; the daily auto-sync records the same message. Replacing a Gmail connection (with Google again or with an app password) and Disconnect revoke the old token.
- A connected app-password inbox at a Gmail address shows "Switch to Google sign-in" (added after the owner's first try: the Google button only appeared without a connection). The round trip replaces the row in place, clears the app password and keeps the daily-sync setting.
- Before migration 023, every connection read falls back to the IMAP-only columns and the Google round trip reports that the migration is needed (and revokes the token). Without both Google keys the button is hidden and `/api/gmail/connect` reports "not set up".

## Checks run

| Check | Result |
| --- | --- |
| `npm test` (Node 24 in CI): 17 new tests in `tests/gmail.test.mjs` and `tests/email-sync-gmail.test.mjs` | 667 pass locally before docs; CI result recorded in the commit's checks run |
| Mutation: removing the user check from the state comparison | "another user's state" test fails, as it should |
| `npm run lint`, isolated `next build` of the working tree | Clean; both routes build as dynamic |
| `scripts/qa-gmail-connect.mjs pre` (before migration 023), signed in, disposable user | All pass: no button without keys; "not set up" notice; an IMAP connection still loads on Inbox and the dashboard; with placeholder keys the button links to the consent URL with read-only scope, offline access and the `localhost:3001` callback; the state cookie is httpOnly on `/api/gmail` and not sent to pages; a forged state and a denial store nothing; signed out, both routes go to sign-in |
| Migration 023 in the Supabase SQL editor | Columns absent beforehand; file SHA-256 `05f7eb92…902b` matched in the editor; "Success"; catalog shows both columns, both checks, and the existing 2 connections as `imap` |
| `scripts/qa-gmail-connect.mjs post` | All pass, plus: a stored Gmail row shows "Gmail, connected with Google (read-only)"; a row without a token is refused by the check; Scan Now makes a real call to Google, which rejects the placeholder client, and the user sees "Reconnect Gmail" with no token in the response; Disconnect removes the row; a new IMAP row defaults to `imap` |
| `scripts/qa-dashboard-report.mjs` after the migration | All 14 steps pass |

## Not verified

- The round trip with a real Google account and a real OAuth client: it needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the owner's Google Cloud project (setup in the README). After setting them: open Inbox, Connect Gmail with Google, approve, then Scan Now.
- Message decoding against real Gmail payloads beyond the recorded shapes in the tests (multipart, HTML-only, ISO-8859-1, list headers).

## First real use (November 15)

The owner's first scan over Google failed: reading 300 messages 8 at a time hit Gmail's per-user rate limit (`403 rateLimitExceeded` on message reads, found once errors were logged with their step and reason), and every 403 was then shown as "Reconnect Gmail". Fixed by mapping errors on Google's reason (only a lost grant or missing permission asks to reconnect) and by pacing and retrying message reads. A paced scan then read 256 of 300 messages with no errors; the remaining 44 and the next scan's listing were refused while Gmail's temporary per-user block from the earlier bursts lasted, so the pace was halved again and the listing is retried too. The next scan, after the block cleared, ran out of its 25-second budget and discarded what it had read; the budget is now 32 seconds and running out keeps the messages already read.

That scan read 129 of 300 messages in 33 seconds with no errors, all already processed over IMAP: every scan was re-reading the newest 300 messages, spending Gmail's per-user quota on mail already handled and leaving the oldest messages in the window waiting. Scans now remember the Gmail ids they finished with (`gmail_seen_ids`, migration 024): a message already processed, one that is never a candidate under any category setting, an unusable or deleted one, and one recorded after classification. Deferred, failed and unclassified messages are not remembered, so they are read again. Listing skips remembered ids (up to 2,000 listed), so after one full pass a scan reads only new mail.

## Known limits

- In Google's Testing mode, Gmail refresh tokens expire after 7 days; publishing the OAuth app removes that (unverified apps show a warning and are capped at 100 users). A public release with a restricted scope needs Google's verification and security assessment.
- Like IMAP, only the inbox is read: mail archived by a filter before the scan is not seen.
- The 300-message cap reports Gmail's estimate of what was left out, not an exact count.
