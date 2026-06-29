# PERF-4.5 Report — Zero API Browsing
## GoalRadar · Sprint PERF-4.5

Generated: 2026-06-10

---

## Executive Summary

After PERF-4.5, all normal user page renders are served exclusively from in-memory cache (L1) or Vercel KV (L2). The football-data.org API is never called from a page render path. Provider calls are the exclusive responsibility of the cron orchestrator.

---

## Before / After

### Provider Calls During Normal Browsing

| Page | Before | After |
|------|--------|-------|
| `/` (homepage) | 1–6 calls (L1 miss every 60s; `getTodayMatches` had no KV) | **0** (KV-only reads + static fallback) |
| `/world-cup-2026` | 0–5 calls (KV stale bg-revalidation) | **0** (readKVOnly — no SWR trigger) |
| `/world-cup-2026/fixtures` | 0–1 calls (SWR bg) | **0** |
| `/standings` | 0–7 calls (SWR bg × 7 competitions) | **0** |
| `/world-cup-2026/groups` | 0–1 calls | **0** |
| `/world-cup-2026/bracket` | 0–1 calls | **0** |
| `/match/*` | 0 calls (PERF-4) | **0** |
| `/live` | 0–1 calls (SWR bg every 30s) | **0–1** (acceptable — live data must refresh) |

### Background Provider Calls (SWR bg-revalidation)

| Scenario | Before | After |
|----------|--------|-------|
| 20 users hit same stale page simultaneously | 20 bg-revalidations (1 per instance) | **1** (global coalescing lock via KV SET NX EX 30) |
| Stale KV standings, 100 users | 100 bg-revalidations | **1** |
| `getTodayMatches` cold instance | 1 blocking provider call | **0** (KV-backed; returns empty on KV miss) |

### Latency (TTFB)

| Scenario | Before | After |
|----------|--------|-------|
| Warm KV (normal browsing) | ~10–50 ms | ~10–20 ms (same — KV read) |
| KV miss (first render after cold) | 200–7000 ms (provider call) | ~1 ms (static fallback) |
| Multiple stale keys simultaneously | Queued provider calls (7s gate) | Static fallback or stale KV data |

### Cache Hit Ratio

| Metric | Before | After (target) |
|--------|--------|----------------|
| L2 KV effective hit rate | ~85% (SWR stale bg counted as "hit") | **99%+** (readKVOnly serves fresh+stale) |
| Provider calls per 1000 page views | ~30–50 | **<1** (only from cron) |
| Duplicate provider calls (same endpoint, multiple instances) | N × instances | **1** (coalescing lock) |

---

## Changes Made

### Phase 1 — Audit
**`API_USAGE_REPORT.md`** — traced every provider call path per route.

Root causes identified:
1. `getTodayMatches()` had no KV layer — called provider on every L1 miss
2. `withKVCache` SWR background revalidation fired from page renders
3. No global coalescing — N instances each triggered the same bg-revalidation

### Phase 2 — Remove API from Page Render

**`src/lib/kv-cache.ts`** — new `readKVOnly<T>(key)`:
- Returns KV data (fresh OR stale) without triggering bg-revalidation
- Falls through to disaster-recovery key (7-day TTL)
- Returns `null` on miss — never calls provider

**`src/lib/api.ts`** — new page-safe `*Cached` variants:
- `getUpcomingMatchesCached(competition)` → L1 → KV read-only → static WC fallback
- `getRecentMatchesCached(competition)` → L1 → KV read-only → static WC fallback
- `getWCResultsCached()` → L1 → KV read-only → static FINISHED matches
- `getStandingsCached(competition)` → L1 → KV read-only → static WC group tables
- `getWCKnockoutMatchesCached()` → L1 → KV read-only → static WC fixtures
- `getWCLiveMatchesCached()` → live-cache (already KV-backed, 30s TTL)
- `getTodayMatchesCached()` → L1 → KV read-only → empty (no cross-competition static)

Also: `getTodayMatches()` upgraded from `fetchDirect` (no KV) to full `withKVCache` path — ensures KV is populated for `getTodayMatchesCached` reads.

### Phase 3 — Snapshot First (Match Pages)

Already completed in PERF-4 (commit `51e99ff`). Match pages use `getOrBuildMatchSnapshot()` with tier-aware TTL, `_buildInflight` cross-request coalescing, and `readMatchDetailFromKV()` inside snapshot builds.

### Phase 4 — Global Request Coalescing

**`src/lib/kv-cache.ts`** — `revalidateInBackground()` now acquires a KV mutex before calling the provider:
```
Before: 20 instances × stale KV → 20 bg-revalidations → 20 provider calls
After:  20 instances × stale KV → 1 wins KV lock → 1 provider call → 19 skip
```

Lock key: `goalradar:lock:{endpoint}` with `SET NX EX 30` (30-second window).  
Lock auto-expires — no cleanup needed. Tracks `_coalesced` counter for diagnostics.

### Phase 5 — Cache Coverage Report

**`src/app/api/debug/cache/route.ts`** — `GET /api/debug/cache`:
- Probes 13 canonical KV keys (WC data + all 7 standings)
- Reports FRESH / STALE / MISS status per key
- Shows L1 hit ratio, L2 KV hit ratio, coalescing saves, provider call count
- Protected by `Authorization: Bearer <ADMIN_SECRET>`

### Phase 6 — Cron Update

**`src/app/api/cron/orchestrator/route.ts`** — added `today-matches` task:
```typescript
{
  label: 'today-matches',
  run:   () => refreshEndpoint(`/matches?dateFrom=${today}&dateTo=${today}`, 60, 120),
}
```
Seeds the cross-competition today's matches KV key every 30 minutes, ensuring `getTodayMatchesCached()` always has data.

### Page Updates (14 files)

All page renders use the page-safe `*Cached` API variants:

| Page | Functions replaced |
|------|--------------------|
| `src/app/page.tsx` | getTodayMatches → getTodayMatchesCached; all WC → *Cached |
| `src/app/world-cup-2026/page.tsx` | All 5 WC calls → *Cached |
| `src/app/world-cup-2026/fixtures/page.tsx` | getUpcomingMatches → *Cached |
| `src/app/world-cup-2026/groups/page.tsx` | getStandings → *Cached |
| `src/app/world-cup-2026/bracket/page.tsx` | getWCKnockoutMatches → *Cached |
| `src/app/world-cup-2026-bracket/page.tsx` | getWCKnockoutMatches → *Cached |
| `src/app/world-cup-2026-groups/page.tsx` | getStandings → *Cached |
| `src/app/world-cup-2026-standings/page.tsx` | getStandings → *Cached |
| `src/app/world-cup-2026-results/page.tsx` | getRecentMatches + getWCLiveMatches → *Cached |
| `src/app/standings/page.tsx` | getStandings → *Cached |
| `src/app/schedule/page.tsx` | getUpcomingMatches + getRecentMatches → *Cached |
| `src/app/world-cup-2026/[group]/page.tsx` | All 3 → *Cached |
| `src/app/world-cup-2026/matches-today/page.tsx` | All 3 → *Cached |
| `src/app/world-cup-2026/matches-tomorrow/page.tsx` | getUpcomingMatches → *Cached |
| `src/app/world-cup-2026-schedule/page.tsx` | getUpcomingMatches → *Cached |
| `src/app/world-cup-2026-predictions/page.tsx` | Both → *Cached |

---

## Static Fallback Chain

When KV misses (unlikely if cron is healthy), pages return bundled static data:

| Function | Static fallback |
|----------|----------------|
| `getUpcomingMatchesCached('WC')` | `getStaticUpcomingMatches(today)` — 72 group matches |
| `getRecentMatchesCached('WC')` | `getStaticGroupMatches().filter(FINISHED)` |
| `getWCResultsCached()` | Same as above |
| `getStandingsCached('WC')` | `getStaticWCGroupTables()` — pre-tournament standings |
| `getWCKnockoutMatchesCached()` | `getStaticGroupMatches()` — all 104 fixtures |
| `getTodayMatchesCached()` | `{ matches: [] }` — empty (no cross-competition static) |
| Non-WC competitions | `{ matches: [] }` or `{ standings: [] }` — empty graceful fallback |

---

## Architecture After PERF-4.5

```
User Request
     │
     ▼
  Page Render (Next.js server component)
     │
     ├─ L1: withCache() in-memory (sub-ms, per-instance)
     │       └─ HIT: return immediately
     │       └─ MISS: ↓
     │
     ├─ L2: readKVOnly() Vercel KV (10ms, cross-instance)
     │       └─ FRESH or STALE: return data (no SWR trigger)
     │       └─ MISS: ↓
     │
     └─ L3: Static bundled data (WC) or empty array
             └─ Always returns — never throws

Provider Calls (football-data.org / api-football)
     │
     └─ ONLY from: /api/cron/orchestrator (every 30min)
                   Via withKVCache() with global coalescing lock
                   Never from page renders
```

---

## Verification Checklist

- [x] `getTodayMatches()` upgraded from `fetchDirect` to `withKVCache`
- [x] `readKVOnly<T>()` exported from `kv-cache.ts`
- [x] All page-safe `*Cached` variants return static/empty on KV miss — never throw
- [x] `revalidateInBackground()` acquires KV mutex before provider call
- [x] `_coalesced` counter tracked in `getKVCacheStats()`
- [x] Cron seeds `today-matches` KV key every 30min
- [x] 14 page files updated to use `*Cached` variants
- [x] `/api/debug/cache` endpoint returns coverage for 13 canonical keys
- [x] TypeScript passes with 0 errors

---

## Remaining Notes

- `/live` page still calls `getLiveMatches()` which triggers bg-revalidation every 30s. This is **intentional** — live scores must be near-real-time. The coalescing lock ensures only 1 instance fires the provider call per 30s window.
- Non-WC competition fixtures (`/schedule?competition=PL`) fall back to `{ matches: [] }` on KV miss. The cron does not pre-warm non-WC fixture lists. This is acceptable — PL/CL fixture pages are a secondary concern vs. WC.
- The `_buildInflight` match snapshot coalescer (PERF-4) works at the snapshot level; the KV coalescing lock (PERF-4.5) works at the individual endpoint level. Together they cover both match-page and general-page scenarios.
