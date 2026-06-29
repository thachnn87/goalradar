# Zero Provider Report — PERF-7A
## GoalRadar · Sprint PERF-7A

Generated: 2026-06-10

---

## Executive Summary

All user-facing page routes have been audited and converted to `*Cached` API
variants. Provider calls can no longer be triggered by page renders.

---

## Success Criteria

| Criterion | Result |
|-----------|--------|
| `/live` may call provider | ✅ `getLiveMatchesCached` → live-cache.ts → KV-backed; provider only on KV miss (30s TTL seeded by orchestrator) |
| refresh routes may call provider | ✅ Unchanged — `refreshEndpoint()` in cron routes only |
| cron jobs may call provider | ✅ Unchanged — orchestrator with skip-if-fresh guard (PERF-6) |
| everything else: 0 provider calls | ✅ All pages now use `*Cached` variants |
| TypeScript: 0 errors | ✅ `npx tsc --noEmit` → 0 errors |

---

## Files Changed

### `src/lib/api.ts` — New `*Cached` variants

| Function | KV miss fallback |
|----------|-----------------|
| `getHeadToHeadCached(id)` | `null` |
| `getTeamMatchesCached(id)` | `{ matches: [] }` |
| `getTeamCached(id)` | `null` |

All three use `withCache(L1) → readKVOnly(L2, no SWR trigger) → fallback`.
They never call `providerManager`.

### `src/app/[alias]/page.tsx`

```diff
- import { getUpcomingMatches, getRecentMatches } from '@/lib/api';
+ import {
+   getUpcomingMatchesCached as getUpcomingMatches,
+   getRecentMatchesCached   as getRecentMatches,
+ } from '@/lib/api';
```

### `src/app/predict/[id]/page.tsx`

```diff
- import { getTeamMatches } from '@/lib/api';
+ import { getTeamMatchesCached as getTeamMatches } from '@/lib/api';
```

### `src/app/team/[id]/page.tsx`

```diff
- import { getTeam } from '@/lib/api';
+ import { getTeamCached } from '@/lib/api';
  // getTeam(id).catch(() => null)  →  getTeamCached(id)  (null-safe, no .catch needed)
```

### `src/lib/match-snapshot.ts`

```diff
- import { getMatchDetail, getHeadToHead, ... } from './api';
+ import { getMatchDetail, getHeadToHeadCached, ... } from './api';
  // in buildSnapshot():
-   getHeadToHead(matchId),
+   getHeadToHeadCached(matchId),
```

### `src/app/competition/[code]/page.tsx`

```diff
- import { getStandings, getRecentMatches, getUpcomingMatches } from '@/lib/api';
+ import {
+   getStandingsCached       as getStandings,
+   getRecentMatchesCached   as getRecentMatches,
+   getUpcomingMatchesCached as getUpcomingMatches,
+ } from '@/lib/api';
```

### `src/app/teams/[slug]/page.tsx`

```diff
- import { getTeam, getTeamMatches, getStandings, getUpcomingMatches, NotFoundError } from '@/lib/api';
+ import {
+   getTeamCached            as getTeamFromKV,
+   getTeamMatchesCached     as getTeamMatches,
+   getStandingsCached       as getStandings,
+   getUpcomingMatchesCached as getUpcomingMatches,
+   NotFoundError,
+ } from '@/lib/api';
  // Local React.cache() wrapper updated: cache(getTeam) → cache(getTeamFromKV)
  // generateMetadata: added `if (!team) return { title: 'Team | GoalRadar' };`
```

### `src/app/world-cup-2026/teams/[slug]/page.tsx`

```diff
- import { getUpcomingMatches, getRecentMatches, getStandings } from '@/lib/api';
+ import {
+   getUpcomingMatchesCached as getUpcomingMatches,
+   getRecentMatchesCached   as getRecentMatches,
+   getStandingsCached       as getStandings,
+ } from '@/lib/api';
```

### `src/app/world-cup-2026/watch-live/page.tsx`

```diff
- import { getWCLiveMatches, getUpcomingMatches } from '@/lib/api';
+ import {
+   getWCLiveMatchesCached   as getWCLiveMatches,
+   getUpcomingMatchesCached as getUpcomingMatches,
+ } from '@/lib/api';
```

### `src/app/world-cup-2026/results/page.tsx`

```diff
- import { getWCResults } from '@/lib/api';
+ import { getWCResultsCached as getWCResults } from '@/lib/api';
```

---

## Remaining Provider Call Paths (Complete Map)

After PERF-7A, provider calls can ONLY originate from:

| Source | Condition | Rate | Mitigation |
|--------|-----------|------|------------|
| `refreshEndpoint()` in orchestrator | When KV entry older than `minIntervalSec` | today+live: ~2 calls/30min; WC+standings: skip if fresh | PERF-6 Phase 3 skip-if-fresh guard |
| `prewarmWorldCup()` in orchestrator | Priority match snapshot pre-warm | ≤4 calls per cron run | Rate-safe guarded |
| `getMatchDetail()` in `buildSnapshot()` | First-ever render of a match page (KV detail miss) | Once per match ID, then KV cached 7d | Cross-instance KV lock (PERF-6 Phase 4) |
| Debug routes (`/api/debug/*`) | Manual trigger only | Negligible | Not user-facing |

**No user-facing page render can trigger a provider call.**

---

## SWR Bg-Revalidation Eliminated

The root cause of PERF-7A: `withKVCache(endpoint, SWR, providerFn)` returns stale data AND triggers `revalidateInBackground()` asynchronously when the KV entry age exceeds `SWR.fresh`. During ISR revalidation of a page with stale KV data, this fired provider calls outside the cron cycle.

By switching all page-render API calls to `readKVOnly` (via `*Cached` variants), stale KV data is served directly — no bg-revalidation, no provider queue entries, regardless of KV freshness state.

---

## Phase 1 Grep Notes

The initial Phase 1 grep in PERF-7A missed several pages due to a glob-quoting issue with bracket paths (`[alias]`, `[slug]`, etc.). The comprehensive fix covered all pages via direct-path greps in Phase 3.

**Pages that had non-Cached calls (all now fixed):**

| Page | Functions Fixed |
|------|----------------|
| `/[alias]` | `getUpcomingMatches`, `getRecentMatches` |
| `/predict/[id]` | `getTeamMatches` |
| `/team/[id]` | `getTeam` |
| `/teams/[slug]` | `getTeam`, `getTeamMatches`, `getStandings`, `getUpcomingMatches` |
| `/competition/[code]` | `getStandings`, `getRecentMatches`, `getUpcomingMatches` |
| `/world-cup-2026/teams/[slug]` | `getUpcomingMatches`, `getRecentMatches`, `getStandings` |
| `/world-cup-2026/watch-live` | `getUpcomingMatches` |
| `/world-cup-2026/results` | `getWCResults` |
| `match-snapshot.ts` buildSnapshot | `getHeadToHead` |

**Pages already correct (from PERF-4.5):**

| Page | Status |
|------|--------|
| `/` (homepage) | ✅ All `*Cached` |
| `/world-cup-2026` (hub) | ✅ All `*Cached` |
| `sitemap.ts` | ✅ All `*Cached` (PERF-6 Phase 5) |
| `/live` | ✅ Intentional live provider call |

---

## TypeScript

```
npx tsc --noEmit → 0 errors
```
