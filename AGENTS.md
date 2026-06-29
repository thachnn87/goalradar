# AI Agents Entry Point

This file is the shared entry point for Codex, ChatGPT Web, and future coding agents working on GoalRadar.

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
- Decisions: `.ai/DECISIONS.md`
- Handoff state: `.ai/HANDOFF.md`
- Changelog: `.ai/CHANGELOG.md`

Do not create agent-specific copies of the same rules or project context.

Prefer additive, scoped changes. Preserve existing architecture, folder structure, SEO behavior, provider/cache strategy, and revenue surfaces unless explicitly instructed otherwise.

For documentation-only tasks, do not modify application source code, package files, tests, imports, or configuration.

