# Resume Butler Chrome extension

Adds the jobs you apply to on LinkedIn Easy Apply, Greenhouse, Lever and Ashby to your Resume Butler tracker, automatically, with the posting's description, so email sync can keep their status up to date. Plain Manifest V3: no build step.

## Install (development)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. A Resume Butler tab opens at `/extension/connect` and connects the extension by itself. If you're signed out, sign in (email or Google) and it brings you back and connects. To use the local app instead, sign in at `http://localhost:3000`, then click the extension's toolbar icon and choose **Connect to localhost:3000 instead**.

After changing files here, click the reload button on the extension's card in `chrome://extensions`. The extension re-adds its scripts to job site and app tabs that are already open, so they don't need a reload.

## How it works

| File | What it does |
|---|---|
| `manifest.json` | Permissions: `storage`, `alarms`, `tabs`, `scripting` (to add the scripts to tabs already open on install or update), `webRequest` (to see LinkedIn's Easy Apply submit request succeed: its URL and status only), and only the app and the supported job sites |
| `background.js` | Holds the connection, sends applications to the app (`/api/extension/*`), retries when offline, undo |
| `content/app-bridge.js` | On the app: marks the page as having the extension and receives the token (no copy and paste) |
| `content/sites.js` | Per-site rules: how to read the job and recognise a submitted application |
| `content/job-reader.js` | Reads company, role, location and description (JSON-LD first, then the site's selectors) |
| `content/detector.js` | Remembers postings, spots the submission, reports it |
| `content/toast.js` | The "Added to Resume Butler, Undo" notice on the job site |
| `popup/` | Status, "I applied to this" for the current tab, recent additions with Undo |

A submission counts when the site moves to its confirmation page (Greenhouse `/confirmation`, Lever `/thanks`), or when a "thanks for applying" / "Your application was sent" message appears after you click submit that wasn't on the page before (LinkedIn Easy Apply, Ashby, and the others as a fallback). When you clicked submit for that job, it's added automatically: a "Tracking application" notice appears in the top-right corner, then "Added to Resume Butler" with Undo. A confirmation page with no submit click first (a link opened directly, say) only asks "Did you apply?" with an Add button. On LinkedIn the success text counts only inside the Easy Apply dialog.

Security: popup-only actions (status, manual add, disconnect) answer only the extension's own popup, the token never leaves the background worker, undo accepts only this browser's recent additions, `http://localhost:3000` is trusted only by unpacked (development) installs, only real (trusted) clicks count, and submissions are accepted from top-level pages, or from Greenhouse's embedded form only after a submit click there.

The plan, including what comes next (more sites, autofill, the Web Store), is in `docs/chrome-extension-plan.md`.

## Known gaps

- Detecting the submission is only tested against the sites' confirmation wording and URLs, not a real submitted application yet. Apply to one real job on each site to confirm.
- **Disconnect** in the popup forgets the token in this browser; to revoke it everywhere, use **Disconnect** on the app's Browser extension page.
- LinkedIn's new Easy Apply (server-driven, no stable class names) is confirmed by its submit request succeeding (the background worker watches that one URL, observe-only), with the "Submit application" click and the brief `/jobs/view/<id>/post-apply/` page as backups. The company comes from the dialog's "Apply to <company>" heading or that URL; the role from the posting page's title, so it can be blank when you apply from search results.
- Workday and other sites aren't supported yet. On those, use **I applied to this** in the popup.
