# Interface and resume import fixes — local verification

Requested fixes: uneven dashboard chart cards, the global New application button, unclear Documents links, education `endDate: Invalid date`, and duplicate Master CV imports.

## Changes

- The paired chart cards now fill the grid row and use matching desktop chart/loading heights. In the rendered fictional fixture at 1280 px, both card bounds were top 148 / bottom 576, height 428 px.
- New application remains available as an outlined secondary action. Submitted versions and Answer library are separate bordered buttons beneath the Documents heading, with responsive wrapping and focus styles.
- Optional blank CV dates become null before action validation. Dates must be real calendar dates; month fields cannot generate malformed dates. Month/year imports use the established first-day convention; year-only/invalid dates stay unknown and are counted for review.
- The parser now calls one authenticated transactional `merge_resume_import` RPC. It matches normalized exact entry identity plus compatible month dates; distinct roles/date periods stay separate. Multiple matches are left unchanged and reported. Existing facts/bullets are retained, missing facts can be filled, and distinct bullets/skills append in order. It does not delete pre-existing duplicate rows or resolve uncertain matches automatically.
- Imports serialize per owner and roll back on write failures. Bounds match the editor: 100 entries per section, 50 bullets per entry. Overflow is reported for review. Missing migration019 fails safely before append-only fallback writes.
- Inline import results distinguish new entries, matched entries, unique bullets and review items. An explicit pending state/ref guard keeps React 18 uploads disabled through fetch/parsing and prevents concurrent upload launches.

## Verification

- 229 Node tests pass, including 8 new tests. The actual saveEducation action reproduced `endDate: Invalid date` before the fix; the blank-date/calendar/month tests pass afterward. Parser contract tests failed against append-only writes and now pass against the atomic RPC contract.
- 23 disposable PostgreSQL checks pass: repeat imports, existing facts preserved, normalized unique bullets, separate roles/periods, append order, current employment preserved, ambiguous duplicates unchanged, tenant isolation, forged owner ignored, bullet cap, rollback and anonymous denial.
- Desktop 1280 px and mobile 390 px rendered checks use actual components with fictional data. No horizontal overflow. Collection links have 1 px borders; education month fields accept a valid start and blank end. A delayed fictional transport showed the import button disabled with progress, followed by a truthful result and enabled button. No real account CV or employer application was modified for these browser tests.
- Lint passes. A fresh isolated build could not fetch Google Fonts under the network restriction. Rebuilding the updated sources in the existing isolated snapshot with its previously cached fonts succeeded (exit 0); the running localhost build was not disturbed.
- Fresh independent review found the React 18 async-transition pending defect; it was fixed and the reviewer confirmed no remaining material findings in that targeted scope. A known pre-existing limitation remains: saving an already-open stale edit dialog can replace bullets added by a concurrent import. Finish open edits before importing.

The provided PDF was inspected locally with pdf2json; only date patterns/counts were printed. It was not sent to an AI provider during verification, and its contents are not committed. The temporary anonymous fictional preview route was removed after checks.

## Integration

Applied migrations001–018 remain unchanged. Migration019 was applied transactionally through the authenticated Supabase SQL editor, which reported success. A subsequent authenticated-role smoke test used the existing fictional QA account, verified initial/repeated/unique-bullet merges, and rolled back all fixtures; the result showed `live_merge_checks=passed` and `fixtures_rolled_back=true`. Migrations001–019 are now immutable; the next migration is020. A stale browser session was recovered by resetting the tool session. Automatic approval review previously reported a usage-limit failure on a deployment-status request; final commit/deployment status must still be checked before claiming hosted availability.


Product commit `fa2dedf3ee6647f14deb824e92f635b656386a06` is pushed and deployed. [GitHub Checks](https://github.com/DoniyorI/resume-butler/actions/runs/40979862847) and [Vercel deployment](https://vercel.com/doniyoris-projects/resume-butler/87qqqyb4zWRuvXCqK7Zn72y1QTPT) both succeeded. The earlier automatic-review usage-limit error cleared and the normal commit/push approval succeeded. Stop at this scope; A7 remains unstarted.
