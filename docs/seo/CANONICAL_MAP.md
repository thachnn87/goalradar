# SEO Canonical Map

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update when routes, canonicals, sitemap generation, robots rules, schema strategy, or internal linking rules change.
Authority: Authoritative SEO route and crawlability guide.

This document summarizes current SEO ownership without duplicating implementation details from route files.

## Canonical Rules

- Public SEO pages should expose one preferred canonical URL per search intent.
- World Cup flat SEO pages and nested utility pages must avoid competing for the same keyword intent.
- Dynamic match, team, competition, and World Cup routes must keep canonical metadata aligned with sitemap inclusion.
- Duplicate or legacy route families should use redirects, canonical metadata, or noindex rules according to existing route behavior.
- Do not introduce new indexable route families without checking existing World Cup, team, match, and competition coverage.

## Sitemap Ownership

- `src/app/sitemap.ts` owns dynamic sitemap generation.
- Split sitemaps currently cover core/static pages, World Cup flat pages, World Cup hub pages, competition pages, match pages, and team pages.
- Sitemap generation must use cached, page-safe, static, or fallback data where available.
- Sitemap generation must not create live provider pressure during crawls.
- Critical fallback URLs should remain available if dynamic sitemap generation fails.

## Robots Ownership

- `src/app/robots.ts` owns robots rules.
- `/admin/`, `/api/`, and `/newsletter/` should remain blocked from crawling unless a future SEO decision changes this.
- Robots should continue declaring the sitemap and host.

## Indexable Route Principles

Indexable routes should be:

- Public, consumer-facing pages.
- Useful without authentication.
- Internally linked from relevant hubs, navigation, or related-link components.
- Backed by stable metadata, canonical URLs, and schema where appropriate.
- Resilient when provider, KV, analytics, ads, or newsletter services are unavailable.

## Noindex Rules

Noindex should apply to:

- Admin dashboards.
- Debug and internal operational surfaces.
- API responses.
- Newsletter confirmation or system utility flows where indexing has no search value.
- Temporary, duplicate, or thin pages until they are intentionally promoted.

## Internal Linking Principles

- World Cup hub pages should link to schedule, fixtures, results, standings, groups, bracket, teams, venues, predictions, TV, streaming, and watch-live pages.
- Match pages should link back to relevant competition, team, and World Cup surfaces where applicable.
- Team pages should link to fixtures, results, standings, and related World Cup pages where applicable.
- Related-link components should reinforce canonical page clusters instead of creating duplicate intent loops.
- Revenue pages and affiliate CTAs should be discoverable only where they match user intent and compliance requirements.

## Schema Coverage Principles

- Use schema where it matches page intent: `Organization`, `WebSite`, `BreadcrumbList`, `CollectionPage`, `SportsEvent`, `SportsTeam`, and FAQ-style schema where appropriate.
- Do not add schema that is unsupported by visible page content.
- Keep schema stable during provider outages by using static or cached fallback data where possible.
