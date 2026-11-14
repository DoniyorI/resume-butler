# Offers, export and import: verification

November 14, 2026. Covers roadmap milestone M8 (formerly A10).

## What changed

- **Offer record.** An application at Offered gets an Offer card: base pay with period and currency, bonus, equity, benefits, start date, the date the offer arrived, a decide-by date and notes. "Accept offer" and "Decline offer" record the decision and its date; declining can move the application to Withdrew. The applications table shows "Accepted" or "Declined" beside the status. The status list itself is unchanged.
- **Closing the search.** For 60 days after an offer is accepted, Today shows one suggestion, "Close out your search", naming the other applications still open, and the suggestions that start new threads (follow-ups, saved jobs, the watchlist) go quiet.
- **Full export.** Profile has a "Your data" card: everything the account holds as one JSON file, or all applications as CSV. The CSV button on the applications table now exports every application, not only the rows loaded on the page.
- **CSV import.** `/applications/import` reads a spreadsheet export, shows what will happen to every row, and imports only after confirmation. An import can be undone for an hour.

No AI is involved in any of it.

## The decide-by date

It is not a column on the offer. It is the open "Offer deadline" step under Next steps, so it also appears in Today. Saving a date creates or reschedules that step, clearing the date cancels it, and accepting or declining completes it. Once an offer is decided the field is hidden and saving the terms again does not bring the step back.

## What the export contains

Profile, Master CV, applications with their status history, next steps, offers and submitted versions, resumes, cover letters, saved jobs, the watchlist, pending inbox updates, the answer library, and the settings of the email connection and extension tokens.

**Never exported:** the email password, extension token hashes, lock tokens, idempotency hashes and PDF bytes (`NEVER_EXPORT` in `src/server/export/exportData.js`). Also left out, and listed in the file's own `summary.notIncluded`: scanned-email records, rate-limit counters, extension ingest events, deletion markers, and the description text of watched postings.

The file ends with a summary: row counts, any section that could not be read (`incomplete`) and any cut off at 20,000 rows (`truncated`). The page warns when either list is non-empty, and refuses to save a download that was cut off part-way.

## What the import will and will not do

- **Reads** comma, semicolon or tab separated files up to 1 MB, the first 500 rows and 40 columns; it says so when a file has more.
- **Columns** are matched from their headings and can be changed in the preview. Company is required.
- **Dates:** ISO, numeric day/month or month/day (detected from the column, selectable, and called out when the column mixes both), and English month names. A row with no readable date is skipped unless the user chooses "Import them dated today". The database's default date is never used silently.
- **Statuses** map to the app's seven. A value it does not know imports as Applied with `Imported status: <value>` kept in the notes, and the preview lists those values. Rows with no status are counted in the preview.
- **Duplicates** (same company, role and applied date, or same company and link, against existing applications and earlier rows) are skipped unless the user ticks the box.
- **Cells that start with `=`, `+`, `-` or `@`** are written with a leading apostrophe on export and read back clean on import.
- **The server re-plans from the uploaded file on commit;** a plan sent by the browser is never trusted.

## Migration 022

`supabase/migrations/022_offers_and_portability.sql` creates `application_offers` and adds two keys to the per-user rate limiter: `export-data` and `import-applications`, 10 an hour each. It is additive and changes no existing data.

It was applied to the hosted database on November 14, 2026 through the Supabase SQL editor. The text run was checked against the committed file by SHA-256 before running; the result was "Success. No rows returned", and a catalog query confirmed the table with row-level security, four policies, the trigger, both foreign keys and the two keys.

On a database without it: the Offer card is one line saying the migration is needed, the applications table and Today work without offer data, and export and import answer "This feature needs the latest database migration."

## Evidence

- **SQL on a real Postgres:** `scripts/qa-offers-sql.mjs` applies migrations 001–022 to a disposable PGlite database and passes 46 assertions: owner access; another signed-in user cannot read, change or delete an offer, insert under someone else's id, or attach an offer to someone else's application (the composite foreign key); anonymous access is refused; one offer per application; every CHECK rejects its bad value, including a decision without a date and a date without a decision; deleting an application removes its offer; the limiter accepts the two new keys, keeps the old ones and still refuses an unknown key. The earlier scripts for migrations 020 and 021 still pass.
- **Tests:** 589 pass with `npm test` on Node 26.3.0, and on Node 24 in the `Checks` workflow. New tests cover the offer service and its deadline step in every transition, the new suggestion rules with their 60-day boundary, the CSV reader and writer (quoting, delimiters, BOM, formula guard, a 1 MB input in linear time), the export (secrets absent, every query scoped, child tables read through parent ids, paging, the cap, a missing table against a failed read), the import planner (headings, statuses, every date format, date order, duplicates, caps) and its database side (unique violations, failures, the time budget, undo scoped to the user and the hour), and the rate limiter.
- **Lint and build:** clean; the production build ran on an isolated copy of the committed tree. Lint now fails on an undefined name (`no-undef`), after the browser check found a component using `useState` without importing it.
- **Signed-in browser flow:** `scripts/qa-offer-export-import.mjs` passed every step against `localhost:3000` and the migrated database: save an offer and reload it; the deadline in Today; accept (decision stored, step completed, "Decide by" hidden, saving notes again creates no step); "Close out your search" on the dashboard and "Accepted" in the table; change the decision and decline with Withdrew; the JSON export (valid, three applications, one offer, no secret column names, a real download from the Profile card); the CSV export; an import preview with exactly 2 ready, 2 already tracked, 1 without a date and 1 problem; commit; undo; a second user sees none of it; no horizontal overflow at 375px; no page errors. Both disposable accounts were removed.
- **Review:** an independent review found no authorization or data-exposure defect. Nine of its eleven behavioural findings were fixed; the other two are the first two limits below. A separate check of the export against every migration found each table correctly scoped and no credential or hash column exported.

## Known limits

- **The import preview is not rate limited.** It needs a sign-in and is bounded by the 1 MB file limit; only the commit counts against the hourly limit.
- **Undo removes the imported applications as they are now,** including changes made to them since. The page says so, and it is available for one hour.
- **CSV only.** Excel and Google Sheets both export it. Spreadsheet serial-number dates are not guessed.
- **Imported rows carry no job description, resume or documents,** and a pay cell that cannot be read is kept in the notes.
- **The export cannot be re-imported.** It is a readable backup; restoring an account from it is not built.
- **PDF files are not in the export,** only their details. Each can still be downloaded from Documents.
- **Offers are not compared side by side,** and equity and bonus are free text.
- **Self-service account deletion is still not available.**
