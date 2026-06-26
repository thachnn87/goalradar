# FIELD_MATRIX — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED from source code ✅

Legend: ✅ Available | ⚠️ Partial/Nullable | ❌ Unavailable | 🔧 Computed

---

## Match Identity Fields

| Field | FD | AF | ESPN | Authority | Snapshot | Static | Nullable | Reliable | Cache | Consumer |
|---|---|---|---|---|---|---|---|---|---|---|
| match.id | ✅ | ✅* | ✅ | ✅ | ✅ | ✅† | No | High | KV | All pages |
| match.utcDate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | No | High | KV | All pages |
| match.status | ✅ | ✅ | — | ✅ | ✅ | — | No | High | KV 30s | Hub, match page |
| match.minute | ✅ | ✅ | — | ✅ | ✅ | — | Yes | Med | KV 30s | Live zone |
| match.stage | ✅ | ✅ | — | ✅ | ✅ | ✅ | Yes | High | KV | Bracket, round pages |
| match.group | ✅ | ✅ | — | ✅ | ✅ | ✅ | Yes | High | KV | Group pages, standings |
| match.matchday | ✅ | ✅ | — | ✅ | ✅ | ✅ | Yes | High | KV | League pages |
| match.lastUpdated | ✅ | ✅ | — | ✅ | ✅ | — | No | High | KV | Cache staleness |

*AF uses internal fixture IDs requiring cross-ID mapping via af-id-map.ts  
†Static fixtures use synthetic negative IDs (e.g., -1, -2) to avoid collision

---

## Team Fields

| Field | FD | AF | ESPN | Authority | Static | Nullable | Reliable | Consumer |
|---|---|---|---|---|---|---|---|---|
| team.id | ✅ | ✅* | — | ✅ | ✅† | No | High | All pages |
| team.name | ✅ | ✅ | ✅ | ✅ | ✅ | No | High | All pages |
| team.shortName | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | Yes | Med | Standings, match card |
| team.tla | ✅ | ✅ | — | ✅ | ✅ | Yes | Med | Match hero |
| team.crest (URL) | ✅ | ✅ | — | ✅ | ❌ | Yes | Med | Team logos |
| team.address | ✅ | — | — | — | — | Yes | Med | Team page |
| team.website | ✅ | — | — | — | — | Yes | Low | Team page |
| team.founded (year) | ✅ | — | — | — | — | Yes | Med | Team page |
| team.clubColors | ✅ | — | — | — | — | Yes | Med | Team page |
| team.venue (stadium) | ✅ | — | — | — | — | Yes | Med | Team page |
| team.coach.name | ✅ | — | — | — | ✅‡ | Yes | Low | Team page |
| team.squad[] | ✅ | — | — | — | — | Yes | Low | Team page |
| team.runningCompetitions[] | ✅ | — | — | — | — | Yes | Med | Team page |
| team.area | ✅ | — | — | — | — | Yes | Med | Team page |
| team.fifaRank | ❌ | ❌ | ❌ | ❌ | ✅ | No | Med‡‡ | Team page |
| team.confederation | ❌ | ❌ | ❌ | ❌ | ✅ | No | High | Team page |
| team.group (WC) | ❌ | ❌ | ❌ | ✅ | ✅ | Yes | High | WC pages |

*AF team IDs differ from FD — requires cross-ID mapping (unreliable)  
†Static team IDs are slug-based strings, not numeric  
‡Coach names in wc-teams.ts (6 featured teams) and wc-all-teams.ts  
‡‡FIFA rankings are hardcoded in static files, not live

---

## Score Fields

| Field | FD | AF | ESPN | Authority | Reliable | Consumer |
|---|---|---|---|---|---|---|
| score.winner | ✅ | ✅ | — | ✅ | High | Match page, standings |
| score.duration | ✅ | ✅ | — | ✅ | Med | Match page |
| score.fullTime.home | ✅ | ✅ | — | ✅ | High | All pages |
| score.fullTime.away | ✅ | ✅ | — | ✅ | High | All pages |
| score.halfTime.home | ✅ | ✅ | — | ✅ | Med | Match report |
| score.halfTime.away | ✅ | ✅ | — | ✅ | Med | Match report |
| score.extraTime.home | ❌ | ✅ | — | ❌ | Med | Not surfaced |
| score.extraTime.away | ❌ | ✅ | — | ❌ | Med | Not surfaced |
| score.penalties.home | ❌ | ✅ | — | ❌ | Med | Not surfaced |
| score.penalties.away | ❌ | ✅ | — | ❌ | Med | Not surfaced |

---

## Match Events

| Field | FD | AF | ESPN | Snapshot | Nullable | Reliable | Consumer |
|---|---|---|---|---|---|---|---|
| goals[].minute | ✅ | ✅* | ✅ | ✅ | Yes | Med | Events section |
| goals[].injuryTime | ✅ | ⚠️ | ✅ | ✅ | Yes | Low | Events section |
| goals[].type (REGULAR/OWN) | ✅ | ✅ | ✅ | ✅ | Yes | Med | Events section |
| goals[].scorer.name | ✅ | ✅ | ✅ | ✅ | Yes | High | Events section |
| goals[].scorer.id | ✅ | ✅ | ✅ | ✅ | Yes | Med | Events section |
| goals[].assist.name | ✅ | ⚠️ | ✅ | ✅ | Yes | Low | Events section |
| bookings[].minute | ✅ | ✅ | ✅ | ✅ | Yes | Med | Events section |
| bookings[].card type | ✅ | ✅ | ✅ | ✅ | Yes | High | Events section |
| bookings[].player.name | ✅ | ✅ | ✅ | ✅ | Yes | High | Events section |
| substitutions[].minute | ✅ | ✅ | ✅ | ✅ | Yes | Med | Events section |
| substitutions[].playerIn | ✅ | ✅ | ✅ | ✅ | Yes | High | Events section |
| substitutions[].playerOut | ✅ | ✅ | ✅ | ✅ | Yes | High | Events section |

*AF enrichment for WC requires af-id-map cross-ID resolution

---

## Match Context Fields

| Field | FD | AF | ESPN | Static | Reliable | Consumer |
|---|---|---|---|---|---|---|
| match.venue (name string) | ✅ | ✅ | — | ✅ | Med | Match page |
| venue.capacity | ❌ | ❌ | ❌ | ✅ | High | Venue page |
| venue.city | ❌ | ✅ | — | ✅ | High | Venue page |
| venue.country | ❌ | ✅ | — | ✅ | High | Venue page |
| venue.surface | ❌ | ❌ | ❌ | ✅ | High | Venue page |
| referees[].name | ✅ | ✅ | — | ✅ | Med | Match page |
| referees[].nationality | ✅ | ✅ | — | ✅ | Med | Match page |
| referees[].type | ✅ | ✅ | — | ✅ | Med | Match page |
| attendance | ❌ | ❌ | ❌ | ❌ | — | UNAVAILABLE |
| weather | ❌ | ❌ | ❌ | ❌ | — | UNAVAILABLE |
| broadcast/TV | ❌ | ❌ | ❌ | ✅† | Med | TV guide page |

†TV guide data is country-level static (broadcaster names), not per-match

---

## Lineup Fields

| Field | FD | ESPN | Snapshot | Nullable | Reliable | Consumer |
|---|---|---|---|---|---|---|
| lineups.home.players[] | ✅ | ✅ | ✅ | Yes | Med | Lineups section |
| lineups.away.players[] | ✅ | ✅ | ✅ | Yes | Med | Lineups section |
| player.starter (bool) | ✅ | ✅ | ✅ | Yes | High | Lineups section |
| player.position | ✅ | ✅ | ✅ | Yes | Med | Lineups section |
| player.jersey | ⚠️ | ✅ | ✅ | Yes | Med | Lineups section |
| player.formationPlace | ❌ | ✅ | ✅ | Yes | Med | Not currently rendered |
| formation (4-3-3 string) | ❌ | ❌ | ❌ | — | — | UNAVAILABLE |

---

## Standings Fields

| Field | FD | AF | Computed | Nullable | Reliable | Consumer |
|---|---|---|---|---|---|---|
| position | ✅ | ✅ | ✅ | No | High | Standings |
| team (name + crest) | ✅ | ✅ | ✅ | No | High | Standings |
| playedGames | ✅ | ✅ | ✅ | No | High | Standings |
| won / draw / lost | ✅ | ✅ | ✅ | No | High | Standings |
| points | ✅ | ✅ | ✅ | No | High | Standings |
| goalsFor / goalsAgainst | ✅ | ✅ | ✅ | No | High | Standings |
| goalDifference | ✅ | ✅ | 🔧 | No | High | Standings |
| form (last 5) | ✅ | ⚠️ | — | Yes | Low | Standings |
| qualificationStatus | ❌ | ❌ | 🔧 | No | High | Standings (qualification engine) |

---

## Head-to-Head Fields

| Field | FD | AF | Nullable | Reliable | Consumer |
|---|---|---|---|---|---|
| aggregates.numberOfMatches | ✅ | ❌ | No | High | H2H section |
| aggregates.wins.homeTeam | ✅ | ❌ | No | High | H2H section |
| aggregates.wins.awayTeam | ✅ | ❌ | No | High | H2H section |
| aggregates.draws | ✅ | ❌ | No | High | H2H section |
| aggregates.goals (total) | ✅ | ❌ | No | High | H2H section |
| matches[] (last N) | ✅ | ❌ | No | High | H2H section |

**Note:** H2H is ONLY available via football-data.org. api-football does NOT implement it.

---

## Computed/Derived Fields (No External Provider)

| Field | Engine | Input | Consumer |
|---|---|---|---|
| qualificationStatus | Qualification Engine | StandingTable[] | Standings, group pages, team pages |
| qualificationReason | Qualification Engine | StandingTable[] | Group page, team page |
| qualificationProbability | Qualification Engine | StandingTable[] | Team page |
| stageLabel | Knockout VM | match.stage | Bracket, round pages |
| slotLabel ("1st Group A") | Knockout VM | standings + authority | Bracket before group resolution |
| narrativeSections | Story Engine | MatchDetail | Match page article |
| matchType (WC_GROUP etc.) | Story Engine | competition.code + stage | Match page |

---

## Static Fields (Build-time, No API)

| Field | Source | Coverage | Consumer |
|---|---|---|---|
| team.slug | wc-all-teams.ts | All 48 WC teams | WC team pages |
| team.fifaRank | wc-all-teams.ts / teams.json | All 48 WC teams | Team pages |
| team.confederation | wc-all-teams.ts / teams.json | All 48 WC teams | Team pages |
| team.intro (prose) | wc-teams.ts | 6 featured teams | WC team pages |
| team.keyPlayers[] | wc-teams.ts | 6 featured teams | WC team pages |
| team.broadcasts[] | wc-teams.ts | 6 featured teams | Team pages |
| venue.capacity | stadiums.json / wc-venues.ts | 16 WC venues | Venue pages |
| venue.transport[] | wc-venues.ts | 16 WC venues | Venue pages |
| venue.faq[] | wc-venues.ts | 16 WC venues | Venue pages |
| broadcasters (country) | tv-guide.json | 25+ countries | TV guide page |
| fixtures (static slots) | fixtures.json | 104 matches | Schedule fallback |

---

## UNAVAILABLE Fields (confirmed absent from all sources)

| Field | Why unavailable |
|---|---|
| xG (expected goals) | No provider supplies it |
| Shot counts (total / on target) | No provider supplies it |
| Possession % | No provider supplies it |
| Pass accuracy | No provider supplies it |
| Player ratings | No provider supplies it |
| Player heatmaps | No provider supplies it |
| Player distance covered | No provider supplies it |
| Attendance figures | No provider supplies it |
| Weather (temperature, conditions) | No provider supplies it |
| Broadcast rights (per-match) | Static country-level only |
| Injury data | No provider supplies it |
| VAR decisions | No provider supplies it |
| Manager post-match quotes | No provider supplies it |
| Player market value | No provider supplies it |
| Tactical formations (string) | Not reliably available |
| Player nationality | Not in match events |
| Score at extra time | FD doesn't expose it; AF does but not integrated |
| Penalty shootout scores | FD doesn't expose it; AF does but not integrated |
