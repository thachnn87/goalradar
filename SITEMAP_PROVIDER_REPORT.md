# Sitemap Provider Report — PERF-6 Phase 5
## GoalRadar · Sprint PERF-6

Generated: 2026-06-10

---

## Problem

`sitemap/4` (match pages) and `sitemap/5` (team pages) previously called the
SWR-backed `getRecentMatches`, `getUpcomingMatches`, and `getStandings` functions
from `src/lib/api.ts`. These functions:

1. Check L1 in-memory cache
2. Check KV (fresh or stale)
3. If stale: return data **AND** trigger `revalidateInBackground()` → provider call
4. If KV miss: make a **blocking** provider call

When Googlebot crawls the sitemap on a cold edge or after a KV eviction:
- 7 competitions × `getRecentMatches` = 7 provider calls
- 7 competitions × `getUpcomingMatches` = 7 provider calls  
- 6 league competitions × `getStandings` = 6 provider calls
- **Total: 20 simultaneous provider calls → queue depth 20**

---

## Fix: Import *Cached Variants

**File:** `src/app/sitemap.ts`

```typescript
// Before:
import { getRecentMatches, getUpcomingMatches, getStandings } from '@/lib/api';

// After:
import {
  getRecentMatchesCached   as getRecentMatches,
  getUpcomingMatchesCached as getUpcomingMatches,
  getStandingsCached       as getStandings,
} from '@/lib/api';
```

The `*Cached` variants were created in PERF-4.5. They follow the path:
```
L1 in-memory (withCache)
  → readKVOnly() — returns fresh OR stale, no SWR trigger
    → static WC fallback (for WC endpoints) or { matches: [] } / { standings: [] }
```

They **never call the provider**. On KV miss they return static bundled data
(for WC) or an empty payload (for leagues) — the sitemap simply emits fewer
entries, which is safe and recovers automatically on the next cron-seeded KV write.

---

## Behaviour After Fix

| Scenario | Before | After |
|----------|--------|-------|
| KV warm (normal) | 0 provider calls (SWR serves stale) | 0 provider calls |
| KV stale | 14–20 bg-revalidation calls | 0 provider calls (stale KV served directly) |
| KV cold miss | 14–20 blocking calls | 0 provider calls (static WC or empty) |
| Googlebot crawls during cron run | 20 + 13 = 33 queued calls | 0 from sitemap |

---

## KV Cache Fallback (Unchanged)

The 24-hour KV sitemap cache (`goalradar:sitemap:matches`, `goalradar:sitemap:teams`)
is written on every successful sitemap generation. Since the provider is no longer
called from the sitemap, the fallback path is now: KV sitemap cache → empty array
(rather than KV sitemap cache → try again and fail).

Both `matchSitemap()` and `teamSitemap()` retain their `try/catch` fallback to
the sitemap KV cache — this still covers cases where the `*Cached` variants
return empty due to a prolonged cron outage.

---

## Verification

- `src/app/sitemap.ts` imports only `*Cached` variants ✅
- No direct `providerManager` or `FootballDataProvider` imports in sitemap ✅
- TypeScript: 0 errors ✅
- Sitemap generation queue impact: **0 provider calls** regardless of KV state ✅
