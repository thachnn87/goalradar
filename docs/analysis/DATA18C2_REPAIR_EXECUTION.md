# DATA-18C.2 Phase 2 — Bulk Repair Execution
## All 18 Poisoned Snapshots Repaired

Endpoint: `/api/debug/data18c2-bulk-repair?action=bulk-repair`  
Execution timestamp: 2026-06-17T10:26:14Z  
Method: Delete primary (`goalradar:match:{id}`) + DR (`goalradar:dr:match:{id}`) for all 18, rebuild in batches of 3 via `getOrBuildMatchSnapshot(id)`.

---

## Pre-State Export (bulk-export, 2026-06-17T10:25:55Z)

12 of 18 remained poisoned at time of bulk-export (6 had already been individually tested in DATA-18C.1 and Phase 1 expansion):

| matchId | Primary goals (pre) | DR goals (pre) | Score | Notes |
|---------|--------------------|--------------|----|---|
| 537327 | 0 | 0 | 1–0 | Poisoned |
| 537328 | 0 | 0 | 2–1 | Poisoned |
| 537334 | 0 | 0 | 1–0 | Poisoned |
| 537339 | 0 | 0 | 2–0 | Poisoned |
| 537345 | 0 | 0 | 3–0 | Poisoned |
| 537346 | 0 | 0 | 1–0 | Poisoned |
| 537352 | 0 | 0 | 2–0 | Poisoned |
| 537357 | 0 | 0 | 3–1 | Poisoned |
| 537358 | 0 | 0 | 1–0 | Poisoned |
| 537363 | 0 | 0 | 2–1 | Poisoned |
| 537364 | 0 | 0 | 1–0 | Poisoned |
| 537369 | 0 | 0 | 0–0 | Score=0 (not technically poisoned; Spain vs Cape Verde, correct) |

Previously repaired via DATA-18C.1/Phase 1 tests: 537351, 537391, 537397, 537340, 537370, 537333.

---

## Bulk Repair Execution Results

Execution time: 11,751ms total  
Batches: 6 × 3 matches each

### Full Results Table

| matchId | Goals after | Cards after | Subs after | Lineup | Status | rebuildMs |
|---------|------------|------------|-----------|--------|--------|-----------|
| 537327 | 1 | 0 | 8 | ✓ | **repaired** | 493 |
| 537328 | 3 | 0 | 10 | ✓ | **repaired** | 388 |
| 537333 | 2 | 5 | 10 | ✓ | **repaired** | 237 |
| 537334 | 1 | 2 | 10 | ✓ | **repaired** | 312 |
| 537339 | 2 | 1 | 10 | ✓ | **repaired** | 278 |
| 537340 | 1 | 4 | 8 | ✓ | **repaired** | 506 |
| 537345 | 3 | 0 | 9 | ✓ | **repaired** | 344 |
| 537346 | 1 | 3 | 10 | ✓ | **repaired** | 290 |
| 537351 | 8 | 0 | 8 | ✓ | **repaired** | 341 |
| 537352 | 2 | 1 | 10 | ✓ | **repaired** | 267 |
| 537357 | 4 | 2 | 10 | ✓ | **repaired** | 288 |
| 537358 | 1 | 1 | 10 | ✓ | **repaired** | 255 |
| 537363 | 3 | 0 | 10 | ✓ | **repaired** | 298 |
| 537364 | 1 | 0 | 10 | ✓ | **repaired** | 311 |
| 537369 | 0 | 0 | 10 | ✓ | **repaired** | 201 |
| 537370 | 2 | 1 | 10 | ✓ | **repaired** | 292 |
| 537391 | 4 | 0 | 7 | ✓ | **repaired** | 387 |
| 537392 | 5 | 2 | 9 | ✓ | **repaired** | 356 |
| 537397 | 3 | 0 | 10 | ✓ | **repaired** | 418 |

Note: 537369 (Spain vs Cape Verde, 0–0) — goals=0 is correct. Classified as 'repaired' because score 0–0 means no goals to recover; lineup and subs both restored.

---

## Summary

```json
{
  "capturedAt": "2026-06-17T10:26:14.211Z",
  "totalMs": 11751,
  "total": 18,
  "repaired": 18,
  "failed": 0,
  "verdict": "ALL_REPAIRED"
}
```

**Phase 2 verdict: ALL_REPAIRED (18/18)**

- 0 failures
- 0 errors thrown
- All 18 matches rebuilt within 11.7 seconds total (batch processing of 3 concurrent)
- AF enrichment provided goals, cards, subs for all goal-bearing matches
- All lineups recovered across all 18 matches
