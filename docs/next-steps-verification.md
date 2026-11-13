# Next steps and Today: verification

November 13, 2026. Covers roadmap milestone M4 (formerly A7).

## What changed

- **Dated steps on each application.** Follow-up, assessment, recruiter screen, interview, offer deadline or task, with a date, an optional time, a contact, a link and notes. A step can be marked done, reopened, cancelled, rescheduled or deleted.
- **Today on the dashboard.** Overdue steps, those due today and the next seven days, each one click from done.
- **Suggested next steps.** Six rules, in order: an offer with no recorded deadline; an interview with nothing planned after it; a recruiter who reached out and has no reply planned; no reply since applying (the existing 14-day rule); inbox updates waiting for review; saved jobs waiting for a decision. Each suggestion states its reason. They are computed on every load, never stored, and involve no AI. An open step for the same purpose removes the suggestion.

## Migration 020

`supabase/migrations/020_application_activities.sql` creates `application_activities`. It is applied to the hosted database (see below). On a database without it the suggestions work, the Today card says that dated steps need migration 020, and the application page shows one line in place of the Next steps card. Nothing else is affected.

The migration is additive: one new table, one unique index on `applications(id, user_id)`, one trigger function. It changes no existing data.

## Evidence

- **SQL on a real Postgres:** `scripts/qa-next-steps-sql.mjs` applies migrations 001–020 to a disposable PGlite database and passes 37 assertions: the owner can insert, read, update, complete and delete; another signed-in user cannot read, change or delete the row, cannot insert under someone else's id, and cannot attach or re-point a step to someone else's application (the composite foreign key); anonymous access is refused; deleting an application removes its steps; every CHECK rejects its bad value; the 2,001st step for one user is refused while another user can still add; applying 020 twice fails without partial state.
- **Tests:** 416 pass with `npm test` on Node 26.3.0, and on Node 24 in the `Checks` workflow. They cover each suggestion rule with its suppression, ownership on every read and write, status transitions, the missing-table path, and the time-zone cases below.
- **Lint and build:** clean; the production build ran on an isolated copy of the committed tree.
- **Signed-in browser flow, pre-migration:** `scripts/qa-next-steps.mjs` passed against `localhost:3000` and the hosted database as it is today: the Today card shows the three expected suggestions for seeded applications, the application page shows the migration line and still saves, no page errors. The disposable account was removed.
- **Review:** an independent review found no authorization or schema defect and confirmed the dashboard's existing figures are unchanged. Its eleven behavioural findings were fixed, including moving the per-user cap into the database, where it cannot be bypassed.

## Migration applied and full flow verified

Migration 020 was applied to the hosted database on November 13, 2026 through the Supabase SQL editor. The text run was checked against the committed file by SHA-256 before running; the result was "Success. No rows returned", and a follow-up query confirmed the table, row-level security, four policies and both triggers.

`scripts/qa-next-steps.mjs` then ran its full path against the migrated database and passed every step: add an assessment and a timed interview (stored with `America/New_York`), see both in Today, complete one from Today, reschedule the other, delete, and confirm that attaching a step to a second user's application is refused by the foreign key (`23503`). No page errors; both disposable accounts were removed.

## Known limits

- **Time zones.** A timed step keeps the zone it was entered in and is edited in that zone. A local time that does not exist on its date (the spring-forward hour) is refused. Today groups by the viewer's local date.
- **Suggestions use the server's date** for their thresholds; the reason names the applied date instead of a day count so it cannot be a day off.
- **No reminders leave the app.** There is no email, push or calendar entry yet.
- **Contacts are fields on a step,** not a shared address book.
- **An offer has a deadline step but no record of its terms.** That is M8.
- **Today shows at most 20 overdue steps** and counts the rest.
