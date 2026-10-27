# Chrome extension plan

Goal: when you apply to a job in your browser, Resume Butler records it automatically (company, role, posting link, job description, date), so the tracker is up to date before any email arrives. Email sync then has a real application to match confirmations, interviews and rejections against, instead of guessing from the email alone.

## How Simplify and Jobright do it

What's public: both are Manifest V3 Chrome extensions that autofill applications on job sites and log the jobs you apply to. Simplify's help docs say it tracks applications "to jobs that are in our database" and asks you to add others by hand. Neither documents its detection logic.

The standard technique, which their manifests' permissions point to (to be confirmed by inspecting them, see below):

1. **Content scripts on applicant tracking systems (ATS).** Most companies' "Apply" pages are hosted by a handful of ATS: Greenhouse (`boards.greenhouse.io`, `job-boards.greenhouse.io`), Lever (`jobs.lever.co`), Ashby (`jobs.ashbyhq.com`), Workday (`*.myworkdayjobs.com`), SmartRecruiters, iCIMS, Jobvite, plus LinkedIn Easy Apply and Indeed. The extension injects a script into those pages.
2. **One adapter per ATS.** Each adapter knows its site's page structure: where the job title, company and description are, what the form fields are (for autofill), and what "submitted" looks like.
3. **Detecting the submission**, in order of reliability:
   - the confirmation page or state the ATS shows after submitting (e.g. a URL ending in `/confirmation`, or a "Thank you for applying" message replacing the form)
   - the submit button click on a valid form, confirmed by the form disappearing
   - (some extensions) watching the page's own network request that submits the application
4. **Matching to a known job.** The job page details are captured before submitting, so the record is complete even though the confirmation page shows little.
5. **Sending it to their backend** with your account's token.

## Can we copy it?

- **Looking is fine, copying isn't.** A Chrome extension is plain (usually minified) JavaScript on your machine, so its files can be read. Reading the manifest and a few files to learn which sites and permissions they use is reasonable research. Copying their code into ours would infringe their copyright and likely breaks their terms, and minified bundles aren't worth copying anyway.
- **What to look at:** `manifest.json` (permissions, `host_permissions`, `content_scripts.matches`), which shows exactly which ATS domains they support, and how they split content scripts, the background service worker and the popup.
- **How to get the files** (needs your OK, since it reads your browser profile or downloads a file):
  - if you have Simplify or Jobright installed in Chrome, their unpacked files are already in `~/Library/Application Support/Google/Chrome/Default/Extensions/<extension id>/`
  - otherwise, the Chrome Web Store serves the `.crx` (a zip) for any public extension

## What we'd build

### Extension (MV3, in `extension/` in this repo)

- **Content scripts** for Greenhouse, Lever and Ashby first (simple, stable pages and most startup jobs), then Workday, LinkedIn Easy Apply and the rest. Each adapter exports:
  - `readJob()`: `{ company, role, location, url, description }` from the posting
  - `isSubmitted()`: whether the confirmation state is showing
- **Generic fallback** for any other site: when a page has a form with a resume upload and you submit it, show a small prompt: "Did you just apply to Role at Company? Add it to Resume Butler." One click to confirm, so there are no silent false positives.
- **Popup:**
  - "Save this job" on any posting, for jobs you mean to apply to later
  - "Tailor my resume": sends the job description to the resume editor, which already knows how to tailor to a job
- **Background service worker:** queues records and sends them to the app, retrying when offline.
- **Permissions:** `storage`, plus host permissions only for the supported ATS domains. Optional permissions are requested when you use the generic fallback, so the install prompt stays short. The extension never reads browsing history and sends nothing unless an application is detected or you click.

### App side

- **Connecting the extension:**
  - A "Connect the extension" button in the app creates a personal API token. It's stored hashed in a new `extension_tokens` table, and the user can revoke it.
  - The app hands the token to the extension through `externally_connectable` (only our domain can talk to the extension).
  - The extension never sees your Supabase session.
- **`POST /api/extension/applications`** (already planned in CLAUDE.md as the extension API): authenticates the token, validates and caps the input like every other route, and creates the application.
  - If an application for the same company and role already exists, it's updated instead.
  - It stores the job description, so tailoring and the match score work right away.
- **Email sync:**
  - matching (`src/server/email/matching.js`) finds these applications, so a later "Thanks for applying" email doesn't create a duplicate suggestion
  - an interview or rejection email becomes a status update on the right application
  - the daily auto-sync works the same way
- **Review step:** applications from the extension can go straight into the tracker, since you just applied, or into the existing review queue. My recommendation is straight in, with an "Added by extension" note and an undo.

### Order of work

1. Inspect Simplify's and Jobright's manifests to confirm the ATS list and permissions. Read only, with your OK.
2. App: `extension_tokens` migration, the connect flow, and `POST /api/extension/applications`, with tests against the email matcher.
3. Extension skeleton: manifest, background worker, popup with "Save this job", loaded unpacked in Chrome.
4. Greenhouse, Lever and Ashby adapters: read the job and detect submission. Test on real postings, without submitting real applications (use the confirmation page markup, or postings you actually apply to).
5. Generic fallback prompt.
6. Workday and LinkedIn adapters. These are the hardest: multi-step, dynamic pages.
7. Autofill from the Master CV. This is the biggest piece and optional; tracking works without it.
8. Chrome Web Store listing: privacy policy, screenshots, review.

## Open decisions

- Straight into the tracker, or through the review queue? (Recommended: straight in, with undo.)
- Which sites first, if not Greenhouse, Lever and Ashby?
- Is autofill in scope, or just tracking and "tailor my resume"?
