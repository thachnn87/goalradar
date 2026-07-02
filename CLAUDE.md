# Claude Code Entry Point

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update only when Claude Code onboarding changes.
Authority: Entry point only. Does not override `docs/PROJECT_CONTEXT.md` or `.ai/AI_RULES.md`.

Claude Code is the primary AI coding assistant for GoalRadar.

Before doing any work, read these files in order:

1. `docs/PROJECT_CONTEXT.md`
2. `.ai/AI_RULES.md`
3. `.ai/CURRENT_SPRINT.md`
4. `.ai/HANDOFF.md`
5. `.ai/SESSION_START.md`

Project truth lives in one place only:

- Canonical context: `docs/PROJECT_CONTEXT.md`
- AI rules: `.ai/AI_RULES.md`
- Sprint state: `.ai/CURRENT_SPRINT.md`
- Decisions: `docs/architecture/DECISIONS.md`
- Handoff state: `.ai/HANDOFF.md`
- Changelog: `.ai/CHANGELOG.md`

Do not duplicate project context or rules in this file.

Preserve GoalRadar's existing architecture, SEO surfaces, revenue readiness, and documentation structure unless the user explicitly asks for a scoped change.

For documentation-only tasks, do not modify application source code, package files, tests, imports, or configuration.
