# Architecture Decisions

- `docs/PROJECT_CONTEXT.md` is the canonical project context.
- `.ai/PROJECT_CONTEXT.md` is only a pointer, not a duplicate.
- Documentation refactors must not modify application behavior.
- Use Next.js App Router conventions.
- Preserve SEO and crawlability.
- Prefer static-first/page-safe data access for public pages where available.
- Preserve existing provider/cache architecture.
- Do not create parallel implementations of existing systems.
- Do not modify `lib/*` without explicit task scope and approval.
- Do not modify environment variables or package manager files during documentation tasks.
- Admin dashboards are MVP and unauthenticated unless a future task explicitly changes that decision.

