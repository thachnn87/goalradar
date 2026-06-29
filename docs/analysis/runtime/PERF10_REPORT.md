# PERF-10 Report — Smart Hot Match Cache
## GoalRadar · Sprint PERF-10

Generated: 2026-06-11
Audit: `PERF10_AUDIT.md` (measured bucket counts + cold-gap defect).

---

## Changes

### Phase 1 — Hot-match prioritization

- New tier **`next-24h`** split out of `next-3d` (`getMatchTier` in
  `src/lib/rate-safe.ts`), unit-verified: 2 h → today · 20 h → next-24h ·
  48 h → next-3d · 9 d → future.
- `TIER_PRIORITY` + hot-first seeding: each prewarm cycle sorts matches
  LIVE → TODAY → NEXT_24H → NEXT_72H → FUTURE → FINISHED before the batch
  loop, so hot matches are always warmed first.

### Phase 2 — Aggressive warming for hot matches

| Bucket | Refresh | Snapshot/Detail TTL |
|--------|---------|---------------------|
| LIVE | every cycle via `refreshLiveMatches` (live-cache owns; snapshots bypass) | — |
| TODAY | every cycle (5-min threshold) | 32 min |
| NEXT_24H | every cycle (15-min threshold) | 32 min |

Hot tiers always outlive a cron cycle → **hot-match cold windows: 0**.

### Phase 3 — Reduced work for cold matches

| Bucket | Before | After |
|--------|--------|-------|
| NEXT_72H | reseed **every cycle** | reseed every **2 h** (TTL 2 h 32 min) |
| FUTURE | reseed every 6 h, **TTL = 6 h → ~30-min cold gap each cycle boundary** | reseed every **12 h**, TTL **12 h 32 min** (gap-free) |
| FINISHED | reseed every 24 h, TTL 24 h (same gap defect) | **reseed only when missing**, TTL **7 d** (scores never change) |

The audit's cold-gap defect (TTL == refresh threshold) is eliminated by the
invariant **TTL = threshold + 32-min cron-safe margin** on every cold tier.

### Phase 4 — Metrics

Each prewarm run writes `goalradar:prewarm:metrics` (KV, 24 h TTL):
`hotMatchCount`, `coldMatchCount`, `snapshotSeedCount`, `skippedFresh`,
`coveragePercent`, `tierBreakdown`, `ts`. `/api/debug/performance` exposes it
as a new **`prewarm`** block together with `snapshotHitRate`
(= live `snapshotPerf.kvHitRate`). KV is used because the cron lambda and the
debug lambda are different processes.

---

## Before / After Workload (per 30-min cycle, steady mid-tournament)

| Work | Before | After |
|------|--------|-------|
| TODAY + NEXT_24H (hot, ~10 matches) | reseeded every cycle (inside next-3d) | reseeded every cycle (unchanged — by design) |
| NEXT_72H (~10 matches) | every cycle ≈ 10 seeds | every 4th cycle ≈ **2.5 seeds** |
| FUTURE (~70 matches) | 70/12 ≈ 5.8 seeds + **cold-gap user rebuilds** | 70/24 ≈ **2.9 seeds**, zero gaps |
| FINISHED (~100 by final) | 100/48 ≈ 2.1 seeds + gap rebuilds | **≈ 0** (only KV evictions) |
| **Total seeds/cycle** | ≈ 28 matches ≈ 112 KV writes | **≈ 15 matches ≈ 60 KV writes** |

**Expected KV write reduction: ~47 %** — while *increasing* coverage,
because the eliminated work was being spent re-seeding still-valid data and
the gaps it left were paid by users as ~7 s provider builds.

## Expected hit-rate improvement

| Metric | Before (measured, PERF-9) | After (expected) |
|--------|---------------------------|------------------|
| Overall KV snapshot hit rate | 11.5 % (cron down) → ~85–92 % (cron up, with cold gaps) | **> 95 %** (gap-free TTLs) |
| Hot-match (live/today/next-24h) hit rate | gap-free already post-PERF-9 | **> 99 %** (reseeded every cycle, 2-min margin, prioritized first) |
| Residual misses | future/finished gap windows | only KV evictions + brand-new fixtures |

Verify in production after the next cron cycles: `prewarm` +
`snapshotPerf.kvHitRate` in `/api/debug/performance`, or re-run the PERF-9
probe (104 × `GET /api/prewarm/match/{id}` → expect ≥ 95 % `hit`).

---

## Constraint Compliance

| Constraint | Status |
|-----------|--------|
| No provider increase | ✅ provider use *decreases* — fewer user-facing cold builds; priority-fetch budget (4/run) unchanged |
| No ISR regression | ✅ no page/route changes; prewarm + debug endpoint only |
| No SEO regression | ✅ zero URL/metadata/sitemap changes |
| No dynamic rendering | ✅ no `headers()`/`cookies()` introduced anywhere |

## Files Changed

| File | Change |
|------|--------|
| `src/lib/rate-safe.ts` | `next-24h` tier, `HOT_TIERS`, `TIER_PRIORITY`, PERF-10 refresh thresholds |
| `src/lib/prewarm/worldcup.ts` | gap-free TTL tables, finished-only-when-missing, hot-first seeding order, `PrewarmMetrics` KV write |
| `src/app/api/debug/performance/route.ts` | new `prewarm` block (hot/cold counts, seed count, snapshotHitRate) |

Build: ✅ · `tsc --noEmit`: 0 errors · tier classification unit-verified.
