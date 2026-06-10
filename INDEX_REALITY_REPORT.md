# Index Reality Report — SEO-5
## GoalRadar · Sprint SEO-5

Generated: 2026-06-10

---

## Executive Summary

Overall indexing health is **good**, but three specific issues require fixes before
the World Cup traffic peak. The most actionable finding is a dual `robots.txt`
conflict where a static file silently overrides the programmatic handler. The
most latent risk is a live page file at a redirected URL whose self-pointing
canonical is wrong.

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 2 | robots.txt dual source; dead page file with wrong canonical |
| HIGH | 3 | newsletter pages crawlable; alias route hits provider on 404; team redirect calls provider directly |
| MEDIUM | 3 | Sitemap Cache-Control not explicit; predict pages; /live revalidate |
| LOW | 3 | Hardcoded static lastModified dates; no hreflang (OK for en-only); ISR frequency on homepage |

---

## Audited Pages

### `/` — Homepage

| Check | Result |
|-------|--------|
| HTTP status | 200 ✅ |
| Canonical | `https://goalradar.org` — self-canonical ✅ |
| Meta robots | `index, follow` (from `layout.tsx` default) ✅ |
| In sitemap | sitemap/0 — priority 1.0 ✅ |
| JSON-LD | `WebSite` (with `SearchAction`), `SportsEvent` (WC 2026), `BreadcrumbList` ✅ |
| hreflang | None — single-language site, correct ✅ |
| Crawl depth | 0 (root) ✅ |
| `revalidate` | 30 s — very aggressive ISR (see LOW §1) |
| Soft 404 risk | None ✅ |

---

### `/world-cup-2026` — WC Hub

| Check | Result |
|-------|--------|
| HTTP status | 200 ✅ |
| Canonical | `https://goalradar.org/world-cup-2026` ✅ |
| Meta robots | `index, follow` ✅ |
| In sitemap | sitemap/2 — priority 0.95 ✅ |
| JSON-LD | `SportsEvent`, `BreadcrumbList` ✅ |
| Crawl depth | 1 hop from homepage ✅ |
| `revalidate` | 30 s |
| Soft 404 risk | None ✅ |

---

### `/world-cup-2026/fixtures`

| Check | Result |
|-------|--------|
| HTTP status | 200 ✅ |
| Canonical | `https://goalradar.org/world-cup-2026/fixtures` ✅ |
| Meta robots | `index, follow` ✅ |
| In sitemap | sitemap/2 — priority 0.90 ✅ |
| JSON-LD | `BreadcrumbList`, `CollectionPage`, `ItemList` of top-24 `SportsEvent` ✅ |
| Crawl depth | 2 hops: `/` → `/world-cup-2026` → `/fixtures` ✅ |
| `revalidate` | 900 s (15 min) |
| Soft 404 risk | None ✅ |

---

### `/world-cup-2026/results` — ⚠️ CRITICAL

| Check | Result |
|-------|--------|
| HTTP status | **301 → `/world-cup-2026-results`** |
| Served to Googlebot | The redirect fires before Next.js renders the page — the file is never served |
| Page file exists | **YES** — `src/app/world-cup-2026/results/page.tsx` |
| Canonical in page file | `https://goalradar.org/world-cup-2026/results` — **self-pointing to the redirect source** |
| In sitemap | Removed in SITEMAP-3 ✅ |
| Soft 404 risk | None (301 is clean) |
| Risk | The page file is dead code. Its canonical points at a URL that 301s. If the redirect in `next.config.ts` is ever removed (accidentally or intentionally), Next.js will serve this page with a canonical that points at itself (the now-live URL), creating a canonical loop that incorrectly competes with `/world-cup-2026-results` for PageRank. |

---

### `/world-cup-2026/standings` — 301 → `/world-cup-2026-standings`

| Check | Result |
|-------|--------|
| HTTP status | **301 → `/world-cup-2026-standings`** |
| Page file | Does NOT exist — redirect-only ✅ |
| In sitemap | Correctly absent (not listed in any sitemap) ✅ |
| Canonical URL `/world-cup-2026-standings` | In sitemap/1 at priority 0.91 ✅ |

---

### `/match/[id]`

| Check | Result |
|-------|--------|
| HTTP status | 200 (valid match ID) / 404 (invalid ID) ✅ |
| Canonical | `matchPath(match.id, home, away)` → `/match/537327-france-vs-england` ✅ |
| Non-canonical slug | `permanentRedirect()` to canonical slug form ✅ |
| Meta robots | `index, follow` ✅ |
| In sitemap | sitemap/4 (dynamically built from recent + upcoming) ✅ |
| JSON-LD | `SportsEvent`, `FAQPage`, `BreadcrumbList` ✅ |
| Crawl depth | 1–2 hops (homepage featured match cards → match page) ✅ |
| `revalidate` | 60 s |
| Soft 404 risk | **Moderate** — if an invalid match ID is requested (e.g. from a scraped/guessed URL), `getOrBuildMatchSnapshot()` attempts a provider call before falling back to `notFound()`. Not a Google-facing issue (Google sees 404) but wastes rate-limiter quota per crawl of bad URLs. |

---

### `/teams/[slug]`

| Check | Result |
|-------|--------|
| HTTP status | 200 (valid slug) / 308 redirect (wrong slug form) ✅ |
| Canonical | `teamPath(team.id, team.name)` ✅ |
| Non-canonical slug | `permanentRedirect()` to canonical slug ✅ |
| Meta robots | `index, follow` ✅ |
| In sitemap | sitemap/5 (built from standings — league teams only; no WC national teams) |
| JSON-LD | `SportsTeam`, `BreadcrumbList` ✅ |
| Crawl depth | 2–3 hops (`/` → `/standings` → team page) ✅ |
| `revalidate` | 300 s |
| Soft 404 risk | **Low** — slug mismatch triggers 308 to canonical; invalid team 404s cleanly |

---

## Cross-Cutting Issues

---

### [CRITICAL-1] Dual `robots.txt` — Static File Overrides Dynamic Handler

**Files:**
- `public/robots.txt` — static file (always served by Next.js static file middleware)
- `src/app/robots.ts` — programmatic handler (NEVER served)

**Problem:** In Next.js, a static file in `public/` at the same path as an app-route
handler takes precedence. `public/robots.txt` is served at `/robots.txt`; `src/app/robots.ts`
is dead code and never executes.

**Diff between the two files:**

| Rule | `public/robots.txt` (ACTIVE) | `src/app/robots.ts` (DEAD) |
|------|-------------------------------|----------------------------|
| Disallow admin | `/admin/` ✅ | `/admin/` ✅ |
| Disallow API | `/api/` ✅ | `/api/` ✅ |
| Disallow newsletter | ❌ NOT listed | `/newsletter/` ✅ |
| Disallow newsletter admin | `/api/newsletter/admin` (subset of /api/) | — |
| Sitemap | `https://goalradar.org/sitemap.xml` ✅ | `https://goalradar.org/sitemap.xml` ✅ |
| `host` directive | ❌ Not present | `https://goalradar.org` (non-standard, ignored by Google) |

**Impact:**
- `/newsletter/confirmed` and `/newsletter/invalid` are NOT in the active robots.txt
  Disallow list, so Googlebot will crawl them.
- Both pages have `robots: { index: false }` in their Next.js metadata, which generates
  `<meta name="robots" content="noindex">` — so they won't be indexed.
- However, this wastes crawl budget: Googlebot fetches the page, reads the noindex header, drops it.
- The `src/app/robots.ts` maintenance intent (disallow `/newsletter/`) is invisible to the crawler.

**Fix required:** Consolidate to one source of truth. Either:
  1. Delete `src/app/robots.ts` and update `public/robots.txt` to add `Disallow: /newsletter/`
  2. Delete `public/robots.txt` so `src/app/robots.ts` takes effect (preferred — it's already correct)

---

### [CRITICAL-2] Ghost Page File at 301 Source — Wrong Canonical

**File:** `src/app/world-cup-2026/results/page.tsx`

**Problem:**
- `next.config.ts` issues a permanent 301: `/world-cup-2026/results` → `/world-cup-2026-results`
- The Next.js redirect fires before any page file is rendered
- `src/app/world-cup-2026/results/page.tsx` EXISTS and contains:
  ```ts
  alternates: { canonical: 'https://goalradar.org/world-cup-2026/results' }
  ```
- This is a **self-pointing canonical to a 301 redirect source** — the worst possible canonical error
- Currently benign because the file is never served
- **Latent risk:** If the redirect is removed (deliberately or during a refactor), this page will serve with a canonical that:
  1. Points at itself (a 301 source)
  2. Competes with `/world-cup-2026-results` which has the real PageRank and external links

**Fix required:** Either:
  1. Delete `src/app/world-cup-2026/results/page.tsx` (cleanest — the redirect handles all traffic)
  2. Or change its canonical to point at `/world-cup-2026-results` AND add `robots: { index: false }` so it defers entirely

---

### [HIGH-1] Newsletter Pages Crawlable (Wastes Crawl Budget)

**Pages:** `/newsletter/confirmed`, `/newsletter/invalid`

**Status:**
- Both pages correctly have `robots: { index: false }` in metadata → `<meta name="robots" content="noindex">` ✅
- BUT neither path is listed in `Disallow:` in the active `public/robots.txt`
- Googlebot will crawl these pages, read the noindex signal, then discard

**Not a blocking indexing issue** — the pages won't appear in search results.  
**Fix:** Add `Disallow: /newsletter/` to `public/robots.txt` (or resolve CRITICAL-1 first by removing `public/robots.txt`).

---

### [HIGH-2] `/[alias]` Catch-All Calls Provider on 404

**File:** `src/app/[alias]/page.tsx`

**Problem:** This catch-all route handles URLs like `/england-vs-usa-live-score`. On every request (including 404s from unrecognised aliases), it calls:
```ts
getUpcomingMatches('WC')   // NOT the *Cached variant
getRecentMatches('WC')     // NOT the *Cached variant
```
These are the SWR-backed functions that can trigger `revalidateInBackground()` → provider call on a stale KV entry. This was **missed in PERF-4.5**.

**Impact for SEO:** Google sees a clean 404 — no indexing harm. But:
- Every crawl of a non-existent alias URL triggers a provider call chain
- If a scraped list of WC team name pairs is crawled, this creates sustained queue pressure
- Any URL not ending in `-live-score` calls both API methods then returns 404 — wasteful

**Fix:** Change `getUpcomingMatches('WC')` and `getRecentMatches('WC')` to `getUpcomingMatchesCached('WC')` and `getRecentMatchesCached('WC')` in `fetchAllWCMatches()`.

---

### [HIGH-3] `/team/[id]` Legacy Redirect Calls Provider Directly

**File:** `src/app/team/[id]/page.tsx`

**Problem:** Legacy numeric-ID URL (`/team/57`) redirects to the canonical slug page. But:
```ts
const team = await getTeam(id).catch(() => null);
permanentRedirect(teamPath(team?.id ?? id, team?.name));
```
- `getTeam(id)` calls the provider directly (no KV backing for team detail pages)
- On API failure, `team` is `null` → redirect to `/teams/{id}` (e.g. `/teams/57`) — a numeric-ID URL
- `/teams/57` (no name slug) may not match any canonical slug → `permanentRedirect()` to the correct slug, creating a **2-hop redirect chain**: `/team/57` → `/teams/57` → `/teams/57-arsenal-fc`

**Impact for SEO:** Google will follow redirect chains up to 5 hops, but a 2-hop chain dilutes redirect signal and slows Googlebot. Also wastes one provider call per crawl of legacy URLs.

**Fix (no-implement note):** Use `getTeamCached(id)` or read KV directly; and ensure `teamPath` always produces the final canonical slug even when name is unavailable.

---

### [MEDIUM-1] Sitemap Lacks Explicit Cache-Control Headers

**File:** `src/app/sitemap.ts` — `export const dynamic = 'force-dynamic'`

**Problem:** `force-dynamic` in Next.js sets `Cache-Control: private, no-cache, no-store` by default,
meaning the sitemap is generated fresh on every Googlebot fetch. With `force-dynamic`, Vercel's
edge CDN treats the response as uncacheable — Googlebot may re-fetch the full sitemap pipeline
(including the sitemap/4 and sitemap/5 which make KV reads) on every ping.

The KV sitemap fallback (`goalradar:sitemap:matches`, 24h TTL) prevents API calls, but the
route handler itself is invoked on every request.

**Fix:** Add explicit `Cache-Control: public, max-age=3600, s-maxage=3600` response headers
to the sitemap handlers, or use a `next.config.ts` header rule for `/sitemap/*`.

---

### [MEDIUM-2] `/predict/[id]` — Prediction Pages Sitemap Coverage

**File:** `src/app/predict/[id]/page.tsx`

**Status:**
- In sitemap/4 for upcoming + live matches only ✅ (finished predictions correctly excluded)
- `revalidate = 3600` (1 hour) — prediction data can be stale when results change nearby
- `getOrBuildMatchSnapshot()` is called — can trigger provider calls on cache miss
- Canonical: `predictPath(match.id, home, away)` ✅

**Issue:** When a live match ends, the prediction page for it is served for up to 1 hour with stale "upcoming match" predictions. After 1 hour the ISR kicks in. Google may cache this page briefly with incorrect "live" signals.

**Not blocking.** Document for monitoring.

---

### [MEDIUM-3] `/live` Page — Always Triggers Provider

**File:** `src/app/live/page.tsx`

**Status:**
- Intentionally calls `getLiveMatches()` (non-Cached variant) — live data requires fresh fetch
- `revalidate = 30` — ISR at 30s
- canonical: `https://goalradar.org/live` ✅
- In sitemap/0 at priority 0.9 ✅

**Not a canonical or indexing problem.** The page serves live content correctly. The provider call
is appropriate here. Left here as a documentation note only — the `*Cached` variants intentionally
exclude `/live`.

---

## Canonical Consistency Audit

| URL | Canonical Set | Correct? |
|-----|--------------|---------|
| `/` | `https://goalradar.org` | ✅ |
| `/world-cup-2026` | `https://goalradar.org/world-cup-2026` | ✅ |
| `/world-cup-2026/fixtures` | `https://goalradar.org/world-cup-2026/fixtures` | ✅ |
| `/world-cup-2026/results` | `https://goalradar.org/world-cup-2026/results` | ⚠️ Self-canonical to 301 source (dead code) |
| `/world-cup-2026-results` | `https://goalradar.org/world-cup-2026-results` | ✅ |
| `/world-cup-2026-standings` | `https://goalradar.org/world-cup-2026-standings` | ✅ |
| `/competition/WC` | `https://goalradar.org/world-cup-2026` | ✅ (fixed in SITEMAP-3) |
| `/competition/PL` etc. | `https://goalradar.org/competition/{code}` | ✅ |
| `/match/{id}-{slug}` | `matchPath(id, home, away)` — slug-canonical | ✅ |
| `/match/{id}` (no slug) | `permanentRedirect` to slug form | ✅ |
| `/teams/{id}-{slug}` | `teamPath(id, name)` — slug-canonical | ✅ |
| `/teams/{id}` (wrong slug) | `permanentRedirect` to canonical slug | ✅ |
| `/team/{id}` (legacy) | `permanentRedirect` → `/teams/{id}-{slug}` | ⚠️ May produce 2-hop chain on API failure |
| `/schedule` | `https://goalradar.org/schedule` | ✅ |
| `/schedule?competition=PL` | Canonical = `/schedule` (query param ignored) | ✅ |
| `/standings?competition=PL` | Canonical = `/standings` (query param ignored) | ✅ |
| `/live` | `https://goalradar.org/live` | ✅ |
| `/admin/*` | `robots: noindex` | ✅ |
| `/newsletter/confirmed` | `robots: noindex` | ✅ (but crawlable — robots.txt gap) |
| `/newsletter/invalid` | `robots: noindex` | ✅ (but crawlable — robots.txt gap) |

---

## robots.txt Audit

**Active file:** `public/robots.txt` (static, takes precedence)

```
User-agent: *
Allow: /

Disallow: /api/
Disallow: /api/newsletter/admin
Disallow: /admin/

Sitemap: https://goalradar.org/sitemap.xml
```

**Issues:**
- `/newsletter/` path is NOT disallowed — confirmed crawlable ⚠️
- Duplicate: `/api/newsletter/admin` is redundant (already covered by `/api/`)
- `src/app/robots.ts` is dead code — never served

---

## Sitemap Coverage Audit

| Sitemap | URLs | Key Content | Issues |
|---------|------|-------------|--------|
| sitemap/0 | 9 | Core static (home, live, schedule, standings, about, contact, legal) | `lastModified` for static pages is hardcoded `2025-01-01` — accurate ✅ |
| sitemap/1 | 8 | WC flat-URL SEO pages | ✅ |
| sitemap/2 | ~180 | WC hub pages, groups A–L, all 48 teams, watch-live and TV countries, venues | ✅ |
| sitemap/3 | 6 | League competition pages (WC excluded) | ✅ (cleaned in SITEMAP-3) |
| sitemap/4 | ~400–600 | Match pages + prediction pages (dynamic) | KV-backed; no provider calls (PERF-6) ✅ |
| sitemap/5 | ~100–150 | Team pages (from league standings) | KV-backed; no WC national teams |

**Not in any sitemap (correct):**
- `/admin/*` — noindex ✅
- `/newsletter/*` — noindex ✅
- `/world-cup-2026/standings` — 301 redirect ✅
- `/world-cup-2026/results` — 301 redirect ✅
- `/competition/WC` — canonical defers to `/world-cup-2026` ✅
- `/schedule?competition=*` — query-param variants ✅
- `/standings?competition=*` — query-param variants ✅

**Possibly missing from sitemaps:**
- `/world-cup-2026/argentina`, `/brazil`, `/england`, `/france`, `/mexico`, `/usa`, `/canada`  
  → These ARE in sitemap/2 (generated from `WC_TEAM_SLUGS` spread) ✅
- `/world-cup-2026/group-{a-h}-predictions` — in sitemap/2 ✅
- `/predict/{id}-{slug}` — added to sitemap/4 for upcoming/live matches ✅

---

## HTTP Status Code Audit

| URL | Expected Status | Note |
|-----|----------------|------|
| `/` | 200 ✅ | |
| `/world-cup-2026` | 200 ✅ | |
| `/world-cup-2026/fixtures` | 200 ✅ | |
| `/world-cup-2026/results` | 301 → `/world-cup-2026-results` | In next.config.ts |
| `/world-cup-2026/standings` | 301 → `/world-cup-2026-standings` | In next.config.ts |
| `/world-cup-2026-results` | 200 ✅ | |
| `/world-cup-2026-standings` | 200 ✅ | |
| `/competition/WC` | 200 (with canonical=/world-cup-2026) | Not in sitemap |
| `/match/{valid-id}` | 200 ✅ | |
| `/match/{invalid-id}` | 404 (via notFound()) | Provider called before 404 |
| `/teams/{valid-slug}` | 200 ✅ | |
| `/teams/{wrong-slug}` | 308 → canonical slug | |
| `/team/{id}` | 308 → `/teams/{id}-{slug}` | ⚠️ 2-hop on API fail |
| `/live` | 200 ✅ | |
| `/schedule` | 200 ✅ | |
| `/standings` | 200 ✅ | |
| `/admin/*` | 200 (noindex) | Accessible, no auth |
| `/newsletter/confirmed` | 200 (noindex) | |
| `/newsletter/invalid` | 200 (noindex) | |
| `/sitemap.xml` | 200 (rewrite → /api/sitemap-index) | ✅ |

---

## Crawl Depth Analysis

```
/ (depth 0)
├── /world-cup-2026         (depth 1)
│   ├── /world-cup-2026/fixtures       (depth 2)
│   ├── /world-cup-2026/groups         (depth 2)
│   ├── /world-cup-2026/bracket        (depth 2)
│   ├── /world-cup-2026/teams          (depth 2)
│   │   └── /world-cup-2026/teams/{slug} (depth 3)
│   └── /world-cup-2026/group-{a-l}   (depth 2)
├── /live                   (depth 1)
├── /schedule               (depth 1)
│   └── /match/{id}         (depth 2)  ← also direct from homepage
├── /standings              (depth 1)
│   └── /teams/{slug}       (depth 2)
└── /match/{id}             (depth 1-2 via featured matches widget)
    └── /predict/{id}       (depth 2-3)
```

**All priority pages are within 3 hops of homepage.** Googlebot budget concern: none.

---

## Soft 404 Risk Summary

| Risk | Page | Severity | Notes |
|------|------|----------|-------|
| Invalid match ID → 404 after provider call | `/match/{id}` | Low | Google sees 404; wastes quota |
| Invalid alias → 404 after provider call | `/[alias]` | Medium | Non-`-live-score` URLs all trigger API; see HIGH-2 |
| Invalid team ID → chain redirect | `/team/{id}` | Low | Soft only on API failure; see HIGH-3 |
| Finished prediction pages | `/predict/{id}` | Low | Served 1h post-match; then 410-equivalent after ISR |

No pages are returning 200 with thin or empty content that would trigger Google's soft 404 detector.

---

## Priority Fix List

| Priority | Issue | Fix |
|----------|-------|-----|
| 🔴 1 | `public/robots.txt` overrides `src/app/robots.ts` — dead code | Delete `public/robots.txt` OR update it to add `Disallow: /newsletter/` and remove `src/app/robots.ts` |
| 🔴 2 | `src/app/world-cup-2026/results/page.tsx` has self-canonical to 301 source | Delete the file (redirect handles all traffic) OR change canonical + add `robots: noindex` |
| 🟠 3 | `/[alias]/page.tsx` calls non-Cached API variants | Switch to `getUpcomingMatchesCached`, `getRecentMatchesCached` |
| 🟠 4 | `/team/[id]` calls provider directly, no KV backing | Use cached team lookup or handle null gracefully to avoid 2-hop redirect chains |
| 🟠 5 | Newsletter pages crawlable (robots.txt gap) | Add `Disallow: /newsletter/` to whichever robots.txt source survives fix #1 |
| 🟡 6 | Sitemap lacks explicit `Cache-Control` | Add `s-maxage=3600` header to sitemap route response |
