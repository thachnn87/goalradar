# DATA-18B.3B Phase 5 — 24h Burn-in Observation

**Date:** 2026-06-19
**Burn-in Start:** 2026-06-19T03:47:26 UTC (first bracket ISR revalidation)
**Burn-in End:** 2026-06-20T03:47 UTC (24h mark)
**Status: IN PROGRESS**

---

## Observation Window

| # | Scheduled (UTC) | Collected | Source | Latency | Errors | Score Drift | State Drift |
|---|----------------|-----------|--------|---------|--------|------------|-------------|
| 1 | 03:47:26 | ✅ 2026-06-19T03:47:26 | cold | 543ms | 0 | 0 | 0 |
| 2 | ~09:47 | ⏳ Pending | — | — | — | — | — |
| 3 | ~15:47 | ⏳ Pending | — | — | — | — | — |
| 4 | ~21:47 | ⏳ Pending | — | — | — | — | — |
| 5 | ~2026-06-20T03:47 | ⏳ Pending | — | — | — | — | — |

**ISR interval:** `revalidate = 21600` (6 hours). Expected ~4–5 bracket revalidations in 24h.

---

## Observation 1 — 2026-06-19T03:47:26 UTC

**Source:** `/api/debug/authority-adoption` (collected at 04:04 UTC, ~16 minutes post-revalidation)

| Field | Value |
|-------|-------|
| Route | `/world-cup-2026/bracket` |
| Cache path | cold rebuild |
| Latency | 543ms |
| Errors | 0 |
| Score drift | 0 |
| State drift | 0 |
| RED issues | 0 |
| Bracket renders | ✅ (32/32 TBD slots correct) |

**Normal.** Cold rebuild expected given DR staleness state (pre-existing orchestrator outage).

---

## What Burns In

The 24h burn-in observes whether the bracket pilot introduces any new failure modes over multiple ISR cycles:

1. **Rendering correctness**: Does the bracket render all 32 knockout slots without error across 4+ revalidation cycles?
2. **Attribution correctness**: Does each bracket revalidation log correctly to authority telemetry?
3. **Latency stability**: Does bracket latency remain in the expected range (50–1500ms)?
4. **No new RED issues**: Does any bracket match produce a RED consistency gate?
5. **No interaction with other routes**: Do the other 6 WC routes show any change in behavior?

---

## Expected Behavior During Burn-in

Given current operational state (orchestrator cron down, DR stale):

- **Cold rebuild on each bracket revalidation**: Expected. All knockout matches are TBD, so no score/state can drift from cold rebuild.
- **543ms latency per bracket revalidation**: Expected for cold rebuild. Will improve to ~50ms once orchestrator is restarted and primary is warm.
- **No bracket-specific errors**: Expected. `canonicalToMatch()` adapter handles TBD gracefully.
- **Accumulating reads in telemetry**: Each 6h bracket ISR adds +1 to bracket attribution reads.

---

## Burn-in Pass Criteria

All of the following must hold across all observed revalidation cycles:

| Criterion | Threshold | Status |
|-----------|-----------|--------|
| Errors per bracket revalidation | 0 | ✅ (obs 1) |
| Score drift | 0 | ✅ (obs 1) |
| State drift | 0 | ✅ (obs 1) |
| New RED issues | 0 | ✅ (obs 1) |
| Bracket attribution reads | ≥4 by 03:47 UTC 2026-06-20 | 1/4 (obs 1 only) |
| Latency per revalidation | < 2000ms | ✅ 543ms |
| Other routes unaffected | No new issues | ✅ (obs 1) |

---

## Burn-in Monitoring Commands

```bash
# Check bracket attribution
curl "https://www.goalradar.org/api/debug/authority-adoption?secret=$CRON_SECRET" \
  | jq '.today.ranked[] | select(.route == "/world-cup-2026/bracket")'

# Check authority freshness
curl "https://www.goalradar.org/api/debug/authority-freshness?secret=$CRON_SECRET"

# Full consistency check
curl "https://www.goalradar.org/api/debug/full-audit?secret=$CRON_SECRET" \
  | jq '{totalMatches, byState, authority, snapshots, consistency}'
```

---

## Current Operational Context

| Metric | Value |
|--------|-------|
| Orchestrator cron | **DOWN** (last write 02:19 UTC) |
| DR staleness | **STALE** (liveCount=1 from 02:19, now 6211s old) |
| Primary KV | **ABSENT** (expired) |
| Write-back mechanism | **ACTIVE** (restores primary for ~5 min after each cold rebuild) |
| User-visible data | **CORRECT** (cold rebuild reads live from FD API) |

The operational degradation does not affect data correctness — only ISR revalidation latency. User page loads serve the ISR-cached static page regardless.

---

## Next Action

Collect observation 2 at ~09:47 UTC (2026-06-19) by re-querying `/api/debug/authority-adoption` and checking bracket reads count. Update this document with each observation.

**Final burn-in verdict to be recorded in DATA18B3B_FINAL_VERDICT.md after 2026-06-20T03:47 UTC.**
