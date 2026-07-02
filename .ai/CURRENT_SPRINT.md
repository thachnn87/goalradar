# Current Sprint

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update when the active sprint objective, tasks, blockers, next action, or review date changes.
Authority: Live sprint state only. Lower authority than `docs/architecture/DECISIONS.md`.

## Objective

Make the AI documentation workspace production-ready, reduce authority drift, and preserve existing project knowledge without changing application behavior.

## Active Tasks

- Create documentation indexes for `docs/`, `docs/analysis/`, and `docs/worldcup/`.
- Move durable decisions into `docs/architecture/DECISIONS.md`.
- Create current-state docs for SEO canonicals, deployment operations, and revenue readiness.
- Refactor `.ai` workspace files to separate rules, sprint state, handoff state, and templates.
- Trim volatile sprint/backlog content from `docs/PROJECT_CONTEXT.md`.

## Blockers

- Historical reports contain old "canonical" and "source of truth" language that needs gradual manual review.
- Existing unrelated dirty/generated files are present in the worktree and should not be touched by this documentation refactor.

## Next Action

- Verify documentation-only diff and summarize created, updated, deprecated, and manual-review items.

## Review Date

2026-07-06
