# MISSING_DATA — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED ✅ — These gaps are confirmed by source code inspection, not assumptions.

---

## Rule Zero

This document lists ONLY what has been confirmed missing by reading actual provider implementations. No guesses. No "might be available." Only verified absence.

---

## Fields Confirmed Absent from ALL Providers

| Missing Field | Checked Providers | Why It Matters | Priority |
|---|---|---|---|
| **xG (Expected Goals)** | FD, AF, ESPN | Performance analytics, momentum | P3 |
| **Shot count (total)** | FD, AF, ESPN | Momentum, domination metric | P3 |
| **Shots on target** | FD, AF, ESPN | Efficiency metric | P3 |
| **Possession %** | FD, AF, ESPN | Dominance metric, momentum | P3 |
| **Pass accuracy** | FD, AF, ESPN | Quality of play | P3 |
| **Distance covered (per player)** | FD, AF, ESPN | Physical performance | P3 |
| **Player heatmap (coordinates)** | FD, AF, ESPN | Tactical visualization | P3 |
| **Player ratings (match)** | FD, AF, ESPN | Player spotlight | P3 |
| **Player nationality** | FD, AF, ESPN | Player profile | P2 |
| **Player age** | FD, AF, ESPN | Player profile | P2 |
| **Player club (current)** | FD, AF, ESPN | Player profile | P2 |
| **Player photo URL** | FD, AF, ESPN | Player spotlight | P3 |
| **Player career goals** | FD, AF, ESPN | Player spotlight | P3 |
| **Goalkeeper saves** | FD, AF, ESPN | Golden Glove | P3 |
| **Goalkeeper clean sheets** | FD, AF, ESPN | Golden Glove | P3 |
| **Save percentage** | FD, AF, ESPN | Keeper performance | P3 |
| **Attendance** | FD, AF, ESPN | Match atmosphere | P3 |
| **Weather (match day)** | FD, AF, ESPN | Match conditions | P3 |
| **Temperature at kickoff** | FD, AF, ESPN | Match conditions | P3 |
| **VAR decisions** | FD, AF, ESPN | Match narrative | P3 |
| **Tactical formations (string)** | FD, AF, ESPN | Lineup display | P2 |
| **Pre-match injury reports** | FD, AF, ESPN | Team selection context | P3 |
| **Broadcast rights (per-match)** | FD, AF, ESPN, tv-guide.json | TV guide | P3 |
| **Fan vote data** | All external | Prediction feature | P1* |
| **Manager quotes** | All external | Match narrative | P3 |
| **Score at extra time** | FD only (AF has it, not integrated) | ET result display | P1 |
| **Penalty shootout score** | FD only (AF has it, not integrated) | PK result display | P1 |
| **Team-level shot map** | FD, AF, ESPN | Advanced analysis | P3 |
| **Stadium photos** | All external | Venue experience | P3 |
| **FIFA ranking (live)** | FD, AF, ESPN | Rankings page | P2 |
| **Player caps / international goals** | FD, AF, ESPN | National team history | P2 |

*Fan vote: possible without external provider — needs internal KV-backed system

---

## Fields Confirmed PARTIALLY Available

| Field | What's Available | What's Missing | Impact |
|---|---|---|---|
| **Assists** | goals[].assist from FD + ESPN | Frequently null even when assist occurred | Display "N/A" when absent |
| **Lineups** | Starters + jersey numbers (FD/ESPN) | Formation string, position coordinates | Can display list; no pitch diagram |
| **Form string** | FD standings form field | Frequently null (especially WC) | Render when present |
| **Venue name** | match.venue string | Capacity, city, history (from static only) | Static supplement covers it |
| **Referee** | Name + nationality | Career stats, photo, experience level | Show name + flag only |
| **Score duration** | REGULAR / EXTRA_TIME / PENALTY_SHOOTOUT | Exact ET/PK score breakdown | Only "match went to ET/PK" |

---

## Fields Absent Only Because Not Integrated (Fixable)

These are available from a connected provider but not yet wired into the canonical model. They require code work, not a new provider.

| Field | Available From | Work Required |
|---|---|---|
| score.extraTime (home/away) | api-football secondary provider | Integrate into authority:v1 canonical model |
| score.penalties (home/away) | api-football secondary provider | Integrate into authority:v1 canonical model |
| Player squad (via getTeam) | football-data.org | Already fetched; not all pages surface it |

---

## Fake Data Warning

**NEVER invent or estimate these values:**

- Do not generate fake attendance figures
- Do not generate fake weather conditions
- Do not generate fake player ratings
- Do not generate fake xG values
- Do not display "estimated" possession

If a field is absent → mark as unavailable or hide the UI element. No placeholders.

---

## Recommendations

### P1 — Add in next sprint (data exists, just not integrated)

1. **ET/Penalty scores** — AF provides them. Add to canonical model. One sprint.
2. **Fan Prediction** — Pure internal system. KV write + vote API + UI. No external provider needed.
3. **Golden Boot** — Goals data exists. Add scorer aggregation to cron. One sprint.

### P2 — Evaluate adding a new data layer

4. **Player nationality / age / club** — Small enrichment layer. Could scrape from Wikipedia or use a free sports API. Not critical path.
5. **FIFA rankings (live)** — Static hardcoded rankings suffice for WC 2026. Live update would require a rankings API.

### P3 — Require new provider contract

6. **Weather** — OpenWeatherMap or similar. Low UX value for a football product.
7. **xG / shots / possession** — StatsBomb, Opta, or Wyscout. High value, high cost.
8. **Attendance** — No free provider; FIFA own stats only.
9. **Stadium photos** — Photo licensing + CDN. Costly but high visual impact.
