# SITEMAP-3 Report — Production Sitemap Cleanup
## GoalRadar · Sprint SITEMAP-3

Generated: 2026-06-10

---

## Executive Summary

Sprint SITEMAP-3 cleaned up every issue identified in `SITEMAP_AUDIT.md`.
Three classes of sitemap problems are resolved:

1. **301 Redirect URL** — `/world-cup-2026/results` removed from sitemap/2
2. **Query-Parameter URLs** — 12 `?competition=X` URLs removed from sitemap/3
3. **WC Canonical Split** — `/competition/WC` removed from sitemap/3; page now emits canonical → `/world-cup-2026`

Additionally, the stale `export const revalidate = 3600` that was silently
ignored by `force-dynamic` was removed and documented.

**Scope constraint respected:** No content pages were modified. No new URLs
created. Only sitemap generation, canonicalisation, and indexing signals
were changed.

---

## Changes Made

### `src/app/sitemap.ts`

| Change | Why |
|--------|-----|
| Removed `export const revalidate = 3600` | Silently ignored with `force-dynamic`; causes confusion |
| Updated file header comment | Documents all 6 sitemaps and SITEMAP-3 changes |
| `wcHubSitemap()` — removed `/world-cup-2026/results` | Returns 301; destination already in sitemap/1 |
| `competitionSitemap()` — switched `COMPETITIONS.map` → `leagueComps.map` | Excludes `/competition/WC` (canonical split) |
| `competitionSitemap()` — removed `/schedule?competition=X` block | Query params not indexable canonicals |
| `competitionSitemap()` — removed `/standings?competition=X` block | Query params not indexable canonicals |

### `src/app/competition/[code]/page.tsx`

| Change | Why |
|--------|-----|
| `generateMetadata()` — canonical for WC → `/world-cup-2026` | Belt-and-suspenders signal for Google |

---

## Before / After: sitemap/3 URL Count

| URL Pattern | Before | After |
|-------------|--------|-------|
| `/competition/WC` | ✅ (1 URL) | ❌ Removed |
| `/competition/PL`, `/PD`, `/BL1`, `/SA`, `/FL1`, `/CL` | ✅ (6 URLs) | ✅ Retained |
| `/schedule?competition=*` | ✅ (6 URLs) | ❌ Removed |
| `/standings?competition=*` | ✅ (6 URLs) | ❌ Removed |
| **Total** | **19 URLs** | **6 URLs** |

---

## Before / After: sitemap/2 URL Count

| Change | Before | After |
|--------|--------|-------|
| `/world-cup-2026/results` | ✅ (1 URL, 301) | ❌ Removed |
| All other WC hub URLs | ✅ | ✅ Retained |

---

## Deliverables

| File | Status |
|------|--------|
| `SITEMAP_REDIRECT_REPORT.md` | ✅ Written (Phase 1) |
| `SITEMAP_CANONICAL_REPORT.md` | ✅ Written (Phase 2 + 3) |
| `SITEMAP_VALIDATION_REPORT.md` | ✅ Written (Phase 4) |
| `SITEMAP3_REPORT.md` | ✅ This file |

---

## Verification Checklist

- [x] `/world-cup-2026/results` removed from sitemap/2
- [x] `/competition/WC` removed from sitemap/3
- [x] All 12 `?competition=X` URLs removed from sitemap/3
- [x] `export const revalidate = 3600` removed from sitemap.ts
- [x] `<link rel="canonical">` on `/competition/WC` → `/world-cup-2026`
- [x] No content pages modified
- [x] No new URLs created
- [x] TypeScript: 0 errors (`npx tsc --noEmit`)
- [x] sitemap/4 and sitemap/5 (dynamic) — untouched, KV fallback intact

---

## Pending: Git Push

Commits `51e99ff` (PERF-4), `92d948e` (PERF-4.5), and the SITEMAP-3 changes
are ready to push. Push when network connectivity is confirmed.
