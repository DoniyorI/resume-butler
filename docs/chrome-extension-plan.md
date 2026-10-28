# Chrome extension plan

Goal: when you apply to a job in your browser, Resume Butler records it automatically (company, role, posting link, job description, date), so the tracker is up to date before any email arrives. Email sync then has a real application to match confirmations, interviews and rejections against, instead of guessing from the email alone.

## How Simplify and Jobright do it

What's public: both are Manifest V3 Chrome extensions that autofill applications on job sites and log the jobs you apply to. Simplify's help docs say it tracks applications "to jobs that are in our database" and asks you to add others by hand. Neither documents its detection logic.

The technique, confirmed by inspecting their manifests (details in the next section):

1. **Content scripts on applicant tracking systems (ATS).** Most companies' "Apply" pages are hosted by a handful of ATS: Greenhouse (`boards.greenhouse.io`, `job-boards.greenhouse.io`), Lever (`jobs.lever.co`), Ashby (`jobs.ashbyhq.com`), Workday (`*.myworkdayjobs.com`), SmartRecruiters, iCIMS, Jobvite, plus LinkedIn Easy Apply and Indeed. The extension injects a script into those pages.
2. **One adapter per ATS.** Each adapter knows its site's page structure: where the job title, company and description are, what the form fields are (for autofill), and what "submitted" looks like.
3. **Detecting the submission**, in order of reliability:
   - the confirmation page or state the ATS shows after submitting (e.g. a URL ending in `/confirmation`, or a "Thank you for applying" message replacing the form)
   - the submit button click on a valid form, confirmed by the form disappearing
   - (some extensions) watching the page's own network request that submits the application
4. **Matching to a known job.** The job page details are captured before submitting, so the record is complete even though the confirmation page shows little.
5. **Sending it to their backend** with your account's token.

## What their extensions actually contain

Inspected on 2026-10-27: only manifests, file names, config shape and which browser APIs are used. No code was copied.

**Simplify Copilot 3.1.11** (installed in your Chrome):
- **Runs everywhere:** a content script on every site and every frame (`*://*/*`, `all_frames`). Permissions include `webRequest`, `webNavigation`, `tabs` and `cookies`, and it can talk to `*.simplify.jobs` through `externally_connectable`.
- **Detection is config-driven:** a `remoteConfig.json` maps 56 hiring platforms (Greenhouse, Lever, Ashby, Workday, iCIMS, SmartRecruiters, Taleo, LinkedIn, Indeed, Rippling and more) to fields like:
  - `urls`: which pages the entry covers
  - `trackedObjExtractors`: a URL pattern plus a template that pull out the job's ID
  - `applyButtonPaths`, `continueButtonPaths`, `submitButtonPaths`: where the buttons are
  - `submittedSuccessPaths`: selectors for what the page shows after a successful submit
  - `inputSelectors`: the form fields, for autofill

  The name and contents suggest it's refreshed from their server, so they can fix a broken site without publishing a new version.
- **Network as a backup:** the background worker also listens to `webRequest.onCompleted` (the network request finishing), and uses `webNavigation.onCompleted` for page loads.

**Jobright Autofill 1.25.1** (downloaded from Google's update server, then deleted):
- **Same broad access:** content scripts on all URLs and frames, plus `scripting`, `webNavigation`, `declarativeNetRequest`, `tabs` and `cookies`. Built with the Plasmo extension framework.
- **Separate scripts by job:** `ats-submission-resume` detects submissions, `applied-success-popup` shows the "applied" confirmation, and `field-discovery` finds form fields.
- **Network watchers for the hard platforms:** `*-submission-network-main` scripts for Workday, Oracle Cloud, SuccessFactors, BrassRing and ClearCompany. These are single-page apps with no clear confirmation page, so the scripts watch the page's own submit request instead (they wrap `XMLHttpRequest`).
- **Syncing with its web app:** a content script on `jobright.ai` (`agent-submission-sync`) passes data between the site and the extension, instead of `externally_connectable`.

**What this confirms for our design:**
- A per-site config (URLs, how to read the job, the submit button, the success state) beats hand-coded adapters, and can be updated from our server.
- Detect the success state first, and watch the submit request only on platforms that show nothing after submitting.
- A post-submit "applied?" prompt is normal practice. It's how Jobright handles sites it can't detect reliably.
- They ask for access to every site so they work anywhere. We can start narrower (the supported platforms only) and add optional access later.

## Can we copy it?

- **Looking is fine, copying isn't.** A Chrome extension is plain (usually minified) JavaScript on your machine, so its files can be read. Reading the manifest and a few files to learn which sites and permissions they use is reasonable research. Copying their code into ours would infringe their copyright and likely breaks their terms, and minified bundles aren't worth copying anyway.
- **What to look at:** `manifest.json` (permissions, `host_permissions`, `content_scripts.matches`), which shows exactly which ATS domains they support, and how they split content scripts, the background service worker and the popup.
- **How to get the files** (needs your OK, since it reads your browser profile or downloads a file):
  - if you have Simplify or Jobright installed in Chrome, their unpacked files are already in `~/Library/Application Support/Google/Chrome/Default/Extensions/<extension id>/`
  - otherwise, the Chrome Web Store serves the `.crx` (a zip) for any public extension

## What we'd build

### Extension (MV3, in `extension/` in this repo)

- **Per-site config** (like Simplify's), starting with Greenhouse, Lever and Ashby (simple, stable pages and most startup jobs), then Workday, LinkedIn Easy Apply and the rest. Each entry is data, not code, and can be updated from the app without republishing the extension:
  - `urls`: the pages it covers
  - how to read the job: `{ company, role, location, url, description }`
  - the submit button
  - the success state (a selector or text shown after submitting)
  - for single-page platforms like Workday, the submit request to watch instead
- **No prompts on supported sites:** a detected submission is added straight to the tracker. A small notice in the top-right corner says "Tracking application" when you click submit, then "Added to Resume Butler" with Undo.
- **Other sites:** "I applied to this" in the popup for now. A generic detector (a form with a resume upload) may come later, adding automatically the same way.
- **Popup:**
  - "Save this job" on any posting, for jobs you mean to apply to later
  - "Tailor my resume": sends the job description to the resume editor, which already knows how to tailor to a job
- **Background service worker:** queues records and sends them to the app, retrying when offline.
- **Permissions:** `storage`, plus host permissions only for the supported ATS domains. Optional permissions are requested when you use the generic fallback, so the install prompt stays short. The extension never reads browsing history and sends nothing unless an application is detected or you click.

### App side

- **Connecting (built, automatic):** when the extension is installed it opens `/extension/connect`. Signed-out visitors sign in first (email or Google) and come back. The page asks the extension whether it is already connected to this account (`type: "status"`, answered with `{ connected, email }`, never the token); if not, it creates a token and hands it over by itself:
  1. The extension's content script on our site sets `<html data-resume-butler-extension="<version>">`.
  2. The page posts `{ source: "resume-butler-app", type: "connect", token }` to its own origin (`window.postMessage`).
  3. The script stores the token and answers `{ source: "resume-butler-extension", type: "connected", ok: true }`.

  If nothing answers within 2 seconds, the page tries `externally_connectable` (when `NEXT_PUBLIC_EXTENSION_ID` is set), and finally shows the token once to paste in.
- **Connecting the extension (details):**
  - A "Connect the extension" button in the app creates a personal API token. It's stored hashed in a new `extension_tokens` table, and the user can revoke it.
  - The app hands the token to the extension through the content-script bridge above, with `externally_connectable` as a fallback when the extension ID is configured.
  - The extension never sees your Supabase session.
- **`POST /api/extension/applications`** (built): authenticates the token, validates and caps the input like every other route, and creates the application.
  - A matching posting link, or normalized company and exact role, fills missing details on an existing application only when it is open and within the same 120-day hiring cycle (`isSameCycle` in `src/server/email/matching.js`). Closed or older matches start a new application; existing user data is preserved.
  - It stores the job description, so tailoring and the match score work right away.
- **Email sync:**
  - matching (`src/server/email/matching.js`) finds these applications, so a later "Thanks for applying" email doesn't create a duplicate suggestion
  - an interview or rejection email queues a suggested status update on the right application for the user to approve
  - the daily auto-sync works the same way
- **Review step (decided and built):** a confirmed submission after a real submit click goes straight into the tracker with an "Added by the browser extension" note and Undo. A confirmation page reached without a submit click asks "Did you apply?" first. Email-derived changes use the review queue.

### Order of work

1. ~~Inspect Simplify's and Jobright's manifests.~~ Done (see above).
2. ~~App: `extension_tokens` (migration 008), the connect page (now `/extension/connect`, one step), and the API (`GET /api/extension/me`, `POST /api/extension/applications`, `DELETE /api/extension/applications/[id]` for undo).~~ Done and tested on 2026-10-27.
3. ~~Extension skeleton: manifest, background worker, popup, auto-connect.~~ Built in `extension/` (see its README).
4. ~~Greenhouse, Lever and Ashby: read the job and detect submission.~~ Built; the readers are checked on live postings. Still to confirm with one real application per site. Test on real postings, without submitting real applications (use the confirmation page markup, or postings you actually apply to).
5. ~~LinkedIn Easy Apply.~~ Built and confirmed on real Easy Apply submissions. LinkedIn's new server-driven Easy Apply has no stable markup, so it's confirmed by its submit request succeeding (`webRequest`, URL and status only), with the "Submit application" click and the brief `/jobs/view/<id>/post-apply/` page as backups.
5a. ~~Job details.~~ The posting's pay range, workplace and employment type (JSON-LD, else parsed from the description) and the site are saved with the application (migration 010).
6. Workday adapter, and a generic detector for other sites. Workday is the hardest: multi-step, dynamic pages.
7. Autofill from the Master CV. This is the biggest piece and optional; tracking works without it.
8. Chrome Web Store listing: privacy policy, screenshots, review.

## Decisions

- ~~Straight into the tracker, or through the review queue?~~ Straight in after a real submit click, with undo; a confirmation page reached without a click asks "Did you apply?" first.
- ~~Which sites first?~~ LinkedIn Easy Apply, Greenhouse, Lever and Ashby. Workday next.
- Still open: is autofill in scope, or just tracking and "tailor my resume"?
