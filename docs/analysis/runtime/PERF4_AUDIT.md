# PERF-4 Audit — Match Page Request Trace
## GoalRadar · Sprint PERF-4

Generated: 2026-06-10

---

## 1. Full Request Trace: `/match/[id]`

### Sequence Diagram (pre-PERF-4)

```
Browser GET /match/537327-mexico-vs-south-africa
│
├─ generateMetadata()
│    └─ getMatchDetail("537327")
│         └─ withCache("/matches/537327", TTL.MATCH=60s, …)
│              ├─ L1 HIT  → 0 ms                        [if warm process]
│              └─ L1 MISS → withKVCache("/matches/537327", SWR.MATCH={60,120}, …)
│                   ├─ KV FRESH  → ~10 ms               [within 60s]
│                   ├─ KV STALE  → ~10 ms + bg provider call  [60–120s old]
│                   └─ KV MISS   → providerManager.getMatch(537327)
│                        └─ footballDataLimiter.acquire()
│                             └─ HTTP GET /matches/537327    [200–7000 ms, queue-gated]
│
├─ MatchDetailPage()
│    └─ getMatchDetail("537327")
│         └─ withCache → L1 HIT  → 0 ms   (populated by generateMetadata call)
│              ▲ NOTE: only if same process instance; cold start = KV read again
│
├─ ScoreHero renders immediately from match ↑
│
├─ <Suspense fallback={<HeadToHeadSkeleton>}>
│    └─ HeadToHeadDeferred()
│         └─ getOrBuildMatchSnapshot("537327")   ← React.cache() dedup
│              ├─ KV  read goalradar:match:537327  → HIT ~10 ms  [within 900s]
│              └─ KV MISS  → buildSnapshot("537327")
│                   ├─ getMatchDetail("537327")   → L1 HIT (already fetched above)
│                   ├─ getHeadToHead("537327")    → withCache → withKVCache(SWR.MATCH={60,120})
│                   │    └─ [KV miss → providerManager.getHeadToHead("537327")]
│                   ├─ getUpcomingMatches("WC")   → withCache → withKVCache(SWR.FIXTURES={900,1800})
│                   │    └─ [KV miss → providerManager.getFixtures("WC")]
│                   ├─ getRecentMatches("WC")     → withCache → withKVCache(SWR.FIXTURES)
│                   │    └─ [KV miss → providerManager.getResults("WC")]
│                   └─ getStandings("WC")         → withCache → withKVCache(SWR.STANDINGS={3600,7200})
│                        └─ [KV miss → providerManager.getStandings("WC")]
│
└─ <Suspense fallback={<WCGroupSectionSkeleton>}>
     └─ WCGroupSectionDeferred()
          └─ getOrBuildMatchSnapshot("537327")   ← React.cache() → instant (same promise)
```

---

## 2. API / KV Call Inventory

### Cold start (no L1, no KV, no snapshot)

| # | Function | KV key | Provider call | Notes |
|---|----------|--------|---------------|-------|
| 1 | `getMatchDetail` (metadata) | `goalradar:/matches/537327` | ✅ `getMatch(537327)` | **Blocking** — metadata waits |
| 2 | `getMatchDetail` (page body) | same | L1 HIT | Process-level cache |
| 3 | `getOrBuildMatchSnapshot` check | `goalradar:match:537327` | — | KV miss → build |
| 4 | `getMatchDetail` (buildSnapshot) | same | L1 HIT | Already in L1 |
| 5 | `getHeadToHead` | `goalradar:/matches/537327/head2head` | ✅ `getHeadToHead(537327)` | Parallel in buildSnapshot |
| 6 | `getUpcomingMatches('WC')` | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | ✅ maybe | SWR.FIXTURES=900s |
| 7 | `getRecentMatches('WC')` | `goalradar:/competitions/WC/matches?dateFrom=…` | ✅ maybe | SWR.FIXTURES=900s |
| 8 | `getStandings('WC')` | `goalradar:/competitions/WC/standings` | ✅ maybe | SWR.STANDINGS=3600s |

**Worst case (cold start + all KV misses): 5 provider calls**  
**Rate-limiter queue cost: 5 × 7s = 35s minimum blocking time**

### Warm L1 + warm KV snapshot

| # | Function | Result | Latency |
|---|----------|--------|---------|
| 1 | `getMatchDetail` (metadata) | L1 HIT | ~0 ms |
| 2 | `getMatchDetail` (page body) | L1 HIT | ~0 ms |
| 3 | `getOrBuildMatchSnapshot` | KV HIT `goalradar:match:537327` | ~10 ms |
| 4–8 | (Suspense deferred) | React.cache() → instant | 0 ms |

**Provider calls: 0. Total latency: ~10 ms.**

---

## 3. Duplicate Fetch Analysis

### Identified duplicates

| Endpoint | Callers | Source |
|----------|---------|--------|
| `getMatchDetail("537327")` | `generateMetadata` + `MatchDetailPage` + `buildSnapshot` | 3× per render |
| `getOrBuildMatchSnapshot("537327")` | `HeadToHeadDeferred` + `WCGroupSectionDeferred` | 2× per render, **React.cache() deduped** ✅ |

**`generateMetadata` and `MatchDetailPage` both call `getMatchDetail` independently.**  
On warm L1 this is fine (0ms hit). On cold start (new serverless instance), both would miss L1 and race to KV.  
`withCache` inflight dedup handles this: the second miss coalesces with the first.

**`buildSnapshot` also calls `getMatchDetail` internally.**  
If L1 was not populated (because both page-level calls read from KV directly), this is a 3rd KV read for the same key.  
`withCache` inflight map prevents >1 concurrent provider call but not >1 KV read.

### Audit log confirmation

Expected in production logs when duplicate exists:
```
[API-AUDIT] ⚠️  DUPLICATE "/matches/537327" — called 3x in last 3000ms
```

---

## 4. Root Cause of Queue Depth=8–9

```
SWR.MATCH = { fresh: 60s, stale: 120s }
```

After prewarm seeds `goalradar:/matches/{id}` with 6h freshUntil (FUTURE tier), the first
background stale-revalidate triggered by `withKVCache` OVERWRITES the tier-aware TTL:

```
prewarm writes:  freshUntil = now + 21600s   (6h)
user hits at now + 121s  →  KV STALE hit  →  bg revalidate
bg revalidate writes:  freshUntil = now + 60s   (SWR.MATCH.fresh=60s) ← OVERWRITES
next user at now + 182s  →  STALE again  →  bg revalidate  ← and so on every 60s
```

With 104 WC matches, if 50 matches cycle through stale-revalidate concurrently:
- 50 `acquire()` calls in the rate-limiter queue
- 50 × 7s = 350s to drain
- User-facing requests enter queue → TTFB spikes to 7–56s

---

## 5. TTL Mismatch Table

| Key | Written by | TTL / freshUntil | Used by |
|-----|-----------|-----------------|---------|
| `goalradar:/matches/{id}` | prewarm (tier-aware) | FUTURE=6h, FINISHED=24h | `withKVCache` reads freshUntil |
| `goalradar:/matches/{id}` | `withKVCache` bg-revalidate | OVERWRITES with SWR.MATCH.fresh=60s | All detail readers |
| `goalradar:match:{id}` | `writeKVSnapshot` (flat 900s) | 900s TTL | `getOrBuildMatchSnapshot` |
| `goalradar:match:{id}` | prewarm `buildPartialSnapshot` | FUTURE=6h, FINISHED=24h | `getOrBuildMatchSnapshot` |

**Key finding: `withKVCache` overwrites prewarm's tier-aware TTL on every bg-revalidate, resetting to 60s.**  
**Key finding: flat 900s snapshot TTL means snapshot expires 5× per orchestrator interval (30min).**

---

## 6. Provider Calls Inside generateMetadata

```typescript
// page.tsx line 52
const match = await getMatchDetail(numericId);
```

`generateMetadata` calls `getMatchDetail` directly, bypassing the snapshot.  
On warm L1: fine. On cold KV miss: triggers provider call.  
This call is NOT deduplicated with the Suspense sections' `getOrBuildMatchSnapshot` calls  
because they use different functions (not same React.cache key).

---

## 7. Static WC Data — Not Used in buildSnapshot

`getStaticGroupMatches()` is available but only used in `getWCKnockoutMatches()` as a last-resort catch.  
In `buildSnapshot`, if `getUpcomingMatches('WC')` fails (provider unavailable), `wcGroupMatches` and  
`wcAllMatches` are empty arrays. The static fixtures are not consulted.

---

## 8. No Request Coalescing at Snapshot Level

`React.cache()` deduplicates `getOrBuildMatchSnapshot` WITHIN a single render cycle (same request).  
But across concurrent requests (20 users hitting the same uncached match simultaneously):
- Each request independently calls `getOrBuildMatchSnapshot`
- Each misses React.cache (different render contexts)
- Each calls `buildSnapshot(matchId)` concurrently
- `withCache` inflight map handles individual endpoint calls (1 provider call for getMatchDetail)
- But 20 concurrent `buildSnapshot` builds waste KV reads and processing

---

## 9. Summary: Issues to Fix

| # | Issue | Impact | Phase Fix |
|---|-------|--------|-----------|
| 1 | `generateMetadata` calls `getMatchDetail` (not snapshot) | Separate KV/provider path | Phase 7 |
| 2 | Flat 900s snapshot TTL | Snapshot expires 5× per orchestrator run | Phase 5 |
| 3 | `withKVCache` bg-revalidate overwrites prewarm tier-aware TTLs | Provider queue depth | Phase 5 |
| 4 | `buildSnapshot` doesn't read detail from KV before provider | Provider called on KV snapshot miss | Phase 2 |
| 5 | No cross-request snapshot build coalescing | Wasteful concurrent builds | Phase 4 |
| 6 | Static WC data not used in buildSnapshot fallback | Provider called even with static fixtures available | Phase 6 |
| 7 | 3 `getMatchDetail` calls per render (metadata + page + buildSnapshot) | Redundant KV reads | Phase 3 |
| 8 | SWR.MATCH.stale=120s triggers provider revalidation every 2min per match | Queue depth accumulation | Phase 5 |
| 9 | No `/api/debug/match-cache` endpoint | No visibility into coverage | Phase 8 |
