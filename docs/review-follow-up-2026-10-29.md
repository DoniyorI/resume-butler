# Review follow-up — October 29, 2026

The owner supplied a DeepSeek harness review of the flexible-document working tree. Findings were checked against current code and fixed in a separate bounded reliability step before A4.

| Finding | Outcome |
| --- | --- |
| AI rate limits fail open | Fixed. Paid/model-backed and email-classification routes require an explicit quota grant. Missing RPC, database errors, invalid results and transport failures return 503. Only the existing PDF-only key retains a logged availability fallback. |
| Newer document format opens an error page | Fixed at the editor boundary. Unsupported content opens a read-only screen with original JSON download. It never mounts autosave or pretends this version understands the document. Export/scoring continue to reject unknown formats. |
| Repeated 409 with no recovery | Fixed. The document saver latches the conflict before subsequent queued/future writes, keeps local edits, offers Download my copy and explicit Reload latest (discard mine). Network failures remain retryable. |
| No CI | Added pinned official checkout/setup-node actions, Node 24, npm ci, lint, tests and production build on main pushes/PRs. Read-only repository permissions; no production credentials. Direct-main workflow remains the owner's choice; branch protection is not changed. |
| No user-facing processing disclosure | Added public `/privacy`, footer and popup links. Describes OpenAI, YtoTech, Supabase, Vercel, EmailJS, email processing, local extension token/queues, disconnect controls and actual deletion/export limits. Does not promise provider retention or legal certification. |
| Silent cron capacity | Added an extra-row capacity probe, minimum known backlog count and sanitized warning for capacity/time budget. Existing least-attempt ordering already rotates deferred inboxes; a 51-inbox test confirms the omitted inbox is first next run. The review's suggestion that the same 50 always starve others did not match this ordering. |
| Split document validation | Documented: Zod is the complete supported document contract; SQL enforces ownership, locking, revision/version and coarse size/shape invariants. It deliberately does not duplicate every Zod rule. Unsupported stored content has a recovery path. |
| Loose custom UUID shape | Tightened to UUID groups, shared by read/write validation; malformed-hyphen regression added. |
| Duplicate LaTeX normalization | Removed; shared normalized result supplies section order. |
| Review could not build | Verified an isolated production build with CI placeholder configuration and no local secrets. Running development `.next` is untouched. |

## Evidence

172 Node tests pass; lint and `git diff --check` clean. Focused independent review found no material defect. CI-style isolated build passes with placeholder Supabase configuration. The first compile caught an import placed before a client directive; fixed before successful verification.

Synthetic signed-in browser checks verify original-data download for schema 99, exactly one write after a conflict, no further autosave attempts while continuing to edit, recovery JSON containing the newest focused-field text, and explicit reload of the remote saved version. The public privacy page loads signed out. Desktop and fresh mobile viewport checks have zero page errors. Temporary files and credentials remain outside Git.

## Rulings and retained tradeoffs

- Keep strict unsupported-format checks for PDF/scoring. Editor recovery is separate; silently projecting a newer format into an older PDF could omit facts. Cost: exporting that format requires a compatible app version or an existing frozen artifact.
- Retain current CSP until a separate nonce/request-rendering change is verified. A nonce is not a safe one-line removal of `unsafe-inline` in this Next.js 14 app. Current React text escaping and restrictive object/base/frame policies stay in place. Cost: the existing inline-script allowance remains a defense-in-depth limitation; this is not marked fixed.
- Retain revocable token persistence in `chrome.storage.local` to support browser restarts; disclose local-profile access risk. Moving it to session storage would force reconnects and does not fix a compromised browser profile. Cost: someone with local profile access can read an active token until it is revoked.
- Preserve the unrelated untracked `LazyCharts 2.jsx`; all commits stage exact feature files. It is not imported or shipped in the tracked application. Deleting unknown user work is not a cleanup prerequisite.
- Do not replace the document hook's editing API or split large existing forms solely to reduce line/callback counts. The save queue has been extracted where it now owns a real invariant. Cost: wider editor interfaces remain a maintenance concern, not a verified correctness defect.

Provider facts were checked against [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data) and [YtoTech's official compiler documentation](https://github.com/YtoTech/latex-on-http). Hosted YtoTech retention was not established, and the disclosure says so. Workflow release SHAs were resolved from official GitHub repositories. Hosted workflow execution and deployment are recorded after push; local configuration is not proof of hosted settings.
