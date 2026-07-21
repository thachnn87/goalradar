# Current Sprint

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-21
Update Trigger: Update when the active sprint objective, tasks, blockers, next action, or review date changes.
Authority: Live sprint state only. Lower authority than `docs/architecture/DECISIONS.md`.

## Objective

Execute the Production Remediation Program (P0 → P1) from the audit, resolving release-blocking issues without altering GoalRadar's architecture, SEO, cache, provider, or World Cup contracts. Each batch is one isolated, independently-verified commit set.

## Active Tasks

- DONE — **Batch 0 (WC date correctness).** Nested bracket (`/world-cup-2026/bracket`) and fixtures (`/world-cup-2026/fixtures`) pages now derive all knockout dates from the schedule SSOT (`WC_KNOCKOUT_SLOTS` via `getRoundDateRange`/`getRoundIsoRange`); third-place venue corrected (Miami, not MetLife); Final's MetLife venue retained (correct). Commits `937a56d`, `c23762d`. Verified: lint 0, tests 72/72, build 0 (incl. `check:wc-arch`).
- NEXT — **Batch 1 (orchestrator durability):** add `maxDuration` + KV run-lock (`cron/orchestrator`, `cron/repair-enrichment`).
- PENDING — **Batches 2–9** per the Engineering Design Pack: cron redundancy, secret de-hardcode (+owner rotation/purge), ads.txt pub-id, wire alerting, provider/cache hardening, SEO/social correctness, land P1-3 WIP, endpoint auth + log hygiene.

## Blockers

- **Org monthly spend limit active** — cannot be lifted by AI; requires an org admin. Node/npm now installed locally, so the toolchain half of Gate 0 is cleared and local gates (lint/test/build) run.
- **Uncommitted P1-3 working tree** — 17 files carry unrelated REL-01 + ESLint-migration work. Batch-0 commits were isolated from them via selective staging. `.ai/CHANGELOG.md` and `.ai/HANDOFF.md` updates for Batch 0 are **DEFERRED** because those files hold the P1-3 content; editing them now would mix changesets. They are updated when Batch 8 lands the P1-3 set (or the maintainer decides the dirty-tree handling).
- **Discovery (out of scope):** Vercel KV (Upstash) request quota exhausted (`ERR max requests limit exceeded`, limit 500000) — surfaced during build, handled gracefully (build still passes). Needs a separate task.

## Next Action

- Confirm dirty-tree handling (isolate vs land P1-3 first). Then continue with Batch 1 per the Production Execution Playbook.

## Review Date

2026-07-28
