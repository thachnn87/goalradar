# Match Latency Report — PERF-7B
## GoalRadar · Sprint PERF-7B: Match Page Instant Open

Generated: 2026-06-10

---

## Goal

Match detail pages (`/match/[id]`, `/predict/[id]`) must open in **under 500 ms** from
cache. Success criterion: **p95 < 500 ms** for cached requests.

---

## Phase 1 — Timing Breakdown

### Latency paths for `getOrBuildMatchSnapshot(matchId)`

| Path | Condition | Est. latency | p95 target met? |
|------|-----------|-------------|-----------------|
| **KV snapshot HIT** | `goalradar:match:{id}` in KV | 8–25 ms | ✅ |
| **Build — detail in KV** | Snapshot expired, detail key warm | 30–120 ms | ✅ |
| **Build — provider fallback** | Both snapshot & detail KV miss | 200–2 000 ms | ❌ without prewarm |
| **Disaster recovery** | Build threw + DR key exists | 15–35 ms | ✅ |

### React.cache() deduplication

`generateMetadata()` and the page component both call `getOrBuildMatchSnapshot(id)`.
The function is wrapped with `React.cache()`, so the async work runs exactly **once per
request** — the second call (`await` in the page component) resolves immediately from
the memoised promise. No duplicate KV reads.

This means `_latencyMs` in the page component's `[MATCH_LATENCY]` log line measures the
second (memoised) call: ≈ 0 ms. The accurate latency is now recorded by
`recordSnapshotFetch()` inside `getOrBuildMatchSnapshot` itself.

### Accurate latency measurement (added)

`recordSnapshotFetch(latencyMs, source)` is now called at every exit point of
`getOrBuildMatchSnapshot`:

| Exit | Source label |
|------|-------------|
| `readKVSnapshot()` returned a hit | `'kv'` |
| `buildSnapshot()` succeeded via KV detail | `'build-kv'` |
| `buildSnapshot()` called provider | `'build-provider'` |
| DR key served after build failure | `'dr'` |

Read via `/api/debug/performance` → `snapshotPerf.{p50,p95,p99,kvHitRate}`.

---

## Phase 2 — Precomputed Snapshot Coverage

### Root cause of cold builds (before this sprint)

The prewarm cron runs every **30 minutes**. The previous KV TTLs for short-lived match
tiers were shorter than the cron interval, creating guaranteed cold windows:

| Tier | Old snapshot TTL | Old detail TTL | Cold window per cycle |
|------|-----------------|----------------|----------------------|
| `today` | 360 s (6 min) | 300 s (5 min) | **24 min** out of 30 |
| `next-3d` | 961 s (16 min) | 900 s (15 min) | **14 min** out of 30 |
| `future` | 21 600 s (6 h) | 21 600 s (6 h) | < 1 min (negligible) |
| `finished` | 86 400 s (24 h) | 86 400 s (24 h) | < 1 min (negligible) |

During the cold window both the snapshot **and** the detail key are expired. The first
user request triggers `buildSnapshot()` → `getMatchDetail()` → **provider call** → up to
2 000 ms latency.

### Fix: TTLs extended beyond cron interval

New TTL for `today` / `next-3d`: `CRON_SAFE_TTL = 1 920 s = 32 min`
(= 30-min cron interval + 2-min safety margin).

| Tier | New snapshot TTL | New detail TTL | Cold window per cycle |
|------|-----------------|----------------|----------------------|
| `today` | **1 920 s (32 min)** | **1 920 s (32 min)** | **0 min** ✅ |
| `next-3d` | **1 920 s (32 min)** | **1 920 s (32 min)** | **0 min** ✅ |
| `future` | 21 600 s (6 h) | 21 600 s (6 h) | 0 min ✅ |
| `finished` | 86 400 s (24 h) | 86 400 s (24 h) | 0 min ✅ |

With 32-min TTLs and a 30-min cron, entries written by one prewarm run remain valid
when the next run fires. The prewarm re-seeds them (skip-if-fresh check uses
`TIER_REFRESH_SEC[tier]` which is unchanged: 5 min for today, 15 min for next-3d),
resetting the TTL for another 32 minutes.

### Prewarm performance optimisation

**Before:** 104 sequential `kv.get()` calls for freshness checks = ~1 040 ms.

**After:** one `kv.mget(...104 keys)` = ~10 ms, then seeding in parallel batches of 10.

| Step | Before | After |
|------|--------|-------|
| Freshness check (104 matches) | 104 × kv.get ≈ 1 040 ms | 1 × kv.mget ≈ 10 ms |
| Seeding stale matches | Sequential for-await | Promise.all batches of 10 |
| Total prewarm (all fresh) | ~1 050 ms | ~30 ms |
| Total prewarm (all stale, 104 writes) | ~5–8 s | ~500–800 ms |

---

## Phase 3 — Metadata Cache

**No code changes required.**

`generateMetadata()` and the page component call the same `React.cache()`-wrapped
`getOrBuildMatchSnapshot(matchId)`. Both receive the same memoised promise. Total KV
reads per request: **1** (from `generateMetadata`, first call).

---

## Phase 4 — Latency Projections

### WC match pages (warm — prewarm covers all 104 matches)

After PERF-7B, WC match snapshots are always valid between cron runs (32-min TTL > 30-min
cron). The vast majority of WC match page requests hit the KV snapshot.

| Percentile | Expected latency | Source |
|-----------|----------------|--------|
| p50 | 10–20 ms | KV snapshot HIT |
| p95 | 15–40 ms | KV snapshot HIT (tail: network jitter) |
| p99 | 30–80 ms | KV snapshot HIT (cold start / jitter) |

**p95 target met: ✅ (estimated < 500 ms)**

### Non-WC match pages (not prewarmed)

| Percentile | Expected latency |
|-----------|----------------|
| p50 | 10–30 ms (if KV detail exists from prior visit) |
| p95 | 10–120 ms (mostly KV hit) |
| p99 | 100–2 000 ms (occasional full cold start) |

Non-WC cold builds trigger provider calls. For the WC 2026 tournament, all match pages
are WC pages and fully covered by `prewarmWorldCup()`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/match-perf-tracker.ts` | Added `p50`/`p99` to `getMatchPerfStats()`; added `recordSnapshotFetch()` + `getSnapshotPerfStats()` for accurate in-snapshot timing |
| `src/lib/match-snapshot.ts` | Import `recordSnapshotFetch`/`getDataSourceStats`; call `recordSnapshotFetch` at every exit point of `getOrBuildMatchSnapshot` |
| `src/lib/prewarm/worldcup.ts` | Extended `DETAIL_STALE_SEC`/`SNAPSHOT_STALE_SEC` for today/next-3d from 5–16 min to 32 min; replaced sequential `kv.get` loop with `kv.mget` batch + `Promise.all` batches of 10 |

---

## Latency API

```
GET /api/debug/performance
```

Response now includes `snapshotPerf`:

```json
{
  "snapshotPerf": {
    "total": 1234,
    "kvHits": 1189,
    "buildKvHits": 39,
    "buildProvHits": 6,
    "drHits": 0,
    "kvHitRate": 96,
    "p50": 14,
    "p95": 28,
    "p99": 67
  }
}
```

**Success criterion:** `snapshotPerf.p95 < 500` ✅ (target value; verify in production after next deploy).

---

## TypeScript

```
npx tsc --noEmit → 0 errors
```
