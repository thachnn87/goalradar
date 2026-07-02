# Operations

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update when deployment flow, Vercel settings, KV, cron, cache, provider dependencies, or operational risks change.
Authority: Authoritative production operations summary.

This document summarizes current operational knowledge without replacing deployment scripts, route code, or environment configuration.

## Deployment Flow

- GoalRadar is a Next.js App Router application intended for Vercel deployment.
- Production build is driven by the existing package scripts.
- Documentation-only changes must not modify deployment configuration or runtime behavior.
- Build and verification output may include provider fallback warnings when external services or credentials are unavailable.

## Vercel

- `vercel.json` is currently minimal.
- Cron route handlers exist in the app, but schedules must be deliberately declared before relying on Vercel cron execution.
- Vercel environment variables control providers, analytics, ads, email, push, Postgres, and KV integrations.

## KV

- Vercel KV is the cross-instance cache, stale-while-revalidate layer, telemetry store, rate-limit/fallback support, and newsletter fallback path.
- Page-safe read paths should prefer KV/static/fallback data over live provider pressure where available.
- KV freshness is an operational risk during high-crawl or high-traffic periods.

## Cache

- GoalRadar uses layered caching: in-memory L1, Vercel KV L2 SWR, disaster recovery keys, and static World Cup data fallback.
- Cache behavior should protect provider quota and preserve page availability.
- Public pages should degrade gracefully when cache, KV, or providers are cold or unavailable.

## Cron

- Cron endpoints exist for orchestration, prewarming, repair, drift scanning, and health/archive-style work.
- Cron routes should be protected, idempotent, and safe to retry before schedules are enabled.
- If production depends on cron behavior, verify schedule configuration and endpoint protection together.

## Provider Dependencies

- football-data.org is the primary football data provider.
- api-football is the secondary failover/enrichment provider and may be disabled by environment configuration.
- Provider calls should go through the existing provider/cache architecture.
- Rate limits, unavailable credentials, and provider drift are expected operational risks.

## Operational Risks

- External provider quota exhaustion during crawl spikes or tournament traffic.
- KV freshness or availability gaps.
- Cron schedules missing or disabled while route handlers exist.
- Admin/debug surfaces exposing operational detail if linked or indexed.
- Static World Cup data becoming stale as official tournament operations evolve.

## Manual Verification Triggers

- Before World Cup traffic spikes.
- After changing sitemap, robots, provider, cache, cron, or data-fallback behavior.
- After adding new admin or debug surfaces.
- After configuring production analytics, ads, email, push, Postgres, or KV credentials.
