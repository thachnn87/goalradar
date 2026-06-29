# DATA_OWNERSHIP — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED ✅

---

## Rule

Every field has ONE owner. The owner is the authoritative read source.
Downstream layers (snapshot, UI, SEO) must read from the owner — never from a peer layer.

---

## Match Fields

| Field | Owner | Why | Fallback |
|---|---|---|---|
| match.id | **football-data.org** | FD IDs are the primary keys throughout the system | Static synthetic ID (negative) |
| match.utcDate | **football-data.org** | Authoritative date/time source | Static fixtures.json |
| match.status | **authority:v1** | Live cache overlay applied here; FD bulk feed is the base | KV snapshot |
| match.minute | **live cache** (`goalradar:live:matches`) | Live clock updated independently | authority:v1 minute field |
| match.stage | **football-data.org** | FD stages are canonical (LAST_32, FINAL, etc.) | Static fixtures.json |
| match.group | **football-data.org** | FD group codes (GROUP_A–GROUP_L) | Static groups.json |
| match.matchday | **football-data.org** | FD matchday number | — |
| match.lastUpdated | **football-data.org** | Provider timestamp | — |
| score.fullTime | **football-data.org → authority:v1** | FD is authoritative for score; authority:v1 preserves it | KV snapshot (DR) |
| score.halfTime | **football-data.org** | FD provides HT score | KV snapshot |
| score.winner | **football-data.org → authority:v1** | Derived from FD fullTime score | KV snapshot |
| score.duration | **football-data.org** | FD exposes REGULAR / EXTRA_TIME / PENALTY_SHOOTOUT | api-football (partial) |
| score.extraTime | **api-football** (PARTIAL) | FD does not expose it | Not integrated yet |
| score.penalties | **api-football** (PARTIAL) | FD does not expose it | Not integrated yet |

---

## Match Events

| Field | Owner | Why | Fallback |
|---|---|---|---|
| goals[] | **football-data.org → enrichment** | FD goals for league; AF+ESPN enrichment for WC | DR snapshot |
| bookings[] | **football-data.org → enrichment** | Same enrichment pipeline | DR snapshot |
| substitutions[] | **football-data.org → enrichment** | Same enrichment pipeline | DR snapshot |
| referees[] | **football-data.org** | Only FD provides referee data | — |
| lineups[] | **ESPN (WC) / FD (leagues)** | ESPN enrichment for FINISHED WC; FD occasionally for leagues | — |
| venue (name) | **football-data.org** | FD match.venue string | Static fixtures.json venueCity |

---

## Competition / Team

| Field | Owner | Why | Fallback |
|---|---|---|---|
| competition.name | **football-data.org** | Canonical name from FD | Static COMPETITIONS constant |
| competition.code | **football-data.org** | WC, PL, CL, etc. — FD codes used throughout | Static constant |
| team.id (numeric) | **football-data.org** | FD IDs are the system's primary team keys | — |
| team.name | **football-data.org** | FD names used across all caches | Static wc-all-teams.ts |
| team.shortName | **football-data.org** | FD shortName | wc-all-teams.ts shortName |
| team.tla | **football-data.org** | 3-letter code | — |
| team.crest (URL) | **football-data.org** | Logo CDN URL from FD | — |
| team.slug | **wc-all-teams.ts** | URL slugs defined statically; no FD equivalent | — |
| team.fifaRank | **wc-all-teams.ts / teams.json** | Static; no live FIFA ranking API | — |
| team.confederation | **wc-all-teams.ts / teams.json** | Static | — |
| team.coach | **football-data.org (via getTeam)** | Live coach from FD team profile | wc-teams.ts (6 teams) |
| team.squad[] | **football-data.org (via getTeam)** | Squad from FD team profile | — |
| team.intro (prose) | **wc-teams.ts / wc-all-teams.ts** | Editorial content; no API | — |

---

## Standings

| Field | Owner | Why | Fallback |
|---|---|---|---|
| standings (league) | **football-data.org** | FD /competitions/{code}/standings | api-football |
| standings (WC group) | **football-data.org** | FD WC standings endpoint | Derived from match results |
| qualificationStatus | **Qualification Engine** | Computed from StandingTable[]; no external source | positionToStatus() |
| qualificationReason | **Qualification Engine** | Computed; no external source | — |
| qualificationProbability | **Qualification Engine** | Computed; no external source | — |

---

## Venues

| Field | Owner | Why | Fallback |
|---|---|---|---|
| venue name (match.venue) | **football-data.org** | Match-level venue string from FD | Static fixtures.json |
| venue capacity | **wc-venues.ts / stadiums.json** | Static; no API provides this | — |
| venue city | **wc-venues.ts / stadiums.json** | Static | FD api-football city field |
| venue transport | **wc-venues.ts** | Editorial; no API | — |
| venue history | **wc-venues.ts** | Editorial; no API | — |

---

## Head-to-Head

| Field | Owner | Why | Fallback |
|---|---|---|---|
| headToHead | **football-data.org** | Only FD implements H2H endpoint | KV snapshot |

---

## Broadcast / TV

| Field | Owner | Why | Fallback |
|---|---|---|---|
| broadcasters (country-level) | **tv-guide.json** | Static; no live rights API | — |
| broadcaster (per-match) | **NONE** | No provider supplies this | — |

---

## Narrative / SEO

| Field | Owner | Why | Fallback |
|---|---|---|---|
| matchType (WC_GROUP etc.) | **Story Engine** | Derived from competition.code + stage | — |
| narrativeSections (5 sections) | **Story Engine** | Only source; buildReportSections() deleted | — |
| stageLabel ("Round of 32") | **Story Engine** | Derived from STAGE_LABELS map | — |
| nextStageLabel | **Story Engine** | Derived from STAGE_NEXT map | — |
| slotLabel ("1st Group A") | **Knockout VM** | Computed from standings + bracket | — |
| matchPage `<title>` | **generateMetadata()** | In match page file | — |
| FAQs | **buildFaqs()** | In match page file | — |
| Article JSON-LD | **MatchReport component** | In match page file | — |
| SportsEvent JSON-LD | **JsonLd component** | In match page file | — |

---

## KV Cache Ownership

| KV Key | Owner (writes) | Readers |
|---|---|---|
| `goalradar:authority:v1` | cron orchestrator | Hub, bracket, round pages, schedule |
| `goalradar:match:{id}` | getOrBuildMatchSnapshot() | Match page |
| `goalradar:dr:match:{id}` | getOrBuildMatchSnapshot() | Emergency fallback |
| `goalradar:/matches/{id}` | refreshEndpoint() via cron | Snapshot builder |
| `goalradar:live:matches` | live-cache.ts (dedicated refresh) | Snapshot overlay, hub |
| `goalradar:espn:lookup:{id}` | espn-id-map.ts | ESPN enrichment |
| `goalradar:espn:event:{id}` | espn-id-map.ts | ESPN enrichment |
| `goalradar:af:events:{id}` | af-id-map.ts | AF enrichment |
| `goalradar:rate-safe:active` | rate-safe.ts | All provider calls |

---

## Ownership Conflicts / Risks

| Risk | Description | Mitigation |
|---|---|---|
| Score drift | FD score in detail KV ≠ score in snapshot | Score drift guard rebuilds snapshot under 30-min lock |
| AF score override | AF enrichment may report wrong scores | FD score restoration step after enrichment |
| Stale authority | authority:v1 older than 5 min during group stage | 5-min TTL + cron refresh every minute |
| TBD knockout teams | homeTeam.id=0 until group completes | 5-min rebuild lock + slot label injection |
| ESPN wrong team match | ESPN team name matching fails | Normalised alias map + negative cache backoff |
