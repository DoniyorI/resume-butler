# Application flow verification — 2026-10-29

The former chart aggregated recorded transitions and dropped unlinked statuses. With 34 applications and only 3 recorded transitions it showed 3, split across Applied/Pending sources. The regression test reproduced 3 ≠ 34 before the fix.

The chart now has one **All applications** source and one destination per current status. Each application contributes once; unchanged records count, and repeated/backward changes cannot inflate totals. Missing/unrecognized statuses remain visible as Unknown status. The description/tooltips describe a current-state snapshot rather than an inferred historical journey. Links use destination colors.

## Verification

- 234 Node tests passed, including 5 new flow tests: full 34/three-history-transition fixture, unchanged 30, repeated/backward history, unknown statuses and empty account.
- ESLint passed with no warnings/errors.
- Isolated production build passed using cached fonts; the running port 3000 build output was untouched. No cold font fetch claim.
- Actual ApplicationFlow component rendered in a temporary public route using fictional in-memory fixtures only: 34 mixed, 30 Applied, 30 Reached Out, 30 unknown, all 8 status buckets and empty. No database writes or real user data.
- Desktop 1280px and mobile 320px checked. At 320px the first layout collided for single-status Reached Out/Unknown-only accounts. Stacking values beneath node names fixed it; all 6 fixtures then had zero SVG text bounding-box intersections and no horizontal overflow. Browser console had no errors/warnings.
- Total tooltip read “34 applications tracked in total”; link tooltip read “30 applications currently in Applied.”
- Temporary QA route removed before production build. Browser viewport override reset.
- Independent final reviewer checked count conservation/Recharts payload compatibility; the narrow-screen risk raised during review was reproduced and fixed.

The applications table already uses server-side pages of 50. With ~30 records its footer shows one page, with both paging buttons disabled. Filtering affects the total; this change does not alter pagination.

No migration or production configuration was changed. Production email scanning separately failed because APP_ENCRYPTION_KEY was missing from Vercel; the existing local key was copied privately to the user's clipboard for their configuration step. Never substitute a newly generated key for existing encrypted credentials.
