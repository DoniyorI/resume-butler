# Application flow count fix

> Use superpowers:executing-plans inline, then independent review.

**Goal:** Show every tracked application once in the flow chart, with one left source and current status destinations. Explain existing pagination accurately.

**Design:** A two-column Sankey: All applications (total) → current status counts. This is an account snapshot, not a reconstructed historical journey. It includes unchanged applications; history cannot change totals or create multiple sources. Unknown/blank statuses are represented explicitly. Keep the existing visual language and responsive chart. No migration, secret change or email scan.

- [x] Write failing tests for 34 applications with only 3 recorded transitions, unchanged-only accounts, backward/repeated histories, unknown statuses and an empty account.
- [x] Replace transition aggregation with current-status counts, preserving total conservation and one source.
- [x] Update chart description, empty state and tooltip wording to match current-state semantics.
- [x] Verify table page size/range/controls from current code; no unsolicited paging redesign.
- [x] Run Node tests, lint, browser fixture and isolated build; review. Delivery: commit/push and deployment verification follow this commit; report the outcome in the delivery response. Preserve unrelated LazyCharts 2.jsx.
- [x] Stop after this scope. The production email key is on the user's clipboard; no permission has been given to transfer it to Vercel. Never overwrite the clipboard during chart work.
