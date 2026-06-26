# PROVIDER_INVENTORY — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED from source code ✅

---

## Source Files

| File | Role |
|---|---|
| `src/lib/providers/football-data.ts` | Primary provider implementation |
| `src/lib/providers/api-football.ts` | Secondary provider + normalisation |
| `src/lib/providers/espn.ts` | Enrichment-only client |
| `src/lib/providers/manager.ts` | Failover orchestration |
| `src/lib/ga4-reporting.ts` | Analytics reporting (not data) |
| `src/lib/rate-limiter.ts` | Token-bucket limiter (7 s/req) |
| `src/lib/rate-safe.ts` | Circuit-breaker + tier scheduling |
| `src/lib/af-id-map.ts` | FD ↔ AF cross-ID mapping |
| `src/lib/espn-id-map.ts` | ESPN event ID lookup + negative cache |

---

## Provider 1 — football-data.org

| Property | Value |
|---|---|
| **Role** | Primary — all competitions, authoritative for score + status |
| **Base URL** | `https://api.football-data.org/v4` |
| **Auth** | Header `X-Auth-Token: {FOOTBALL_API_KEY}` |
| **Rate limit** | 10 req/min (free plan); enforced at 1 req/7 s (~8.5 req/min) |
| **Timeout** | 10 s |
| **Failover source** | Triggers api-football failover on 429/403/5xx/timeout |
| **Refresh interval** | Tier-aware: 30 s (live) → 15 min (fixtures) → 6 h (WC structure) |
| **Competitions** | WC, PL, PD, BL1, SA, FL1, CL (7 total) |

### Endpoints

| Method | Endpoint | Returns |
|---|---|---|
| `getMatch(id)` | `/matches/{id}` | MatchDetail (goals, bookings, subs, referees, venue, lineups) |
| `getFixtures(comp)` | `/competitions/{code}/matches?status=SCHEDULED,TIMED` | Match[] |
| `getResults(comp)` | `/competitions/{code}/matches?dateFrom=…&dateTo=today` | Match[] (last 30 days) |
| `getStandings(comp)` | `/competitions/{code}/standings` | StandingTable[] |
| `getLiveMatches()` | `/matches?status=IN_PLAY,PAUSED` | Match[] (all competitions) |
| `getAllMatches(comp)` | `/competitions/{code}/matches` | Match[] (all statuses) |
| `getTodayMatches()` | `/matches?dateFrom=today&dateTo=today` | Match[] |
| `getTeamMatches(id)` | `/teams/{id}/matches?status=FINISHED&limit=10` | Match[] |
| `getTeam(id)` | `/teams/{id}` | TeamDetail |
| `getHeadToHead(matchId)` | `/matches/{matchId}/head2head` | HeadToHead |

### Field availability by endpoint

| Field | /matches/{id} | /competitions/{code}/matches | /teams/{id} | /standings |
|---|---|---|---|---|
| id | ✅ | ✅ | ✅ | ✅ |
| utcDate | ✅ | ✅ | ✅ | — |
| status | ✅ | ✅ | ✅ | — |
| score (FT + HT) | ✅ | ✅ | ✅ | — |
| minute | ✅ | ✅ (live) | ✅ (live) | — |
| stage | ✅ | ✅ | ✅ | ✅ |
| group | ✅ | ✅ | ✅ | ✅ |
| matchday | ✅ | ✅ | ✅ | — |
| homeTeam / awayTeam | ✅ | ✅ | ✅ | ✅ |
| goals (scorer, assist, minute, type) | ✅ | ❌ | ❌ | — |
| bookings (card, minute, player) | ✅ | ❌ | ❌ | — |
| substitutions (in, out, minute) | ✅ | ❌ | ❌ | — |
| referees (name, nationality) | ✅ | ❌ | ❌ | — |
| venue (name only) | ✅ | ❌ | ❌ | — |
| lineups (starters, formation) | ✅ (sometimes) | ❌ | ❌ | — |
| head-to-head | via separate endpoint | ❌ | ❌ | — |
| team.address | ❌ | ❌ | ✅ | — |
| team.coach | ❌ | ❌ | ✅ | — |
| team.squad (roster) | ❌ | ❌ | ✅ | — |
| team.venue (stadium name) | ❌ | ❌ | ✅ | — |
| standings rows | — | — | — | ✅ |
| form string | — | — | — | ✅ |

### NOT provided by football-data.org

- xG (expected goals)
- Shot counts / on target
- Possession %
- Pass accuracy
- Player ratings
- Player heatmaps
- Attendance figures
- Weather
- Broadcast rights / TV schedules
- Injury data
- Manager tactics / formation
- VAR decisions
- Player market value
- Historical win probabilities

### Retry policy

| Error | Action |
|---|---|
| 429 | Wait `Retry-After` header (default 60 s), 1 retry, activate rate-safe mode |
| 403 | No retry, activate rate-safe mode ≥ 1 h |
| 5xx | Wait 1 s, 1 retry |
| Timeout | Wait 1 s, 1 retry, activate circuit breaker 15–60 min |
| 404 | Throw NotFoundError immediately (no failover) |
| Other 4xx | Throw immediately |

---

## Provider 2 — api-football (api-sports.io)

| Property | Value |
|---|---|
| **Role** | Secondary — automatic failover when football-data.org unavailable |
| **Base URL** | `https://v3.football.api-sports.io` |
| **Auth** | Header `x-apisports-key: {API_FOOTBALL_KEY}` |
| **Feature flag** | `ENABLE_API_FOOTBALL` (default: "true") |
| **Retry** | Max 3 retries, exponential backoff (429: attempt×5 s, other: attempt×1 s) |
| **Timeout** | 10 s |
| **Competitions** | Same 7 codes via ID mapping (WC→1, PL→39, etc.) |

### ID Mapping (FD competition code → AF league ID)

```
WC  → leagueId: 1,   season: 2026
PL  → leagueId: 39,  season: 2025
PD  → leagueId: 140, season: 2025
BL1 → leagueId: 78,  season: 2025
SA  → leagueId: 135, season: 2025
FL1 → leagueId: 61,  season: 2025
CL  → leagueId: 2,   season: 2025
```

### Endpoints

| Method | Endpoint | Notes |
|---|---|---|
| `getMatch(id)` | `/fixtures?id={id}` | Best-effort via cross-ID map |
| `getFixtures(comp)` | `/fixtures?league={id}&season={s}&status=NS-TBD` | |
| `getResults(comp)` | `/fixtures?league={id}&season={s}&status=FT-AET-PEN&from=…` | |
| `getStandings(comp)` | `/standings?league={id}&season={s}` | |
| `getLiveMatches()` | `/fixtures?live=all` | |
| `getAllMatches(comp)` | `/fixtures?league={id}&season={s}` | |
| `getTodayMatches()` | `/fixtures?date={YYYYMMDD}` | |
| `getTeamMatches(id)` | `/fixtures?team={id}&last=10&status=FT-AET-PEN` | Best-effort ID mapping |
| `getTeam(id)` | `/teams?id={id}` | Minimal profile |
| `getHeadToHead(matchId)` | **NOT SUPPORTED** — throws NotFoundError | |

### NOT provided by api-football

- Head-to-head data (not implemented in client)
- Reliable cross-ID team matching (best-effort only)
- Same field gaps as football-data.org for xG, attendance, etc.

---

## Provider 3 — ESPN (Enrichment Only)

| Property | Value |
|---|---|
| **Role** | Post-match enrichment: goals, cards, subs, lineups for WC FINISHED matches |
| **Base URL** | `https://site.api.espn.com/apis/site/v2/sports/soccer` |
| **Auth** | None (public API) |
| **League param** | `fifa.world` (env: `ESPN_WC_LEAGUE`) |
| **Scope** | WC matches only, FINISHED status only |
| **Policy** | Best-effort; failure never blocks data flow |
| **Feature flag** | `ENABLE_ESPN_ENRICHMENT` (default: "true" when KV available) |
| **Timeout** | 10 s |
| **Enrichment order** | AF enrichment tried first; ESPN is fallback |
| **Competition coverage** | WC 2026 only |

### Endpoints

| Method | Endpoint | Returns |
|---|---|---|
| `findEspnMatch(home, away, date)` | `/fifa.world/scoreboard?dates={YYYYMMDD}` | ESPN event ID (string) |
| `getEspnMatchEvents(espnId)` | `/fifa.world/summary?event={id}` | EspnMatchEvents |

### EspnMatchEvents fields

```
goals[]:
  scorer { id, name }
  assist { id, name } | null
  minute, injuryTime
  type (REGULAR | OWN_GOAL)
  team

bookings[]:
  player { id, name }
  card (YELLOW | RED | YELLOW_RED)
  minute, team

substitutions[]:
  playerOut { id, name }
  playerIn  { id, name }
  minute, team

lineups:
  home / away:
    team
    players[]:
      id, name, position (abbreviated)
      jersey, starter (bool)
      formationPlace, subbedIn, subbedOut
```

### ESPN caching

| KV Key | TTL | Purpose |
|---|---|---|
| `goalradar:espn:lookup:{fdMatchId}` | 30 days | ESPN event ID (immutable once found) |
| `goalradar:espn:event:{fdMatchId}` | 30 days | Cached events (immutable for FINISHED) |
| Negative miss record | 15 min → 1 h → 6 h → 24 h | Escalating backoff |

### NOT provided by ESPN enrichment

- Live event polling (ESPN not used for live matches)
- Pre-match data
- Statistics (xG, shots, possession)
- Attendance
- Weather

---

## Provider 4 — Google Analytics 4 (Reporting Only)

| Property | Value |
|---|---|
| **Role** | Admin dashboard metrics — not part of data pipeline |
| **Purpose** | Page views, competition traffic, user segments |
| **Auth** | Service account JWT → OAuth2 token exchange |
| **Env vars** | `GOOGLE_ANALYTICS_PROPERTY_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` |
| **Data type** | Read-only reporting |
| **Fallback** | Returns null on missing config or API failure |
| **Impact on data pipeline** | NONE — admin view only |

---

## Internal Data Sources (Non-API)

### Authority:v1

| Property | Value |
|---|---|
| **KV key** | `goalradar:authority:v1` (CanonicalMatch[]) |
| **TTL** | ~5 min (refreshed by cron) |
| **Source** | Built from FD bulk feed + live cache overlay + enrichment |
| **Purpose** | Single truth for all WC match listings (hub, bracket, rounds, schedule) |
| **Owner** | `src/lib/canonical-match.ts` |

### Knockout VM

| Property | Value |
|---|---|
| **Source** | Derived from authority:v1 + standings |
| **Purpose** | R32/R16/QF/SF/TP/Final bracket with slot labels |
| **Owner** | `src/lib/knockout-vm.ts` |
| **KV key** | None (computed on demand, no dedicated KV entry) |

### Static WC Files (bundled at build time)

| File | Content | TTL |
|---|---|---|
| `src/data/worldcup/teams.json` | 48 teams (slug, name, flag, group, confederation, fifaRank) | Permanent |
| `src/data/worldcup/groups.json` | 12 group compositions | Permanent |
| `src/data/worldcup/stadiums.json` | 16 venues (name, city, capacity) | Permanent |
| `src/data/worldcup/fixtures.json` | 104 match slots (dates, venues, team slots) | Permanent |
| `src/data/worldcup/tv-guide.json` | Broadcaster by country (25+ countries) | Manual update |

### In-Memory Engines

| Engine | File | Output |
|---|---|---|
| Qualification Engine | `src/lib/wc-qualification.ts` | QualificationStatus per team |
| Story Engine | `src/lib/match-story-engine.ts` | ReportSection[] narrative |
| Knockout VM builder | `src/lib/knockout-vm.ts` | KnockoutViewModel |

---

## Provider Failover Architecture

```
Request
  ↓
football-data.org (primary)
  ├─ success                 → return
  ├─ 404                     → propagate NotFoundError (no failover)
  └─ ApiUnavailableError
      (429/403/5xx/timeout)
        ├─ ENABLE_API_FOOTBALL=true
        │    ↓
        │  api-football (secondary)
        │    ├─ success      → return
        │    └─ failure      → KV disaster-recovery
        └─ ENABLE_API_FOOTBALL=false
             ↓
           KV disaster-recovery (30-day TTL)
```

---

## Rate Limits Summary

| Provider | Limit | GoalRadar enforcement |
|---|---|---|
| football-data.org | 10 req/min | 1 req/7 s token bucket |
| api-football | Varies by plan | 3 retries, exp backoff |
| ESPN | None (public) | Best-effort only |
| GA4 | Standard quotas | Graceful null on failure |
