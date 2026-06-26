# MATCH_TYPE_MATRIX — DATA-18WC.MATCH-STORY

**Date:** 2026-06-26
**Status:** IMPLEMENTED ✅

---

## Classification Logic

```typescript
const isWC         = match.competition?.code === 'WC';
const hasGroup     = !!(match.group);               // 'GROUP_A' … 'GROUP_L'
const isGroupStage = hasGroup || stage === 'GROUP_STAGE';
const isKnockout   = isWC && !isGroupStage && !!stage && stage !== 'GROUP_STAGE';

matchType =
  isWC && isGroupStage  → 'WC_GROUP'
  isWC && isKnockout    → 'WC_KNOCKOUT'
  else                  → 'STANDARD'
```

---

## Match Type Matrix

### WC_GROUP

| Property | Value |
|---|---|
| Template | `buildWCGroupReport()` |
| Stages | `GROUP_STAGE` / any stage with `match.group` present |
| Required vocabulary | "group standings", "three points", "World Cup qualification", "knockout rounds", "group stage", "Group [X]" |
| Forbidden vocabulary | "league table", "campaign" (without "World Cup"), "season", "title race", "fixture congestion" |
| Section 4 heading | "Group Stage Impact" |
| Section 5 heading | "FIFA World Cup 2026" |
| Context boilerplate | 48 nations, 12 groups, top-2 auto + 8 best third |

### WC_KNOCKOUT — Round of 32

| Property | Value |
|---|---|
| Template | `buildWCKnockoutReport()` |
| Stage key | `LAST_32` |
| Stage label | "Round of 32" |
| Next stage | "Round of 16" |
| Required vocabulary | "winner advances to the Round of 16", "loser eliminated", "knockout football", "road to the Final" |
| Forbidden vocabulary | "three points", "league table", "draw helps", "campaign", "season", "title race", "fixture congestion" |
| Section 4 heading | "Road to the Final" |
| Section 5 heading | "FIFA World Cup 2026" |

### WC_KNOCKOUT — Round of 16

| Property | Value |
|---|---|
| Stage key | `LAST_16` |
| Stage label | "Round of 16" |
| Next stage | "Quarter-finals" |
| Required vocabulary | "winner advances to the Quarter-finals", "loser eliminated", "road to the Final" |
| Forbidden | same as all WC_KNOCKOUT |

### WC_KNOCKOUT — Quarter-finals

| Property | Value |
|---|---|
| Stage key | `QUARTER_FINALS` |
| Stage label | "Quarter-finals" |
| Next stage | "Semi-finals" |
| Required vocabulary | "winner advances to the Semi-finals", "loser eliminated", "history", "road to the Final" |

### WC_KNOCKOUT — Semi-finals

| Property | Value |
|---|---|
| Stage key | `SEMI_FINALS` |
| Stage label | "Semi-finals" |
| Next stage | "Final" |
| Required vocabulary | "winner advances to the Final", "loser faces Third Place Play-off", "one game from the ultimate prize" |
| Special | "next stage = Final" triggers enhanced road-to-Final copy |

### WC_KNOCKOUT — Third Place Play-off

| Property | Value |
|---|---|
| Stage key | `THIRD_PLACE` |
| Stage label | "Third Place Play-off" |
| Next stage | null |
| Required vocabulary | "bronze medal", "third place", "podium", "finishing third" |
| Section 4 heading | "The Bronze Medal" |
| Forbidden | "road to the Final" (they didn't make the Final) |

### WC_KNOCKOUT — Final

| Property | Value |
|---|---|
| Stage key | `FINAL` |
| Stage label | "Final" |
| Next stage | null |
| Required vocabulary | "World Champion", "the ultimate prize", "history", "legacy", "crowning" |
| Section 4 heading | "The World Cup Champion" |
| Section 5 heading | "FIFA World Cup 2026" |
| Special | Completely different intro for draw (extra time / penalties narrative) |

### STANDARD

| Property | Value |
|---|---|
| Template | `buildStandardReport()` |
| Competitions | PL, BL1, SA, FL1, PD, CL, EC, WCQ, all non-WC |
| Required vocabulary | "three points", "league table", "campaign", "season", "standings" |
| Section 4 heading | "Result Impact" |
| Section 5 heading | "Competition Context" |

---

## Stage Label Vocabulary

| Stage key | stageLabel | nextStageLabel |
|---|---|---|
| `GROUP_STAGE` | "Group Stage" | — |
| `LAST_32` | "Round of 32" | "Round of 16" |
| `LAST_16` | "Round of 16" | "Quarter-finals" |
| `QUARTER_FINALS` | "Quarter-finals" | "Semi-finals" |
| `SEMI_FINALS` | "Semi-finals" | "Final" |
| `THIRD_PLACE` | "Third Place Play-off" | null |
| `FINAL` | "Final" | null |

---

## Match State Matrix

| Status | matchState | Tense |
|---|---|---|
| `SCHEDULED` / `TIMED` | `UPCOMING` | Future |
| `IN_PLAY` / `PAUSED` | `LIVE` | Present |
| `FINISHED` | `FINISHED` | Past |
| `CANCELLED` / `SUSPENDED` / `POSTPONED` | `CANCELLED` | Neutral |

---

## Winner Matrix (FINISHED only)

| score.winner | Winner enum | Result Impact style |
|---|---|---|
| `HOME_TEAM` | `'HOME'` | victory / "winner advances" |
| `AWAY_TEAM` | `'AWAY'` | away win / "winner advances" |
| `DRAW` / null | `'DRAW'` | draw / extra time narrative (knockout) |
| (not FINISHED) | `null` | — |
