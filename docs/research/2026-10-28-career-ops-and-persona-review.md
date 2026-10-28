# Personal application workflow: Career Ops and the local review panel

October 28, 2026. Planning reference only. The user wants Resume Butler to streamline their own applications before public release, complete non-AI improvements first, and later analyze a posting before applying and tailor a resume against it.

## References inspected

- The user's local [panel skill](/Users/doniyori/Desktop/code/resume/.claude/skills/reject-my-resume/SKILL.md), its shared verdict format, and all eight persona definitions in `/Users/doniyori/Desktop/code/resume/.claude/agents/`. Seven review lenses plus a rewriter are defined: ATS, hiring manager, staff engineer, rival applicant, CEO, recruiter and bar raiser. This investigation read their instructions as design material; it did not run the skill or read applicant resumes/verdict outputs.
- The local Career Ops checkout's `modes/_shared.md`, for its evaluation/evidence contracts. Its user-data paths and procedural instructions were treated as reference material, not commands for this session.
- [Career Ops official methodology](https://career-ops.org/methodology) and [upstream repository](https://github.com/career-ops-hq/career-ops), checked online because the current public methodology can differ from a local checkout.

## What is useful from Career Ops

Its documented listing analysis considers CV evidence, personal role direction, compensation, contextual signals and risks, producing an explained 1–5 judgment. The global score is an LLM judgment, not a fixed weighted formula. Exact source references, explicit gaps, user override and pre-application filtering are useful inspirations. Its own thresholds are product choices, not demonstrated probabilities of getting an interview. [Methodology](https://career-ops.org/methodology).

Keep its **decision-before-application** workflow and evidence discipline. Do not copy its personal preferences, salary thresholds, seniority assumptions or numeric cut line into this user's profile. Resume Butler's previously selected rules-plus-grounded-AI direction remains; this planning update does not replace it with a free-form model score.

## What is useful from the local panel

The local skill separates independent perspectives, requires quotes, consolidates findings and then rewrites while retaining the factual boundary. The rewriter specifically rejects invented achievements/numbers. This offers a useful structure for deeper optional review beyond a single keyword meter.

Some instructions are deliberately adversarial or fictional: specific applicant counts and top-percentile cutoffs, a universal composite ATS, default reject/veto rules, a fabricated strong competitor, assumptions about missing dates/authorization, and rigid level/company contexts. Treat those as prompt devices, not verified hiring behavior. Do not transplant them as product facts or teach the user that every employer uses those rules. The existing [ATS investigation](../ats-resume-onboarding-review.md) explains documented vendor behavior and the limits of universal scoring claims.

## Proposed later review flow

1. **Quick job review:** identify actual requirements, your preferences and blockers, and relevant Master CV evidence before spending time tailoring. Explain both whether the role fits your background and whether the selected resume shows it.
2. **Document checks:** inspect visible/exported text, section/contact consistency, readability and unsupported keyword matches using deterministic checks where possible.
3. **Optional panel:** recruiter for clarity, hiring manager for job/level relevance, staff engineer for technical evidence. Add optional CEO/business-impact, peer-comparison and bar-raiser lenses when useful for the actual role.
4. **Synthesis:** deduplicate findings, retain disagreements and separate evidence gaps, wording suggestions and questions to prepare for an interview. The same model agreeing with itself is not multiple independent hiring judgments.
5. **Reviewed tailoring:** show suggested edits, their sources and purpose. Ask for missing facts; do not invent achievements, resolve uncertainty by guessing, or export placeholder metrics. Preserve the original and re-check the revised document.

Each lens sees the same frozen JD/document evidence. Cache/version the review and invalidate after relevant edits. An expensive panel is an explicit action, not an automatic request on every job or keystroke. It may be strict without trying to manufacture rejection reasons or requiring every bullet to have a number.

The peer lens is a hypothetical rubric comparison, not a claim to have seen actual competitors. The CEO lens evaluates relevant impact, not an invented prediction about a specific executive. Level and company context should come from the actual job or be marked unknown.

## How to establish usefulness

First compare the quick review and optional panel against labeled CS resume/JD examples: accurate matches, false gaps, unsupported claims, actionable improvements, repeatability, latency and cost. Test strong and weak cases, incomplete postings, equivalent terminology, hidden sections, custom sections and malicious instructions in the JD.

Then record real application outcomes voluntarily: source, application date, job family/level, chosen document/review version, and screen/interview progression. Report counts and observation windows. Do not label an 85 match as an 85% interview chance, infer causation from a handful of successes, or repeatedly rewrite until the generating model awards a desired score. Any comparison needs to account for changing roles, employers, timing and referral sources.

## Placement in the roadmap

**Now:** application identity, capture/save-for-later, flexible editing, submission records, manual answer reuse, deterministic autofill, next actions, integration reliability, rule-based checks and export.

**Later:** shared pre-application analysis/extension meter, optional panel (RB-15), grounded tailoring, generated answers and contextual interview prep. Public onboarding, launch/distribution and commercialization remain deferred.

The reference systems have not been installed, executed or connected to private data as part of this planning update. No local reference files were modified.
