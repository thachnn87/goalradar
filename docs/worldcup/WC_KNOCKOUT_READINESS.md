# WC_KNOCKOUT_READINESS — DATA-18WC.6

**Date:** 2026-06-23

## WC 2026 knockout format

48 teams → 32 qualify from groups → LAST_32 (16 matches, ~1 July) → LAST_16 (8) → QF (4) → SF (2) → Final (1) = 31 knockout matches.

## Finding: WCBracket missing LAST_32

`src/components/WCBracket.tsx` (pre-fix) had:
```typescript
const ROUND_KEYS = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'] as const;
```
LAST_32 was absent. The bracket would render 4 rounds starting from LAST_16, omitting the 16 Round of 32 matches entirely.

`src/lib/wc-rounds.ts` already had LAST_32 configured (`slug: 'round-of-32'`, `matchCount: 16`). The football-data.org API uses stage name `'LAST_32'`. WCBracket's `byStage` filter uses `m.stage === key`, so LAST_32 API matches would have been silently discarded.

## Fix applied

Updated `src/components/WCBracket.tsx`:

| Constant | Before | After |
|----------|--------|-------|
| ROUND_KEYS | LAST_16, QF, SF, FINAL | **LAST_32**, LAST_16, QF, SF, FINAL |
| NUM_R16_SLOTS → NUM_L32_SLOTS | 8 | **16** |
| TOTAL_H | 704 px | **1408 px** |
| SLOTS_PER_MATCH.LAST_32 | — | **1** |
| SLOTS_PER_MATCH.LAST_16 | 1 | **2** |
| SLOTS_PER_MATCH.QF | 2 | **4** |
| SLOTS_PER_MATCH.SF | 4 | **8** |
| SLOTS_PER_MATCH.FINAL | 8 | **16** |
| ROUND_MATCH_COUNT.LAST_32 | — | **16** |
| byStage init | no LAST_32 | **LAST_32: []** added |

The `matchCenterY` math is correct with the updated constants: LAST_32 match i center = (i + 0.5) × 88px, FINAL center = 8 × 88 = 704px (midpoint of 1408px).

## RouteToFinal

`src/app/world-cup-2026/teams/[slug]/page.tsx` `RouteToFinal` component already includes LAST_32 in its stepper. Team pages are unaffected by this fix.

## Verdict

**KNOCKOUT_READINESS: FIXED** — LAST_32 (16 matches, Round of 32) added to WCBracket. Bracket now spans all 5 knockout rounds. Will show 16 TBD placeholder cards until Round of 32 begins (~1 July 2026).
