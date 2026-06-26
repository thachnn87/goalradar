# STORY_CARD_ENGINE — DATA-18WC.MATCH-STORY

**Date:** 2026-06-26
**Status:** DOCUMENTED (not yet surfaced in UI)

---

## Purpose

Generate contextual story cards for each match. Rule engine only — no AI, no LLM.

---

## Story Card Types

| Card | Trigger condition | Example |
|---|---|---|
| **Winner Advances** | WC knockout, match result known | "South Africa advance to the Round of 16" |
| **Must Win** | WC group, team needs win to qualify | "Brazil must win to guarantee Round of 32 place" |
| **First Knockout Match** | Team's first WC knockout appearance | "First time in WC knockout since 2010" |
| **Historic Meeting** | Teams met in a previous WC Final | "Brazil vs Germany — 2002 Final rematch" |
| **First World Cup Meeting** | Teams have never met at a WC | "First ever World Cup meeting between these nations" |
| **Best Third** | Team qualified as best third | "Qualified as one of the 8 best third-placed teams" |
| **Group Winner** | Team won their group | "Won Group C with maximum 9 points" |
| **Revenge Match** | Lost to this opponent in previous WC | "Revenge for 2022 Round of 16 defeat" |
| **Previous WC Meeting** | Teams met in a WC within last 3 tournaments | "Played in the 2022 Round of 16" |
| **Host Nation** | Team is co-host (USA, Canada, Mexico) | "USA playing on home soil" |
| **Underdog** | Team ranked 20+ places lower by FIFA | "Rank 47 vs Rank 8" |

---

## Implementation Notes

- All rules are deterministic from match data + H2H data + team FIFA ranking
- Source: `match.homeTeam`, `match.awayTeam`, `headToHead`, qualification engine output
- No API call needed — all data available in `MatchSnapshot`
- Cards should be generated in `buildStoryContext()` and stored in `StoryContext.storyCards`
- Currently: story card generation is not implemented in the engine

---

## Data Requirements per Card

| Card | Data needed |
|---|---|
| Winner Advances | `nextStageLabel`, `matchState`, `winner` |
| Must Win | WC group standings, team's remaining matches, current points |
| First Knockout | H2H data filtered by `stage !== 'GROUP_STAGE'` |
| Historic Meeting | H2H data filtered by `stage === 'FINAL'` |
| First World Cup Meeting | `headToHead.numberOfMatches === 0` in WC context |
| Best Third | Qualification engine output |
| Group Winner | Group standings, points = 9 |
| Revenge Match | Last WC meeting result |
| Host Nation | `['USA', 'CAN', 'MEX'].includes(team.tla)` |
| Underdog | FIFA ranking difference |
