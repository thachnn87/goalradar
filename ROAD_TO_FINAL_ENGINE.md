# ROAD_TO_FINAL_ENGINE — DATA-18WC.MATCH-STORY

**Date:** 2026-06-26
**Status:** IMPLEMENTED ✅

---

## Purpose

Automatically injects "Road to the Final" context into every WC knockout match narrative. Describes where the winner goes next, who was eliminated, and frames each match as a step on the path to the Final.

---

## Section by Stage and Outcome

### Upcoming matches

| Stage | Road to the Final text |
|---|---|
| LAST_32 | "The winner advances to the Round of 16, moving one step closer to a potential World Cup Final…" |
| LAST_16 | "The winner advances to the Quarter-finals…" |
| QUARTER_FINALS | "The winner advances to the Semi-finals…" |
| SEMI_FINALS | "The winner advances to the Final. There is no second chance…" |
| THIRD_PLACE | Third-place pride framing — no "road to Final" (they didn't make it) |
| FINAL | "The FIFA World Cup 2026 Final is the culmination of a month of extraordinary football…" |

### After match (winner decided)

| Stage | Road to the Final text |
|---|---|
| LAST_32 | "[Winner] advance to the Round of 16. [Loser] are eliminated, their 2026 World Cup over." |
| LAST_16 | "[Winner] advance to the Quarter-finals. [Loser] eliminated." |
| QUARTER_FINALS | "[Winner] advance to the Semi-finals." |
| SEMI_FINALS | "[Winner] advance to the Final — one game from the ultimate prize. [Loser] eliminated." |
| THIRD_PLACE | "[Winner] finish third at the FIFA World Cup 2026." |
| FINAL | "[Champion] are World Champions — the pinnacle of international football achieved." |

### After match (draw at 90 minutes — extra time)

> A knockout match requires a winner. Extra time will be played, and if the score remains level after 30 additional minutes, a penalty shootout will determine who advances to the [next round]. In World Cup knockout football, every save, every kick and every decision can define a nation's legacy.

### Live matches

| Stage | Road to the Final text |
|---|---|
| LAST_32–SEMI_FINALS | "The winner advances to the [next round] — every goal brings one nation closer to the Final. The loser faces immediate elimination." |
| FINAL | "One 90-minute performance stands between these nations and immortality. The FIFA World Cup trophy is within reach." |

---

## Stage Progression Map

```
Round of 32 (32 matches)
  ↓ 16 winners
Round of 16 (16 matches)
  ↓ 8 winners
Quarter-finals (8 matches)
  ↓ 4 winners
Semi-finals (4 matches)
  ↓ 2 winners (2 losers → Third Place Play-off)
Final
  ↓ 1 World Champion
```

---

## Implementation

The road context is generated in `buildWCKnockoutReport()` in `src/lib/match-story-engine.ts`.

The `nextStageLabel` field in `StoryContext` drives the advancement text automatically:

```typescript
const STAGE_NEXT: Record<string, string> = {
  LAST_32:        'Round of 16',
  LAST_16:        'Quarter-finals',
  QUARTER_FINALS: 'Semi-finals',
  SEMI_FINALS:    'Final',
  // THIRD_PLACE and FINAL → null (no next stage)
};
```

No hardcoding of opponent names — all text uses team names from `StoryContext.homeS` / `StoryContext.awayS`.
