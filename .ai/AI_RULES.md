# AI Rules

These rules apply to Claude Code, OpenAI Codex, ChatGPT Web, and future coding agents.

## Always

- Read `docs/PROJECT_CONTEXT.md` first.
- Check `git status --short` before making changes.
- Preserve existing coding style and architecture.
- Prefer additive changes.
- Keep changes tightly scoped to the user request.
- Update `.ai/CHANGELOG.md` after meaningful repository changes.
- Update `.ai/CURRENT_SPRINT.md` when sprint/task state changes.
- Preserve SEO, canonical URLs, sitemap behavior, and revenue surfaces.
- Document handoff state in `.ai/HANDOFF.md` when switching agents.

## Never

- Rewrite architecture without explicit approval.
- Duplicate components or create parallel implementations.
- Change folder structure without explicit approval.
- Modify environment variables.
- Modify package manager files unless explicitly requested.
- Modify tests during documentation-only tasks.
- Modify source code during documentation-only tasks.
- Rename source files or change imports unless explicitly requested.
- Treat old audit reports as current truth without checking `docs/PROJECT_CONTEXT.md`.
- Expose admin/debug routes publicly without explicit approval.

