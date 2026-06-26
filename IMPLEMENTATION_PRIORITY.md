# IMPLEMENTATION_PRIORITY — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED — Rankings derived from confirmed data availability, not guesses.

---

## Priority Definitions

| Priority | Definition | Implication |
|---|---|---|
| **P0** | 100% of required data is available RIGHT NOW | Can implement in next sprint with zero provider work |
| **P1** | 80%+ data available; small integration gap | Small data gap to close (1–3 days), then build |
| **P2** | ~50% data available; meaningful gap | Requires either a new provider integration OR a new internal system |
| **P3** | Data does NOT exist from any current provider | Do NOT implement until provider contract is in place |

---

## P0 — Implement Now (Data 100% Ready)

These features have all required data available in KV today.

| # | Feature | Data sources | Sprint estimate | Notes |
|---|---|---|---|---|
| 1 | **Road to Final UI** | authority:v1, knockout-vm.ts, Story Engine | 1 sprint | Engine built; UI only |
| 2 | **Qualification Simulator** | Qualification Engine, FD standings | 1 sprint | Engine built; interactive UI only |
| 3 | **Live Qualification Status** | Qualification Engine (per request) | 0.5 sprint | Widget refresh during group stage |
| 4 | **Story Cards** | MatchSnapshot, H2H, qual engine | 1 sprint | Rules in STORY_CARD_ENGINE.md; render only |
| 5 | **Match Timeline** | Snapshot.goals + bookings + substitutions | 0.5 sprint | Merge by minute; no new data |
| 6 | **Knockout Journey (team path)** | authority:v1 (all knockout matches) | 0.5 sprint | Filter by team.id across stages |
| 7 | **Group Standings Widget (on match page)** | Snapshot.standings + qual status | 0.5 sprint | Data in snapshot; UI missing |
| 8 | **TV Schedule page** | tv-guide.json (25+ countries) | 0.5 sprint | Data exists; may need a page |
| 9 | **Probability display (group page)** | Qual engine probability (0–1) | 0.5 sprint | Compute per request; render bar |
| 10 | **SEO: JSON-LD FAQ coverage** | buildFaqs() (already built) | 0 sprint | Already built; verify rendering |
| 11 | **Referee detail (name + flag)** | Snapshot.match.referees[] | 0.5 sprint | Name + nationality available |
| 12 | **H2H summary (on match page)** | Snapshot.headToHead | 0 sprint | Already rendered; verify format |
| 13 | **Score duration indicator (ET / PK)** | score.duration (FD) | 0.5 sprint | FD exposes REGULAR/EXTRA_TIME/PENALTY_SHOOTOUT |

---

## P1 — Implement After Small Data Gap

These features need 1–3 days of data work before the UI can be built. Do not start UI until the data gap is confirmed closed.

| # | Feature | Data gap | Gap fix | Sprint estimate (total) |
|---|---|---|---|---|
| 14 | **ET / Penalty Scores** | score.extraTime and score.penalties absent from canonical model | Wire api-football score.extraTime/penalties into authority:v1 | 1 sprint (data) + 0.5 sprint (UI) |
| 15 | **Fan Prediction** | No prediction data exists | Internal KV system: POST /api/predict, GET /api/predict/{id} | 1 sprint (internal infra) + 1 sprint (UI) |
| 16 | **Golden Boot Leaderboard** | goals[].scorer.name exists; no cross-match aggregation | Add scorer aggregation to post-FINISHED cron; store in `goalradar:golden-boot:WC:2026` | 1 sprint (aggregation + UI) |
| 17 | **Momentum Chart (goals-based)** | Possession / xG absent; goal-based version possible | Use existing goals timeline; display score lead changes by minute | 0.5 sprint (limited scope) |
| 18 | **Player Spotlight (basic)** | Name/goals/assists present; photo/nationality absent | Build without photo; show name + stat card | 0.5 sprint (no photo) |

---

## P2 — Requires New Integration or New System

These features need either a new provider to be wired in OR a non-trivial internal system to be built. Do not plan in current sprint.

| # | Feature | What's missing | Required provider / system | Estimated effort |
|---|---|---|---|---|
| 19 | **Player profile (nationality / age / club)** | Not available from FD, AF, or ESPN | New enrichment layer (free sports API or Wikipedia scrape) | 2–3 sprints |
| 20 | **Live FIFA Rankings** | Static hardcoded rankings only | FIFA rankings API or licensed feed | 2 sprints |
| 21 | **Formation display (tactical)** | Tactical formation string absent | AF provides "formation" string on lineups endpoint — integrate | 1 sprint |
| 22 | **Player career goals / caps** | Not available from any provider | New stats enrichment layer | 3 sprints |
| 23 | **Lineup pitch diagram** | Lineups partial; position coordinates absent | Position mapping from shirt number + formation string | 2 sprints |

---

## P3 — Do NOT Implement Until Provider Exists

These features have NO viable data source from any currently integrated or accessible provider. Implementing placeholder UI for these would either display fake data or render empty/broken. Do not implement.

| # | Feature | Blocker | Provider needed |
|---|---|---|---|
| 24 | **xG (Expected Goals)** | No shot-level data anywhere | StatsBomb, Opta, Wyscout |
| 25 | **Shots on target / total** | No shot data from any provider | StatsBomb, Opta |
| 26 | **Possession %** | No possession data from any provider | StatsBomb, Opta |
| 27 | **Heatmaps** | No player tracking data | STATSperform, Hawkeye |
| 28 | **Pass accuracy** | No pass-level data | Opta, StatsBomb |
| 29 | **Golden Glove (keeper saves)** | No keeper save stats | New stats provider |
| 30 | **Attendance** | No provider supplies attendance | FIFA official data feed |
| 31 | **Weather at kickoff** | No weather integration | OpenWeatherMap or similar |
| 32 | **Player ratings** | No ratings from any provider | Sofascore feed or licensed ratings |
| 33 | **Stadium photos** | No image assets or CDN | Photo licensing + CDN |
| 34 | **Broadcaster (per-match)** | No broadcast rights API | Licensed rights data feed |
| 35 | **Pre-match injury reports** | No injury API | FantasyData, RotoBaller, or similar |
| 36 | **Manager quotes** | Not a data API problem; requires editorial/news pipeline | NLP from news feeds |
| 37 | **VAR decisions** | No VAR event data from any provider | Opta/Wyscout VAR data |

---

## Sprint Sequencing Recommendation

| Sprint | Features | Rationale |
|---|---|---|
| S1 | Road to Final UI, Story Cards, Match Timeline | All P0; highest WC narrative value |
| S2 | ET/PK scores (P1 data gap), Fan Prediction system | Close the most visible data gaps before Final |
| S3 | Golden Boot, Qualification Simulator UI, Live Qual Widget | Tournament awards + qualification tension |
| S4 | Momentum Chart, Player Spotlight, Group Standings Widget | Match page depth |
| S5 | Formation integration (P2), Player profile enrichment | Requires provider evaluation |
| S6+ | P3 features only after provider contract signed | Not in current roadmap |

---

## What MUST NOT Be Built Yet

1. **Attendance** — No provider. Do not show "N/A" or fake figures. Hide entirely.
2. **Weather** — No provider. Do not show placeholder. Hide entirely.
3. **xG / shots / possession** — No provider. Do not show zeros. Hide entirely.
4. **Player ratings** — No provider. Do not invent ratings.
5. **Stadium photos** — No assets. Do not show broken images.

Displaying a P3 feature with fake or estimated data is worse than not showing it.
