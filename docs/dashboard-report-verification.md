# Dashboard figures and Search report: verification

November 14, 2026. Covers roadmap milestone M12 (the rest of A10). No migration, no AI.

## What changed

- **Response rate and offer rate** count only applications applied at least 14 days ago (`RESPONSE_WINDOW_DAYS`), so a week-old application no longer counts as "no response". Both show "x of N applied 14+ days ago". With none in the window the card says "Not enough history yet", never 0%. With fewer than 5, it shows the counts only, as the report does.
- **Offer rate** uses the same denominator as the response rate.
- **"Median days to first response"** replaces "Avg. response time". It is measured from Applied to the first Reached Out, Interviewed or Offered in the status history, and the card says how many responses it comes from.
- **Pipeline** says it shows current status ("Where your applications are now"), so it does not seem to contradict the history-based response rate.
- **Application flow:** an application at Reached Out has its own node, "Employer reached out", instead of being counted as awaiting a response.
- **Follow-ups card:** the claim that a short follow-up "often gets a response" is removed; the card lists the facts only.
- **Search report** at the bottom of the dashboard (`searchReport` in `src/features/dashboard/report.js`): tables by source, job site, resume used, month applied (last 6) and workplace type. Each row gives applications, responses, response rate, interviews (Interviewed or Offered) and offers over the same 14-day window. A group under 5 applications shows "too few to compare" in place of a rate. The text says it describes the user's own records and predicts nothing. Month rows link to the applications list filtered by date; the other groups have no matching filter, so they have no link.

## Evidence

- **Tests:** 631 pass with `npm test`, and on Node 24 in the `Checks` workflow. They cover the 14-day boundary, N = 0, responses known only from history, the median for odd and even counts, offers, the Reached Out node with the sankey balancing, and `searchReport` (grouping, the under-5 rule, month buckets, missing values).
- **Lint and build:** clean; the production build ran on an isolated copy of the committed tree.
- **Signed-in browser flow:** `scripts/qa-dashboard-report.mjs` seeds 12 applications across sources, resumes, months and statuses with history. It then checks:
  - the card texts against what the seed implies;
  - the median and its label;
  - that no Reached Out application is shown as awaiting a response;
  - that the follow-up claim is gone;
  - the report numbers for chosen groups, including "too few to compare";
  - "Not enough history yet" for a new account;
  - no horizontal overflow at 375px;
  - no page errors.

  It passed against `localhost:3000`, and both disposable accounts were removed.

## Known limits

- Rates are descriptive. Groups differ in when and where the user applied, so a difference between rows is not a cause.
- An application's response is what its status history records; replies never entered in the app are not counted.
- Only month rows link to a filtered list.
