# Sitemap Canonical Report — SITEMAP-3 Phases 2 & 3
## GoalRadar · Sprint SITEMAP-3

Generated: 2026-06-10

---

## Phase 2 — Query-Parameter URLs Removed

### Problem

`sitemap/3` (`competitionSitemap`) previously included two `leagueComps.map` blocks
generating query-parameter URLs:

```
/schedule?competition=PL
/schedule?competition=PD
/schedule?competition=BL1
/schedule?competition=SA
/schedule?competition=FL1
/schedule?competition=CL
/standings?competition=PL
... (12 URLs total)
```

**Why these are problematic:**
- Google's sitemap spec states entries should be the canonical URL for a page.
  Query parameters typically indicate filtered views of a parent page, not
  independent canonicals.
- Google Search Console reports query-param sitemap entries as "Duplicate without
  user-selected canonical" when a non-parameterised version exists.
- `/schedule` and `/standings` are already in `sitemap/0` at priority 0.8.
  The parameterised variants add no additional indexable surface.
- Crawl budget waste: Googlebot must resolve 12 extra URLs that produce
  near-duplicate content.

### Fix Applied

**File:** `src/app/sitemap.ts` — `competitionSitemap()` function

Both `leagueComps.map` blocks removed. The `/competition/[code]` entries
(the true canonicals for per-competition pages) are retained.

Replaced with explanatory comment:

```typescript
// NOTE: /schedule?competition=X and /standings?competition=X were removed
// in SITEMAP-3.  Query-parameter URLs are not crawlable canonical pages;
// Google typically ignores them in sitemaps and they inflated the URL count
// without adding indexable surface area.
```

**URL count change in sitemap/3:** −12 URLs (from ~19 to ~7)

---

## Phase 3 — /competition/WC Canonical Consolidation

### Problem

`sitemap/3` previously listed `/competition/WC` alongside the WC hub at
`/world-cup-2026` (sitemap/2). This created a canonical split:

| URL | Sitemap | Priority | Content |
|-----|---------|----------|---------|
| `/world-cup-2026` | sitemap/2 | 0.95 | WC hub — standings, fixtures, bracket, teams |
| `/competition/WC` | sitemap/3 | 0.92 | Same WC data rendered via competition template |

Two high-authority URLs for the same content forces Google to choose one
canonical. This dilutes PageRank and can suppress both pages in rankings.

### Fix 1 — Sitemap Exclusion

**File:** `src/app/sitemap.ts` — `competitionSitemap()` function

Changed `COMPETITIONS.map` → `leagueComps.map` (the `leagueComps` variable
already filters `code !== 'WC'`). `/competition/WC` no longer appears in
any sitemap.

### Fix 2 — HTML Canonical Tag

**File:** `src/app/competition/[code]/page.tsx` — `generateMetadata()`

Added WC-specific canonical override:

```typescript
const canonical = normCode === 'WC'
  ? `${BASE_URL}/world-cup-2026`
  : `${BASE_URL}/competition/${normCode}`;
```

When Google crawls `/competition/WC`, the page's `<link rel="canonical">`
header now points to `/world-cup-2026`. This is a belt-and-suspenders signal:
even if `/competition/WC` is discovered via an external link, its own HTML
tells Google where the canonical authority lives.

---

## Final sitemap/3 URL Set

After SITEMAP-3, `competitionSitemap()` emits exactly 6 URLs:

| URL | Priority |
|-----|----------|
| `/competition/PL` | 0.82 |
| `/competition/PD` | 0.82 |
| `/competition/BL1` | 0.82 |
| `/competition/SA` | 0.82 |
| `/competition/FL1` | 0.82 |
| `/competition/CL` | 0.82 |

No query-parameter URLs. No WC duplicate.

---

## Verification

- `/competition/WC` removed from sitemap/3 ✅
- All 12 query-param URLs removed from sitemap/3 ✅
- `/competition/[code]` non-WC pages remain in sitemap/3 ✅
- `/competition/WC` page now emits `<link rel="canonical" href="/world-cup-2026">` ✅
- No content pages modified ✅
- TypeScript: 0 errors ✅
