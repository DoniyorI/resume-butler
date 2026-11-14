# Watchlist: verification

November 14, 2026. Covers roadmap milestone M7 (formerly RB-13).

## What changed

- **Watchlist page (`/watchlist`).** Paste the link to a company's public job board on Greenhouse, Lever or Ashby, with optional title keywords. The server reads the board and keeps the open roles whose title matches a keyword (all roles when there are none).
- **Roles scored for fit.** Each kept role shows the same fit band as Saved jobs, computed from its description and the Master CV, and the list is ordered strongest first.
- **Save or dismiss.** "Save" turns a role into a saved job with its description, location and link, so tailoring, applying and tracking continue from there. "Dismiss" hides it.
- **Kept current.** A board is re-read when the page is opened and its last check is over 12 hours old, on "Check now", and once a day by a scheduled job. A role that leaves the board is marked closed, not deleted.
- **Today.** A strong or good fit on the watchlist that is not saved or dismissed is suggested on the dashboard, with its reason.

This is the product's answer to job discovery: boards the user names, not a job marketplace. No AI is involved.

## What the server will fetch

The board link is only parsed for a platform and a board token. The server never fetches a URL the user typed.

- Three fixed hosts: `boards-api.greenhouse.io`, `api.lever.co`, `api.ashbyhq.com`.
- The token must match `^[A-Za-z0-9_-]{1,100}$`.
- Redirects are refused, the request times out after 15 seconds, and the body is capped at 15 MB.
- Posting links are rebuilt from the platform, token and posting id; a URL from the board's response is never stored.
- Titles, locations and descriptions are stripped to plain text, with control characters, NUL and lone surrogates removed, and capped before they are stored.
- A board whose roles cannot be read is recorded as an error and closes nothing. A board that reports no roles at all is believed only on the second check in a row; the first one leaves the stored roles open.

## Migration 021

`supabase/migrations/021_watchlist.sql` creates `watched_companies` and `watched_postings`. It is applied to the hosted database (see below). On a database without it the Watchlist page says the migration is needed and nothing else is affected.

The migration is additive: two tables, their indexes, policies and triggers, one new function, and two new keys in the per-user rate limiter (`watchlist-add`, 20 an hour; `watchlist-check`, 60 an hour). It changes no existing data.

**Server-managed columns.** A signed-in user can insert only `user_id, platform, board_token, name, title_keywords` and update only `name, title_keywords` on a watched company. The last-check time, error and open count are written through `record_watch_check`, which checks ownership. Without this a user could reset their own check time to force re-reads or to take the daily job's attention from other users.

**Caps.** 20 companies and 2,500 postings per user, enforced by triggers; 100 roles are kept per company on each read.

## Evidence

- **SQL on a real Postgres:** `scripts/qa-watchlist-sql.mjs` applies migrations 001–021 to a disposable PGlite database and passes 108 assertions: owner access; another signed-in user cannot read, change or delete rows, or attach a posting to someone else's company (the composite foreign key); anonymous access is refused; the server-managed columns cannot be inserted or updated directly; `record_watch_check` refuses another user's company; both caps hold; every CHECK rejects its bad value; removing a company removes its postings; the limiter accepts the two new keys and still refuses an unknown one.
- **Tests:** 522 pass with `npm test` on Node 26.3.0, and on Node 24 in the `Checks` workflow (run 43516809530). The watchlist tests cover link parsing for each platform and its refusals, each adapter against recorded board shapes, the text cleaning, keyword matching, the refresh paths (new, still open, closed, failed read), saving and dismissing, the missing-table path, the scheduled job's per-user limit, and the Today rule with its suppression.
- **Lint and build:** clean; the production build ran on an isolated copy of the committed tree.
- **Signed-in browser flow:** `scripts/qa-watchlist.mjs` passed its full path against `localhost:3000` and the migrated database: add a company (one live read of a public Ashby board: 36 of 76 roles kept by the keywords), see roles with fit bands, save one and find it in Saved jobs, dismiss one, edit keywords, confirm a second user sees none of it, the page at 375px, remove the company. No page errors; both disposable accounts were removed.
- **Review:** the automated security review of the feature commit found the two issues described under "Server-managed columns" and an unlimited `refreshStaleBoards`; all were fixed before the migration was applied. An independent review's findings (an empty board closing every role, unsafe characters in board text, missing rate limits, stored board URLs) were fixed earlier.

## Migration applied

Migration 021 was applied to the hosted database on November 14, 2026 through the Supabase SQL editor. The text run was checked against the committed file by SHA-256 before running; a follow-up catalog query confirmed both tables, row-level security, the policies, the triggers and the column grants.

## Not verified

- **The scheduled job in production.** `GET /api/cron/watchlist` is unit-tested and authorized by `CRON_SECRET` like the email job; its first real run is the day after deployment.
- **Live reads of Greenhouse and Lever.** Their adapters are tested against recorded response shapes; the browser run read one Ashby board.
- **The watchlist suggestion on Today in a browser.** It is unit-tested.

## Known limits

- **Only companies the user names,** and only boards on Greenhouse, Lever or Ashby. Lever's EU host is not supported.
- **Title keywords take effect at the next check.** Editing them does not re-filter the stored roles.
- **Descriptions are capped at 20,000 characters,** so fit on a very long posting reads the first part.
- **"First seen" is the same for every role right after a company is added.**
- **The scheduled job reads at most five companies per user per run;** the rest are refreshed on the next run or when the page is opened.
- **No notification leaves the app** when a new role appears.
