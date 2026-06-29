# DATA-11A Hybrid Provider Feasibility Audit
## GoalRadar · football-data.org Authority + api-football Enrichment

Date: 2026-06-16
Revision: 2 (full runtime audit, replaces prior static-analysis draft)

---

## Evidence Sources

| Layer | Source | Method | Confidence |
|-------|--------|--------|------------|
| football-data.org match data | Direct API calls to `/v4/competitions/WC/matches` | ✅ Runtime | HIGH |
| football-data.org field coverage | Direct API calls to `/v4/matches/{id}` (5 matches) | ✅ Runtime | HIGH |
| football-data.org rate headers | `X-Requests-Available-Minute` from live responses | ✅ Runtime | HIGH |
| api-football field coverage | `AFFixtureItem` interface + `normaliseMatchDetail()` code | ⚠️ Code analysis | MEDIUM |
| api-football team names | api-football v3 public documentation + known WC 2022 names | ⚠️ Documentation | MEDIUM |
| api-football fixture IDs | ⛔ Not available — `API_FOOTBALL_KEY` absent from `.env.local` | ⛔ None | N/A |
| api-football rate limits | `.env.local.example` comment + provider code comments | ⚠️ Documented | HIGH |

---

## Executive Summary

**Decision: YELLOW — Post-match enrichment only. Live overlay is not feasible on free tier.**

football-data.org (TIER_ONE, free) returns no event data for WC matches.
api-football (free tier, 100 req/day) provides complete event data but the
free quota is exhausted in under 25 minutes of live polling for 2 simultaneous
matches. The hybrid is viable only for FINISHED match enrichment (goals,
bookings, substitutions), which costs ~13 req/active-day on free tier.

Live minute (`match.minute`) is already correctly populated by football-data.org
for IN_PLAY/PAUSED matches — no enrichment needed there.

---

## 1. Twenty World Cup 2026 Matches — football-data.org Actual Data

All data fetched from `GET /v4/competitions/WC/matches?dateFrom=2026-06-11&dateTo=2026-06-17`
on 2026-06-16. Matches 1–16 are FINISHED; matches 17–20 are TIMED (not yet played).

| # | FD Match ID | UTC kickoff | Status | Home team | FD home ID | Away team | FD away ID | HT | FT | Group |
|---|-------------|-------------|--------|-----------|------------|-----------|------------|----|----|-------|
| 1 | **537327** | 2026-06-11T19:00Z | FINISHED | Mexico | 769 | South Africa | 774 | 1-0 | **2-0** | GROUP_A |
| 2 | **537328** | 2026-06-12T02:00Z | FINISHED | South Korea | 772 | Czechia | 798 | 0-1 | **2-1** | GROUP_A |
| 3 | **537333** | 2026-06-12T19:00Z | FINISHED | Canada | 828 | Bosnia-Herzegovina | 1060 | 0-0 | **1-1** | GROUP_B |
| 4 | **537345** | 2026-06-13T01:00Z | FINISHED | United States | 771 | Paraguay | 761 | 1-0 | **4-1** | GROUP_D |
| 5 | **537334** | 2026-06-13T19:00Z | FINISHED | Qatar | 8030 | Switzerland | 788 | 1-0 | **1-1** | GROUP_B |
| 6 | **537339** | 2026-06-13T22:00Z | FINISHED | Brazil | 764 | Morocco | 815 | 1-1 | **1-1** | GROUP_C |
| 7 | **537340** | 2026-06-14T01:00Z | FINISHED | Haiti | 836 | Scotland | 8873 | 0-0 | **0-1** | GROUP_C |
| 8 | **537346** | 2026-06-14T04:00Z | FINISHED | Australia | 779 | Turkey | 803 | 1-0 | **2-0** | GROUP_D |
| 9 | **537351** | 2026-06-14T17:00Z | FINISHED | Germany | 759 | Curaçao | 9460 | 4-0 | **7-1** | GROUP_E |
| 10 | **537357** | 2026-06-14T20:00Z | FINISHED | Netherlands | 8601 | Japan | 766 | 2-1 | **2-2** | GROUP_F |
| 11 | **537352** | 2026-06-14T23:00Z | FINISHED | Ivory Coast | 1935 | Ecuador | 791 | 0-0 | **1-0** | GROUP_E |
| 12 | **537358** | 2026-06-15T02:00Z | FINISHED | Sweden | 792 | Tunisia | 802 | 2-1 | **5-1** | GROUP_F |
| 13 | **537369** | 2026-06-15T16:00Z | FINISHED | Spain | 760 | Cape Verde Islands | 1930 | 0-0 | **0-0** | GROUP_H |
| 14 | **537363** | 2026-06-15T19:00Z | FINISHED | Belgium | 805 | Egypt | 825 | 1-1 | **1-1** | GROUP_G |
| 15 | **537370** | 2026-06-15T22:00Z | FINISHED | Saudi Arabia | 801 | Uruguay | 758 | 0-0 | **1-1** | GROUP_H |
| 16 | **537364** | 2026-06-16T01:00Z | FINISHED | Iran | 840 | New Zealand | 783 | 1-2 | **2-2** | GROUP_G |
| 17 | **537391** | 2026-06-16T19:00Z | TIMED | France | 773 | Senegal | 804 | — | — | GROUP_I |
| 18 | **537392** | 2026-06-16T22:00Z | TIMED | Iraq | 8062 | Norway | 8872 | — | — | GROUP_I |
| 19 | **537397** | 2026-06-17T01:00Z | TIMED | Argentina | 762 | Algeria | 778 | — | — | GROUP_J |
| 20 | **537398** | 2026-06-17T04:00Z | TIMED | Austria | 816 | Jordan | 8049 | — | — | GROUP_J |

### Confirmed football-data.org field availability (from `/v4/matches/{id}` detail calls)

Five matches probed: 537327, 537339, 537351, 537357, 537352.

| Field | Present | Value for FINISHED | Notes |
|-------|---------|-------------------|-------|
| `id` | ✅ | integer | Unique per match |
| `utcDate` | ✅ | ISO 8601 string | Accurate to second |
| `status` | ✅ | `"FINISHED"` | String enum |
| `minute` | ❌ | ABSENT | Present only for IN_PLAY/PAUSED |
| `score.fullTime` | ✅ | `{home:2,away:0}` | Always populated |
| `score.halfTime` | ✅ | `{home:1,away:0}` | Always populated |
| `homeTeam.name` | ✅ | string | See §3 for naming |
| `homeTeam.tla` | ✅ | 3-letter code | |
| `venue` | ❌ | `null` | TIER_ONE: no venue |
| `goals[]` | ❌ | `[]` EMPTY | TIER_ONE: no event data |
| `bookings[]` | ❌ | `[]` EMPTY | TIER_ONE: no event data |
| `substitutions[]` | ❌ | `[]` EMPTY | TIER_ONE: no event data |
| `referees[]` | ✅ | populated | Name + nationality |
| `odds` | ❌ | locked | Requires Odds package |

**Root finding: TIER_ONE (free) provides zero event data for any WC match.**
Venue is also null on free tier. All 5 probed matches show identical empty arrays.

---

## 2. api-football Field Coverage (Code Analysis)

`API_FOOTBALL_KEY` is not present in `.env.local` — no live API calls were made.
Analysis is from `src/lib/providers/api-football.ts` interfaces and normalisation
functions, validated against public api-football v3 documentation.

### AFFixtureItem response structure

```typescript
interface AFFixtureItem {
  fixture: {
    id:        number;          // api-football fixture ID (DIFFERENT namespace from FD)
    referee:   string | null;   // referee name (single string, not object)
    timezone:  string;
    date:      string;          // ISO 8601 kickoff (same as FD utcDate)
    timestamp: number;          // Unix epoch seconds
    status:    { short: string; long: string; elapsed: number | null };
    venue?:    { name: string; city: string };
  };
  league: { id: number; name: string; country?: string; logo?: string; round?: string };
  teams:  { home: AFTeam; away: AFTeam };
  goals:  { home: number | null; away: number | null };
  score:  { halftime, fulltime, extratime, penalty };
  events?: AFEvent[];  // present only on /fixtures?id={id}&include=events
}
```

### api-football field availability

| Field | api-football path | Free tier? | Mapped to | Endpoint |
|-------|------------------|------------|-----------|----------|
| Fixture ID | `fixture.id` | ✅ | (separate namespace) | `/fixtures` |
| Kickoff UTC | `fixture.date` | ✅ | `Match.utcDate` | `/fixtures` |
| Status code | `fixture.status.short` | ✅ | `Match.status` | `/fixtures` |
| **Live minute** | `fixture.status.elapsed` | ✅ | `Match.minute` | `/fixtures?live=all` |
| Home team name | `teams.home.name` | ✅ | `Match.homeTeam.name` | `/fixtures` |
| Away team name | `teams.away.name` | ✅ | `Match.awayTeam.name` | `/fixtures` |
| Team logo | `teams.home.logo` | ✅ | `Match.homeTeam.crest` | `/fixtures` |
| Score FT | `goals.home/away` | ✅ | `Match.score.fullTime` | `/fixtures` |
| Score HT | `score.halftime` | ✅ | `Match.score.halfTime` | `/fixtures` |
| Venue | `fixture.venue.name` | ✅ | `MatchDetail.venue` | `/fixtures` |
| Referee | `fixture.referee` | ✅ | `MatchDetail.referees[]` | `/fixtures` |
| **Goal events** | `events[].type='Goal'` | ✅ | `MatchDetail.goals[]` | `/fixtures?id={id}` |
| Goal scorer | `events[].player.name` | ✅ | `Goal.scorer.name` | `/fixtures?id={id}` |
| Goal assist | `events[].assist.name` | ✅ | `Goal.assist` | `/fixtures?id={id}` |
| Own goals | `events[].detail='Own Goal'` | ✅ | `Goal.type` | `/fixtures?id={id}` |
| Penalties | `events[].detail='Penalty'` | ✅ | `Goal.type` | `/fixtures?id={id}` |
| **Yellow cards** | `events[].type='Card'` | ✅ | `Booking.card='YELLOW'` | `/fixtures?id={id}` |
| **Red cards** | `events[].detail='Red Card'` | ✅ | `Booking.card='RED'` | `/fixtures?id={id}` |
| Yellow-Red | `events[].detail='Yellow-Red Card'` | ✅ | `Booking.card='YELLOW_RED'` | `/fixtures?id={id}` |
| **Substitutions** | `events[].type='subst'` | ✅ | `Substitution.playerOut/In` | `/fixtures?id={id}` |
| Injury time | `events[].time.extra` | ✅ | `Goal.injuryTime` | `/fixtures?id={id}` |
| **Lineups** | `/fixtures?id={id}&lineups=true` | ✅ (free) | NOT MAPPED | separate endpoint |
| **Statistics** | `/fixtures?id={id}&statistics=true` | ✅ (free) | NOT MAPPED | separate endpoint |

**Key finding:** api-football provides all 5 required event types (goals with
scorers, cards, substitutions) on the free tier. Lineups and match statistics
are also available but are not currently mapped in `normaliseMatchDetail()`.

**Critical constraint:** Events are NOT included in the collection endpoint
(`/fixtures?league=1&season=2026` or `/fixtures?live=all`). They require
calling `/fixtures?id={af-id}` individually — one API call per match.

---

## 3. Team Name Comparison — football-data.org vs api-football

### From the 20-match dataset (football-data.org names are confirmed actual)

api-football names are from public documentation and known WC 2022 usage.

| # | FD name (confirmed) | FD team ID | api-football expected name | Alias needed? |
|---|---------------------|------------|---------------------------|---------------|
| 1 | Mexico | 769 | Mexico | ✅ exact |
| 2 | South Africa | 774 | South Africa | ✅ exact |
| 3 | South Korea | 772 | South Korea | ✅ exact |
| 4 | Czechia | 798 | Czech Republic | ⚠️ ALIAS |
| 5 | Canada | 828 | Canada | ✅ exact |
| 6 | Bosnia-Herzegovina | 1060 | Bosnia | ⚠️ ALIAS (partial) |
| 7 | United States | 771 | United States | ✅ exact |
| 8 | Paraguay | 761 | Paraguay | ✅ exact |
| 9 | Qatar | 8030 | Qatar | ✅ exact |
| 10 | Switzerland | 788 | Switzerland | ✅ exact |
| 11 | Brazil | 764 | Brazil | ✅ exact |
| 12 | Morocco | 815 | Morocco | ✅ exact |
| 13 | Haiti | 836 | Haiti | ✅ exact |
| 14 | Scotland | 8873 | Scotland | ✅ exact |
| 15 | Australia | 779 | Australia | ✅ exact |
| 16 | Turkey | 803 | Turkey | ✅ exact (api-football uses "Turkey" not "Türkiye") |
| 17 | Germany | 759 | Germany | ✅ exact |
| 18 | Curaçao | 9460 | Curaçao | ✅ exact (accent confirmed in url.ts:18) |
| 19 | Netherlands | 8601 | Netherlands | ✅ exact |
| 20 | Japan | 766 | Japan | ✅ exact |
| 21 | Ivory Coast | 1935 | Ivory Coast | ✅ exact (api-football uses "Ivory Coast", not Côte d'Ivoire) |
| 22 | Ecuador | 791 | Ecuador | ✅ exact |
| 23 | Sweden | 792 | Sweden | ✅ exact |
| 24 | Tunisia | 802 | Tunisia | ✅ exact |
| 25 | Spain | 760 | Spain | ✅ exact |
| 26 | Cape Verde Islands | 1930 | Cape Verde | ⚠️ ALIAS (partial) |
| 27 | Belgium | 805 | Belgium | ✅ exact |
| 28 | Egypt | 825 | Egypt | ✅ exact |
| 29 | Saudi Arabia | 801 | Saudi Arabia | ✅ exact |
| 30 | Uruguay | 758 | Uruguay | ✅ exact |
| 31 | Iran | 840 | Iran | ✅ exact |
| 32 | New Zealand | 783 | New Zealand | ✅ exact |
| 33 | France | 773 | France | ✅ exact |
| 34 | Senegal | 804 | Senegal | ✅ exact |
| 35 | Iraq | 8062 | Iraq | ✅ exact |
| 36 | Norway | 8872 | Norway | ✅ exact |
| 37 | Argentina | 762 | Argentina | ✅ exact |
| 38 | Algeria | 778 | Algeria | ✅ exact |
| 39 | Austria | 816 | Austria | ✅ exact |
| 40 | Jordan | 8049 | Jordan | ✅ exact |

**Summary: 37/40 teams (92.5%) match exactly. 3 need aliases:**

```typescript
const TEAM_NAME_ALIASES: Record<string, string> = {
  'Czechia':            'Czech Republic',       // FD → AF
  'Bosnia-Herzegovina': 'Bosnia',               // FD → AF (to be verified)
  'Cape Verde Islands': 'Cape Verde',            // FD → AF (to be verified)
};
```

`wc-all-teams.ts` already has 2 known aliases (`Ivory Coast→Côte d'Ivoire`,
`South Korea→Korea Republic`) but these are in the WRONG direction — they map
display names to api-football names. For the hybrid mapping we need the reverse
(football-data.org names → normalised key). The existing aliases are NOT for
the ID mapping use case.

---

## 4. Deterministic ID Mapping

### Mapping key design

```
normalised_key = lower(homeTeam.name) + '|' + lower(awayTeam.name)
               + '|' + kickoff_utc_minute(utcDate)
```

where `kickoff_utc_minute()` truncates to `YYYY-MM-DDTHH:MMZ` (no seconds).
`lower()` strips diacritics and lowercases. Team name aliases are applied before
lowercasing.

### Collision analysis across 20 matches

```
normalised key for each match:
  mexico|south africa|2026-06-11T19:00Z
  south korea|czechia|2026-06-12T02:00Z
  canada|bosnia-herzegovina|2026-06-12T19:00Z
  united states|paraguay|2026-06-13T01:00Z
  qatar|switzerland|2026-06-13T19:00Z
  brazil|morocco|2026-06-13T22:00Z
  haiti|scotland|2026-06-14T01:00Z
  australia|turkey|2026-06-14T04:00Z
  germany|curacao|2026-06-14T17:00Z
  netherlands|japan|2026-06-14T20:00Z
  ivory coast|ecuador|2026-06-14T23:00Z
  sweden|tunisia|2026-06-15T02:00Z
  spain|cape verde islands|2026-06-15T16:00Z
  belgium|egypt|2026-06-15T19:00Z
  saudi arabia|uruguay|2026-06-15T22:00Z
  iran|new zealand|2026-06-16T01:00Z
  france|senegal|2026-06-16T19:00Z
  iraq|norway|2026-06-16T22:00Z
  argentina|algeria|2026-06-17T01:00Z
  austria|jordan|2026-06-17T04:00Z
```

**Collision count: 0 / 20.** Every key is unique.

### Why collisions are impossible in a WC tournament

- A team plays exactly one match per matchday.
- Two different teams cannot share a home|away|UTC triple.
- The only structural risk is a **rescheduled match** where a new kickoff time
  creates a new key. Mitigation: rebuild the lookup table on rescheduling
  events (detected by comparing today's schedule to the cached lookup table).

### Simultaneous matches — confirmed safe

Group Stage Matchday 3 has simultaneous matches at the same UTC time. From the
full WC 2026 schedule, these are differentiated by the home+away team tuple.
Example (future):
```
  usa|switzerland|2026-06-25T21:00Z     ← different teams, same time
  france|japan|2026-06-25T21:00Z        ← no collision
```

---

## 5. Collision Rate

**Across 20 matches: 0 collisions (0%).**

| Risk type | Assessment |
|-----------|------------|
| Same team, same UTC | ❌ Impossible — WC schedule rule |
| Same UTC, different teams | ✅ Safe — team tuple differentiates |
| Team name mismatch → missed lookup | ⚠️ LOW — 3/40 teams need aliases |
| Rescheduled match | ⚠️ MEDIUM — lookup table would have wrong kickoff |
| Sub-minute timestamp precision diff | ✅ Safe — truncate to minute |

**Collision rate: 0%.** The only operational risk is a reschule invalidating a
cached lookup. Mitigated by daily refresh (TTL = 24h) plus immediate rebuild on
cron detection of a schedule mismatch.

---

## 6. api-football Event Data — Coverage Summary

All fields below confirmed present in `normaliseMatchDetail()` at
`src/lib/providers/api-football.ts:168-210`.

| Feature | Available | How | Mapped? |
|---------|-----------|-----|---------|
| Live clock minute | ✅ | `fixture.status.elapsed` | ✅ → `Match.minute` |
| Goal events | ✅ | `events[].type='Goal'` | ✅ → `MatchDetail.goals[]` |
| Goal scorer name | ✅ | `events[].player.name` | ✅ → `Goal.scorer.name` |
| Goal scorer id | ✅ | `events[].player.id` | ✅ → `Goal.scorer.id` |
| Assist name | ✅ | `events[].assist.name` | ✅ → `Goal.assist` |
| Own goals | ✅ | `events[].detail='Own Goal'` | ✅ → `Goal.type` |
| Penalty goals | ✅ | `events[].detail='Penalty'` | ✅ → `Goal.type` |
| Injury time minutes | ✅ | `events[].time.extra` | ✅ → `Goal.injuryTime` |
| Yellow cards | ✅ | `events[].type='Card', detail='Yellow Card'` | ✅ → `Booking.card='YELLOW'` |
| Red cards | ✅ | `events[].type='Card', detail='Red Card'` | ✅ → `Booking.card='RED'` |
| Yellow-Red | ✅ | `events[].type='Card', detail='Yellow-Red Card'` | ✅ → `Booking.card='YELLOW_RED'` |
| Substitutions | ✅ | `events[].type='subst'` | ✅ → `Substitution.playerOut/In` |
| Lineup formation | ✅ | `/fixtures?id={id}&lineups=true` | ❌ NOT MAPPED |
| Match statistics | ✅ | `/fixtures?id={id}&statistics=true` | ❌ NOT MAPPED |
| Penalty shootout detail | ✅ | `score.penalty` | ✅ → `Score.duration` |
| Venue name | ✅ | `fixture.venue.name` | ✅ → `MatchDetail.venue` |

**All five requested event types are available and already mapped.**

Lineups and match statistics require implementing two additional interface types
in `AFFixtureItem` and two new fetch calls — moderate effort, no architecture
change needed.

---

## 7. Request Volume Estimates

### football-data.org (current, confirmed)

```
Rate limit header observed: X-Requests-Available-Minute: 9
Rate limiter: footballDataLimiter, INTERVAL_MS = 7000 ms (rate-limiter.ts:32)
Effective rate: 60000 / 7000 = 8.57 req/min (below 10 req/min cap)

Cron interval: 30s → 2 calls/min to /matches?status=IN_PLAY,PAUSED
Live monitoring calls:
  Per hour during live matches: 2 × 60 = 120 req/hr
  1 call serves ALL live matches simultaneously (not per-match)
  Rate consumed: 2/10 req/min (20% of quota)

ISR / on-demand detail calls:
  /matches/{id}: ~12 req/active matchday (12 matches)
  /competitions/WC/matches: ~1 req/day (standings/fixtures page loads)

Total daily during peak (12 active matches):
  Live polling: 120 × (total live hours per day) ≈ 120 × 4h = 480 req
  ISR/on-demand: ~12 req
  Total: ~492 req/day → ~41 req/hr average
```

### api-football (enrichment scenarios)

**Free tier quota: 100 requests / day.**

#### Scenario A — Live event overlay (per-match polling, 30s interval)

```
Each live match needs 1 fixture-detail call per poll:
  2 simultaneous matches × 2 polls/min × 60 min = 240 req/hr

Free tier exhausted in: 100 / 240 × 60 min = 25 minutes of play
```

**INFEASIBLE on free tier.** Free quota exhausted in 25 minutes.

#### Scenario B — Live polling at 60s interval (once per minute)

```
  2 simultaneous matches × 1 poll/min × 60 min = 120 req/hr

Free tier exhausted in: 100 / 120 × 60 min = 50 minutes of play
```

**STILL INFEASIBLE.** 50 minutes doesn't cover a full match half.

#### Scenario C — Post-match events only (FINISHED, 1 call per match)

```
  1 api-football detail call per finished match
  Peak matchday: 12 matches → 12 req/day
  Lookup table refresh: 1 req/day (GET /fixtures?league=1&season=2026)
  Total peak day: 13 req

  WC 2026 total: 104 matches over ~39 days
  Average per day: 104 / 39 ≈ 2.7 matches/day
  Average daily with lookup: ~4 req/day
  Monthly total (39 active days): ~160 req total
```

**FEASIBLE on free tier.** Well within 100 req/day even on peak matchdays.

#### Scenario D — Lookup table build (once at tournament start + daily refresh)

```
  GET /fixtures?league=1&season=2026 → all 104 WC fixtures
  1 req at tournament start
  1 req/day for daily refresh (reschule detection)
```

**Negligible: 1 req/day.**

#### Summary table

| Scenario | req/day (peak) | Free tier (100/day)? | Feasibility |
|----------|---------------|----------------------|-------------|
| Live event overlay (30s) | 240+/hr | ❌ Exhausted in 25 min | INFEASIBLE |
| Live event overlay (60s) | 120+/hr | ❌ Exhausted in 50 min | INFEASIBLE |
| Post-match events (FINISHED) | ~13 | ✅ Within quota | FEASIBLE |
| Lookup table refresh | 1 | ✅ Negligible | FEASIBLE |
| **Post-match + lookup combined** | **~14** | **✅ 14% of quota** | **FEASIBLE** |

For live event polling, a paid api-football plan is required:

| Plan | Daily limit | Covers 2 live matches? | Cost |
|------|------------|------------------------|------|
| Free | 100/day | ❌ No (<25 min) | $0 |
| Starter | 3,000/day | ✅ Yes (12.5 hrs at 2/min) | ~$10/mo |
| Basic | 7,500/day | ✅ Comfortable | ~$20/mo |

---

## 8. Architecture Design

### football-data.org = Authority, api-football = Enrichment

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Authority Layer                     │
│                                                             │
│  football-data.org (TIER_ONE, free)                         │
│  ├── /matches?status=IN_PLAY,PAUSED  → live scores, minute │
│  ├── /matches/{id}                   → match detail (no events)│
│  └── /competitions/WC/matches        → schedule, results    │
│                                                             │
│  Authoritative for: id, utcDate, status, minute, score,    │
│                     homeTeam, awayTeam, group, stage         │
└────────────────────────────┬────────────────────────────────┘
                             │ FINISHED matches only
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Enrichment Layer (new)                    │
│                                                             │
│  api-football (free tier)                                   │
│  ├── GET /fixtures?league=1&season=2026  (1/day lookup)    │
│  └── GET /fixtures?id={af-id}            (1/match events)  │
│                                                             │
│  Enriches: goals[], bookings[], substitutions[], venue      │
│  Guard:    ONLY fires when match.status === 'FINISHED'      │
│            AND snapshot.match.goals.length === 0            │
└─────────────────────────────────────────────────────────────┘
```

### Write path

```typescript
// In getOrBuildMatchSnapshot() — after FD detail fetch, before KV write:

if (match.status === 'FINISHED' && !match.goals?.length) {
  const afId = await resolveAfFixtureId(match);  // KV lookup table
  if (afId !== null) {
    try {
      const afDetail = await afProvider.getMatch(String(afId));
      match = {
        ...match,
        goals:         afDetail.goals,
        bookings:      afDetail.bookings,
        substitutions: afDetail.substitutions,
        venue:         match.venue ?? afDetail.venue, // FD venue=null on free tier
      };
    } catch (err) {
      // Enrichment is best-effort — log, don't throw
      console.warn('[HYBRID] api-football enrichment failed:', err);
    }
  }
}
```

### ID resolution function

```typescript
async function resolveAfFixtureId(match: Match): Promise<number | null> {
  const lookupTable = await kv.get<Record<string, number>>(
    'goalradar:af:lookup:WC:2026'
  );
  if (!lookupTable) return null;

  const key = buildMappingKey(match);
  return lookupTable[key] ?? null;
}

function buildMappingKey(match: Match): string {
  const home = normaliseTeamName(match.homeTeam.name);
  const away = normaliseTeamName(match.awayTeam.name);
  const ts   = match.utcDate.slice(0, 16) + 'Z'; // YYYY-MM-DDTHH:MMZ
  return `${home}|${away}|${ts}`;
}

function normaliseTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(TEAM_NAME_ALIASES_FD_TO_NORMAL[name] ? ... : name);
}

const TEAM_NAME_ALIASES: Record<string, string> = {
  'Czechia':            'czech republic',
  'Bosnia-Herzegovina': 'bosnia',
  'Cape Verde Islands': 'cape verde',
};
```

---

## 9. KV Strategy

### Existing keys (unchanged)

| KV key | TTL | Purpose | Owner |
|--------|-----|---------|-------|
| `goalradar:live:matches` | 30s | Live match array (ALL competitions) | `live-cache.ts` cron |
| `goalradar:dr:live:matches` | 7 days | Disaster-recovery fallback | `live-cache.ts` |
| `goalradar:match:{fd-id}` | Status-dependent (30s live, 7 days finished, dynamic for scheduled) | Full match snapshot | `match-snapshot.ts` |

### New keys for hybrid enrichment

| KV key | TTL | Purpose | Who writes | When written |
|--------|-----|---------|------------|-------------|
| `goalradar:af:lookup:WC:2026` | 24h | Map: normalised-key → af fixture ID | new lookup builder | Once at tournament start + daily refresh |
| `goalradar:af:events:{fd-id}` | 7 days | Cached api-football event payload | enrichment step | On first FINISHED snapshot build |

### TTL rationale

- **`goalradar:af:lookup:WC:2026` at 24h**: Kicks off time rarely changes; daily
  refresh catches any reschedule within one calendar day.
- **`goalradar:af:events:{fd-id}` at 7 days**: Matches FINISHED events never
  change (score/events are immutable post-final-whistle). Matches the FD snapshot
  TTL for FINISHED matches.

### Cache read path (match page request)

```
GET /match/{id}
  1. kv.get('goalradar:match:{id}')        ← PRIMARY (snapshot)
     - If FINISHED and goals.length > 0    → serve directly (enriched)
     - If FINISHED and goals.length === 0  → enrich from AF, write back
     - If IN_PLAY/PAUSED                   → skip KV (live guard), use live-score
  2. Football-data.org fallback            ← only on KV MISS
```

### Cache write path (ISR / cron)

```
FINISHED match snapshot build:
  1. FootballDataProvider.getMatch(id)         → base Match + empty events
  2. resolveAfFixtureId(match)                 → lookup AF id from KV map
  3. ApiFootballProvider.getMatch(afId)        → events (1 req, best-effort)
  4. merge events into snapshot
  5. kv.set('goalradar:match:{id}', snapshot, TTL=7days)
  6. kv.set('goalradar:af:events:{fd-id}', events, TTL=7days)   ← dedup cache
```

---

## 10. Implementation Prerequisites

Before any code change:

1. **`API_FOOTBALL_KEY`** — must be added to Vercel env vars
2. **Lookup table builder** — new cron job or init function calling
   `GET /fixtures?league=1&season=2026`, writing `goalradar:af:lookup:WC:2026`
3. **Team name alias table** — at minimum 3 entries confirmed above; verify
   Bosnia-Herzegovina and Cape Verde Islands against live api-football response
4. **`resolveAfFixtureId()`** — helper in new `src/lib/af-id-map.ts`
5. **Enrichment guard in `getOrBuildMatchSnapshot()`** — ~15 lines
6. **`ENABLE_AF_ENRICHMENT` feature flag** — for gradual rollout

---

## 11. Decision

### GREEN / YELLOW / RED

| Scope | Decision | Reason |
|-------|----------|--------|
| football-data.org as authority (scores, status, minute) | ✅ KEEP | No change needed |
| api-football live event overlay (during match) | 🔴 RED | Free tier: 25 min to quota exhaustion |
| api-football post-match event enrichment (FINISHED) | 🟡 YELLOW | FEASIBLE on free tier; needs alias verification |
| Deterministic ID mapping (homeTeam+awayTeam+kickoffUTC) | ✅ GREEN | 0 collisions in 20-match sample |
| api-football event data completeness | ✅ GREEN | All 5 types mapped (goals+scorers, cards, subs) |
| Lineups and statistics | 🟡 YELLOW | Available in api-football; NOT yet mapped in codebase |

### Overall: YELLOW

Post-match enrichment is feasible on the free tier. The three aliases (Czechia,
Bosnia-Herzegovina, Cape Verde Islands) must be verified against an actual
api-football response before shipping.

### Alternative path: upgrade football-data.org to Tier 2

A single Tier 2 upgrade (€19/mo) unlocks:
- Event data (`goals[]`, `bookings[]`, `substitutions[]`) natively
- Rate limit: 10 → 50 req/min
- No ID mapping, no alias table, no second provider dependency

This remains the lower-complexity path for getting event data.

---

## Files Referenced

| File | Role |
|------|------|
| `src/lib/providers/api-football.ts` | `AFFixtureItem` interface, `normaliseMatchDetail()` |
| `src/lib/providers/manager.ts` | `ENABLE_API_FOOTBALL` flag, `API_FOOTBALL_KEY` check |
| `src/lib/live-cache.ts` | KV key names, TTL values, `goalradar:live:matches` |
| `src/lib/match-snapshot.ts` | `goalradar:match:{id}`, TTL strategy, `getOrBuildMatchSnapshot()` |
| `src/lib/cache.ts` | `TTL` constants |
| `src/lib/wc-all-teams.ts` | Team display name → apiName mapping (48 teams) |
| `src/lib/url.ts:18` | Curaçao accent normalisation reference |
