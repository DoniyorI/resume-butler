# A3 — Flexible Master CV and resume sections

Execute inline on main. Scope: RB-04A; existing AI stays compatible, with no new model/prompt work.

## Model and safety

Keep legacy education/experience/projects/skills arrays. Add certifications and stable-ID custom sections (`entries`, `text`, `list`) with stable-ID items. `order` holds heading/visibility for all section IDs. Schema version2 preserves legacy fields; reject unknown future versions. Custom sections never disappear merely because an old AI flow supports four sections.

Store Master CV custom sections and renamed starter headings in owned `profiles.cv_sections` JSON, with a revision. Resume saves use a row-locked revision check. Missing migration blocks new writes with retained editor input; old clients cannot silently drop custom sections. Selected CV content is copied into resumes, never live-linked.

## Tasks

- [x] Shared normalization, visible traversal, custom entry factories and immutable section updates. RED→GREEN round-trip/unknown version/hidden content/legacy fixtures.
- [x] Migration014 and owned server validation/save boundaries: custom CV settings and revisioned resume saves. Disposable SQL ownership, concurrent revision conflict, old-client protection tests.
- [x] Resume outline add/remove/undo, existing heading rename, three custom layouts and certification items. Keep current layout, quiet saving, keyboard labels and mobile access.
- [x] Master CV custom-section editor and heading settings; include certifications/custom sections in manual CV library selection. Existing AI changes preserve manual custom content.
- [x] Export all visible content with escaped headings/body; PDF freshness key reflects printable content only. Deterministic scoring text uses visible content; larger A9 rubric changes remain separate.
- [x] Synthetic save/refresh/manual-selection/editor/PDF-text/browser checks, tests/lint/isolated build, independent review and material fixes. Record local/migration/deployment separately, then commit/push.

## Acceptance

A research/volunteering/certification section can be added in Master CV, copied to a resume, renamed/reordered/hidden/removed/restored, saved/refreshed and exported without losing facts or changing another document. A stale tab receives a recoverable conflict rather than silently overwriting a newer document.

## Verification ledger

- 165 Node tests and lint pass; 14 disposable PostgreSQL assertions cover real migrations and revision/ownership/old-client behavior.
- Migration014 installed after text comparison (4096 characters, checksum293654610); SQL editor reported Success. Do not edit this migration after application.
- Fresh independent review found three Important issues, all reproduced RED→GREEN: certification default fields changed PDF freshness keys; retained fields from another custom layout inflated scan text; raw application scanners gave hidden sections section/bullet credit. Fixes share the printable projection and normalize at the scoring boundary.
- Real synthetic PDF compiled, text extracted and raster inspected. All three layouts and certifications present; title/subtitle spacing corrected and latest raster inspected clean.
- Live browser run8be71faa: create/rename/refresh Master CV; independent resume copy plus certification; edit/hide/show/remove/undo; refresh after Saved; actual PDF download; two simultaneous revisioned saves yield one winner/one conflict; stale tab keeps edits and shows Not saved. Zero page errors. Extra text/list/reorder/rename/refresh checks and mobile Layout drawer creation/cancel pass with zero page errors.
- Ruling: retain existing AI selection of the four supported legacy sections — custom/certification selection is manual in A3 and manual content survives accepted AI picks — cost if wrong: users expecting automatic selection across their new sections must choose those entries themselves until Phase B.
- Ruling: leave the scoring weights and larger four-section rubric changes to A9 — A3 fixes visibility for every caller, while this milestone guarantees section storage/edit/export — cost if wrong: the current heuristic still has known quality/Projects bias until A9 and must not be presented as a hiring probability.

Completion evidence: docs/flexible-documents-verification.md. Push/deployment recorded separately. A4 follows; the remaining program is not complete.
