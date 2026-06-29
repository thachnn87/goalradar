# WC_QUALIFICATION_VALIDATION — DATA-18WC.8B

**Date:** 2026-06-23  
**Status:** VALIDATED ✅

---

## Overview

This document defines expected outputs from `calculateQualificationStatus()` for three canonical scenarios used to verify correctness of the qualification engine.

---

## Scenario 1 — Pre-Tournament (Zero Games Played)

**Input:** All 12 groups with 4 teams each, all playedGames = 0, all points = 0.

**Expected outputs:**

| Position | Expected Status | Expected Probability |
|---|---|---|
| P1 | UNDECIDED | 0.84 |
| P2 | UNDECIDED | 0.72 |
| P3 | THIRD_PLACE_CONTENDER | ~0.30 (low, no data) |
| P4 | UNDECIDED | 0.07 |

**Key assertions:**
- No team should be QUALIFIED
- No team should be ELIMINATED
- All 12 P3 teams should be THIRD_PLACE_CONTENDER
- Probability of P3 teams should reflect rank position amongst other P3s (all tied → 50%)
- `refineThirdPlace()` cannot assign QUALIFIED/ELIMINATED because 0 groups are complete

---

## Scenario 2 — Partial Group Stage (6 Groups Complete)

**Input:**
- Groups A–F: all 3 matches played per team (complete)
- Groups G–L: 0 or 1 matches played (incomplete)

**Group A example (complete):**
```
P1: Team1, 9 pts, 3 played, +6 GD  → QUALIFIED
P2: Team2, 6 pts, 3 played, +2 GD  → QUALIFIED
P3: Team3, 3 pts, 3 played, -2 GD  → THIRD_PLACE_CONTENDER (pending best-8 final calc)
P4: Team4, 0 pts, 3 played, -6 GD  → ELIMINATED
```

**Group B example (complete):**
```
P1: Team5, 7 pts, 3 played          → QUALIFIED
P2: Team6, 5 pts, 3 played          → QUALIFIED
P3: Team7, 4 pts, 3 played          → THIRD_PLACE_CONTENDER
P4: Team8, 1 pt,  3 played          → ELIMINATED
```

**Group G example (1 match played):**
```
P1: TeamX, 3 pts, 1 played, 2 remaining  → UNDECIDED (84%)
P2: TeamY, 1 pts, 1 played, 2 remaining  → UNDECIDED (72%)
P3: TeamZ, 0 pts, 1 played, 2 remaining  → THIRD_PLACE_CONTENDER
P4: TeamW, 0 pts, 1 played, 2 remaining  → UNDECIDED (7%)
```

**Key assertions:**
- Complete groups (A–F): P1/P2 = QUALIFIED, P4 = ELIMINATED
- Incomplete groups (G–L): P1/P2 = UNDECIDED unless already unreachable
- 6 complete → `numCompleted = 6 < 8` → best-8 third-place logic deferred
- All P3 teams remain THIRD_PLACE_CONTENDER regardless of points (can't eliminate yet)
- Exception: P3 in incomplete group with 0 pts, 2 remaining → max = 6 pts; if all completed P3s have ≥ 7 pts → ELIMINATED via early check

---

## Scenario 3 — Group Stage Complete

**Input:** All 12 groups, all 3 matches played, realistic final standings.

**Example third-place standings (for best-8 check):**

| Group | Team | Pts | GD | GF | Status |
|---|---|---|---|---|---|
| A | Team-A3 | 7 | +3 | 6 | QUALIFIED |
| B | Team-B3 | 6 | +2 | 5 | QUALIFIED |
| C | Team-C3 | 6 | +1 | 5 | QUALIFIED |
| D | Team-D3 | 5 | +2 | 5 | QUALIFIED |
| E | Team-E3 | 5 | +1 | 4 | QUALIFIED |
| F | Team-F3 | 5 | +1 | 4 | QUALIFIED (tiebreak: alphabetical group) |
| G | Team-G3 | 5 | 0 | 3 | QUALIFIED |
| H | Team-H3 | 5 | 0 | 3 | QUALIFIED (8th) |
| I | Team-I3 | 4 | -1 | 2 | ELIMINATED |
| J | Team-J3 | 4 | -1 | 2 | ELIMINATED |
| K | Team-K3 | 3 | -2 | 1 | ELIMINATED |
| L | Team-L3 | 1 | -4 | 0 | ELIMINATED |

**Key assertions:**
- Ranks 1–8: QUALIFIED
- Ranks 9–12: ELIMINATED
- Tie at rank 8/9 boundary: resolved by points → GD → GF (deterministic)
- Total qualified teams: 24 (P1/P2) + 8 (best third) = 32
- Total eliminated: 12 (P4) + 4 (worst third) = 16
- Map size: 48 entries (4 teams × 12 groups)

---

## Edge Case Validations

### Static Skeleton Entries (id === 0)

**Input:** Groups with `team.id === 0` (pre-populated template rows)

**Expected:**
- Engine processes these entries normally for point comparisons
- Each static entry gets a unique negative synthetic map key (`-1`, `-2`, ...) to avoid collision
- `refineThirdPlace()` skips static entries (checks `team.id === 0`)
- Lookup via `findQualByName()` still works by team name

### Empty Input

**Input:** `calculateQualificationStatus([])`

**Expected:**
- Returns empty `Map<number, TeamQualification>` with size 0
- No error thrown

### Single Group

**Input:** One group with 4 teams, all complete

**Expected:**
- P1/P2 → QUALIFIED
- P4 → ELIMINATED
- P3 → THIRD_PLACE_CONTENDER (numCompleted = 1 < 8, cannot resolve best-8)

### P1 Already Safe After 2 Matches

**Input:**
```
P1: 6 pts, 2 played, 1 remaining
P2: 3 pts, 2 played, 1 remaining
P3: 3 pts, 2 played, 1 remaining
P4: 0 pts, 2 played, 1 remaining
```

**Check for P1 QUALIFIED:**
- Max P3 = 3 + 3 = 6; Max P4 = 0 + 3 = 3
- Max below P2 = max(6, 3) = 6
- P1 points = 6; 6 < 6 is false → NOT qualified yet (tied achievable)
- P1 stays UNDECIDED

**Check with P1 = 7 pts:**
- Max P3 = 3 + 3 = 6; max(6, 3) = 6; 6 < 7 is true → QUALIFIED ✅

### P4 Already Eliminated After 2 Matches

**Input:**
```
P3: 6 pts, 2 played, 1 remaining
P4: 0 pts, 2 played, 1 remaining
```

**Check:**
- P4 max = 0 + 3 = 3
- P3 current = 6
- 3 < 6 is true → ELIMINATED ✅

---

## Validation Checklist

| Check | Pass |
|---|---|
| Sum of QUALIFIED + THIRD_PLACE_CONTENDER + ELIMINATED + UNDECIDED = 48 | ✅ |
| All-complete run: exactly 24 QUALIFIED + 8 QUALIFIED (best-third) = 32 total | ✅ |
| All-complete run: exactly 16 ELIMINATED | ✅ |
| No static entry (id=0) causes map key collision | ✅ |
| `positionToStatus(1, 3)` → QUALIFIED | ✅ |
| `positionToStatus(4, 3)` → ELIMINATED | ✅ |
| `positionToStatus(1, 0)` → UNDECIDED | ✅ |
| `positionToStatus(4, 0)` → UNDECIDED | ✅ |
| `positionToStatus(3, 0)` → THIRD_PLACE_CONTENDER | ✅ |
| QUAL_BADGE_STYLES covers all 4 statuses | ✅ |
| TypeScript: `npx tsc --noEmit` → 0 errors | ✅ |
