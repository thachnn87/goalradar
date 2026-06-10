# GROWTH-2A Report — High ROI Expansion
## GoalRadar · Sprint GROWTH-2A

Generated: 2026-06-10
Implements the two HIGH-priority items from `PROGRAMMATIC_SEO_PLAN.md`
(G2 knockout round pages, G1 prediction aliases). Date pages and top scorers
deliberately NOT implemented. Provider layer untouched.

---

## Feature 1 — Knockout Round Pages

### Routes created (6)

| Route | Target queries | Sitemap priority |
|-------|---------------|------------------|
| `/world-cup-2026/round-of-32` | "round of 32 world cup", "world cup knockout fixtures" | 0.90 |
| `/world-cup-2026/round-of-16` | "world cup round of 16" | 0.90 |
| `/world-cup-2026/quarter-finals` | "world cup quarter finals schedule" | 0.90 |
| `/world-cup-2026/semi-finals` | "world cup semi finals 2026" | 0.90 |
| `/world-cup-2026/third-place` | "world cup third place match" | 0.90 |
| `/world-cup-2026/final` | "world cup 2026 final", "world cup final date" | **0.93** |

### Architecture

- **New** [`src/lib/wc-rounds.ts`](src/lib/wc-rounds.ts) — round config (slug, stage,
  labels, blurbs). Date ranges **derived from the bundled `WC_KNOCKOUT_SLOTS`
  schedule** — no hardcoded dates that can drift.
- **New** [`src/components/WCRoundPage.tsx`](src/components/WCRoundPage.tsx) — shared
  server component + `buildRoundMetadata()`. Each route is a ~10-line thin wrapper.
- `revalidate = 900` (15 min, FIXTURES TTL) — scores refresh during the round.

### Data path (zero provider)

`getWCKnockoutMatchesCached()` → L1 in-memory → `readKVOnly` → static fixtures
fallback. Identical to the bracket page. **No provider call possible.**
Pre-knockout (before fixtures carry team names), the bundled `WC_KNOCKOUT_SLOTS`
schedule renders (kickoff times, venues, qualification labels) so no page is
ever thin — no soft-404 risk.

### Metadata & structured data

- Per-round `title` / `description` / canonical / OG / Twitter (the Final gets a
  distinct date-and-venue-focused title).
- JSON-LD per page: `BreadcrumbList` + `SportsEvent` for the round
  (start/end dates from the schedule) with each fixture as a `subEvent`
  linking to its match page, and `superEvent` → the WC 2026 hub.

### Internal links added

| From | Link |
|------|------|
| `WCPageNav` (rendered on every WC page) | added "🎯 Round of 32" and "🥇 Final" |
| Bracket page round-progress pills | converted from static `<div>`s to `<Link>`s — all 6 rounds |
| Bracket page R32 section heading | now links to `/world-cup-2026/round-of-32` |
| Each round page | round-pills nav linking all 6 sibling rounds + prev/next round links + "Full bracket →" |
| Each round page `WCRelatedLinks` | bracket, schedule, results, standings, predictions, TV guide |
| `wc-nav-routes.ts` registry | 6 routes registered (dev-mode link validation) |

Crawl depth: hub → round page = **2 hops**; every WC page reaches all rounds via
WCPageNav within 1 hop.

---

## Feature 2 — Prediction Alias Routes

### Implementation

Extended the existing `/[alias]` catch-all ([src/app/[alias]/page.tsx](src/app/[alias]/page.tsx))
— same file that handles `-live-score`. No new route directory needed (Next.js
allows only one dynamic segment per level).

| Aspect | Behaviour |
|--------|-----------|
| Pattern | `/{home}-vs-{away}-prediction` (e.g. `/england-vs-croatia-prediction`) |
| Response | **308 Permanent Redirect** → `/predict/{id}-{home}-vs-{away}` |
| Canonical | `generateMetadata` sets `alternates.canonical` → the `/predict/{id}` URL |
| Duplicate content | None — the alias never renders content; it is a pure redirect + canonical hint |
| Static generation | `generateStaticParams` pre-builds aliases for every WC fixture with known teams; prediction aliases generated **only for non-FINISHED matches** (finished predictions are stale, matching the `/predict` sitemap rule) |
| Unknown slugs | `notFound()` — clean 404, zero API cost beyond the KV-cached WC match list |

### URL counts

| Alias type | Count at launch | Notes |
|------------|----------------|-------|
| `-live-score` (existing) | 72 | group-stage fixtures with both teams known |
| `-prediction` (new) | **72** | same fixture set, non-finished only; grows to ~104 as knockout pairings resolve, shrinks as matches finish |

---

## Sitemap Changes

| Segment | Change |
|---------|--------|
| sitemap/2 (WC hub) | +6 round pages (`final` at 0.93, others 0.90, hourly) |
| sitemap/4 (matches) | +1 prediction-alias entry per upcoming/live WC fixture (~72 at launch, priority 0.78, daily) |

**Note / accepted trade-off:** prediction aliases are 308 redirect sources.
Listing them in the sitemap (per sprint spec and PROGRAMMATIC_SEO_PLAN) gives
Google a direct discovery path for exact-match "X vs Y prediction" slugs; GSC
may report them as "Page with redirect", which is expected and harmless —
the canonical + 308 both point at `/predict/{id}`, so signals consolidate there.
If GSC noise becomes a concern, dropping them from sitemap/4 is a one-line
revert that does not affect the routes themselves.

---

## URL Count Added

| Type | URLs |
|------|------|
| Knockout round pages | 6 |
| Prediction aliases | ~72 at launch (→ ~104 as knockouts resolve) |
| **Total new URLs** | **~78 (→ ~110)** |

---

## Provider Impact

**Zero.**

- Round pages: `getWCKnockoutMatchesCached()` — L1 → `readKVOnly` → bundled static fixtures. Never touches `providerManager`.
- Prediction aliases: reuse `fetchAllWCMatches()` which calls `getUpcomingMatchesCached` / `getRecentMatchesCached` (PERF-7A verified, KV-only).
- No changes to `src/lib/providers/*`, `api.ts`, or any cron/orchestrator code.
- **0 new API dependencies.**

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/wc-rounds.ts` | NEW — round configs + schedule-derived date helpers |
| `src/components/WCRoundPage.tsx` | NEW — shared round page component + metadata builder |
| `src/app/world-cup-2026/{round-of-32,round-of-16,quarter-finals,semi-finals,third-place,final}/page.tsx` | NEW — 6 thin wrappers (`revalidate = 900`) |
| `src/app/[alias]/page.tsx` | Extended for `-prediction` suffix (308 → predictPath, canonical, staticParams) |
| `src/components/WCPageNav.tsx` | +2 links (Round of 32, Final) |
| `src/app/world-cup-2026/bracket/page.tsx` | Round pills → links; R32 heading → link |
| `src/lib/wc-nav-routes.ts` | +6 registered hub routes |
| `src/app/sitemap.ts` | sitemap/2 +6 round pages; sitemap/4 +prediction aliases |

---

## Verification

```
npx tsc --noEmit  → 0 errors
npm run build     → success (see build log; all 6 round routes present)
```

Success criteria: **0 provider calls ✅ · 0 new API dependencies ✅ · build passes ✅**
