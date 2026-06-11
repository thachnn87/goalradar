# PERF-10 Audit — Smart Hot Match Cache
## GoalRadar · Sprint PERF-10

Generated: 2026-06-11 (tournament day 1)

---

## Current Pipeline (post PERF-9)

- Orchestrator triggered every 30 min by GitHub Actions (PERF-9).
- `prewarmWorldCup()`: bulk WC matches from KV → `kv.mget` freshness batch →
  parallel seeding (batches of 10, PERF-7B) → 4 priority full-detail fetches.
- Snapshot consumers: `/match/[id]`, `/predict/[id]` only.
- Sitemap/4 lists match + predict pages for recent + upcoming matches —
  Googlebot traffic hits the same snapshot keys as users.
- Homepage / live / schedule / WC hub render from list caches (no snapshot
  reads) but seed prewarm hints for their first 10 visible matches (PERF-8).

## Current tier config (before PERF-10)

| Tier | Refresh threshold | Snapshot TTL | Detail TTL | Behaviour per 30-min cron |
|------|------------------|--------------|-----------|---------------------------|
| live | 30 s | (not written — live-cache owns) | 60 s | skipped by seedMatch |
| today | 5 min | 32 min | 32 min | reseeded **every cycle** ✅ |
| next-3d | 15 min | 32 min | 32 min | reseeded **every cycle** — more work than needed |
| future | 6 h | **6 h** | **6 h** | reseed every 12th cycle — **TTL = threshold → ~29-min cold gap** ⚠ |
| finished | 24 h | **24 h** | **24 h** | reseed every 48th cycle — **same cold-gap defect** ⚠ |

### ⚠ Defect found: TTL == refresh-threshold cold windows

For `future` and `finished`, the KV TTL equals the skip-if-fresh threshold.
A snapshot written at cycle N is *skipped* at every cycle while fresh, then
**expires before the cycle that would reseed it** (threshold reached between
runs). Result: each future match goes cold for up to ~30 min every 6 h, each
finished match every 24 h — exactly the buckets with the most matches.

## Measured bucket counts (real fixture data, day 1)

| Bucket | Count now | Mid-tournament estimate | Traffic importance |
|--------|----------|------------------------|--------------------|
| LIVE | 0 | 2–4 during match windows | **extreme** (live scores) |
| TODAY | 1 (opener) | 4–6 | **very high** |
| NEXT_24H | 1 | 4–6 | **high** (predictions peak pre-match) |
| NEXT_72H | 8 | 12–16 | medium |
| FUTURE | 94 | shrinks daily | low per match (long-tail SEO) |
| FINISHED | 0 | grows to 104 | medium-low (results queries decay fast) |

## Current prewarm cost (per 30-min cycle, steady mid-tournament)

| Work | Matches | KV writes (4/match) |
|------|---------|--------------------|
| today + next-3d reseed every cycle | ~18–22 | ~80 |
| future reseed (every 12th cycle, amortised) | 70/12 ≈ 6 | ~24 |
| finished reseed (every 48th cycle, amortised) | 100/48 ≈ 2 | ~8 |
| **Total ≈ 28 matches/cycle ≈ 112 KV writes/cycle** | | |

Plus the hidden cost: cold-gap rebuilds on user requests (provider, ~7 s)
for future/finished matches caught in the TTL gap.

## Fix Plan (PERF-10 phases)

| Bucket | Refresh threshold | Snapshot/Detail TTL | Change |
|--------|------------------|---------------------|--------|
| LIVE | every cycle (live-cache + refreshLiveMatches) | bypass | unchanged |
| TODAY | every cycle (5 min) | 32 min | unchanged (already aggressive) |
| **NEXT_24H** (new bucket) | every cycle (15 min) | 32 min | split out of next-3d; always hot |
| NEXT_72H | **2 h** | **2 h 32 min** | was every cycle — 4× less work |
| FUTURE | **12 h** | **12 h 32 min** | was 6 h — 2× less work, **cold gap eliminated** (TTL = threshold + cron-safe margin) |
| FINISHED | **only when missing** | **7 days** | scores never change; rebuild only on eviction |

Seeding order becomes priority-sorted (LIVE → TODAY → NEXT_24H → NEXT_72H →
FUTURE → FINISHED) so hot matches are seeded first in every cycle.

Metrics (`hotMatchCount`, `coldMatchCount`, `snapshotSeedCount`, tier
breakdown) written to KV by each prewarm run and surfaced in
`/api/debug/performance` (alongside the existing `snapshotPerf.kvHitRate`).
