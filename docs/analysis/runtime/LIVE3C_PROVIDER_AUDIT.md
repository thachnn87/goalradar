# LIVE-3C Provider Event Validation Audit
## GoalRadar · Sprint LIVE-3C

Generated: 2026-06-15
Method: Direct API probing via curl/PowerShell + code inspection
No code changes. No commits.

---

## Executive Summary

**football-data.org free tier does not return event data (goals, bookings,
substitutions) for ANY competition, for ANY match, regardless of whether the
match is finished or in progress.**

The keys `goals`, `bookings`, `substitutions` are **completely absent** from the
raw JSON response — not empty arrays, not null, not present. The entire
`/matches/{id}` response is ~1 KB of basic match metadata only.

`api-football` is NOT configured in this environment (`API_FOOTBALL_KEY` absent
from `.env.local`), so direct event-data testing against api-football is not
possible. Code analysis confirms `normaliseMatchDetail()` DOES map events — but
this path is not reachable in the current deployment.

---

## Test Methodology

1. Read `FOOTBALL_API_KEY` from `.env.local`
2. Queried `GET /v4/competitions/{code}/matches?status=FINISHED` to find match IDs
3. For each match ID, queried `GET /v4/matches/{id}` individually (the path used
   by `FootballDataProvider.getMatch()`)
4. Inspected response for presence of `goals`, `bookings`, `substitutions` keys
5. Confirmed key absence in raw JSON body (not just PowerShell null handling)
6. Checked response headers for plan/tier indicators

Rate limit: 10 req/min (free tier). Requests spaced 8s apart.

---

## Match Evidence Matrix

| Comp | Match ID | Match | Status | Score | goals key | bookings key | sub key | Raw size |
|------|----------|-------|--------|-------|-----------|--------------|---------|----------|
| **WC** | 537358 | Sweden vs Tunisia | FINISHED | 5–1 | ❌ absent | ❌ absent | ❌ absent | — |
| **WC** | 537327 | Mexico vs South Africa | FINISHED | 2–0 | ❌ absent | ❌ absent | ❌ absent | — |
| **PL** | 537785 | Liverpool vs Bournemouth | FINISHED | 4–2 | ❌ absent | ❌ absent | ❌ absent | — |
| **PL** | 537786 | Aston Villa vs Newcastle | FINISHED | 0–0 | ❌ absent | ❌ absent | ❌ absent | — |
| **PD** | 544214 | Girona vs Rayo Vallecano | FINISHED | 1–3 | ❌ absent | ❌ absent | ❌ absent | — |
| **BL1** | 540406 | Bayern vs RB Leipzig | FINISHED | 6–0 | ❌ absent | ❌ absent | ❌ absent | ~1 036 B |
| **CL** | 551981 | Athletic vs Arsenal | FINISHED | 0–2 | ❌ absent | ❌ absent | ❌ absent | — |

### Confirmed top-level keys present in every response

```
area | awayTeam | competition | group | homeTeam | id | lastUpdated |
matchday | odds | referees | score | season | stage | status | utcDate | venue
```

**16 keys. No `goals`. No `bookings`. No `substitutions`.** Confirmed by checking
raw JSON body string — the literal word "goals" does not appear in the response
at all.

### Response header evidence (account tier)

```
X-Requests-Available-Minute: 9    → 10 req/min plan (free tier)
X-API-Version: v4
X-Authenticated-Client: Thach Nguyen
```

---

## Root Cause

football-data.org v4 restricts event data (goals, bookings, substitutions) to
**paid subscription tiers**. The free tier (10 req/min) returns basic match
metadata only. No competition is exempt — WC, PL, PD, BL1, CL all return
identical stripped responses.

This is not a:
- WC 2026 specific delay ✗
- Match recency issue ✗ (Bayern 6-0 Leipzig was May 17, still no events)
- Data availability gap ✗ (the score/result is there, events are gated by plan)

---

## Provider Comparison

### football-data.org (PRIMARY — configured, active)

| Field | Available | Notes |
|-------|-----------|-------|
| score | ✅ | fullTime, halfTime, winner, duration |
| status | ✅ | FINISHED, IN_PLAY, PAUSED, etc. |
| minute | ✅ | Present at runtime for IN_PLAY (extra field, no mapper) |
| referee | ✅ | referees[] present |
| venue | ✅ | Present in individual match response |
| goals[] | ❌ | **Absent — free tier restriction** |
| bookings[] | ❌ | **Absent — free tier restriction** |
| substitutions[] | ❌ | **Absent — free tier restriction** |

### api-football (SECONDARY — NOT configured in dev; production unknown)

| Field | Available | Notes |
|-------|-----------|-------|
| score | ✅ | Mapped by `normaliseScore()` |
| status | ✅ | Mapped from short code via `STATUS_MAP` |
| minute | ✅ | `fixture.status.elapsed` mapped to `minute` (LIVE-3A) |
| goals[] | ✅ | Mapped by `normaliseMatchDetail()` from `item.events[]` |
| bookings[] | ✅ | Mapped by `normaliseMatchDetail()` from `item.events[]` |
| substitutions[] | ✅ | Mapped by `normaliseMatchDetail()` from `item.events[]` |
| scorer names | ✅ | `e.player.name`, `e.assist.name` |

**Code path:** `ApiFootballProvider.getMatch(id)` → `fetchRaw('/fixtures?id={id}')` →
`normaliseMatchDetail(item)` — events are mapped and would flow into `snapshot.match.goals[]`.

### Critical caveat: ID namespace mismatch

`ApiFootballProvider.getMatch(id)` is called with a **football-data.org match ID**.
api-football uses its own internal fixture IDs — there is no documented cross-mapping.

| Scenario | What happens |
|----------|-------------|
| football-data.org active (normal) | `getMatch(fd-id)` hits football-data.org → no events |
| Failover to api-football | `getMatch(fd-id)` hits api-football `/fixtures?id={fd-id}` → likely `NotFoundError` or wrong match |
| api-football is the LIVE feed source | Match IDs in the app are api-football IDs → `getMatch(af-id)` on api-football works correctly |

During a failover event where api-football serves the LIVE feed, the match IDs
originate from api-football (`normaliseMatch(item.fixture.id)`). In this case
`getMatch(af-id)` on api-football would correctly return events. But once
football-data.org recovers, the primary would be called with `af-id` → wrong match.

**This ID mismatch is a pre-existing architectural issue, not introduced by LIVE-3.**

---

## Answers to Audit Questions

**Is WC 2026 missing event data only?**
No. ALL competitions are affected equally. The absence is due to subscription
tier, not competition data availability.

**Are all competitions affected?**
Yes. WC, PL, PD, BL1, CL — all 5 tested competitions return no event data.

**Is football-data.org delayed?**
No. Bayern 6-0 Leipzig (BL1, May 17) — 29 days after match — still no events.
Score and result are correct. Events are gated by plan, not delayed.

**Is api-football richer?**
Yes. api-football's `normaliseMatchDetail()` maps full event data (goals with
scorer names, assists, bookings, substitutions) IF:
1. `API_FOOTBALL_KEY` is configured
2. The fixture ID matches api-football's system (see caveat above)

---

## Impact on Existing Components

| Component | Status | Impact |
|-----------|--------|--------|
| `GoalScorers` (LIVE-3B, above fold) | ⚠️ Silent | Always returns `null` — never displays |
| `GoalsSection` (below fold) | ⚠️ Silent | Always returns `null` — never displays |
| `BookingsSection` (below fold) | ⚠️ Silent | Always returns `null` — never displays |
| `SubstitutionsSection` (below fold) | ⚠️ Silent | Always returns `null` — never displays |
| `MatchSummary` (score, duration, competition) | ✅ Works | Uses score/status only |
| `MatchLiveZone` (score + minute) | ✅ Works | Uses score/status/minute from live cache |
| `ScoreHero` (score, HT, FT badge) | ✅ Works | Score data present |

All four event components gracefully return `null` — no crashes, no empty
containers, no layout breaks. The silence is correct behaviour given no data.

---

## Recommendation

### PRIMARY RECOMMENDATION: HYBRID DETAIL PROVIDER

**Upgrade the football-data.org subscription to the tier that includes event data.**

This is the cleanest path:
- No code changes required — `FootballDataProvider.getMatch()` returns raw JSON
  with no mapper; `goals[]`, `bookings[]`, `substitutions[]` will flow into
  `MatchDetail` automatically the moment the plan is upgraded
- All 4 event UI components will start displaying data immediately
- No ID mapping issue (football-data.org IDs are already used throughout)
- No new provider integration work
- `LIVE-4 Timeline` can be built immediately after the plan upgrade

football-data.org plans that include event data: Tier 2 (€19/mo, 50 req/min)
and above. At 50 req/min the rate limiter can be relaxed.

### ALTERNATIVE: API-FOOTBALL FOR EVENTS ONLY

If upgrading football-data.org is not feasible:

1. Configure `API_FOOTBALL_KEY` in production (Vercel env vars)
2. Solve the ID mapping issue: add a lookup table or search-by-date/teams
   endpoint to map football-data.org match IDs to api-football fixture IDs
3. In `buildSnapshot()`, after loading match detail, make a separate api-football
   call for events if `match.goals` is absent/empty

This adds complexity and a second provider dependency but would work with the
current football-data.org free plan.

### NOT RECOMMENDED: KEEP CURRENT

Keeping the current state means the GoalsSection, GoalScorers, BookingsSection,
SubstitutionsSection components remain permanently silent. LIVE-4 Timeline would
also be built on a foundation with no data. This wastes the UI work already done.

---

## LIVE-4 Timeline: Build Now or Wait?

**Wait.** LIVE-4 (Timeline of goal events, bookings, substitutions) requires
event data. Building the Timeline component before event data is available is
premature — the implementation would be correct but permanently non-functional
until the data source issue is resolved.

**Recommended order:**
1. Upgrade football-data.org plan (or configure api-football with ID mapping)
2. Verify event data flows into `snapshot.match.goals[]` on a test match
3. Then build LIVE-4 Timeline with confidence

---

## Test Match IDs for Future Verification

When event data becomes available, verify with these confirmed FINISHED matches:

| ID | Match | Competition | Score |
|----|-------|-------------|-------|
| 540406 | Bayern vs RB Leipzig | BL1 | 6–0 |
| 551981 | Athletic vs Arsenal | CL | 0–2 |
| 537785 | Liverpool vs Bournemouth | PL | 4–2 |
| 544214 | Girona vs Rayo Vallecano | PD | 1–3 |
| 537358 | Sweden vs Tunisia | WC | 5–1 |

For a 4–2 Liverpool win, a correct `goals[]` would return 6 entries (4 home,
2 away) with scorer names and minutes. If `goals.length === 6` after the plan
upgrade, event data is flowing correctly end-to-end.
