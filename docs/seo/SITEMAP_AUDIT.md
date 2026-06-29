# Sitemap Audit — GoalRadar
**Date:** 2026-06-10  
**Scope:** `/sitemap.xml`, `/sitemap/0.xml` – `/sitemap/3.xml` (static), plus dynamic generation logic for `/sitemap/4.xml` and `/sitemap/5.xml`

---

## 1. Sitemap Architecture

```
/sitemap.xml
  ├─ /sitemap/0.xml   core static pages (9 URLs)
  ├─ /sitemap/1.xml   WC 2026 flat-URL SEO pages (8 URLs)
  ├─ /sitemap/2.xml   WC 2026 hub pages (146 URLs)
  ├─ /sitemap/3.xml   competition & league pages (19 URLs)
  ├─ /sitemap/4.xml   match + predict pages — dynamic (API-sourced)
  └─ /sitemap/5.xml   team pages — dynamic (standings-sourced)
```

**Files:**  
- `src/app/sitemap.ts` — Next.js metadata sitemap, serves `/sitemap/{id}.xml`  
- `src/app/api/sitemap-index/route.ts` — XML index served at `/sitemap.xml` via a rewrite  
- `next.config.ts` — `/sitemap.xml` → `/api/sitemap-index` rewrite; 25+ 301 redirects

---

## 2. URL Count

### Static segments (deterministic at build time)

| Sitemap | Segment | URLs | Source |
|---------|---------|------|--------|
| `/sitemap/0.xml` | Core static | **9** | Hardcoded |
| `/sitemap/1.xml` | WC flat-URL SEO | **8** | Hardcoded |
| `/sitemap/2.xml` | WC hub — fixed pages | 17 | Hardcoded |
| `/sitemap/2.xml` | WC group-prediction pages (a–h) | 8 | `['a'..'h']` spread |
| `/sitemap/2.xml` | WC group pages (a–l) | 12 | `WC_GROUPS` (12) |
| `/sitemap/2.xml` | Featured team pages | 6 | `WC_TEAM_SLUGS` (6) |
| `/sitemap/2.xml` | All WC team detail pages | 48 | `WC_ALL_TEAM_SLUGS` (48) |
| `/sitemap/2.xml` | Watch-live country pages | 7 | `WC_WATCH_COUNTRY_SLUGS` (7) |
| `/sitemap/2.xml` | TV-schedule country pages | 32 | `WC_TV_COUNTRY_SLUGS` (32) |
| `/sitemap/2.xml` | Venue detail pages | 16 | `WC_VENUE_SLUGS` (16) |
| **`/sitemap/2.xml` total** | | **146** | |
| `/sitemap/3.xml` | `/competition/{code}` pages | 7 | `COMPETITIONS` (7 codes) |
| `/sitemap/3.xml` | `/schedule?competition={code}` | 6 | 6 non-WC competitions |
| `/sitemap/3.xml` | `/standings?competition={code}` | 6 | 6 non-WC competitions |
| **`/sitemap/3.xml` total** | | **19** | |
| **Static total (0+1+2+3)** | | **182** | |

### Dynamic segments (API-sourced at render time)

| Sitemap | Content | Estimated URLs |
|---------|---------|----------------|
| `/sitemap/4.xml` | Match detail pages (`/match/{id}-{home}-vs-{away}`) | ~150–200 |
| `/sitemap/4.xml` | Predict pages (`/predict/{id}-…`, upcoming+live only) | ~50–100 |
| `/sitemap/5.xml` | Team pages (`/teams/{id}-{slug}`, all competitions) | ~100–130 |
| **Dynamic total** | | **~300–430** |

**Grand total (estimated):** ~480–612 URLs across all 6 sitemaps.

---

## 3. Canonical Consistency

### Base URL
All sitemaps use the hardcoded base: `https://goalradar.org`  
No `www.` variant appears anywhere. Consistent across:
- `src/app/sitemap.ts`
- `src/app/api/sitemap-index/route.ts`
- `src/app/robots.ts`
- `src/app/layout.tsx` (`metadataBase: new URL("https://goalradar.org")`)
- All page-level `BASE_URL` constants (35+ files)

**Verified consistent — no `www.` mixed in any sitemap-generated URL.**

### Trailing slashes
No trailing slashes in any URL. All sitemap entries end without `/`.  
Next.js default: no trailing slash. Consistent.

### Query-parameter URLs in sitemap/3 ⚠️

`sitemap/3` includes 12 query-parameter URLs as "supplemental crawl-discovery":
```
/schedule?competition=PL
/schedule?competition=PD
… (6 total)
/standings?competition=PL
… (6 total)
```

The comment in `sitemap.ts` acknowledges these are not canonical:
> _"supplemental crawl-discovery entries — Canonical for each is /competition/[code]"_

**Issue:** Including non-canonical URLs in a sitemap signals Google to index them. Even with a `<canonical>` tag on the page itself, listing parameterized URLs in sitemaps splits crawl budget and may cause indexing confusion. Google's guidance is that sitemaps should only list canonical URLs.

---

## 4. www Redirect Handling

The sitemap declares all URLs as `https://goalradar.org` (non-www).  
`robots.txt` host declaration: `https://goalradar.org` ✓

**Cannot be verified from source** — www → non-www redirect is handled at the DNS/CDN (Vercel) layer, not in application code. Must be confirmed at the hosting level:
- Expected: `https://www.goalradar.org/*` → 301 → `https://goalradar.org/*`
- A missing www redirect would create a duplicate-content risk for any inbound `www.` link.

---

## 5. lastmod Analysis

| Segment | lastmod value | Verdict |
|---------|--------------|---------|
| `/about`, `/contact`, `/privacy-policy`, `/terms`, `/affiliate-disclosure` | `new Date('2025-01-01')` | ✅ Correct — static pages |
| `/world-cup-2026-live-stream`, `/world-cup-2026-tv-guide` | `new Date('2026-05-01')` | ✅ Correct — evergreen content |
| WC hub pages (venues, watch-live, tv-schedule, host-cities) | `new Date('2026-05-01')` | ✅ Correct |
| WC hub dynamic pages (fixtures, groups, predictions, etc.) | `new Date()` | ⚠️ See below |
| Match pages (sitemap/4) | `match.lastUpdated` if set, else `new Date()` | ✅ Correct for matches |
| All other pages | `new Date()` | ⚠️ See below |

**Issue — `new Date()` on ISR pages:** When `new Date()` is used as `lastmod` and the sitemap revalidates hourly (ISR 3600s), every hub page reports `lastmod = now` on every crawl. Google interprets this as "this page was modified in the last hour" — which is not meaningful for pages like the group standings overview. It dilutes the freshness signal.  
Better: for stable-content hub pages, use a fixed date; for live-data pages (fixtures, results, standings), `new Date()` is acceptable.

---

## 6. Match URLs

Sitemap/4 generates match URLs using:
```typescript
`${BASE_URL}${matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}`
```

`matchPath` format: `/match/{id}-{home-slug}-vs-{away-slug}`  
Example: `/match/537327-mexico-vs-south-africa`

Canonical enforcement is handled in `src/app/match/[id]/page.tsx` — the page redirects any non-canonical slug format to the canonical slug (e.g. `/match/537327` → `/match/537327-mexico-vs-south-africa`).

**Verified consistent:** sitemap generates the same canonical format that the page uses.

Prediction URLs:  
`/predict/{id}-{home-slug}-vs-{away-slug}` — only included for `SCHEDULED` + `TIMED` + `IN_PLAY` matches.  
Finished matches correctly excluded (stale predictions have no SEO value).

---

## 7. WC URLs

### Coverage matrix

| URL pattern | Sitemap | Route exists | Status |
|------------|---------|-------------|--------|
| `/world-cup-2026` | sitemap/2 | `src/app/world-cup-2026/page.tsx` | ✅ |
| `/world-cup-2026/fixtures` | sitemap/2 | `…/fixtures/page.tsx` | ✅ |
| `/world-cup-2026/results` | sitemap/2 | `…/results/page.tsx` | ❌ **301 redirect** (see §8) |
| `/world-cup-2026/groups` | sitemap/2 | `…/groups/page.tsx` | ✅ |
| `/world-cup-2026/bracket` | sitemap/2 | `…/bracket/page.tsx` | ✅ |
| `/world-cup-2026/teams` | sitemap/2 | `…/teams/page.tsx` | ✅ |
| `/world-cup-2026/matches` | sitemap/2 | `…/matches/page.tsx` | ✅ |
| `/world-cup-2026/host-cities` | sitemap/2 | `…/host-cities/page.tsx` | ✅ |
| `/world-cup-2026/matches-today` | sitemap/2 | `…/matches-today/page.tsx` | ✅ |
| `/world-cup-2026/matches-tomorrow` | sitemap/2 | `…/matches-tomorrow/page.tsx` | ✅ |
| `/world-cup-2026/watch-live` | sitemap/2 | `…/watch-live/page.tsx` | ✅ |
| `/world-cup-2026/tv-schedule` | sitemap/2 | `…/tv-schedule/page.tsx` | ✅ |
| `/world-cup-2026/streaming-guide` | sitemap/2 | `…/streaming-guide/page.tsx` | ✅ |
| `/world-cup-2026/venues` | sitemap/2 | `…/venues/page.tsx` | ✅ |
| `/world-cup-2026/predictions` | sitemap/2 | `…/predictions/page.tsx` | ✅ |
| `/world-cup-2026/winner-predictions` | sitemap/2 | `…/winner-predictions/page.tsx` | ✅ |
| `/world-cup-2026/golden-boot-predictions` | sitemap/2 | `…/golden-boot-predictions/page.tsx` | ✅ |
| `/world-cup-2026/group-{a-h}-predictions` (×8) | sitemap/2 | Static files ✓ | ✅ |
| `/world-cup-2026/group-{a-l}` (×12) | sitemap/2 | `[group]` dynamic route | ✅ |
| `/world-cup-2026/{usa,england,brazil,argentina,mexico,canada}` (×6) | sitemap/2 | Static files ✓ | ✅ |
| `/world-cup-2026/teams/{slug}` (×48) | sitemap/2 | `teams/[slug]/page.tsx` | ✅ |
| `/world-cup-2026/watch-live/{country}` (×7) | sitemap/2 | `watch-live/[country]/page.tsx` | ✅ |
| `/world-cup-2026/tv-schedule/{country}` (×32) | sitemap/2 | `tv-schedule/[country]/page.tsx` | ✅ |
| `/world-cup-2026/venues/{venue}` (×16) | sitemap/2 | `venues/[venue]/page.tsx` | ✅ |
| `/world-cup-2026-schedule` | sitemap/1 | Static page ✓ | ✅ |
| `/world-cup-2026-results` | sitemap/1 | Static page ✓ | ✅ |
| `/world-cup-2026-standings` | sitemap/1 | Static page ✓ | ✅ |
| `/world-cup-2026-bracket` | sitemap/1 | Static page ✓ | ✅ |
| `/world-cup-2026-groups` | sitemap/1 | Static page ✓ | ✅ |
| `/world-cup-2026-live-stream` | sitemap/1 | Static page ✓ | ✅ |
| `/world-cup-2026-tv-guide` | sitemap/1 | Static page ✓ | ✅ |
| `/world-cup-2026-predictions` | sitemap/1 | Static page ✓ | ✅ |

---

## 8. URLs in Sitemap Returning Non-200

### ❌ CRITICAL — `/world-cup-2026/results` (sitemap/2, position 3)

**Situation:**
```
sitemap/2 lists: https://goalradar.org/world-cup-2026/results
next.config.ts:  source: '/world-cup-2026/results'  →  destination: '/world-cup-2026-results'  permanent: true
```

`next.config.ts` redirects fire **before** the file-system router. The `src/app/world-cup-2026/results/page.tsx` file exists but is never served — every request to `/world-cup-2026/results` returns **301** to `/world-cup-2026-results`.

**Effect:** Google encounters the sitemap URL, follows the 301, and indexes `/world-cup-2026-results` instead. The sitemap URL itself is flagged as a redirect in Google Search Console.

**Fix:**  
Remove `/world-cup-2026/results` from the `wcHubSitemap()` function. It is already covered in sitemap/1 at its canonical destination `/world-cup-2026-results`. The `results/page.tsx` source file can be removed or kept as dead code — the redirect handles all traffic.

```diff
-    {
-      url: `${BASE_URL}/world-cup-2026/results`,
-      ...
-    },
```

---

## 9. Orphan URLs (reachable but not in any sitemap)

| Route | File | Reason not in sitemap | Notes |
|-------|------|-----------------------|-------|
| `/team/{id}` | `src/app/team/[id]/page.tsx` | Old numeric-ID route | 308 permanent redirect to `/teams/{id}-{slug}`. Correct: redirect routes should not be in sitemap. |
| `/world-cup-2026/team/{slug}` | `src/app/world-cup-2026/team/[slug]/page.tsx` | Singular variant | 308 redirect to `/world-cup-2026/teams/{slug}`. Correct. |
| `/{alias}` (e.g. `/mexico-vs-south-africa-live-score`) | `src/app/[alias]/page.tsx` | Intentional — canonical tag points to real match URL | These thin alias pages set `alternates.canonical` to the real `/match/{id}-…` URL. Correct: canonical pages (not aliases) should be in sitemap. |
| `/newsletter/confirmed` | `src/app/newsletter/confirmed/page.tsx` | Blocked by `robots.txt` | `/newsletter/` disallowed. Correct. |
| `/newsletter/invalid` | `src/app/newsletter/invalid/page.tsx` | Blocked by `robots.txt` | Correct. |
| `/admin/performance` | `src/app/admin/performance/page.tsx` | Blocked by `robots.txt` | `/admin/` disallowed. Correct. |
| `/admin/seo` | `src/app/admin/seo/page.tsx` | Blocked by `robots.txt` | Correct. |

**Verdict:** No unintentional orphan routes. All omissions are deliberate (redirects, blocked paths, or alias canonicals).

---

## 10. URLs Missing from Sitemap

### Confirm-absent check

| URL | In sitemap? | Should be? | Verdict |
|-----|-------------|-----------|---------|
| `/predict/{id}` for finished matches | No | No | ✅ Correct — stale predictions excluded |
| `/world-cup-2026/team/{slug}` | No | No | ✅ Correct — redirect |
| `/world-cup-2026/group-{i-l}-predictions` | No | No | ✅ No page routes exist for groups i–l predictions |
| `/competition/WC` | sitemap/3 | Debatable | ⚠️ See below |

### `/competition/WC` vs `/world-cup-2026` — duplicate topic coverage

`sitemap/3` includes `/competition/WC` (priority 0.92) alongside `/world-cup-2026` in `sitemap/2` (priority 0.95). Both pages cover the FIFA World Cup. Unless `/competition/WC` serves meaningfully different content from the WC hub, this creates a competing pair for the same topic keywords, splitting PageRank between the two URLs.

**Recommendation:** If `/competition/WC` redirects to `/world-cup-2026` or displays the same content, remove it from `sitemap/3` and add a canonical pointing to `/world-cup-2026`. If it's kept as a distinct page, add a `<link rel="canonical">` to differentiate intent clearly.

---

## 11. Additional Issues

### Issue A — Stale comment in `sitemap.ts` header
The top-of-file comment lists only 5 child sitemaps (IDs 0–4) but `generateSitemaps()` returns 6 (IDs 0–5). The sitemap-index correctly references all 6. The comment needs updating to mention `sitemap/5.xml — team pages`.

### Issue B — `force-dynamic` overrides `revalidate = 3600`
`sitemap.ts` exports both:
```typescript
export const revalidate = 3600;   // ISR — 1 hour cache
export const dynamic   = 'force-dynamic';  // disables all caching
```
In Next.js 15 App Router, `force-dynamic` takes precedence and cancels ISR. The `revalidate = 3600` is silently ignored. The sitemaps are regenerated on every request, not cached via ISR.

**Practical impact:** Vercel's CDN edge cache typically handles this (the `Cache-Control` header on responses from dynamic routes is still set by Next.js), so requests are often served from the CDN layer. But the intent in the comment ("cached by ISR revalidate=3600") is not what's happening in the runtime. The `force-dynamic` was added to prevent API timeout during `next build`, which is correct — the KV-level caching inside each function (24h TTL) is the real DR/cache mechanism. Remove `revalidate = 3600` to match actual behavior.

### Issue C — `lastmod: new Date()` on evergreen hub pages
Dynamic `new Date()` as `lastmod` for pages like `/world-cup-2026/winner-predictions`, `/world-cup-2026/host-cities`, `/world-cup-2026/golden-boot-predictions` causes Google Search Console to report these pages as modified every hour. For content that changes infrequently, use a fixed date so Google can trust the freshness signal.

---

## 12. Summary Tables

### Total URLs

| Segment | Count | Type |
|---------|-------|------|
| Sitemap/0 — Core static | 9 | Static |
| Sitemap/1 — WC flat SEO | 8 | Static |
| Sitemap/2 — WC hub | 146 | Static |
| Sitemap/3 — Competition/league | 19 | Static |
| **Static subtotal** | **182** | |
| Sitemap/4 — Match pages | ~150–200 | Dynamic |
| Sitemap/4 — Predict pages | ~50–100 | Dynamic |
| Sitemap/5 — Team pages | ~100–130 | Dynamic |
| **Dynamic subtotal** | **~300–430** | |
| **Grand total (est.)** | **~480–612** | |

### Indexable URLs

All URLs in the sitemap are intended to be indexable (no `noindex` meta tags expected on sitemapped pages). The only confirmed non-indexable entries are admin/newsletter pages, which are correctly excluded from the sitemap and blocked via `robots.txt`.

### Orphan URLs

| Count | Description |
|-------|-------------|
| 0 | Unintentional orphans |
| 3 | Intentional redirect-route orphans (`/team/[id]`, `/world-cup-2026/team/[slug]`, `[alias]`) — correct |
| 4+ | Admin/newsletter pages — blocked by robots, correct |

### URLs Missing from Sitemap

None missing that should be present. One URL _in_ the sitemap that should be removed:

| URL | Action |
|-----|--------|
| `https://goalradar.org/world-cup-2026/results` | Remove from `wcHubSitemap()` — it 301s to `/world-cup-2026-results` |

### URLs in Sitemap Returning Non-200

| URL | HTTP Status | Redirects to |
|-----|-------------|--------------|
| `https://goalradar.org/world-cup-2026/results` | 301 | `https://goalradar.org/world-cup-2026-results` |

---

## 13. Prioritised Fix List

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | 🔴 Critical | `/world-cup-2026/results` in sitemap/2 returns 301 | Remove from `wcHubSitemap()` in `sitemap.ts` |
| 2 | 🟠 High | Parameterized URLs (`/schedule?competition=X`) in sitemap/3 are non-canonical | Remove from `competitionSitemap()`; rely on `<canonical>` tags + `/competition/{code}` entries |
| 3 | 🟡 Medium | `/competition/WC` and `/world-cup-2026` both in sitemap — competing for same topic | Add canonical on `/competition/WC` pointing to `/world-cup-2026`, or remove from sitemap/3 |
| 4 | 🟡 Medium | `revalidate = 3600` silently ignored due to `force-dynamic` | Remove `export const revalidate = 3600` from `sitemap.ts` to reflect actual behavior |
| 5 | 🟡 Medium | `lastmod: new Date()` on stable evergreen hub pages | Use fixed dates for pages with slow-changing content |
| 6 | 🟢 Low | Stale header comment in `sitemap.ts` (mentions 5 sitemaps, generates 6) | Update comment to include `sitemap/5.xml — team pages` |
| 7 | 🟢 Low | `src/app/world-cup-2026/results/page.tsx` is dead code (redirect always fires first) | Delete file or add a redirect component with a clear comment |
| 8 | ℹ️ Info | www redirect not verifiable from source | Confirm at Vercel dashboard: `www.goalradar.org` → 301 → `goalradar.org` |
