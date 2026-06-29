# WC_FEED_RECONCILIATION.md — DATA-18WC.7 Phase 4
**Date:** 2026-06-23  
**Sources:** /api/debug/authority-drift, /api/debug/authority-compare, /api/debug/feed-integrity (production probes)

---

## Feed Drift Matrix

| Check | Result | Count |
|---|---|---|
| Authority drift scope | 44 matches audited | — |
| GREEN (score + state consistent) | 40 | 90.9% |
| YELLOW (lineup missing) | 3 | 6.8% |
| RED (score drift) | 1 | 2.3% |

---

## RED — Score Drift

| Match ID | Fixture | Authority Score | Snapshot Score | Snapshot Age |
|---|---|---|---|---|
| **537371** | Spain vs Saudi Arabia | **4-0** | **5-0** | 35.6 hours stale |

**Root Cause:** The match snapshot for 537371 is 35.6 hours stale. The snapshot says 5-0 but the authority cache (sourced from football-data.org feed) shows 4-0. One of these is incorrect — the snapshot is stale and likely wrong.  
**Action Required:** Force-refresh snapshot for match 537371 immediately.  
**Impact:** The match detail page for Spain vs Saudi Arabia shows incorrect score (5-0 instead of 4-0 or vice versa).

---

## YELLOW — Lineup Missing (3 matches)

| Match ID | Fixture | Score | Snapshot Age |
|---|---|---|---|
| 537369 | Spain vs Cape Verde Islands | 0-0 | 4.9 hours |
| 537354 | Ecuador vs Curacao | 0-0 | 4.9 hours |
| 537365 | Belgium vs Iran | 0-0 | 4.9 hours |

These are scheduled/upcoming matches (score 0-0, no lineup populated yet). Lineups are typically available 1–2 hours before kickoff. The 4.9-hour-old snapshot may predate lineup publication.  
**Action:** Re-enrich these matches ~1h before kickoff to capture lineup data.

---

## YELLOW — UPCOMING Feed Absent from KV

- `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` key is missing
- 3 upcoming matches (MD3 today) are stranded in the FINISHED feed
- Authority cache has 0 upcoming matches until CRON repopulates
- **Next CRON run will fix:** once upcoming CRON job fires, `coldRebuild` (post DATA-18WC.6 fix) will pick up UPCOMING via `readKVOnly` directly

---

## YELLOW — Standings Group Key Format Mismatch

- API returns: `"Group A"`, `"Group B"`, …`"Group L"`
- Code expects: `"GROUP_A"`, `"GROUP_B"`, …`"GROUP_L"`
- Effect: `liveFound=false` for all 12 groups — merge falls back to STATIC source for all standings
- Standing data is correct (served from KV standings key directly), but the group-merge enrichment path is broken

---

## YELLOW — Standings DR KV Absent

- `goalradar:dr:/competitions/WC/standings` key does not exist (`ttlSec: -2`)
- Primary standings KV is fresh (TTL=5112s) — no immediate impact
- Risk: if primary KV expires during an outage, standings revert to static zero-stats skeleton

---

## Authority-Compare Benchmark

All 4 spot-check matches passed — old path vs new path both return 47 matches with identical IDs:

| Match ID | Score | Goals | Gate |
|---|---|---|---|
| 537397 | 3-0 | 3 goals | ✅ |
| 537392 | 1-4 | 5 goals | ✅ |
| 537391 | 3-1 | 4 goals | ✅ |
| 537351 | 7-1 | 8 goals | ✅ |

---

## Feed Consistency Summary

| Feed Pair | Consistency | Notes |
|---|---|---|
| FINISHED feed ↔ Authority | ✅ 47/47 | ID match, no duplicates |
| UPCOMING feed ↔ Authority | ❌ Feed absent | 0 upcoming in KV, 3 TIMED stranded in FINISHED |
| Authority ↔ Snapshots | ⚠️ 1 RED, 3 YELLOW | Score drift on 537371, lineup gaps on 3 upcoming |
| Standings KV ↔ Static | ⚠️ Group key mismatch | Live merge disabled, falls back to static |

---

## Findings

- 🔴 Spain vs Saudi Arabia (537371) score drift: authority=4-0 vs snapshot=5-0 — immediate fix needed
- 🟡 UPCOMING feed absent from KV — next CRON will resolve
- 🟡 3 TIMED matches in FINISHED feed (537405, 537411, 537412)
- 🟡 Standings group key mismatch disables live merge for all 12 groups
- 🟡 Standings DR KV absent
- ✅ No duplicate match IDs
- ✅ Authority-compare benchmark: 4/4 GREEN

**Phase 4 Gate: FEED_RECONCILIATION_YELLOW** (1 RED score drift, 4 YELLOW operational issues — no data corruption, all fixable)
