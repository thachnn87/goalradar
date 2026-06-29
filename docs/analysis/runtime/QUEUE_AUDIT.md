# Queue Audit — PERF-6 Phase 1
## GoalRadar · Sprint PERF-6

Generated: 2026-06-10

---

## Root Cause Summary

Queue depths of 8–9 during orchestrator runs are caused by **three independent
sources** that pile into the same `footballDataLimiter` FIFO queue simultaneously:

1. **Orchestrator cron** — 13 forced provider calls per run, no skip-if-fresh guard
2. **Sitemap generation** — up to 20 provider calls when Googlebot triggers a cold sitemap render
3. **Snapshot builds** — per-instance `_buildInflight` is not cross-instance; multiple Vercel functions can build the same snapshot in parallel

---

## Provider Call Paths

### A. Cron Orchestrator — `/api/cron/orchestrator`

**File:** `src/app/api/cron/orchestrator/route.ts`  
**Frequency:** Every 30 minutes (external scheduler)  
**Queue depth impact per run:** 13 calls × 7s = **91 seconds minimum**

| Task | Endpoint | Cache Layer | Forced? |
|------|----------|-------------|---------|
| wc-all-matches | `/competitions/WC/matches` | None — always fetches | ✅ Yes |
| wc-upcoming | `/competitions/WC/matches?status=SCHEDULED,TIMED` | None | ✅ Yes |
| wc-finished | `/competitions/WC/matches?status=FINISHED` | None | ✅ Yes |
| wc-recent | `/competitions/WC/matches?dateFrom=...&dateTo=...` | None | ✅ Yes |
| today-matches | `/matches?dateFrom=...&dateTo=...` | None | ✅ Yes |
| live-matches | `/matches?status=IN_PLAY,PAUSED` | None | ✅ Yes |
| standings-WC | `/competitions/WC/standings` | None | ✅ Yes |
| standings-PL | `/competitions/PL/standings` | None | ✅ Yes |
| standings-PD | `/competitions/PD/standings` | None | ✅ Yes |
| standings-BL1 | `/competitions/BL1/standings` | None | ✅ Yes |
| standings-SA | `/competitions/SA/standings` | None | ✅ Yes |
| standings-FL1 | `/competitions/FL1/standings` | None | ✅ Yes |
| standings-CL | `/competitions/CL/standings` | None | ✅ Yes |

**Problem:** `refreshEndpoint()` ALWAYS calls the provider, regardless of KV
freshness. There is no skip-if-fresh guard. Data that is 2 minutes old (not
stale until 6 hours per freshSec=21600) is still re-fetched every 30 minutes.

**Additionally:** After the 13 tasks, `prewarmWorldCup()` makes up to **4 more**
provider calls for priority matches (next-24h SCHEDULED/TIMED with
`providerManager.getMatch(id)`). Total: up to **17 queued calls per run**.

---

### B. Sitemap Generation — `sitemap/4` and `sitemap/5`

**File:** `src/app/sitemap.ts`  
**Frequency:** On demand (Googlebot, GSC fetch, edge CDN miss)  
**Queue depth impact:** Up to **20 provider calls** on cold render

| Function | Call | Competitions | Provider Calls |
|----------|------|--------------|----------------|
| `matchSitemap()` | `getRecentMatches(c.code)` | 7 | 7 |
| `matchSitemap()` | `getUpcomingMatches(c.code)` | 7 | 7 |
| `teamSitemap()` | `getStandings(c.code)` | 6 (non-WC) | 6 |
| **Total** | | | **20** |

**Problem:** Sitemap functions call the SWR-backed `withKVCache` versions of
these APIs. On KV miss (cold start, edge eviction), all 14 competition
fixture requests fire simultaneously, then 6 standings requests. With 7s/call
spacing, this takes up to 140 seconds and pushes queue depth to 20.

Note: The existing 24-hour KV sitemap cache (`goalradar:sitemap:matches`) only
fires AFTER the API calls succeed — it doesn't prevent them.

---

### C. Match Snapshot Builds — `src/lib/match-snapshot.ts`

**File:** `src/lib/match-snapshot.ts`  
**Frequency:** On demand — on KV snapshot miss  
**Queue depth impact per build:** 1–4 provider calls

| Call | Source | Provider Impact |
|------|--------|-----------------|
| `getMatchDetail(matchId)` | `buildSnapshot()` — KV miss fallback | 1 call to `/matches/{id}` |
| `getHeadToHead(matchId)` | `buildSnapshot()` — always attempted | 1 call to `/matches/{id}/head2head` |
| `getUpcomingMatches('WC')` | `buildSnapshot()` — WC matches | SWR bg-revalidation trigger |
| `getRecentMatches('WC')` | `buildSnapshot()` — WC matches | SWR bg-revalidation trigger |
| `getStandings('WC')` | `buildSnapshot()` — WC standings | SWR bg-revalidation trigger |

**Problem 1:** `_buildInflight` map coalesces within a single Vercel function
instance, but Vercel routes requests to different instances. 5 instances hitting
the same uncached match simultaneously → 5 parallel builds → 5–20 provider calls.

**Problem 2:** `getUpcomingMatches`, `getRecentMatches`, `getStandings` inside
`buildSnapshot` use the SWR-backed `withKVCache` path, not the `*Cached`
(read-only) variants. If any are stale, they trigger bg-revalidation.

---

### D. Debug Routes — Direct Provider Access

**Files:** `src/app/api/debug/provider-health/route.ts`, `src/app/api/debug/provider-smoke/route.ts`  
**Queue depth impact:** 2 provider calls each

Both debug routes instantiate NEW `FootballDataProvider` and `ApiFootballProvider`
instances and call `getFixtures('WC')` directly. These run THROUGH the shared
`footballDataLimiter.acquire()` queue (since the limiter is a module-level
singleton). These should only be called manually (not by schedulers).

---

### E. Background SWR Revalidation — Already Mitigated (PERF-4.5)

All page render paths use `*Cached` variants (`readKVOnly`) — no SWR trigger
from pages. The KV NX lock (`goalradar:lock:{endpoint}`, 30s) prevents multiple
instances from triggering the same bg-revalidation simultaneously.

The lock IS working. The queue depth 8–9 is NOT from page renders.

---

## Queue Depth Analysis

### Scenario: Orchestrator run (30-min cron) + Googlebot sitemap crawl

If these overlap:
- Orchestrator: 13 calls queued (tasks 1–13 enqueue one per 7s)
- Sitemap: 20 calls arrive mid-orchestrator run
- Depth peaks at: 13 + 20 − drained = **~8–9** (matches observed symptom)

### Scenario: Orchestrator + prewarm

- 13 regular tasks + 4 priority match fetches = 17 queued
- Depth can reach 17 mid-run

---

## Fix Summary (implemented in PERF-6)

| Source | Fix | Expected Depth |
|--------|-----|----------------|
| Orchestrator forced refresh | Skip-if-fresh guard (`minIntervalSec`) | 0–3 (only stale tasks fire) |
| Sitemap provider calls | Replace with `*Cached` variants (KV-only) | 0 |
| Snapshot cross-instance builds | KV lock per match | 0–1 |
| Snapshot SWR triggers | Use `*Cached` WC variants in `buildSnapshot` | 0 |
| Provider timeout (no circuit open) | `enableRateSafeMode('timeout', 15min)` | 0 (circuit opens) |
