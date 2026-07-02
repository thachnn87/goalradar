# GoalRadar Documentation Index

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update when authoritative documentation is added, moved, deprecated, or superseded.
Authority: Authoritative documentation map. Lower authority than `docs/PROJECT_CONTEXT.md` and `.ai/AI_RULES.md`.

This index tells AI agents and maintainers which GoalRadar documents are current authority and which documents are historical evidence.

## Current Authoritative Documents

- `docs/PROJECT_CONTEXT.md`: canonical stable project context.
- `.ai/AI_RULES.md`: AI agent operating rules and document precedence.
- `docs/architecture/DECISIONS.md`: durable architecture and product decisions.
- `.ai/CURRENT_SPRINT.md`: current objective, active tasks, blockers, next action, and review date.
- `docs/seo/CANONICAL_MAP.md`: current SEO route, canonical, sitemap, robots, and internal-linking rules.
- `docs/deployment/OPERATIONS.md`: current production operations, cache, KV, cron, and provider notes.
- `docs/business/REVENUE_READINESS.md`: current analytics, AdSense, affiliate, SEO, and revenue blockers.

## AI Workspace Documents

- `.ai/PROJECT_CONTEXT.md`: lightweight pointer to `docs/PROJECT_CONTEXT.md`.
- `.ai/AI_RULES.md`: required rules for Claude Code, Codex, ChatGPT, Gemini, Cursor, and future agents.
- `.ai/CURRENT_SPRINT.md`: live sprint state only.
- `.ai/HANDOFF.md`: current handoff state only.
- `.ai/HANDOFF_TEMPLATE.md`: reusable handoff template.
- `.ai/CHANGELOG.md`: append-only material AI-assisted repository changes.
- `.ai/SESSION_START.md`: session start and finish checklist.
- `CLAUDE.md`: Claude Code entry point.
- `AGENTS.md`: generic agent entry point.

## Folder Indexes

- `docs/analysis/INDEX.md`: historical analysis and audit reports.
- `docs/worldcup/INDEX.md`: World Cup 2026 current references and historical reports.

## Historical Report Areas

These folders contain valuable evidence, prior audits, validation reports, and implementation notes. They are not current authority unless a current authoritative document links to a specific file as active.

- `docs/analysis/`
- `docs/analysis/runtime/`
- `docs/analysis/trace/`
- `docs/analysis/graph/`
- `docs/analysis/matrix/`
- `docs/worldcup/`
- `docs/deployment/`
- `docs/seo/`
- `docs/business/`
- `docs/features/`
- `docs/architecture/`

## Historical Report Rule

Historical documents must never present themselves as the current source of truth for new work. If a historical report conflicts with `docs/PROJECT_CONTEXT.md`, `.ai/AI_RULES.md`, or `docs/architecture/DECISIONS.md`, the current authoritative document wins.

## Manual Review Queue

- Review historical files that use "source of truth", "canonical", "final verdict", or "never" language.
- Promote still-current facts into the appropriate authoritative document.
- Leave historical reports in place after promotion; do not delete them.
