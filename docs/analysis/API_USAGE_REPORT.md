# API Usage Report — Football-Data.org Call Trace
## GoalRadar · Sprint PERF-4.5 Phase 1

Generated: 2026-06-10

---

## Legend

| Column | Meaning |
|--------|---------|
| **Caller** | Page route or lib function |
| **Endpoint** | API path passed to `providerManager` |
| **Cache layer** | L1 = in-memory (cache.ts), L2 = Vercel KV (kv-cache.ts) |
| **Fresh TTL** | How long KV data is served without revalidation |
| **Stale TTL** | How long KV serves stale data (SWR bg-revalidate window) |
| **Provider risk** | Conditions under which a live provider call fires |
| **Prewarmed?** | Whether cron orchestrator keeps this endpoint warm |

---

## 1. Homepage (`/`)

| # | Function | Endpoint | L1 TTL | L2 Fresh | L2 Stale | Provider risk | Prewarmed |
|---|----------|----------|--------|----------|----------|---------------|-----------|
| 1 | `getTodayMatches()` | `GET /matches?dateFrom=X&dateTo=X` | 60s | **None — no KV** | **None** | **Every L1 miss (every new instance/every 60s)** | ❌ No |
| 2 | `getWCLiveMatches()` | `GET /matches?status=IN_PLAY,PAUSED` | 30s | 30s | 60s | L1+L2 miss or KV stale bg | ✅ Cron 30min |
| 3 | `getStandings('WC')` | `GET /competitions/WC/standings` | 3600s | 3600s | 7200s | L1+L2 miss or KV stale bg | ✅ Cron 30min |
| 4 | `getUpcomingMatches('WC')` | `GET /competitions/WC/matches?status=SCHEDULED,TIMED` | 900s | 900s | 1800s | L1+L2 miss or KV stale bg | ✅ Cron 30min |
| 5 | `getRecentMatches('WC')` | `GET /competitions/WC/matches?dateFrom=…&dateTo=…` | 900s | 900s | 1800s | L1+L2 miss or KV stale bg | ✅ Cron 30min |
| 6 | `getWCKnockoutMatches()` | `GET /competitions/WC/matches` | 21600s | 21600s | 43200s | L1+L2 miss or KV stale bg | ✅ Cron 30min |

**Critical issue — `getTodayMatches()`:** This function uses `fetchDirect` (no KV layer). It calls `providerManager.getTodayMatches()` directly whenever L1 is cold (new serverless instance, or every 60s TTL expiry). With Vercel's auto-scaling, this can generate dozens of provider calls per minute across instances.

**Duplicate risk:** `getWCLiveMatches()` and `getLiveMatches()` share the same KV key (`goalradar:live:matches`) via `live-cache.ts`. No duplicate — 1 API call serves both.

---

## 2. World Cup Hub (`/world-cup-2026`)

| # | Function | Endpoint | Provider risk | Prewarmed |
|---|----------|----------|---------------|-----------|
| 1 | `getWCLiveMatches()` | `GET /matches?status=IN_PLAY,PAUSED` | Same as above | ✅ |
| 2 | `getUpcomingMatches('WC')` | `GET /competitions/WC/matches?status=SCHEDULED,TIMED` | L2 stale bg (30min cron → always fresh) | ✅ |
| 3 | `getRecentMatches('WC')` | `GET /competitions/WC/matches?dateFrom=…` | L2 stale bg | ✅ |
| 4 | `getStandings('WC')` | `GET /competitions/WC/standings` | L2 stale bg (cron → always fresh) | ✅ |
| 5 | `getWCKnockoutMatches()` | `GET /competitions/WC/matches` | L2 stale bg (6h fresh vs 30min cron) | ✅ |

**Duplicate risk:** Endpoints 2,3,5 partially overlap. `getWCKnockoutMatches()` fetches all 104 WC matches; endpoints 2/3 fetch subsets. With cron pre-warming, all three read from KV — no duplicate provider calls. But on cold KV: up to 3 separate provider calls for the same competition data.

---

## 3. WC Fixtures (`/world-cup-2026/fixtures`)

| Function | Endpoint | Provider risk | Prewarmed |
|----------|----------|---------------|-----------|
| `getUpcomingMatches('WC')` | `GET /competitions/WC/matches?status=SCHEDULED,TIMED` | L2 stale bg | ✅ |

Single call, KV-backed, cron-prewarmed. Low risk.

---

## 4. WC Groups (`/world-cup-2026/groups`, `/world-cup-2026-groups`)

| Function | Endpoint | Provider risk | Prewarmed |
|----------|----------|---------------|-----------|
| `getStandings('WC')` | `GET /competitions/WC/standings` | L2 stale bg | ✅ |

Low risk. Static group table fallback is already wired via `getStaticWCGroupTables()` on the page.

---

## 5. WC Bracket (`/world-cup-2026/bracket`, `/world-cup-2026-bracket`)

| Function | Endpoint | Provider risk | Prewarmed |
|----------|----------|---------------|-----------|
| `getWCKnockoutMatches()` | `GET /competitions/WC/matches` | L2 stale bg | ✅ |

Static fallback via `getStaticGroupMatches()` wired in `getWCKnockoutMatches()`. Low risk.

---

## 6. WC Results (`/world-cup-2026-results`)

| Function | Endpoint | Provider risk | Prewarmed |
|----------|----------|---------------|-----------|
| `getRecentMatches('WC')` | `GET /competitions/WC/matches?dateFrom=…` | L2 stale bg | ✅ |
| `getWCLiveMatches()` | `GET /matches?status=IN_PLAY,PAUSED` | L2 stale bg | ✅ |

Low risk.

---

## 7. Global Standings (`/standings`)

| # | Function | Endpoint | Provider risk | Prewarmed |
|---|----------|----------|---------------|-----------|
| 1–7 | `getStandings(code)` × 7 competitions | `GET /competitions/{code}/standings` | L2 stale bg | ✅ All 7 codes |

7 parallel calls, all KV-backed, all cron-prewarmed (cron refreshes WC+PL+PD+BL1+SA+FL1+CL standings). Low risk.

---

## 8. Match Detail (`/match/[id]`)

| # | Function | Endpoint | Provider risk | Prewarmed |
|---|----------|----------|---------------|-----------|
| 1 | `getOrBuildMatchSnapshot()` | KV: `goalradar:match:{id}` | Snapshot KV miss → builds snapshot (PERF-4) | ✅ Via prewarmWorldCup |
| 2 | (within snapshot build) `getMatchDetail()` | `GET /matches/{id}` | Snapshot KV miss only | ✅ Per-match |
| 3 | (within snapshot build) `getHeadToHead()` | `GET /matches/{id}/head2head` | Snapshot KV miss only | ✅ Per-match |
| 4 | (within snapshot build) `getStandings('WC')` | `GET /competitions/WC/standings` | Snapshot KV miss only | ✅ Cron |
| 5 | (within snapshot build) `getUpcomingMatches('WC')` | `GET /competitions/WC/matches?status=SCHEDULED,TIMED` | Snapshot KV miss only | ✅ Cron |

**PERF-4 fixed:** `generateMetadata` and page body both use `getOrBuildMatchSnapshot()` via `React.cache()`. On snapshot KV hit: 0 provider calls. On miss: up to 4 provider calls (but coalesced across concurrent requests via `_buildInflight` map).

---

## 9. Live Scores (`/live`)

| Function | Endpoint | Provider risk | Prewarmed |
|----------|----------|---------------|-----------|
| `getLiveMatches()` | `GET /matches?status=IN_PLAY,PAUSED` | KV stale bg every 30s | ✅ Cron 30min |

Acceptable — live data must be fresh. The cron refreshes every 30min which is longer than the 30s TTL, so users will trigger bg-revalidations. This is by design.

---

## 10. WC Group Pages (`/world-cup-2026/[group]`)

| Function | Endpoint | Provider risk | Prewarmed |
|----------|----------|---------------|-----------|
| `getStandings('WC')` | Standings | L2 stale bg | ✅ |
| `getUpcomingMatches('WC')` | Upcoming | L2 stale bg | ✅ |
| `getRecentMatches('WC')` | Recent | L2 stale bg | ✅ |

3 calls, all cron-prewarmed. Low risk on warm KV.

---

## 11. WC Team Pages (`/world-cup-2026/teams/[slug]`)

| Function | Endpoint | Provider risk | Prewarmed |
|----------|----------|---------------|-----------|
| `getUpcomingMatches('WC')` | Upcoming | L2 stale bg | ✅ |
| `getRecentMatches('WC')` | Recent | L2 stale bg | ✅ |
| `getStandings('WC')` | Standings | L2 stale bg | ✅ |

---

## 12. Schedule (`/schedule`)

| Function | Endpoint | Provider risk | Prewarmed |
|----------|----------|---------------|-----------|
| `getUpcomingMatches(competition)` (default: WC) | Upcoming per competition | L2 stale bg | WC only |
| `getRecentMatches(competition)` | Recent per competition | L2 stale bg | WC only |

Non-WC competition fixtures (PL, CL, etc.) are **not** prewarmed by the cron. First request after KV expiry (30min stale window) will call the provider.

---

## Summary: Provider Call Risk Matrix

| Route | On KV warm | On KV cold | On bg-stale | Prewarmed | Sprint Priority |
|-------|-----------|-----------|-------------|-----------|----------------|
| `/` (homepage) | 0 calls* | 6 calls | 5 calls bg | ✅ except `getTodayMatches` | 🔴 HIGH |
| `/world-cup-2026` | 0 calls | 5 calls | 5 calls bg | ✅ | 🟡 MEDIUM |
| `/world-cup-2026/fixtures` | 0 calls | 1 call | 1 call bg | ✅ | 🟢 LOW |
| `/standings` | 0 calls | 7 calls | 7 calls bg | ✅ | 🟢 LOW |
| `/world-cup-2026/groups` | 0 calls | 1 call | 1 call bg | ✅ | 🟢 LOW |
| `/world-cup-2026/bracket` | 0 calls | 1 call | 0 (static) | ✅ | 🟢 LOW |
| `/match/*` | 0 calls | 4 calls | 0 | ✅ | 🟢 LOW (PERF-4 done) |
| `/live` | 0 calls | 1 call | 1 call bg | ✅ | ℹ️ Acceptable |

*`getTodayMatches()` has no KV — it calls provider on every new serverless instance (L1 miss every 60s).

---

## Root Causes

### RC-1: `getTodayMatches()` has no KV layer ❌
```typescript
// src/lib/api.ts — line 164
export function getTodayMatches() {
  return withCache(key, TTL.MATCH,
    () => providerManager.getTodayMatches()  // direct provider, no KV
  );
}
```
Every new serverless instance (or after 60s L1 expiry) calls the provider directly.

### RC-2: SWR bg-revalidation fires from page renders ⚠️
When `withKVCache` encounters a stale entry, it returns stale data AND fires `revalidateInBackground()` which calls the provider. This happens even during page renders. Multiple serverless instances all see the same stale KV entry and each fire their own bg-revalidation → N provider calls for the same endpoint.

### RC-3: No global coalescing across instances ⚠️
`withCache` (L1) deduplicates within a single process via an inflight Map. But concurrent serverless instances have separate L1 caches, so 20 instances can each independently trigger the same provider call.

### RC-4: Match page snapshot can miss KV on first visit ℹ️
Already fixed in PERF-4. `prewarmWorldCup()` pre-seeds all 104 WC match snapshots.

---

## Remediation Plan (PERF-4.5)

| Issue | Fix | Phase |
|-------|-----|-------|
| `getTodayMatches()` no KV | Add `withKVCache` + page-safe `getTodayMatchesCached()` | 2 |
| Pages trigger bg-revalidation → provider | All page renders use `readKVOnly()` — no SWR trigger | 2 |
| No global coalescing | KV mutex in `revalidateInBackground()` — `SET lockKey NX EX 30` | 4 |
| No cache visibility | `/api/debug/cache` endpoint | 5 |
