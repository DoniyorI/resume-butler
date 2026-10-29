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

No new migration or permission is needed; existing migrations001–017 remain unchanged. Code is locally verified; commit/hosted CI/deployment will be recorded here after pushing. Reload the unpacked0.4.0 extension; shipping web API code alone does not update an installed extension.
