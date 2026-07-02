# Architecture Decisions

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update when an architecture, SEO, data, revenue, or agent-operating decision changes.
Authority: Authoritative decision log. Higher authority than sprint files and historical reports.

This file records durable GoalRadar decisions in ADR style. Operational rules for AI agents live in `.ai/AI_RULES.md`.

## ADR-001: Canonical Project Context

ID: ADR-001
Status: Accepted
Date: 2026-06-29
Decision: `docs/PROJECT_CONTEXT.md` is the canonical stable project context.
Rationale: Multiple AI agents need one shared project brain without duplicate context files drifting apart.
Consequences: Other docs may point to the context, but must not duplicate it wholesale.
Supersedes: Earlier duplicated AI context copies.

## ADR-002: AI Workspace Pointer

ID: ADR-002
Status: Accepted
Date: 2026-06-29
Decision: `.ai/PROJECT_CONTEXT.md` is a lightweight pointer only.
Rationale: A second full context file would create split-brain project state.
Consequences: Agents must read `docs/PROJECT_CONTEXT.md` for project context.
Supersedes: Any copied `.ai/PROJECT_CONTEXT.md` content.

## ADR-003: Documentation Refactors Must Not Change Runtime Behavior

ID: ADR-003
Status: Accepted
Date: 2026-06-29
Decision: Documentation-only tasks must not modify application source, runtime configuration, package files, tests, imports, or production behavior.
Rationale: Documentation reorganization should be safe to review, commit, and deploy independently.
Consequences: Runtime changes require an explicit scoped user request.
Supersedes: N/A

## ADR-004: Next.js App Router Foundation

ID: ADR-004
Status: Accepted
Date: 2026-06-29
Decision: GoalRadar uses Next.js App Router conventions.
Rationale: The existing application, route structure, metadata, sitemaps, and server components are built on App Router.
Consequences: New routes and metadata should follow existing App Router patterns.
Supersedes: N/A

## ADR-005: Static-First Public Pages

ID: ADR-005
Status: Accepted
Date: 2026-06-29
Decision: Public SEO pages should prefer static, cached, or page-safe data access where available.
Rationale: Crawl traffic and provider outages must not create rate-limit failures or blank high-value pages.
Consequences: Pages should avoid direct provider calls when page-safe cached variants, KV, or static World Cup data are available.
Supersedes: N/A

## ADR-006: Provider and Cache Ownership

ID: ADR-006
Status: Accepted
Date: 2026-06-29
Decision: Provider access remains centralized through the existing provider/cache architecture.
Rationale: `ProviderManager`, L1 cache, Vercel KV SWR, disaster recovery keys, and static fallback data are already the reliability model.
Consequences: Do not create parallel provider, cache, or data-fetching systems without explicit approval.
Supersedes: N/A

## ADR-007: SEO and Crawlability Preservation

ID: ADR-007
Status: Accepted
Date: 2026-06-29
Decision: SEO routes, canonical URLs, robots behavior, sitemap behavior, schema, and internal linking are protected product surfaces.
Rationale: Organic search is the primary growth channel.
Consequences: SEO changes must be deliberate and checked against `docs/seo/CANONICAL_MAP.md`.
Supersedes: N/A

## ADR-008: Admin Dashboards Are MVP and Unauthenticated

ID: ADR-008
Status: Accepted
Date: 2026-06-29
Decision: Admin dashboards are currently MVP tools without authentication unless a future task explicitly changes that decision.
Rationale: Existing admin pages were requested as MVP and no authentication was added.
Consequences: Admin pages must remain `noindex`, robots-blocked where applicable, and absent from public navigation unless explicitly approved.
Supersedes: N/A

## ADR-009: Revenue Surfaces Are Environment Driven

ID: ADR-009
Status: Accepted
Date: 2026-06-29
Decision: AdSense, GA4, server-side GA4 reporting, OneSignal, Resend, and related revenue/retention integrations are environment driven.
Rationale: The app must degrade safely when credentials are absent.
Consequences: Do not hardcode production credentials or publisher IDs. Public pages should remain functional when integrations are disabled.
Supersedes: N/A
