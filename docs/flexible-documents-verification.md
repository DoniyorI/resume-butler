# Flexible documents / A3 verification

Verified October 29, 2026. A3 implements manual custom sections and certifications, without adding new AI selection or changing models.

## Delivered behavior

- Keep the existing resume layout; rename/reorder/hide headings, add entries/text/list sections, remove custom sections and Undo.
- Master CV supports named custom sections with stable entry IDs, editable starter headings and certifications. Manual library selection copies data into a resume; later edits remain independent.
- Schema2 reads existing four-array resumes. Revisioned, owned RPCs reject stale saves and older clients that would discard schema2 content. Unsupported future formats stop editing rather than silently dropping facts. Missing setup preserves unsaved input with an error.
- Preview, PDF and deterministic scan text include visible custom/certification fields. Retained fields from another layout and hidden sections receive no keyword/section/bullet credit. PDF freshness keys ignore revision/item IDs and normalize save defaults.
- Existing AI selection remains limited to supported legacy arrays. Accepting its picks preserves manual custom/certification content. The wider scoring rubric is still A9 work.

## Validation

- 165 Node tests pass, lint clean, isolated production build succeeds. New tests cover legacy/unknown formats, immutable copies, escaped exports/unsafe links, hidden-layout content, save defaults/PDF freshness, all scanner callers, setup/stale-save errors.
- `scripts/qa-flexible-documents-sql.mjs`: 14 disposable PostgreSQL assertions across actual migrations001–014. Ownership, revision conflicts, older-client protection, future-version rejection and independent CV settings.
- Live synthetic browser run `8be71faa`: Master CV custom creation, heading rename and refresh; copying a custom section/certification; independent edit; hide/show/remove/Undo; reload after Saved; real PDF download. Two concurrent RPC writes with one expected revision yield one success and one conflict. A stale browser retains edits and reports Not saved. Zero page errors.
- Extra signed-in checks: text/list creation, keyboard reorder, hide/show, heading rename and refresh. Desktop1600×1100, mobile390×844; zero page errors. Mobile Layout drawer form checked separately.
- Actual generated PDF text includes the edited copy and certification, excludes the source entry title, and remains one page for the fixture. Independent all-layout fixture also contains entries, text and lists. Both raster views inspected; title/subtitle overlap found and fixed before completion.
- Independent review found three Important issues: certification default fields invalidated PDF keys, hidden layout fields inflated scan text, raw application scans still awarded hidden-section credit. Each reproduced RED→GREEN; full suite green after fixes. No additional confirmed ownership or data-loss findings.

## Rollout and limits

Migration014 applied to `tlmabncoijnuxymxohgu`; SQL text matched local file (4096characters, checksum293654610) and editor reported Success. Applied migrations were not edited. Commit/push/deployment state recorded separately.

Limits: this is manual customization; new AI selection across custom sections is Phase B. A9 still replaces the wider quality/Projects-biased rubric. Frozen uploaded/generated submitted bytes are A4, not established by a working resume link. Guided first-login setup remains pending.

Local evidence: `/tmp/resume-butler-a3-{profile,studio,layouts,mobile,mobile-layout,conflict,browser-pdf}.png`, `/tmp/resume-butler-a3-browser.pdf`, `/tmp/resume-butler-a3.pdf`, and private synthetic browser logs. No employer application or real inbox was used.
