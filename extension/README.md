# Resume Butler Chrome extension

Save openings before applying, choose a working resume, compare job keywords, and automatically track submissions on LinkedIn Easy Apply, Greenhouse, Lever and Ashby. Version0.5.0 includes updated LinkedIn capture; reviewed filling remains available on English Lever application forms. Plain Manifest V3: no build step.

## Job details and resume comparison (0.5.0)

LinkedIn's generated-class layout is read using posting-linked metadata and the **About the job** expandable description. Salary, workplace and employment chips are tied to the current posting, including search-result links. The reader rejects a panel still showing another job during navigation, captures details after they finish loading, and preserves them when confirmation pages show little. Generated class changes do not affect this path. Geographic location is only captured when provided; **Remote** does not imply a particular city. Published metadata pay takes priority over a different range in the description. Missing or ambiguous details still require review. Older selectors and matching structured job data remain supported.

In the toolbar popup, choose a working resume or leave **Master CV / decide later**, then select **Compare with job**. The **Resume match** panel shows unweighted keyword coverage and expandable matched/missing terms using the app's existing deterministic checker. Only visible selected-resume content counts; Master CV comparison includes owned skills, experience, projects, education, certifications and custom sections. It uses the current description in **Review captured details**, including your corrections, and the saved resume/CV at request time. Changing source or description clears the result; compare again after editing the source elsewhere. No recognized terms means no numeric score.

This is wording coverage, not proficiency, interview probability, experience-duration/eligibility verification or PDF readability. It makes no AI calls. Comparison is an explicit popup action: resume contents remain server-side, and the posting page receives neither your resume nor the result. The connection and current tab are checked before returning results; changed contexts require another comparison. Saving and recording remain available when comparison fails.

Migration **018** gives new extension-created applications source notes such as **Added from LinkedIn**, derived from the posting link. It also replaces untouched generic extension notes; edited notes remain unchanged. Migration018 is installed in the configured project. No other schema change, permission or dependency is needed. [Verification and limits](../docs/extension-capture-score-verification.md). Reload the unpacked extension after updating.

## Reviewed Lever filling (0.4.0)

Open the application form at `https://jobs.lever.co/<company>/<posting-id>/apply`, then the toolbar popup. **Review fields** shows contact facts from your Master CV and current approved answer versions. A single exact question match proposes an answer; multiple matches or other questions need your explicit choice. Read the preview, check the fields you want, then choose **Fill selected fields**. Existing input, including corrections made after review, is kept. Inline results distinguish filled, kept and skipped fields; this is not an application-completion score.

Supported contact fields: full name, email, phone, LinkedIn, GitHub and portfolio. Supported answer targets are plain custom text fields/textareas and Additional information. Location suggestions, current employer, dropdowns/options, referral attribution, demographic/consent/signature fields and file uploads stay manual. A value that exceeds a field's length or needs multiple lines is not silently shortened. **Copy** rechecks the saved source and has a manual selection fallback when clipboard access is denied.

The working-resume link opens the owned resume you chose for preparation. Download the intended version and attach it yourself; opening/selecting it is not proof of employer upload. Save the choice to keep it with the job. The extension never submits the employer form or attaches a file. Filling does not record an application or enter the offline submission queue.

Reviews expire after five minutes, a worker restart, account changes, tab/window changes or relevant navigation. Sources are rechecked before filling/copying. Proposed values remain in temporary worker/popup memory; only selected field/value pairs reach the job-page script, and existing typed values are not sent back. No new browser permission or AI call is needed. Requires the deployed autofill API and existing migrations016–017 for the approved library. Reload the unpacked extension after updating. Other platforms retain capture/tracking only. [Verification, fixtures and limits](../docs/reviewed-autofill-verification.md).

## Save before applying (0.3.0)

Open a supported posting and the toolbar popup. Select a working resume (or Master CV / decide later), expand **Review captured details** to correct extracted text, then choose **Save for later**. Open **Saved jobs** to search, edit or remove saved openings. Saving does not count as applying. Resume choice records intent; it does not verify the actual uploaded file.

Saved jobs require migration **013** after **012**. A failed save shows an error and preserves popup fields while it stays open; retry explicitly. Confirmed submissions still use the durable offline queue. Exact, unique posting matches link a saved job to its application automatically; ambiguous evidence remains unlinked.

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
| `ingestionQueue.js` | Serializes durable queue writes; preserves event UUID, captured payload/date, account and app origin until acknowledgment |
| `autofillReview.js` | Private account/tab/form-bound review lifecycle, approved-version checks, explicit selection and one fill attempt |
| `content/app-bridge.js` | On the app: marks the page as having the extension and receives the token (no copy and paste) |
| `content/sites.js` | Per-site rules: how to read the job and recognise a submitted application |
| `content/job-reader.js` | Reads company, role, location and description (JSON-LD first, then the site's selectors) |
| `content/detector.js` | Remembers postings, spots the submission, reports it |
| `content/toast.js` | The "Added to Resume Butler, Undo" notice on the job site |
| `content/autofill.js` | Top-frame Lever field inventory, visibility/identity/deadline checks and safe writes without submit or file actions |
| `popup/` | Save/correct the posting, select a working resume, review Lever fields, copy fallback and submission tracking |

A submission counts when the site moves to its confirmation page (Greenhouse `/confirmation`, Lever `/thanks`), or when a "thanks for applying" / "Your application was sent" message appears after you click submit that wasn't on the page before (LinkedIn Easy Apply, Ashby, and the others as a fallback). When you clicked submit for that job, it's added automatically: a "Tracking application" notice appears in the top-right corner, then "Added to Resume Butler" with Undo. A confirmation page with no submit click first (a link opened directly, say) only asks "Did you apply?" with an Add button. On LinkedIn the success text counts only inside the Easy Apply dialog.

Security: popup-only actions (status, manual add, disconnect) answer only the extension's own popup, the token never leaves the background worker, undo accepts only this browser's recent additions, `http://localhost:3000` is trusted only by unpacked (development) installs, only real (trusted) clicks count, and submissions are accepted from top-level pages, or from Greenhouse's embedded form only after a submit click there.

The plan, including what comes next (more adapters and the Web Store), is in `docs/chrome-extension-plan.md`.

## Known gaps

Capture/tracking requires database migrations **012–013**; reviewed approved-answer reuse also needs **016–017**. Each queued submission keeps the same event UUID and original payload across retries. Different employer boards never share a queue identity just because their posting numbers match. Queues belong to an account and app origin; switching accounts cannot replay another account's work. Older unscoped items require explicit assignment in the popup. Reconnect restores retry scheduling.

When multiple applications could match, the submission is saved for review at **Applications → Submissions to match**. Choose an existing opening or explicitly create a separate one. Nothing is preselected. Resolving it completes the original event, so a queued retry returns the same result. Reload the unpacked extension after updating its files.

Permanent validation/payload conflicts are retained as blocked queue entries rather than retried indefinitely. The popup reports them; an item-level repair/discard UI remains future work. The automated worker tests use Chrome/storage/network boundaries; they do not submit actual employer forms.

- Detecting the submission is only tested against the sites' confirmation wording and URLs, not a real submitted application yet. Apply to one real job on each site to confirm.
- **Disconnect** in the popup forgets the token in this browser; to revoke it everywhere, use **Disconnect** on the app's Browser extension page.
- LinkedIn's new Easy Apply (server-driven, no stable class names) is confirmed by its submit request succeeding (the background worker watches that one URL, observe-only), with the "Submit application" click and the brief `/jobs/view/<id>/post-apply/` page as backups. The company comes from the dialog's "Apply to <company>" heading or that URL; the role from the posting page's title, so it can be blank when you apply from search results.
- Workday and arbitrary job sites have no adapter yet. Add those applications manually in the app; the popup's **I applied to this** is available only when it can read a supported posting. Real human completion/correction-time measurement remains necessary before expanding autofill support.
