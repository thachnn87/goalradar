# PERF-2 Audit — Cache-First Architecture
## GoalRadar · /match/[slug]

Generated: 2026-06-09

---

## 1. Full Request Trace: /match/[id]

### 1.1 Request lifecycle (after PERF-1 + PERF-2)

```
Browser
  │
  ├─ HTTP GET /match/537327-mexico-vs-south-africa
  │
  ▼
Next.js App Router (server component)
  │
  ├── generateMetadata()
  │     └─ getMatchDetail(id)
  │           └─ withCache (L1 in-memory, TTL 60s)
  │                 HIT  → return immediately                         ~0 ms
  │                 MISS → withKVCache (L2 Vercel KV, SWR 60s/120s)
  │                           [SWR] cache-hit  → return              ~10 ms
  │                           [SWR] stale-hit  → return + bg-refresh ~10 ms
  │                           MISS → providerManager.getMatch(id)
  │                                    footballDataLimiter.acquire()  ~0-7000 ms
  │                                    football-data HTTP fetch        ~200-800 ms
  │
  ├── MatchDetailPage()
  │     └─ getMatchDetail(id)    ← same cache path as above
  │          [React.cache() deduplicates with generateMetadata call]
  │          Score hero renders immediately on return.
  │
  ├── <Suspense fallback={<HeadToHeadSkeleton />}>
  │     HeadToHeadDeferred()
  │       └─ getOrBuildMatchSnapshot(id)  [React.cache() deduplicated]
  │             readKVSnapshot()    KV key: goalradar:match:{id}     ~10 ms
  │               HIT  → [Snapshot] HIT   → return snapshot
  │               MISS → buildSnapshot()
  │                       ├─ getMatchDetail(id)   L1 HIT (already fetched above) ~0 ms
  │                       ├─ getHeadToHead(id)    KV → football-data
  │                       ├─ getUpcomingMatches   KV → football-data (WC only)
  │                       ├─ getRecentMatches     KV → football-data (WC only)
  │                       └─ getStandings         KV → football-data (WC only)
  │             H2H section streams in when snapshot resolves.
  │
  └── <Suspense fallback={<WCGroupSectionSkeleton />}>
        WCGroupSectionDeferred()
          └─ getOrBuildMatchSnapshot(id)  [React.cache() → 0 extra calls]
               WC standings preview, group matches, related,
               next/prev nav stream in together.
```

### 1.2 Waterfall diagram

```
Time (ms) →   0    10   50   100  200  300  500  1000   7000
              │    │    │    │    │    │    │    │      │
generateMeta  ├────┤    (L1 hit)
              │    ├────┤   (KV hit, SWR fresh)
              │         ├───────┤  (KV stale, bg-revalidate)
              │              └─────────────────────────┤  (provider, no queue wait)
              │                                └────────────────────────────────┤ (provider, queue depth 1)
              │
MatchPage     ├────┤    (React.cache → 0ms, deduplicates with meta)
SCORE HERO    ← renders here ────────────────────────────────────────────────────
              │
H2H Suspense  ├────────────────────────────────┤  (snapshot KV hit, ~10ms)
              │         └─────────────────────────────────────────────────────┤  (snapshot build)
              │
WC Group      ── same snapshot as H2H (React.cache deduplicated, 0 extra calls) ──
```

---

## 2. Cache Architecture (Post PERF-1 + PERF-2)

### 2.1 Data source priority (Phase 5)

| Priority | Tier | Key / Scope | Latency | TTL |
|----------|------|-------------|---------|-----|
| 1 | L1 in-memory (`withCache`) | Per-process | ~0 ms | 60 s (MATCH) |
| 2 | L2 Vercel KV fresh (`withKVCache`) | Shared across instances | ~10 ms | 60 s fresh / 120 s stale |
| 3 | L2 Vercel KV stale (SWR) | Shared across instances | ~10 ms | Serves stale, triggers bg-refresh |
| 4 | L2 KV snapshot (`goalradar:match:{id}`) | Per-match composite | ~10 ms | 900 s |
| 5 | L2 KV disaster-recovery (`goalradar:dr:*`) | 7-day emergency | ~10 ms | 604 800 s |
| 6 | L3 Static WC dataset (`fixtures.json`) | Bundled, 104 matches | ~0 ms | n/a |
| 7 | L3 football-data.org (primary provider) | Network | 200–800 ms + queue | n/a |
| 8 | L3 api-football (emergency, disabled by default) | Network | 200–800 ms | n/a |

### 2.2 Score hero fast path

- `getMatchDetail()` → L1 → KV SWR → provider
- `generateMetadata()` and `MatchDetailPage()` both call `getMatchDetail()`
- React's per-request cache (`React.cache()`) deduplicates: **only 1 fetch total**
- KV warm: score hero renders in **~10 ms** (KV hit) or **~0 ms** (L1 hit)
- Provider cold miss: score hero renders in **~200–800 ms** (no queue) or up to **7 s** (queue depth 1)

### 2.3 H2H / WC sections (deferred streaming)

- Wrapped in `<Suspense>` with animated skeletons
- `getOrBuildMatchSnapshot()` wrapped with `React.cache()` — both `HeadToHeadDeferred` and `WCGroupSectionDeferred` share **1 snapshot read**
- Snapshot KV hit: sections stream in ~10 ms after the score hero
- Snapshot build (miss): parallel fetch of 4 endpoints; with warm individual-endpoint KV caches, typically **~50–150 ms**

---

## 3. Blocking Provider Calls — Before/After

### Before PERF-1 (baseline)

| Scenario | TTFB | Blocking calls | Notes |
|----------|------|----------------|-------|
| KV warm | ~15 ms | 0 | Snapshot KV hit served everything |
| KV stale | ~15 ms + bg | 0 | Served stale, bg triggered |
| Cold miss, no queue | ~35 000 ms | 5 | `generateMetadata` awaited `getOrBuildMatchSnapshot` → 5 API calls × 7s queue slot each |
| Cold miss, queue depth 4 | up to ~210 000 ms | 5 | Worst case: 5 calls × 4 deep × 7 s |

### After PERF-2

| Scenario | TTFB | Blocking calls | Notes |
|----------|------|----------------|-------|
| L1 hit | ~0 ms | 0 | Score hero from in-memory |
| KV fresh | ~10 ms | 0 | `[SWR] cache-hit`; queue bypassed |
| KV stale | ~10 ms | 0 | `[SWR] stale-hit`; bg-refresh in background |
| Cold miss, no queue | ~200–800 ms | 1 | Only `getMatchDetail`; H2H/WC stream later |
| Cold miss, queue depth 1 | ~7 200 ms | 1 | Only `getMatchDetail` waits; H2H/WC stream later |
| Full outage (KV + provider) | ~0 ms (static) | 0 | Static WC fixtures served from bundled data |

### Improvement summary

| Metric | Before | After | Δ |
|--------|--------|-------|---|
| Worst-case TTFB (cold, queue-4) | ~210 s | ~7 s | **−97%** |
| Blocking provider calls (cold) | 5 | 1 | **−80%** |
| Score hero blocking (KV warm) | 0 ms | 0 ms | unchanged |
| Provider calls avoided (KV hit) | counted | `queueBypassedCount` | observable |

---

## 4. Queue Bypass Analysis (Phase 6)

### How the queue bypass works

1. `withCache` (L1) returns immediately on hit — `footballDataLimiter.acquire()` never called.
2. `withKVCache` FRESH hit (`[SWR] cache-hit`) — fetcher never invoked, queue never entered.
3. `withKVCache` STALE hit (`[SWR] stale-hit`) — data returned immediately; background refresh enters queue but the **user never waits for it**.
4. Only a true L1+L2 MISS causes the user to enter the queue.

### Observability

`GET /api/debug/performance` (ADMIN_SECRET required) now returns:

```json
{
  "kv": {
    "queueBypassedCount": 1843,
    "staleServedCount":   214,
    "providerCallsAvoided": 1843
  },
  "rateLimiter": {
    "totalWaits":       12,
    "totalWaitMs":      84000,
    "avgProviderWaitMs": 7000
  }
}
```

---

## 5. SWR Log Reference (Phase 3)

| Log line | Meaning |
|----------|---------|
| `[SWR] cache-hit /competitions/WC/standings` | KV fresh hit; returned immediately, queue bypassed |
| `[SWR] stale-hit /competitions/WC/standings` | KV stale hit; returned immediately, bg-refresh firing |
| `[SWR] refresh-start /competitions/WC/standings` | Background revalidation started |
| `[SWR] refresh-complete /competitions/WC/standings` | Background revalidation written to KV |
| `[SWR] refresh-failed /competitions/WC/standings: ...` | Background revalidation failed (non-fatal) |
| `[MATCH_RENDER] kv \| matchId=537327 \| ms=11` | Score hero served from KV in 11 ms |
| `[MATCH_LATENCY] ms=11 \| matchId=537327 \| source=kv` | Same event, for metrics |
| `[Snapshot] HIT  match:537327 \| age 42s` | H2H/WC sections from snapshot KV |
| `[Snapshot] MISS match:537327 — building snapshot` | Cold snapshot build |
| `[DATA_SOURCE] static` | Bundled fixtures.json served (full outage path) |
| `[QUEUE] football-data \| depth=2 \| waiting for slot` | Provider queue entered (cache miss) |

---

## 6. Verified Page-by-Page Cache Coverage

| Page | Primary data | KV TTL | Provider bypass on hit |
|------|-------------|--------|------------------------|
| `/match/[id]` — score hero | `getMatchDetail` | 60 s fresh / 120 s stale | ✅ `[SWR] cache-hit/stale-hit` |
| `/match/[id]` — H2H/WC | `getOrBuildMatchSnapshot` | 900 s (snapshot key) | ✅ `[Snapshot] HIT` |
| `/world-cup-2026` | `getUpcomingMatches`, standings, knockout | SWR.WC 6 h / 12 h | ✅ static fallback on full outage |
| `/world-cup-2026/fixtures` | `getUpcomingMatches('WC')` | SWR.FIXTURES 15 min / 30 min | ✅ |
| `/world-cup-2026/results` | `getRecentMatches('WC')` | SWR.FIXTURES 15 min / 30 min | ✅ |
| `/world-cup-2026/groups` | `getStandings('WC')` | SWR.STANDINGS 1 h / 2 h | ✅ |
| `/world-cup-2026/bracket` | `getWCKnockoutMatches` | SWR.WC 6 h / 12 h | ✅ static fallback on full outage |
| `/schedule` | `getUpcomingMatches` | SWR.FIXTURES 15 min / 30 min | ✅ |
| `/live` | `getLiveMatches` | SWR.LIVE 30 s / 60 s | ✅ (freshness required; stale acceptable) |

---

## 7. Feature Flag: ENABLE_API_FOOTBALL=false

When `ENABLE_API_FOOTBALL=false` (Sprint RES-5):

- api-football is never called automatically
- `withFailover` throws primary error immediately → propagates to KV DR path
- DR snapshot → static WC dataset are the only fallbacks
- `[PROVIDER] api-football disabled (ENABLE_API_FOOTBALL=false) | skipping failover` logged

New fallback chain:
```
football-data → KV SWR (fresh) → KV SWR (stale + bg) → KV DR (7d) → static fixtures.json
```

---

## 8. Remaining Work / Recommendations

| Item | Priority | Notes |
|------|----------|-------|
| Pre-warm KV on deploy | Medium | Hit `/api/debug/prewarm-status` to populate snapshot keys for scheduled WC matches |
| Live match polling | Medium | `revalidate = 30` + `SWR.LIVE` already handles; consider `router.refresh()` on client for live pages |
| Snapshot TTL tuning | Low | 900 s may be too long for in-progress matches; consider status-aware TTL (live → 30 s, scheduled → 3600 s) |
| CDN edge caching | Low | `Cache-Control: s-maxage=60, stale-while-revalidate=120` would add a 4th cache tier at the CDN edge |
| `avgProviderWaitMs` alert | Low | Alert if `avgProviderWaitMs > 14000` (2× the 7 s/slot interval, meaning sustained queue depth ≥ 2) |
