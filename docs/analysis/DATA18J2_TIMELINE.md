# DATA-18J.2 Phase 1 — Production Timeline

Date: 2026-06-17  Captured at refNowMs **1781716986654** (single instant, all reads near-simultaneous).
Source: live `https://www.goalradar.org` debug endpoints (Bearer CRON_SECRET). **AUDIT ONLY.**

---

## Captured ages (relative to capture instant)

| Match | snapshot age | detail age | ESPN cache age | snap goals | ESPN goals |
|-------|-------------|-----------|----------------|-----------|-----------|
| 537328 | **37.9 min** | **37.9 min** | 856.0 min (~14.3 h) | 0 | 3 |
| 537351 | **37.9 min** | **37.9 min** | 856.0 min | 0 | 8 |
| 537391 | **37.9 min** | **37.9 min** | 856.2 min | 0 | 4 |
| 537392 | **37.9 min** | **38.0 min** | 855.8 min | 0 | 5 |
| 537397 | **37.9 min** | **38.0 min** | 831.1 min (~13.9 h) | 0 | 3 |

(snapshot/detail age from `/api/debug/match-state/{id}`; ESPN cache age + goals from `/api/debug/espn-enrichment/{id}`.)

---

## Reconstructed timeline per match (identical shape for all 5)

```
T-14.3h   buildSnapshot runs (organic page visit)
          → enrichMatchWithEspnEvents fresh-fetch → ESPN event cache WRITTEN (goals 3..8)
          → enriched snapshot written (goals>0) + DR written (goals>0)        [ESPN age proves this]

(between) primary snapshot goalradar:match:{id} evicted / cycled out

T-37.9m   ORCHESTRATOR PREWARM batch cycle (prewarmWorldCup → seedMatch)
          → writes detail key  goalradar:/matches/{id}        (worldcup.ts:337)
          → AF-only enrich attempt → AF lookup table absent → goals=0
          → writes snapshot key goalradar:match:{id} goals=0  (worldcup.ts:380, raw kv.set)
          → SKIP-DR (poison guard) — DR left at its earlier enriched value
          ALL FIVE matches stamped within the SAME pass → identical 37.9-min age

T-0       capture: snapshot goals=0, detail+snapshot ages locked together at 37.9 min,
          ESPN cache still holds the events (goals 3..8), unused
```

---

## What the timestamps prove

1. **ESPN cache (≈14 h) ≫ snapshot age (37.9 min).** The events were already cached for ~14 h when the current snapshot was written. A writer that consulted ESPN would have produced goals>0. The 37.9-min writer did not → it is **not** `buildSnapshot`.

2. **detail age == snapshot age (both 37.9 min) for every match.** The same writer wrote *both* keys in the same operation. `buildSnapshot`/`prewarmMatchSnapshotKVOnly` **read** the detail key and write only the snapshot — they cannot make detail and snapshot share an age. Only `seedMatch` writes both (worldcup.ts:337 + 380).

3. **All 5 matches share one age (37.9 min) to ±0.1 min.** A batch pass over the WC match list stamped them together. Per-request writers (page visit, hover-prewarm) would scatter ages across user activity. This is a single cron cycle = `prewarmWorldCup`.

Cron execution evidence: `prewarmWorldCup()` is invoked by `/api/cron/orchestrator:219` and `/api/cron/prewarm-worldcup`. (Per-execution server logs are not exposed via tooling; the lockstep timestamps are the observable proxy for the batch run.)
