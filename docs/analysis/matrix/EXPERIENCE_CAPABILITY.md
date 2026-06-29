# EXPERIENCE_CAPABILITY — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED ✅

---

## Summary

| Experience Feature | Status | Priority |
|---|---|---|
| Road to Final | ✅ READY | P0 |
| Qualification Simulator | ✅ READY | P0 |
| Live Qualification | ✅ READY | P0 |
| Story Cards | ✅ READY | P0 |
| Timeline | ✅ READY | P0 |
| Knockout Journey | ✅ READY | P0 |
| Qualification Reason | ✅ READY | P0 |
| TV Schedule | ✅ READY | P0 |
| Venue Experience | ✅ READY | P0 |
| Travel Guide | ✅ READY | P0 |
| History (H2H) | ✅ READY | P0 |
| Referee | ✅ READY | P0 |
| Fan Prediction | ✅ READY | P1 |
| Momentum | ⚠️ PARTIAL | P1 |
| Player Spotlight | ⚠️ PARTIAL | P1 |
| Golden Boot | ⚠️ PARTIAL | P1 |
| Probability | ✅ READY | P1 |
| Weather | ❌ BLOCKED | P3 |
| Attendance | ❌ BLOCKED | P3 |
| Stadium Photos | ❌ BLOCKED | P3 |
| Player Form | ❌ BLOCKED | P3 |
| xG | ❌ BLOCKED | P3 |
| Heatmaps | ❌ BLOCKED | P3 |
| Golden Glove | ❌ BLOCKED | P3 |
| Broadcaster (per-match) | ❌ BLOCKED | P3 |
| Injuries | ❌ BLOCKED | P3 |

---

## READY Features

### Road to Final
- **Status:** ✅ READY
- **Data source:** authority:v1 + Story Engine + Knockout VM
- **Fields used:** stage, nextStageLabel, winner, homeTeam, awayTeam
- **Already built:** Story Engine generates "Road to the Final" section per knockout match
- **Missing:** Dedicated "Road to the Final" UI component showing full path (Group → R32 → R16 → QF → SF → Final)
- **Sprint to build:** 1 (UI only)

### Qualification Simulator
- **Status:** ✅ READY
- **Data source:** Qualification Engine + live standings (KV)
- **Fields used:** StandingTable[], playedGames, points, remaining
- **Already built:** `calculateQualificationStatus()` with probability estimates
- **Missing:** Interactive UI (sliders for remaining match outcomes)
- **Sprint to build:** 1 (UI only — no new data)

### Live Qualification
- **Status:** ✅ READY
- **Data source:** Qualification Engine + live standings
- **Already built:** Engine runs on every standings read; positionToStatus() fallback
- **Missing:** Live updating widget on group pages
- **Sprint to build:** 0.5

### Story Cards
- **Status:** ✅ READY
- **Data source:** Match data + H2H + qualification engine + static (rankings, host flags)
- **Available cards:** Winner Advances, Must Win, Host Nation, First WC Meeting, Group Winner, Best Third, Underdog, Revenge Match
- **Already built:** STORY_CARD_ENGINE.md documents all rules
- **Missing:** Story card generation function + UI render
- **Sprint to build:** 1

### Timeline
- **Status:** ✅ READY
- **Data source:** Snapshot goals[] + bookings[] + substitutions[]
- **Fields used:** minute, type, team, scorer, card, playerIn, playerOut
- **Already built:** All event data in MatchDetail.snapshot
- **Missing:** Timeline merge + UI component (merge sort goals+cards+subs by minute)
- **Sprint to build:** 0.5

### Knockout Journey
- **Status:** ✅ READY
- **Data source:** authority:v1 (all knockout matches) + Knockout VM
- **Fields used:** stage, winner, homeTeam, awayTeam, score
- **Already built:** Knockout VM builds full bracket
- **Missing:** "Team's path through the tournament" summary view
- **Sprint to build:** 0.5

### Qualification Reason
- **Status:** ✅ READY
- **Data source:** Qualification Engine
- **Already built:** qualificationReason string generated per team, wired into group + team pages
- **Missing:** Nothing — fully implemented

### TV Schedule
- **Status:** ✅ READY
- **Data source:** tv-guide.json (25+ countries)
- **Limitation:** Country-level only; not per-match
- **Missing:** TV guide page (may exist; not verified in this audit)
- **Sprint to build:** 0.5

### Venue Experience
- **Status:** ✅ READY
- **Data source:** wc-venues.ts (all 16 venues), stadiums.json
- **Fields:** name, capacity, city, country, transport[], faq[], intro, matchInfo[]
- **Already built:** Venue pages exist at `/world-cup-2026/venues/[slug]`
- **Missing:** Nothing — fully implemented

### Travel Guide
- **Status:** ✅ READY
- **Data source:** wc-venues.ts (VenueTransport[], airport info)
- **Already built:** Included in venue page data
- **Missing:** Nothing — fully implemented

### History (H2H)
- **Status:** ✅ READY
- **Data source:** FD head-to-head endpoint → KV snapshot
- **Fields:** aggregates (wins, draws, goals), matches[] history
- **Already built:** H2H section in match snapshot; deferred Suspense in match page
- **Missing:** Nothing — fully implemented

### Referee
- **Status:** ✅ READY
- **Data source:** FD referees[] (name, nationality, type)
- **Already built:** Displayed in match page events section
- **Limitation:** Name + nationality only; no career stats or photo

### Probability
- **Status:** ✅ READY
- **Data source:** Qualification Engine qualificationProbability (0.0–1.0)
- **Already built:** Probability surfaced on team page WC qualification card
- **Missing:** Visual probability bar; group probability table

---

## PARTIAL Features

### Momentum
- **Status:** ⚠️ PARTIAL
- **What's available:** Score timeline (goals by minute, who led at each point)
- **Missing fields:** Possession %, shots, dangerous attacks, pressure index
- **What can be built:** Goals-based momentum chart (bar chart of scoring bursts). Useful but incomplete.
- **Sprint to build:** 1 (limited scope)

### Player Spotlight
- **Status:** ⚠️ PARTIAL
- **What's available:** Scorer name, card recipient name, assist credit (when present)
- **Missing:** Player photo, nationality, age, club, career stats, FIFA rating
- **What can be built:** "Top performer" card showing goals + assists from match data
- **Sprint to build:** 0.5 (data available; no photo)

### Golden Boot
- **Status:** ⚠️ PARTIAL
- **What's available:** goals[].scorer.name per match
- **Missing:** Aggregation engine (cross-match scorer tally)
- **What can be built:** KV-backed scorer leaderboard, updated by cron after each FINISHED WC match
- **Sprint to build:** 1 (aggregation engine + UI)

---

## BLOCKED Features

### Weather
- **Status:** ❌ BLOCKED
- **Blocker:** No weather provider configured
- **What's needed:** OpenWeatherMap / Weather.com API integration + match venue→city mapping
- **Priority:** P3

### Attendance
- **Status:** ❌ BLOCKED
- **Blocker:** No provider exposes attendance
- **What's needed:** New data provider
- **Priority:** P3

### Stadium Photos
- **Status:** ❌ BLOCKED
- **Blocker:** No image CDN or licensed photo assets
- **What's needed:** Photo licensing + CDN (Cloudinary, AWS S3, etc.)
- **Priority:** P3

### Player Form
- **Status:** ❌ BLOCKED
- **Blocker:** No multi-match player statistics provider
- **What's needed:** Opta, StatsBomb, or similar
- **Priority:** P3

### xG
- **Status:** ❌ BLOCKED
- **Blocker:** No shot-level data provider
- **What's needed:** StatsBomb, Opta
- **Priority:** P3

### Heatmaps
- **Status:** ❌ BLOCKED
- **Blocker:** No player tracking data provider
- **What's needed:** Enterprise tracking (STATSperform, Hawkeye, etc.)
- **Priority:** P3

### Golden Glove
- **Status:** ❌ BLOCKED
- **Blocker:** No keeper stats (saves, clean sheets) from any provider
- **What's needed:** New stats provider
- **Priority:** P3

### Broadcaster (per-match)
- **Status:** ❌ BLOCKED
- **Blocker:** No per-match broadcast rights API
- **What's needed:** Broadcast rights data provider
- **Priority:** P3

### Injuries
- **Status:** ❌ BLOCKED
- **Blocker:** No pre-match fitness/injury API
- **What's needed:** Sports news or injury API (FantasyData, etc.)
- **Priority:** P3
