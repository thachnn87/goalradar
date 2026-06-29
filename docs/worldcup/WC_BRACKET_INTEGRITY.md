# WC_BRACKET_INTEGRITY.md — DATA-18WC.7 Phase 6
**Date:** 2026-06-23  
**Source:** `src/components/WCBracket.tsx` (post DATA-18WC.6 fix)

---

## Bracket Round Configuration

| Round Key | Label | Expected Matches | Slots Per Match | TOTAL_H Contribution |
|---|---|---|---|---|
| LAST_32 | Round of 32 | 16 | 1 | 16 × 88 = 1408px |
| LAST_16 | Round of 16 | 8 | 2 | — |
| QUARTER_FINALS | Quarter-finals | 4 | 4 | — |
| SEMI_FINALS | Semi-finals | 8 | 8 | — |
| FINAL | Final | 1 | 16 | — |
| **Total** | | **31** | | **TOTAL_H = 1408px** |

---

## WC 2026 Knockout Structure

| Round | Matches | In WCBracket? |
|---|---|---|
| LAST_32 (Round of 32) | 16 | ✅ (added in DATA-18WC.6) |
| LAST_16 (Round of 16) | 8 | ✅ |
| QUARTER_FINALS | 4 | ✅ |
| SEMI_FINALS | 2 | ✅ |
| THIRD_PLACE | **1** | ❌ Missing |
| FINAL | 1 | ✅ |
| **Total** | **32** | 31/32 in bracket |

**Expected knockout total: 32 (including 3rd place)**  
**Bracket covers: 31 (excludes THIRD_PLACE)**

---

## THIRD_PLACE Gap

WC 2026 has a 3rd place playoff match. The `WCBracket` component does not include `THIRD_PLACE` in `ROUND_KEYS`. The football-data.org API uses stage identifier `THIRD_PLACE` for this match.

- `src/lib/wc-rounds.ts` may define `THIRD_PLACE` as a valid stage
- The bracket renders LAST_32 → LAST_16 → QF → SF → FINAL — the THIRD_PLACE match is displayed nowhere in the bracket
- **Impact:** Cosmetic gap — users cannot see the 3rd place match from the bracket view
- **Fix:** Add `THIRD_PLACE` as a side bracket below the FINAL column, or as a separate row

---

## Layout Math Verification

```
SLOT_H        = 88px
NUM_L32_SLOTS = 16
TOTAL_H       = 16 × 88 = 1408px  ✓

matchCenterY(LAST_32, i)    = (i + 0.5) × 88   [i=0..15: 44, 132, ..., 1364]
matchCenterY(LAST_16, i)    = (2i + 1) × 88     [i=0..7:  88, 264, ..., 1320]
matchCenterY(QF, i)         = (4i + 2) × 88     [i=0..3: 176, 528, 880, 1232]
matchCenterY(SF, i)         = (8i + 4) × 88     [i=0,1:  352, 1056]
matchCenterY(FINAL, 0)      = (0×16 + 8) × 88  = 704  [midpoint of 1408px ✓]
```

BracketConnector math: for LAST_32→LAST_16, pair `i`, `i*2` and `i*2+1` connect to midY which equals LAST_16 match center. Verified correct for all adjacent round pairs.

---

## Current State (Group Stage)

All knockout rounds are fully populated with TBD placeholder cards (dashed border, `text-gray-700` "TBD" text). No real knockout matches in authority cache yet (all 31 stage slots return 0 matches from `byStage[key]`).

---

## Findings

- ✅ LAST_32 added — 5 rounds present (16+8+4+2+1 = 31 slots)
- ✅ TOTAL_H = 1408px correctly doubles from pre-fix 704px
- ✅ matchCenterY math verified — FINAL centers at 704px (midpoint)
- ✅ BracketConnector SVG paths verified for all round pairs
- ⚠️ THIRD_PLACE match (1 match, WC 3rd/4th playoff) not rendered — 31 of 32 knockout matches covered

**Phase 6 Gate: BRACKET_PASS_WITH_CAVEAT** (31/32 knockout matches handled; THIRD_PLACE display is a known gap)
