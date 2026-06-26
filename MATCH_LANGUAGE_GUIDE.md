# MATCH_LANGUAGE_GUIDE — DATA-18WC.MATCH-STORY

**Date:** 2026-06-26
**Status:** IMPLEMENTED ✅

---

## The Core Rule

Match type determines vocabulary. Vocabulary never leaks across templates.

---

## Forbidden in WC_KNOCKOUT

These phrases MUST NOT appear in any match where `matchType === 'WC_KNOCKOUT'`:

| Forbidden phrase | Why | Replacement |
|---|---|---|
| "three points" | Knockout has no points system | "advances", "eliminates" |
| "league table" | No league in WC knockout | "road to the Final" |
| "draw helps both teams" | Draws go to extra time | "the match would continue into extra time" |
| "campaign" (standalone) | League season framing | "World Cup journey", "tournament run" |
| "season standings" | No season in knockout | N/A — omit |
| "title race" | No title to race for in WC | N/A — omit |
| "fixture congestion" | No fixture calendar in WC | N/A — omit |
| "remaining league fixtures" | Not a league | N/A — omit |
| "top-four" / "mid-table" | League concepts | N/A — omit |
| "relegated" / "relegation" | League concepts | N/A — omit |

---

## Required in WC_KNOCKOUT

These phrases MUST appear contextually (not literally forced) in `WC_KNOCKOUT` output:

| Required concept | Example phrases |
|---|---|
| Advancement | "winner advances to the [next round]" |
| Elimination | "loser is eliminated", "faces elimination", "World Cup over" |
| Extra time | "extra time will be played", "could not be separated after 90 minutes" |
| Penalty shootout | "penalty shootout will determine who advances" |
| Road to Final | "road to the Final", "one step closer to the Final" |
| Knockout framing | "knockout football", "no second chance", "must win" |

---

## Permitted in WC_GROUP (not forbidden)

WC group stage uses "three points" — it IS a points-based stage. However, context is always WC-specific:

| Instead of | Use |
|---|---|
| "the league table" | "the Group [X] standings" |
| "their campaign" | "their World Cup journey" / "World Cup ambitions" |
| "this season" | "at the World Cup" / "in this tournament" |
| "Matchday X" | "Group [X]" |

---

## Vocabulary by Template

### STANDARD vocabulary (League / CL / Cup)

```
three points ✅
league table ✅
campaign ✅
season ✅
standings ✅
title race ✅
fixture congestion ✅
relegated ✅
```

### WC_GROUP vocabulary

```
three points          ✅  (group stage has points)
group standings       ✅
World Cup journey     ✅
knockout rounds       ✅
qualification push    ✅
best-eight third      ✅
league table          ❌
title race            ❌
season (standalone)   ❌
```

### WC_KNOCKOUT vocabulary

```
winner advances       ✅
loser eliminated      ✅
extra time            ✅
penalty shootout      ✅
road to the Final     ✅
World Cup journey     ✅
bronze medal          ✅ (THIRD_PLACE only)
World Champion        ✅ (FINAL only)
three points          ❌
league table          ❌
campaign (standalone) ❌
draw helps both       ❌
season standings      ❌
```

---

## Stage-Specific Vocabulary

| Stage | Unique required phrases |
|---|---|
| LAST_32 | "Round of 16", "no second chance", "World Cup continues" |
| LAST_16 | "Quarter-finals", "pressure intensifies" |
| QUARTER_FINALS | "Semi-finals", "history", "elite eight" |
| SEMI_FINALS | "Final", "one game from the ultimate prize", "World Cup Final" |
| THIRD_PLACE | "bronze medal", "podium", "third place", "finishing on a high" |
| FINAL | "World Champion", "ultimate prize", "history", "legacy", "greatest trophy" |

---

## Section Heading Vocabulary

| Match Type | Section 4 heading | Section 5 heading |
|---|---|---|
| STANDARD | "Result Impact" | "Competition Context" |
| WC_GROUP | "Group Stage Impact" | "FIFA World Cup 2026" |
| WC_KNOCKOUT (LAST_32–SEMI_FINALS) | "Road to the Final" | "FIFA World Cup 2026" |
| WC_KNOCKOUT (THIRD_PLACE) | "The Bronze Medal" | "FIFA World Cup 2026" |
| WC_KNOCKOUT (FINAL) | "The World Cup Champion" | "FIFA World Cup 2026" |
