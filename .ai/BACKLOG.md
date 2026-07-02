# Backlog

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-01
Update Trigger: Update when backlog priority changes. Do not store live sprint state here.
Authority: Planning backlog only. Lower authority than `.ai/CURRENT_SPRINT.md` and current docs.

## P0

- Review historical reports that still use "canonical", "source of truth", or "final verdict" language.
- Promote still-current historical findings into authoritative docs.
- Verify cron/cache/KV readiness before high-traffic events. See `docs/deployment/OPERATIONS.md`.

## P1

- Maintain `docs/seo/CANONICAL_MAP.md` as route and indexability decisions evolve.
- Maintain `docs/business/REVENUE_READINESS.md` as analytics, AdSense, and affiliate status changes.
- Verify Search Console sitemap submission and index coverage.
- Add or verify site-wide Open Graph image strategy.
- Decide whether admin dashboards should remain unauthenticated MVP tools.
- Prevent local/dev environments from silently sharing the production football-data.org API key and rate-limit quota. Observed 2026-07-01: running the dev server with production credentials pulled via `vercel env pull` caused real rate-limiter contention (queue depth 15, provider timeout, 87s page load) — a genuine production-impact risk, not theoretical. Needs either a sandboxed/mock provider for local dev, or an explicit warning when `NODE_ENV=development` detects a production API key. Kept at P1, not escalated to P0: follow-up Vercel production logs from the same window showed `[LIVE CACHE] set` succeeding intermittently (count flapping between 0 and 1) with no `RATE_LIMIT`/circuit-breaker lines — actual production impact from this incident was not confirmed, only the underlying risk.

## P2

- Expand automated tests around provider failover, sitemap generation, canonical URL generation, and static World Cup fallback.
- Add stronger monitoring for KV freshness and provider rate-limit exhaustion.
- Improve admin dashboard source-of-truth clarity across in-process counters, KV endpoint freshness, and GA4.
- Add richer docs indexes for architecture, SEO, revenue, and operations if current indexes become too large.
- Improve handoff templates with links to active PRs/issues when available.

## Future Ideas

- Editorial CMS or data entry flow for content updates.
- Better visual assets and OG images per page cluster.
- More granular ad placement experiments.
- A/B testing for affiliate, newsletter, and push CTA copy.
- AI-readable route map generated from `src/app`.
- AI-readable component inventory generated from `src/components`.
- Automated documentation freshness check in CI.
- Agent-specific onboarding prompts for Claude Code, Codex, and ChatGPT Web.
