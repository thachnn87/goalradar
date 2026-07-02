# AI Rules

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update when AI operating rules, document authority, or maintenance rules change.
Authority: Authoritative AI agent rules. Lower authority than `docs/PROJECT_CONTEXT.md`; higher authority than sprint state and historical reports.

These rules apply to Claude Code, OpenAI Codex, ChatGPT Web, and future coding agents.

## Document Precedence

When documents conflict, resolve them in this order:

1. Current user instructions
2. System / repository instructions
3. `docs/PROJECT_CONTEXT.md`
4. `.ai/AI_RULES.md`
5. `docs/architecture/DECISIONS.md`
6. `.ai/CURRENT_SPRINT.md`
7. `docs/INDEX.md`
8. Folder indexes
9. Historical reports

Historical reports are evidence, not current authority, unless a current authoritative document explicitly promotes them.

## Document Responsibilities

- `docs/PROJECT_CONTEXT.md`: stable project context only.
- `.ai/AI_RULES.md`: AI behavior, precedence, update rules, and conflict resolution.
- `docs/architecture/DECISIONS.md`: durable decisions in ADR format.
- `.ai/CURRENT_SPRINT.md`: live objective, active tasks, blockers, next action, and review date only.
- `.ai/HANDOFF.md`: current handoff state only.
- `.ai/HANDOFF_TEMPLATE.md`: reusable handoff template.
- `.ai/CHANGELOG.md`: material AI-assisted repository changes only.
- `docs/INDEX.md`: documentation map and historical-report policy.
- Folder indexes: current-vs-historical guidance for large doc areas.

## Always

- Read `docs/PROJECT_CONTEXT.md` first.
- Check `git status --short` before making changes.
- Preserve existing coding style and architecture.
- Prefer additive changes.
- Keep changes tightly scoped to the user request.
- Update `.ai/CHANGELOG.md` after material AI-assisted repository changes.
- Update `.ai/CURRENT_SPRINT.md` when sprint/task state changes.
- Update `.ai/HANDOFF.md` when handing work to another agent or leaving meaningful incomplete work.
- Preserve SEO, canonical URLs, sitemap behavior, and revenue surfaces.
- Promote still-current facts from historical reports into the appropriate authoritative document instead of treating the report as current truth.

## Never

- Rewrite architecture without explicit approval.
- Duplicate components or create parallel implementations.
- Change folder structure without explicit approval.
- Duplicate `docs/PROJECT_CONTEXT.md` into another file.
- Duplicate architecture decisions between `.ai/DECISIONS.md` and `docs/architecture/DECISIONS.md`.
- Store sprint state, backlog state, temporary TODOs, or last-session status in `docs/PROJECT_CONTEXT.md`.
- Modify environment variables.
- Modify package manager files unless explicitly requested.
- Modify tests during documentation-only tasks.
- Modify source code during documentation-only tasks.
- Rename source files or change imports unless explicitly requested.
- Treat old audit reports as current truth without checking `docs/PROJECT_CONTEXT.md`.
- Expose admin/debug routes publicly without explicit approval.

## Conflict Resolution

- If a historical report says it is canonical but conflicts with current authoritative docs, update the current doc if needed and treat the historical report as evidence only.
- If a user request conflicts with repository rules, follow the higher-priority instruction and state the conflict.
- If a documentation-only task requires code, package, test, import, or config changes, stop and ask for explicit approval.
- If a fact belongs in multiple places, keep the authoritative version in one file and link to it from other files.
