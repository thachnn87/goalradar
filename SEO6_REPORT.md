# SEO-6 Report — Quick Wins Cleanup
## GoalRadar · Sprint SEO-6

Generated: 2026-06-10
Implements all fixes from `INDEX_REALITY_REPORT.md` (SEO-5).

---

## FIX 1 — robots.txt Consolidation ✅

**Action:** Deleted `public/robots.txt`. `src/app/robots.ts` is now the single
source of truth and is actually served at `/robots.txt`.

**Resulting `/robots.txt` output:**

```
User-Agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /newsletter/

Host: https://goalradar.org

Sitemap: https://goalradar.org/sitemap.xml
```

All required directives present:
- `Disallow: /admin/` ✅
- `Disallow: /api/` ✅
- `Disallow: /newsletter/` ✅ (was missing in the old static file — resolves HIGH-1)
- `Sitemap: https://goalradar.org/sitemap.xml` ✅

This also resolves **HIGH-1** (newsletter pages crawlable): `/newsletter/confirmed`
and `/newsletter/invalid` are now blocked by robots.txt in addition to their
existing `noindex` meta tags.

---

## FIX 2 — Ghost Results Page ✅

**Action:** Deleted `src/app/world-cup-2026/results/page.tsx` (dead code — the
`next.config.ts` 301 fires before the page ever renders).

**Redirect verified in `next.config.ts`:**

```ts
{
  source: '/world-cup-2026/results',
  destination: '/world-cup-2026-results',
  permanent: true,   // 301/308
},
```

- `/world-cup-2026/results` → 301 → `/world-cup-2026-results` (unchanged) ✅
- The latent canonical-loop risk (self-canonical pointing at a 301 source) is
  eliminated — there is no longer a page file to accidentally serve.
- The URL was already absent from all sitemaps (SITEMAP-3) ✅

---

## FIX 3 — Alias Route Verification ✅

**File:** `src/app/[alias]/page.tsx` (no changes needed — fixed in PERF-7A)

```ts
import {
  getUpcomingMatchesCached as getUpcomingMatches,
  getRecentMatchesCached   as getRecentMatches,
} from '@/lib/api';
```

Both calls in `fetchAllWCMatches()` route through `*Cached` variants
(L1 → `readKVOnly` → static fallback). **No provider path remains** — crawls of
non-existent alias URLs can no longer trigger provider calls. Resolves HIGH-2.

---

## FIX 4 — Legacy Team Redirect (Single Hop) ✅

**File:** `src/app/team/[id]/page.tsx`

**Problem:** when the team-detail KV entry missed, the redirect fell back to a
non-canonical slug, producing a 2-hop chain:
`/team/57` → `/teams/57-tbd` → `/teams/57-arsenal-fc`.

**Fix:** team name is now resolved BEFORE redirecting, KV-only, in two tiers:

1. `getTeamCached(id)` — `goalradar:/teams/{id}` KV entry
2. **NEW:** scan league standings (`getStandingsCached` per competition) — these
   are orchestrator-seeded and warm for every league team appearing in sitemap/5

**Final redirect map:**

| Request | Condition | Redirect | Hops |
|---------|-----------|----------|------|
| `/team/57` | Team KV entry hit | 308 → `/teams/57-arsenal-fc` | **1** ✅ |
| `/team/57` | Team KV miss, found in PL standings | 308 → `/teams/57-arsenal-fc` | **1** ✅ |
| `/team/{id}` | Both miss (team not in any tracked league) | 308 → `/teams/{id}` → 308 → canonical | 2 (rare edge) |
| `/team/{garbage}` | Non-numeric ID | 308 → `/teams/{garbage}` → `notFound()` 404 | clean 404 |

Every team listed in sitemap/5 is, by construction, present in standings KV —
so all crawlable legacy team URLs now redirect in a **single hop**. The 2-hop
edge case only occurs for team IDs outside all tracked competitions (URLs that
were never published or linked). Zero provider calls on this route. Resolves HIGH-3.

---

## FIX 5 — Sitemap Cache Headers ✅

**Changes:**

1. `next.config.ts` — new `headers()` rule:

```ts
{ source: '/sitemap.xml',      headers: [Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400] },
{ source: '/sitemap/:id*.xml', headers: [same] },
```

2. `src/app/api/sitemap-index/route.ts` — response header upgraded from
`s-maxage=3600` to `public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`.

**Effect:** Covers `/sitemap.xml` and `/sitemap/0.xml` … `/sitemap/5.xml`.
Vercel's edge CDN now caches every sitemap response for 1 hour
(`s-maxage=3600`); Googlebot pings within that window are served from the CDN
and **do not invoke the sitemap route handlers** (no regeneration, no KV reads).
`stale-while-revalidate=86400` serves the stale copy instantly while the edge
refreshes in the background after expiry. Resolves MEDIUM-1.

Note: `vercel.json` was not touched (project constraint) — headers are applied
via `next.config.ts`, which Vercel honours identically.

---

## FIX 6 — Build Verification

```
npm run build → SUCCESS (see build output)
npx tsc --noEmit → 0 errors (after .next type regeneration)
```

---

## Files Changed

| File | Change |
|------|--------|
| `public/robots.txt` | **Deleted** — `src/app/robots.ts` is the single source of truth |
| `src/app/world-cup-2026/results/page.tsx` | **Deleted** — dead code behind a 301; latent canonical-loop risk removed |
| `src/app/team/[id]/page.tsx` | Standings-based name fallback → single-hop redirect; bare-ID fallback only when team is in no tracked competition |
| `next.config.ts` | Added `headers()` rule: `Cache-Control: public, max-age=3600, s-maxage=3600` for `/sitemap.xml` and `/sitemap/:id*.xml` |
| `src/app/api/sitemap-index/route.ts` | Cache-Control upgraded to `public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400` |

---

## Remaining SEO Issues

All CRITICAL and HIGH issues from `INDEX_REALITY_REPORT.md` are resolved:

| SEO-5 Issue | Severity | Status |
|-------------|----------|--------|
| CRITICAL-1: dual robots.txt | CRITICAL | ✅ Fixed (FIX 1) |
| CRITICAL-2: ghost results page | CRITICAL | ✅ Fixed (FIX 2) |
| HIGH-1: newsletter crawlable | HIGH | ✅ Fixed (FIX 1 — robots.ts disallows `/newsletter/`) |
| HIGH-2: alias route provider calls | HIGH | ✅ Verified fixed (PERF-7A, FIX 3) |
| HIGH-3: team redirect 2-hop chain | HIGH | ✅ Fixed (FIX 4) |
| MEDIUM-1: sitemap Cache-Control | MEDIUM | ✅ Fixed (FIX 5) |

**Remaining (medium/low only):**

| Issue | Severity | Note |
|-------|----------|------|
| `/predict/[id]` serves stale "upcoming" predictions for up to 1h after a match finishes (`revalidate = 3600`) | MEDIUM | Monitoring only — Google re-crawls; no canonical/indexing error |
| `/team/{id}` for IDs outside tracked competitions takes 2 hops | LOW | Edge case; such URLs are not in any sitemap and were never published |
| Hardcoded `lastModified: 2025-01-01` for static legal pages in sitemap/0 | LOW | Accurate (pages unchanged); cosmetic |
| No hreflang | LOW | Correct for a single-language (en) site |
| Homepage `revalidate = 30` is aggressive ISR | LOW | Intentional for live scores; not an SEO problem |

**Success criteria met: 0 critical, 0 high remaining.** ✅
