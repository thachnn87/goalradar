# World Cup Documentation Index

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update when World Cup route, data, SEO, cache, or content authority changes.
Authority: Folder index. Lower authority than `docs/INDEX.md`.

This folder contains World Cup 2026 audits, validation reports, data-flow notes, and historical remediation plans.

## Current Authoritative Documents

Use these documents for current work:

- `docs/PROJECT_CONTEXT.md`: stable product and architecture context.
- `docs/seo/CANONICAL_MAP.md`: current World Cup canonical, sitemap, robots, and internal-linking rules.
- `docs/deployment/OPERATIONS.md`: cache, KV, cron, and provider operational state.
- `docs/architecture/DECISIONS.md`: current architecture decisions.
- `.ai/CURRENT_SPRINT.md`: active World Cup sprint tasks, if any.

## Current Runbooks & Reports

- `docs/worldcup/BRACKET_VALIDATION_RUNBOOK.md`: how to validate the knockout bracket end-to-end (parent graph, winner propagation, geometry, tests, smoke). Current procedure.
- `docs/worldcup/WC_KNOCKOUT_GRAPH_AUDIT.md`: bracket source-of-truth integrity report (explicit DAG, `buildKnockoutGraph`).
- Incident postmortem: `docs/deployment/WC_BRACKET_POSTMORTEM_2026-07-11.md` (WC knockout bracket misrendering; OPEN).
- Deployment/operations runbooks: see `docs/deployment/INDEX.md`.

## Historical Reports

Files such as `WC_*.md`, `DATA18WC*.md`, and `*_FINAL_VERDICT.md` are historical evidence. They may include useful validation detail, but they are not the current source of truth unless referenced from an authoritative document.

## Archived Analysis

The World Cup archive includes route audits, cache matrices, data ownership reports, live-state reports, knockout/bracket validation, and production drift scans. Preserve these files for traceability.

## Current World Cup Knowledge

- Static World Cup data lives in `src/data/worldcup/`.
- Public World Cup pages should remain crawlable, internally linked, and static-first where possible.
- Provider pressure must not be increased by sitemap or crawler traffic.
- Canonical and redirect rules must be checked against `docs/seo/CANONICAL_MAP.md` before route changes.

## Promotion Rule

If a World Cup report contains still-current facts, promote the concise current fact into `docs/PROJECT_CONTEXT.md`, `docs/seo/CANONICAL_MAP.md`, `docs/deployment/OPERATIONS.md`, or `docs/architecture/DECISIONS.md`.
