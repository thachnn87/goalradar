# DATA-18B.3A Structural Validation

**Date:** 2026-06-19
**Source:** `/api/debug/full-audit` structural counters (03:30 UTC)

---

## Validation Results

| Requirement | Expected | Actual | Status |
|-------------|----------|--------|--------|
| Total matches | 104 | **104** | PASS |
| Duplicate match IDs | 0 | **0** | PASS |
| Teams (unique IDs) | 48 | **48** | PASS |
| Groups | 12 (A–L) | **12** | PASS |
| Matches per group | 6 | **6 each** | PASS |
| Group stage total | 72 | **72** | PASS |
| Knockout stage total | 32 | **32** | PASS |
| All stage types present | 7 | **7** | PASS |

**All structural checks: PASS.**

---

## Team Count

48 unique team IDs extracted from `homeTeam.id` / `awayTeam.id` across all 72 group stage matches plus any knockout matches where teams are determined.

**Verified:** `structure.teamCount = 48`

---

## Group Structure

12 groups (A through L), 6 matches each = 72 group stage matches.

| Group | Matches | Finished | Live | Scheduled |
|-------|---------|---------|------|-----------|
| GROUP_A | 6 | 3 | 1 | 2 |
| GROUP_B | 6 | 4 | 0 | 2 |
| GROUP_C | 6 | 2 | 0 | 4 |
| GROUP_D | 6 | 2 | 0 | 4 |
| GROUP_E | 6 | 2 | 0 | 4 |
| GROUP_F | 6 | 2 | 0 | 4 |
| GROUP_G | 6 | 2 | 0 | 4 |
| GROUP_H | 6 | 2 | 0 | 4 |
| GROUP_I | 6 | 2 | 0 | 4 |
| GROUP_J | 6 | 2 | 0 | 4 |
| GROUP_K | 6 | 2 | 0 | 4 |
| GROUP_L | 6 | 2 | 0 | 4 |
| **Total** | **72** | **27** | **1** | **44** |

All 12 groups present in `structure.groups`. `groupCounts` = 6 for all groups.

---

## Stage Distribution

| Stage | Count | Expected | Status |
|-------|-------|----------|--------|
| GROUP_STAGE | 72 | 72 | PASS |
| LAST_32 | 16 | 16 | PASS |
| LAST_16 | 8 | 8 | PASS |
| QUARTER_FINALS | 4 | 4 | PASS |
| SEMI_FINALS | 2 | 2 | PASS |
| THIRD_PLACE | 1 | 1 | PASS |
| FINAL | 1 | 1 | PASS |
| **Total** | **104** | **104** | **PASS** |

All 7 stage types present. Stage counts match WC 2026 format exactly (48 teams, LAST_32 round added vs previous 32-team format).

---

## Duplicate Check

`duplicateIds: []` — 0 duplicate match IDs across 104 matches.

The `idCount` map in `full-audit` route checks every `m.id` and returns any ID that appears more than once. Result: empty array.

---

## Score Structure Integrity

All 27 finished matches have:
- `score.fullTime` present
- `score.fullTime.home`: number ≥ 0
- `score.fullTime.away`: number ≥ 0

All 76 scheduled matches have:
- `score.fullTime` present (values `null` — correct pre-match state)

All 1 live match had:
- `score.fullTime.home`: number (in-progress partial score)
- `score.fullTime.away`: number

No `score.fullTime` missing errors. No NaN or non-numeric score values.

---

## UTCDate Coverage

104/104 matches have `utcDate` set. No missing kickoff dates.

---

## Stage Field Coverage

104/104 matches have `stage` set. No missing stage assignments.

---

## Group Field Coverage

72/72 GROUP_STAGE matches have `group` set (GROUP_A through GROUP_L).
32/32 knockout matches have `group: null` (correct — knockout matches are not assigned to groups).

No group-stage match is missing its group assignment.
