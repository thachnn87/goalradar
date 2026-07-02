# Revenue Readiness

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update when analytics, AdSense, affiliate, SEO monetization, trust pages, or revenue blockers change.
Authority: Authoritative current revenue readiness tracker.

This document tracks production readiness for revenue-related systems. It does not replace implementation files or environment configuration.

## Analytics

Current state:

- GA4 client tracking is environment driven.
- Server-side GA4 Data API reporting exists for admin performance summaries.
- Custom event helpers exist for analytics instrumentation.

Readiness gaps:

- Confirm production GA4 measurement ID.
- Confirm GA4 reporting service account variables if admin reporting is required.
- Confirm key events are registered as GA4 custom dimensions where needed.

## AdSense

Current state:

- AdSense loading is environment driven.
- A canonical ad slot component reserves layout space to protect Core Web Vitals.
- `public/ads.txt` exists.
- Legal and trust pages exist.

Readiness gaps:

- Confirm production publisher ID and ad unit slot IDs.
- Confirm all ad placements comply with content, layout, and policy requirements.
- Validate no accidental ad rendering on utility, admin, debug, or low-value pages.

## Affiliate

Current state:

- Reusable affiliate CTA surfaces exist.
- Affiliate disclosure page exists.

Readiness gaps:

- Replace placeholder affiliate links before production revenue campaigns.
- Confirm affiliate offers match page intent and disclosure requirements.
- Avoid aggressive affiliate placement on thin or informational pages.

## SEO Revenue Readiness

Current state:

- World Cup 2026 route surface is the primary organic growth engine.
- Dynamic sitemaps, robots rules, metadata, schema, breadcrumbs, and internal-linking components exist.

Readiness gaps:

- Confirm Search Console sitemap submission and coverage.
- Maintain canonical discipline across overlapping World Cup route clusters.
- Add or verify site-wide Open Graph image strategy.

## Revenue Blockers

- Missing or unverified production analytics credentials.
- Missing or unverified production AdSense configuration.
- Placeholder affiliate links.
- Unauthenticated admin dashboards should remain noindex and out of public navigation.
- Provider/cache/KV instability can reduce traffic quality, crawl reliability, and monetization surface availability.
