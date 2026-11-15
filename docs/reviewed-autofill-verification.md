# Reviewed Lever filling — verification and limits

Verified locally October29,2026 on main, after7630516. Extension0.4.0 is the first A6 adapter; it does not complete the broader RB-10 platform-expansion/public-distribution package. [Implementation plan](superpowers/plans/2026-10-29-reviewed-autofill.md).

## Behavior and boundaries

- English, top-frame Lever application forms only. Read-only inspection of a public Lever form grounded the adapter's field names and question wrappers; no personal data was entered there.
- Review before fill: Master CV full name/email/phone/LinkedIn/GitHub/portfolio and explicitly selected current approved text answers. A single exact normalized question may propose an answer; ambiguous/different questions require a choice and preview. Draft, archived, removed or changed versions are unavailable.
- Preserve any existing input, including whitespace and corrections after review. Recheck the exact document/URL/form/action/question/control signature, visibility, editable state and length before each write. Never shorten an answer or flatten multiline content into a single-line input silently.
- Location suggestions, current employer, dropdowns/options, referral questions, demographics/consent/signatures, unknown controls and file attachments remain manual. The working-resume link opens the chosen owned resume for manual download/attachment; it cannot establish which file an employer received.
- Only trusted extension UI can request source reads/filling. Job scripts receive no token, entire profile, answer library or existing typed values; only the selected field/value pairs and review deadline reach the top-frame adapter. Proposed values are temporary memory, not persistent storage or a retry queue.
- Reviews expire after five minutes or a worker restart and are invalidated by relevant account/tab/navigation/window changes. Approval/contact sources are checked again before fill/copy. Filling never records/submits an application or attaches a file. The existing submitted-application queue remains independent.

## Evidence

| Check | Result |
|---|---|
| Node24 full suite | **210 pass**; includes owned source reads, strict bounded selections, duplicate/overlapping actions, source changes, final-read context races, pending-prepare invalidation and expiry during pending fill/copy |
| Adapter browser fixture | **61 checks pass**,0 page errors and0 submission requests; blank fields fill, manual edits/whitespace stay, hidden/disabled/readonly/changed/replaced controls are skipped, form destination/navigation changes during input stop later writes, long/Unicode text is handled without truncation, EEO/options/files/referrals stay untouched |
| Popup browser fixture | **20 checks pass**,0 page errors; explicit review/selection, approved source preview, manual copy dialog, result states, working-resume link, stale rejection and capture availability during source failure; no horizontal overflow at320/360px |
| Live local API → Supabase | **24 checks pass**, run `dacb2bee`, restricted to the two existing fictional QA accounts; owned contacts/metadata and approved reuse succeed, foreign answers404, stale/draft/archive versions409, malformed/duplicate/owner-override input400, disconnected token401; temporary tokens revoked, fixture answer archived |
| Real unpacked MV3 runtime | **14 checks pass** in installed Chrome for Testing156 using a disposable profile: actual worker, toolbar popup and isolated content adapter,3 source requests, correct two-field fill, manually entered email preserved, EEO/location/options/file controls untouched, no proposed values persisted and0 employer submission requests |
| Frontend audit | Exit0;0 errors/0 warnings at1440×900 and390×844, one h1,0 unnamed controls,0 horizontal overflow, no failed/4xx+ asset requests. Uses actual popup HTML/CSS/JS with a fictional transport fixture, separately from the native runtime test |
| Lint / isolated production build | Pass. Build runs in `/tmp`, without production secrets or touching the running app's `.next`. Existing stale Browserslist data warning and answer-export dynamic-route discovery diagnostic remain; neither is a new autofill runtime failure |
| Independent review | TwoP2 timing gaps reproduced and fixed with RED→GREEN regressions. Reviewer independently reran20 focused tests and confirmed both fixes; no outstanding findings within that targeted confirmation |

The native test intercepts both the fictional employer page and gateway responses. Live ownership/approval checks use the actual local API and Supabase separately. No real employer form was submitted, no real inbox was opened, and these tests do not establish every employer's current compatibility or Safari/Firefox behavior.

The temporary frontend-review copy supplies the fictional popup transport and installed Chrome channel. Its name check recognizes actual HTML labels/ARIA naming rather than the original heuristic's omission of labels and use of input values as names; no source errors are muted. Reports/screenshots are `/tmp/resume-butler-a6-ui-review.json`, `/tmp/resume-butler-a6-ui-review/`, and `/tmp/resume-butler-a6-popup{,-narrow}.png`.

## Reproduce

Run the normal Node24 test/lint commands. Browser scripts require `PLAYWRIGHT_MODULE` pointing to an installed Playwright module:

- `scripts/qa-reviewed-autofill.mjs`: isolated DOM/form checks, outbound requests intercepted.
- `scripts/qa-reviewed-autofill-popup.mjs`: actual popup rendering and real lifecycle with fictional Chrome/network boundaries.
- `scripts/qa-reviewed-autofill-runtime.mjs`: set `QA_CHROME_EXECUTABLE` to an installed official browser that supports unpacked extensions; creates/removes a private disposable profile. Uses the real toolbar popup target through public CDP because this popup is absent from Playwright's normal page list.
- `scripts/qa-reviewed-autofill-api.mjs`: run with `--use-system-ca --import ./tests/register.mjs` and private `QA_SESSION_FILE`; guarded to the existing project and two fictional accounts. Never commit or print that file, keys or generated tokens.

The fixture counts measure automated correctness, not human time saved or interview outcomes. Measure human completion/correction time and wrong-field incidents before claiming a productivity improvement or expanding support. No content telemetry is added. At most100 field inventories/approved choices and50 selected sources are supported per review. If an old approved answer is outside the latest100, use the answer library's copy flow. Worker restarts/context changes require fresh review; autofill is never silently resumed.

## Deployment

No new migration or permission is needed; existing migrations001–017 remain unchanged. Feature commit `9988a20eb4d2b626aebf2b41dae3c30e2b49b3a7` is pushed to main: [GitHub CI](https://github.com/DoniyorI/resume-butler/actions/runs/40942835690) and [Vercel deployment](https://vercel.com/doniyoris-projects/resume-butler/BA341dYHYS4iBRPE5iFFeRrVAYLA) succeeded. The updated public privacy page also passed desktop/mobile frontend checks with0 findings. Reload the unpacked0.4.0 extension; shipping web API code alone does not update an installed extension. The owner requested stopping after this release; A7 has not been started.

## Greenhouse (extension 0.7.0)

Greenhouse (`job-boards.greenhouse.io`, top frame) shares the Lever write procedure through `extension/content/autofill-core.js`. The fixture `tests/fixtures/greenhouse-application.html` is synthetic and models a read-only inspection of a public posting (November 14, 2026): id-based controls with no `name`, React-select comboboxes with required-field shims, file inputs, EEO selects. Run `scripts/qa-reviewed-autofill-greenhouse.mjs` (same `PLAYWRIGHT_MODULE` setup); `qa-reviewed-autofill.mjs` now injects the core before the Lever adapter, and the popup and runtime scripts include a Greenhouse case. Not verified against a live employer form, iframes, or employer-customised markup.

### Greenhouse evidence (November 14, 2026)

| Check | Result |
|---|---|
| Tests | 592 pass on Node 26.3.0 and on Node 24 in the `Checks` workflow, including a 33-URL table that the worker's and the popup's URL rules must agree on |
| Lever after the shared core | `scripts/qa-reviewed-autofill.mjs`: the same 61 checks pass as before the extraction, 0 page errors, 0 submit requests |
| Greenhouse adapter fixture | `scripts/qa-reviewed-autofill-greenhouse.mjs`: 102 checks pass, 0 page errors, 0 requests, 0 submit events; a React-style controlled field keeps the written value |
| Popup fixture | `scripts/qa-reviewed-autofill-popup.mjs`: 27 checks pass, including the Greenhouse job page and embed URLs and look-alike URLs that get no panel |
| Real unpacked MV3 runtime | `scripts/qa-reviewed-autofill-runtime.mjs`: 24 checks pass in Chrome for Testing, filling both the Lever and the Greenhouse fixture through the real popup, a manually typed email kept, 0 employer requests |
| Lint / isolated production build | Pass |
| Independent review | No high or medium findings; Lever's behaviour confirmed unchanged line by line. Two low findings fixed: the adapter checks the full origin, and a control outside its field wrapper is left manual |

**Limits.** Top frame only: a Greenhouse form embedded in an iframe on a company's own careers site is not filled. Choices (country, yes/no questions), demographics, files and resume text stay manual. The fixture is synthetic; no live Greenhouse form was filled or submitted.

**To use it:** reload the unpacked extension in `chrome://extensions` (0.7.0).


## Ashby (extension 0.8.0)

Ashby (`jobs.ashbyhq.com/<org>/<uuid>/application`, top frame) uses the same core as Lever and Greenhouse (`extension/content/autofill-core.js`). The core gained two optional adapter hooks for a page with no `<form>` element: `owner(element, root)` (replaces the `element.form` re-check; Lever and Greenhouse do not supply it and keep `element.form`) and `extraManual(root)` (lists controls that are not inputs, such as the yes/no button pair). The adapter is `extension/content/autofill-ashby.js`. Its root is the single parent that holds the one application container and any survey container; zero or several containers, an invisible root or a survey outside it give "This Ashby form is not ready or its layout is unsupported. Complete it manually.", which is also what a page that has not rendered yet returns. The fixture `tests/fixtures/ashby-application.html` is synthetic (fictional company and wording) and models a read-only render of a public posting on November 14, 2026: no form element, field entries keyed by `data-field-path`, a location combobox whose label points at nothing, UUID-named custom questions, a yes/no button pair with a clip-hidden mirror checkbox, a phone field, a visible-but-tiny reCAPTCHA textarea inside the form root, radio and checkbox groups whose ids change on every load, a diversity survey in a sibling container, a hidden reCAPTCHA textarea, an unlabelled uploader, a plain submit button, fields rendered about 300 ms after load and a controlled name field.

### Ashby evidence (November 14, 2026)

| Check | Result |
|---|---|
| Lever and Greenhouse after the core hooks | `qa-reviewed-autofill.mjs` 61 checks and `qa-reviewed-autofill-greenhouse.mjs` 102 checks, unchanged, 0 page errors, 0 requests |
| Ashby adapter fixture | `scripts/qa-reviewed-autofill-ashby.mjs`: 175 checks pass, 0 page errors, 0 requests; 0 clicks of any kind, 0 clicks on the submit button, 0 submit events and 0 submit attempts by autofill (a positive control confirms the counters see a real click); not-ready page, late render, radio group ids that change per load, controlled fields keep their value, typed input kept, hidden/disabled/changed/moved controls skipped (including a control moved into the survey container or out of its field entry, and a stray label outside the entry), root, URL and during-write changes stop the batch, long and multiline text not truncated or flattened |
| Popup fixture | `scripts/qa-reviewed-autofill-popup.mjs`: 33 checks pass, including the Ashby application URL and Ashby job-page and look-alike URLs that get no panel |
| Real unpacked MV3 runtime | `scripts/qa-reviewed-autofill-runtime.mjs`: 35 checks pass in Chrome for Testing; the real popup fills the Ashby fixture (name and approved answer), keeps a typed email, leaves location, choices, files and yes/no alone, 0 clicks, 0 employer requests |
| URL rules | `tests/extension-autofill-urls.test.mjs`: worker and popup copies agree on every Ashby case (application URL with query, trailing slash and uppercase id; job page without `/application`; malformed ids; look-alike hosts; http; credentials; ports) |

**Limits.** Top frame only: Ashby boards embedded in an iframe on a company's site are not filled. The location picker, yes/no buttons, radios, checkboxes, comboboxes, the diversity survey, files and the resume uploader stay manual. The fixture is synthetic and was grounded in one read-only render of one public posting; no live Ashby form was filled or submitted, and other boards may be customised. Because the page is a React app, a re-render that replaces the root or a field after review makes the next fill stop with "The form changed. Review its fields again before filling."

**To use it:** reload the unpacked extension in `chrome://extensions` (0.8.0).
