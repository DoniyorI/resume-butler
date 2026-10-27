# Resume Butler Chrome extension

Adds the jobs you apply to on Greenhouse, Lever and Ashby to your Resume Butler tracker, with the posting's description, so email sync can keep their status up to date. Plain Manifest V3: no build step.

## Install (development)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. A Resume Butler tab opens and connects the extension to your signed-in account by itself. To use the local app instead, sign in at `http://localhost:3000`, then click the extension's toolbar icon and choose **Connect to localhost:3000 instead**.

After changing files here, click the reload button on the extension's card in `chrome://extensions`, then reload the job page.

## How it works

| File | What it does |
|---|---|
| `manifest.json` | Permissions: `storage`, `alarms`, `tabs`, and only the app and the three job sites |
| `background.js` | Holds the connection, sends applications to the app (`/api/extension/*`), retries when offline, undo |
| `content/app-bridge.js` | On the app: marks the page as having the extension and receives the token (no copy and paste) |
| `content/sites.js` | Per-site rules: how to read the job and recognise a submitted application |
| `content/job-reader.js` | Reads company, role, location and description (JSON-LD first, then the site's selectors) |
| `content/detector.js` | Remembers postings, spots the submission, reports it |
| `content/toast.js` | The "Added to Resume Butler, Undo" notice on the job site |
| `popup/` | Status, "I applied to this" for the current tab, recent additions with Undo |

A submission counts when the site moves to its confirmation page (Greenhouse `/confirmation`, Lever `/thanks`), or when a "thanks for applying" message appears after you click submit that wasn't on the page before (Ashby, and the others as a fallback). It's added automatically only if you clicked submit for that job in this browser session; otherwise the notice asks "Did you just apply?" first, so a page that shows or frames a confirmation can't add jobs.

Security: popup-only actions (status, manual add, disconnect) answer only the extension's own popup, the token never leaves the background worker, undo accepts only this browser's recent additions, `http://localhost:3000` is trusted only by unpacked (development) installs, only real (trusted) clicks count, and submissions are accepted from top-level pages or Greenhouse's embedded form only, with "Did you just apply?" shown and accepted only at the top level.

The plan, including what comes next (more sites, autofill, the Web Store), is in `docs/chrome-extension-plan.md`.

## Known gaps

- Detecting the submission is only tested against the sites' confirmation wording and URLs, not a real submitted application yet. Apply to one real job on each site to confirm.
- **Disconnect** in the popup forgets the token in this browser; to revoke it everywhere, use **Disconnect** on the app's Browser extension page.
- Workday, LinkedIn Easy Apply and other sites aren't supported yet. On those, use **I applied to this** in the popup.
