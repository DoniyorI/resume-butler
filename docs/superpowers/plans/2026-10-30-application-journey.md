# Application journey

The user approved replacing the current-state fan-out with Applied and Reached Out entry streams, an interview milestone, and shared outcome pools (especially Rejected). Continue inline on main under the existing instruction to finish without repeated approvals.

## Design

Use existing owned application/history reads. Each application has one entry stream and one current outcome. Where its recorded history (or current status) proves an interview, route it through **Interviewed** before its outcome. Rejections before and after interviews join the same **Rejected** pool. Never invent an interview for an offer with no interview history.

Waiting records go to **Awaiting response**. Current interviews go to **Still interviewing**. Pending, Offered, Rejected and Withdrew retain distinct outcomes. Missing starting history for an advanced record is explicitly **Unknown start**, rather than assumed Applied. Repeated/backward changes cannot count an application twice at the interview milestone or introduce cycles.

This is a summary of entry, interview milestone and current outcome, not every raw status edit. Applied → Reached Out changes remain within the original entry stream. It does not reconstruct pending/recruiter-contact stages or create database history. Node labels/tooltips distinguish cumulative milestones from current outcomes. A horizontally scrollable minimum-width chart keeps multiple columns readable on narrow screens.

Approaches considered: current-status fan-out was implemented and rejected because it loses the journey; aggregating raw transitions omits unchanged records and creates cycles/double counting. The selected milestone summary preserves all records while showing the requested branching.

## Execution

1. Replace focused tests with failing journey, count-conservation, missing-history and cycle cases.
2. Implement aggregation and wire the existing history map back in.
3. Update chart labels/colors/tooltips, responsive sizing and total context.
4. Verify real components against fictional desktop/mobile fixtures, full Node suite, lint and isolated build; remove temporary fixture.
5. Independent final review, then commit/push main and check CI/Vercel. Leave unrelated LazyCharts 2.jsx untouched. Stop after this scope; dashboard ideas are suggestions, not an additional implementation request.
