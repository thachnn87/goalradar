# API_CAPABILITY_MATRIX — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED from source code ✅

Legend: ✅ AVAILABLE | ⚠️ PARTIAL | ❌ UNAVAILABLE

---

## Core Match Features

| Feature | Required Fields | Provider | Available | Confidence | Fallback | Status |
|---|---|---|---|---|---|---|
| Match score (FT) | score.fullTime | FD + AF + Authority | ✅ | High | DR snapshot | READY |
| Match score (HT) | score.halfTime | FD + AF | ✅ | Med | — | READY |
| Match status (live) | status, minute | FD + live cache | ✅ | High | Authority v1 | READY |
| Extra time score | score.extraTime | AF only | ⚠️ | Med | — | PARTIAL |
| Penalty shootout score | score.penalties | AF only | ⚠️ | Med | — | PARTIAL |
| Goals with scorers | goals[].scorer | FD + AF + ESPN | ✅ | High | DR snapshot | READY |
| Assists | goals[].assist | FD + ESPN | ⚠️ | Low | — | PARTIAL |
| Cards (yellow/red) | bookings[] | FD + AF + ESPN | ✅ | High | DR snapshot | READY |
| Substitutions | substitutions[] | FD + AF + ESPN | ✅ | High | DR snapshot | READY |
| Lineups (starters) | lineups.home/away | FD + ESPN | ⚠️ | Med | — | PARTIAL |
| Formations (string) | lineups.formation | **NONE** | ❌ | — | — | BLOCKED |
| Referees | referees[] | FD | ✅ | Med | — | READY |
| Venue name | venue | FD + static | ✅ | Med | Static | READY |
| Head-to-head | headToHead | FD only | ✅ | High | KV cache | READY |

---

## World Cup Structure

| Feature | Required Fields | Provider | Available | Confidence | Fallback | Status |
|---|---|---|---|---|---|---|
| Group standings | StandingTable[] | FD + static | ✅ | High | Static skeleton | READY |
| Knockout bracket | stage + authority v1 | FD + authority | ✅ | High | Static slots | READY |
| Road to Final | stage, nextStage | Story Engine | ✅ | High | Story Engine | READY |
| Slot labels ("1st Group A") | standings + knockout-vm | Computed | ✅ | High | — | READY |
| Qualification status | StandingTable[] | Qualification Engine | ✅ | High | positionToStatus() | READY |
| Qualification probability | StandingTable[] | Qualification Engine | ✅ | Med | — | READY |
| Qualification reason | StandingTable[] | Qualification Engine | ✅ | Med | — | READY |
| Best-8 third place | All 12 group tables | Qualification Engine | ✅ | High | — | READY |
| Group composition (48 teams) | teams.json | Static | ✅ | High | — | READY |
| Match dates / venues (structure) | fixtures.json | Static | ✅ | High | — | READY |
| Venue details (capacity, city) | stadiums.json / wc-venues.ts | Static | ✅ | High | — | READY |

---

## WC Experience Features (Planned)

| Feature | Required Fields | Provider | Available | Confidence | Fallback | Status |
|---|---|---|---|---|---|---|
| **Road to Final** | stage, nextStage, winner, teams | Story Engine + Knockout VM | ✅ | High | — | READY |
| **Qualification Simulator** | group standings, remaining fixtures | Qualification Engine + FD | ✅ | High | Static | READY |
| **Live Qualification** | real-time standings + engine | FD live + engine | ✅ | High | positionToStatus() | READY |
| **Story Cards** | match data + H2H + qual status | Multiple | ✅ | High | — | READY |
| **Timeline** | goals[]+cards[]+subs[] by minute | FD + AF + ESPN | ✅ | High | — | READY |
| **Momentum** | goals timeline, HT/FT scores | FD + AF + ESPN | ⚠️ | Med | Goals only | PARTIAL |
| **Player Spotlight** | goals[].scorer, bookings[].player | FD + AF + ESPN | ⚠️ | Med | Name only | PARTIAL |
| **Venue Experience** | stadiums.json, wc-venues.ts | Static | ✅ | High | — | READY |
| **Knockout Journey** | match results by stage | Authority v1 | ✅ | High | — | READY |
| **Qualification Reason** | qual engine output | Qualification Engine | ✅ | High | — | READY |
| **Fan Prediction** | No external data needed | Internal only | ✅ | High | — | READY* |
| **History** | H2H matches | FD H2H endpoint | ✅ | Med | — | READY |
| **Probability** | Standings + fixtures | Qualification Engine | ✅ | Med | — | READY |
| **Golden Boot** | goals[].scorer across tournament | FD + AF + ESPN | ⚠️ | Med | No aggregation | PARTIAL |
| **Golden Glove** | Keeper stats (saves, clean sheets) | **NONE** | ❌ | — | — | BLOCKED |
| **Weather** | Weather service | **NONE** | ❌ | — | — | BLOCKED |
| **Attendance** | Per-match attendance figure | **NONE** | ❌ | — | — | BLOCKED |
| **TV Schedule** | tv-guide.json | Static | ✅ | Med | — | READY |
| **Travel Guide** | wc-venues.ts transport[] | Static | ✅ | High | — | READY |
| **Stadium Photos** | Photo CDN | **NONE** | ❌ | — | — | BLOCKED |
| **Referee Profile** | referees[].nationality + name | FD | ✅ | Med | — | READY |
| **Player Form** | Player stats across matches | **NONE** | ❌ | — | — | BLOCKED |
| **Broadcaster** (per-match) | Per-match broadcast rights | **NONE** | ❌ | — | — | BLOCKED |
| **xG** | Expected goals per shot | **NONE** | ❌ | — | — | BLOCKED |
| **Heatmaps** | Player position data | **NONE** | ❌ | — | — | BLOCKED |
| **Injuries** | Pre-match injury reports | **NONE** | ❌ | — | — | BLOCKED |

*Fan Prediction requires building an internal storage system (Vercel KV + API route)

---

## League Features (Non-WC)

| Feature | Required Fields | Provider | Available | Confidence | Status |
|---|---|---|---|---|---|
| League standings | StandingTable[] | FD + AF | ✅ | High | READY |
| Form string | form field | FD | ⚠️ | Low | PARTIAL |
| Team profile | TeamDetail | FD | ✅ | Med | READY |
| Team recent results | getTeamMatches() | FD | ✅ | Med | READY |
| League fixtures | getFixtures() | FD + AF | ✅ | High | READY |
| Match report | MatchDetail | FD + Story Engine | ✅ | High | READY |
| H2H | HeadToHead | FD only | ✅ | High | READY |
| Champions League bracket | stage + FD matches | FD | ⚠️ | Med | PARTIAL |

---

## Data Confidence Definitions

| Level | Meaning |
|---|---|
| **High** | Data present in >95% of matches; authoritative source; no known gaps |
| **Med** | Data present in most matches; occasionally null; may need fallback |
| **Low** | Data unreliable; frequently null; should not be primary display |
| **—** | Not applicable (feature blocked) |

---

## Notes

1. **Extra time / penalty scores** — AF exposes these but they are not yet integrated into the authority:v1 canonical model. They can be added.

2. **Assists** — FD provides assist data but it is frequently absent (null) even for goals that had clear assists. ESPN also provides assists. Both are unreliable.

3. **Fan Prediction** — Fully possible with only internal infrastructure (KV write + API route). No external provider needed.

4. **Golden Boot** — Goals data is available per-match but no aggregation engine exists. Would require a KV-backed scorer tally updated by the cron orchestrator.

5. **Lineup availability** — FD only provides lineups for some competitions and typically only 1–2 hours before kickoff. ESPN enrichment provides lineups for FINISHED WC matches. Not available pre-match.
