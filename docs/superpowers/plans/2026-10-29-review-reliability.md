# Review follow-up before A4

Source: user-provided `resume-butler-review.md` dated October 29. Continue the practical program after confirmed reliability findings; no general redesign or model changes.

- [x] Fail closed for paid/model-backed rate-limit keys on missing/failed/invalid quota checks; retain explicit availability policy for PDF-only checks. Test RPC errors, thrown transport failures, invalid result, denied/allowed results.
- [x] Stop resume autosave after a revision conflict; keep the local buffer; offer recovery download and explicit discard/reload. Test queue ordering, revision increments, one conflict blocking subsequent network writes, retryable transport errors.
- [x] Newer/unsupported stored resumes open a read-only recovery view with original data download. Keep unsupported formats out of scoring/export rather than pretending this build understands them.
- [x] Add least-privilege CI for Node 24 install/lint/tests; verify action references from official repositories.
- [x] Add factual public privacy/integration disclosure naming Supabase, OpenAI and YtoTech, exactly what is sent, local extension token storage, controls and limits. Do not invent provider retention promises or a nonexistent account-delete flow.
- [x] Verify cron fairness/capacity behavior, expose bounded backlog warnings without logging inbox data. Tighten custom UUID validation and document validation authority; remove duplicate normalization.
- [x] Run tests/lint/isolated build and fictional-account recovery/read-only/privacy checks. Record decisions on existing CSP and MV3 token storage; preserve unrelated file. Commit/push, then resume A4.

Decisions: Zod is the complete document write contract; SQL owns account isolation, transaction/revision/version/size guards. Direct own-row API writes may be rejected/repaired without constituting cross-account access; make this explicit. Existing unsafe-inline CSP needs a separate nonce/cache compatibility change, not a blind configuration flip. Revocable token persistence is retained for normal browser restarts and disclosed. Existing module callback counts are not a functional bug and do not justify a broad refactor during this work.

Verified:172 tests, lint and isolated CI-style build; synthetic desktop/mobile recovery and public privacy checks; independent review with no material findings. Details and exhaustive rulings: docs/review-follow-up-2026-10-29.md. HostedCI/deployment checked after push.
