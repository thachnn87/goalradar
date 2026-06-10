# Provider Trace — PERF-7A Phase 2
## GoalRadar · Sprint PERF-7A

Generated: 2026-06-10

---

## Classification Table

| File | Line | Function | Classification | Reason |
|------|------|----------|---------------|--------|
| `src/app/[alias]/page.tsx` | 26 (import), 49–50 | `getUpcomingMatches('WC')` `getRecentMatches('WC')` | **RISKY** | SWR-backed via `withKVCache`; ISR revalidation triggers bg-revalidation when KV data stale; blocking call on KV miss |
| `src/app/predict/[id]/page.tsx` | 24 (import), 907–909 | `getTeamMatches(homeId)` `getTeamMatches(awayId)` | **RISKY** | SWR-backed via `withKVCache`; ISR revalidation triggers bg-revalidation on stale; 2× calls per render |
| `src/app/team/[id]/page.tsx` | 13 (import), 28 | `getTeam(id)` | **RISKY** | SWR-backed via `withKVCache(SWR.STANDINGS)`; ISR at 86400s but standings freshness is 3600s, so bg-revalidation fires on every ISR revalidation |
| `src/lib/match-snapshot.ts` | 360 | `getHeadToHead(matchId)` | **RISKY** | SWR-backed; called on every snapshot build (not only first render); result already null-safe in caller |
| `src/lib/match-snapshot.ts` | 349 | `getMatchDetail(matchId)` | **ACCEPTABLE** | Only called when `readMatchDetailFromKV()` returns null (first-ever KV miss); protected by cross-instance KV lock (PERF-6 Phase 4); no static fallback possible for arbitrary match IDs |
| `src/app/live/page.tsx` | — | `getLiveMatches()` | **LIVE-ONLY** | Intentional real-time data; live scores require fresh provider data |
| `src/lib/refresh.ts` | — | All provider calls | **SAFE** | Behind `isRateSafeModeActive()` guard; cron-only code path |
| `src/lib/prewarm/worldcup.ts` | — | Priority snapshot pre-warm | **SAFE** | Called only from orchestrator cron; rate-safe guarded |
| `src/app/api/cron/orchestrator/route.ts` | — | All `refreshEndpoint()` calls | **SAFE** | Cron route; not user-facing |
| `src/app/api/debug/*` | — | All provider calls | **SAFE** | Debug routes; manually triggered only |
| `src/app/sitemap.ts` | — | `getRecentMatches`, `getUpcomingMatches`, `getStandings` | **SAFE** | Import-aliased to `*Cached` variants (PERF-6 Phase 5); never call provider |
| `src/lib/match-snapshot.ts` | 361–363 | `getUpcomingMatchesCached`, `getRecentMatchesCached`, `getStandingsCached` | **SAFE** | `*Cached` variants (PERF-6 Phase 4); `readKVOnly` → static fallback |

---

## RISKY Paths: Root Cause

All four RISKY paths share the same pattern: they import and call the **SWR-backed** (`withKVCache`) versions of API functions. `withKVCache` works as follows:

1. If KV entry is **fresh**: return data (no provider call) ✅
2. If KV entry is **stale**: return data AND trigger `revalidateInBackground()` → provider call ⚠️
3. If KV **miss**: make **blocking** provider call ❌

Even though these pages use ISR (`revalidate = 86400` or `revalidate = 3600`), the ISR revalidation *is* a real render — it runs the full page component. If the KV entry for the requested data is stale at that point, bg-revalidation fires and adds to the provider queue.

### Fix pattern

Replace `withKVCache`-backed functions with `*Cached` variants that use `readKVOnly`:

```
SWR-backed:   L1 → withKVCache (SWR) → provider
*Cached:      L1 → readKVOnly        → static / null / empty
```

`readKVOnly` returns fresh **or** stale KV data without triggering bg-revalidation, and never calls the provider.

---

## Fix Plan (Phase 3)

### 1. Add missing `*Cached` variants to `src/lib/api.ts`

Three new functions needed:

- `getTeamMatchesCached(id)` — KV read-only; falls back to `{ matches: [] }` on miss
- `getTeamCached(id)` — KV read-only; falls back to `null` on miss
- `getHeadToHeadCached(id)` — KV read-only; falls back to `null` on miss

### 2. Fix `src/app/[alias]/page.tsx`

```diff
- import { getUpcomingMatches, getRecentMatches } from '@/lib/api';
+ import {
+   getUpcomingMatchesCached as getUpcomingMatches,
+   getRecentMatchesCached   as getRecentMatches,
+ } from '@/lib/api';
```

### 3. Fix `src/app/predict/[id]/page.tsx`

```diff
- import { getTeamMatches } from '@/lib/api';
+ import { getTeamMatchesCached as getTeamMatches } from '@/lib/api';
```

### 4. Fix `src/app/team/[id]/page.tsx`

```diff
- import { getTeam } from '@/lib/api';
+ import { getTeamCached } from '@/lib/api';

  // (usage: getTeam(id).catch(() => null)  →  getTeamCached(id))
```

### 5. Fix `src/lib/match-snapshot.ts` line 360

```diff
- import { getMatchDetail, getHeadToHead, ... } from './api';
+ import { getMatchDetail, getHeadToHeadCached, ... } from './api';

  // in buildSnapshot():
-   getHeadToHead(matchId),
+   getHeadToHeadCached(matchId),
```

---

## Acceptable Remaining Provider Call

After all fixes, the **only** remaining user-facing provider call path is:

| Path | Condition | Frequency | Mitigation |
|------|-----------|-----------|------------|
| `getMatchDetail(matchId)` in `buildSnapshot()` | First-ever render of a match page when `goalradar:/matches/{id}` KV key is absent | Once per new match ID, then KV cached | Cross-instance KV lock (PERF-6 Phase 4) — only one instance builds per match |

This call is intentional: there is no static fallback for arbitrary match IDs. The KV is populated by the cron orchestrator's snapshot pre-warm (`prewarm/worldcup.ts`), so for known WC matches this path is rarely triggered in production.
