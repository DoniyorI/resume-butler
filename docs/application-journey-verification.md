# Application journey verification — 2026-10-30

Replaces the October 29 current-status fan-out with the journey requested by the user.

## Behavior

- Applied and Reached Out are entry streams, determined from the first valid recorded status (or the current entry status when history is absent).
- Applications with recorded/current interview evidence pass through one Interviewed milestone. All others flow directly to their current outcome; an offer never creates an assumed interview.
- Rejections before and after interviews merge into one Rejected pool.
- Awaiting response retains unchanged applications. Still interviewing, Pending, Offered, Rejected, Withdrew and Unknown status remain distinct current outcomes.
- Advanced records without a known entry stream appear under Unknown start, with an explanatory note.
- This summarizes entry, interview milestone and current outcome, rather than rendering every raw status edit. Each application enters/exits once. The interview milestone counts each record once, including repeated/backward edits; the graph remains acyclic.
- History reads remain scoped by the owning application's user. No schema, credentials or database data changed.

## Evidence

All eight focused journey tests failed against the prior snapshot implementation, then passed. Coverage includes the 34-record mixed cohort, both unchanged entry streams, shared rejection pool, unknown origins, no inferred interviews, repeated/backward changes, unsorted history without mutation, authoritative current state, unknown statuses, invalid/unrelated history and empty accounts. The full Node suite passed: **237 tests**. ESLint passed.

The actual component was rendered through a temporary public route with fictional in-memory fixtures only: mixed journey, unchanged/waiting, every outcome, unknown start and empty account. Desktop 1280px and mobile 320px had no text-label intersections. At 320px, chart content remained 640px inside a 238px scroll region, without document overflow; keyboard ArrowRight scrolling worked. Browser console had no errors/warnings. The Interviewed tooltip correctly read “3 applications reached interviews.”

The mixed fixture showed 32 Applied + 2 Reached Out entries; 3 reached interviews; outcomes summed to 34, with early/post-interview rejections joining the same pool of 2. Link totals across multiple journey stages are intentionally not added as a count of unique applications.

The temporary QA route was removed and viewport override reset before delivery. Independent fresh-context review found no material issues.

The isolated production build passed using the existing cached-font build snapshot, keeping the live port-3000 output untouched. No cold-font-fetch claim. Deployment/CI results are checked after pushing and reported in the delivery response.
