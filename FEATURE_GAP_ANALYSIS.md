# FEATURE_GAP_ANALYSIS — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED ✅

---

## Summary

| Status | Count | Features |
|---|---|---|
| FULLY POSSIBLE | 16 | Road to Final, Qualification Simulator, Story Cards, Live Qual, Timeline, Venue, Travel, TV Schedule, H2H, Referee, Standings, Match Score, Match Events, Knockout Bracket, Qual Reason, Fan Prediction |
| PARTIALLY POSSIBLE | 6 | Momentum, Player Spotlight, Lineups, Golden Boot, Form, ET/Penalty Scores |
| IMPOSSIBLE | 9 | Weather, Attendance, Stadium Photos, Player Form, xG, Heatmaps, Broadcaster per-match, Injuries, Golden Glove |

---

## FULLY POSSIBLE Features

### Road to Final
- **Status:** FULLY POSSIBLE
- **Why:** Stage, nextStage, winner, and team data are all available via authority:v1. Story Engine already generates "Road to the Final" section. Knockout VM has the full bracket progression.
- **Implementation:** Story Engine (DONE), Knockout VM (DONE). UI render only remains.

### Qualification Simulator
- **Status:** FULLY POSSIBLE
- **Why:** Qualification Engine already computes status from live standings. Remaining fixture count available from standings (playedGames). Engine supports UNDECIDED with probability.
- **Implementation:** Engine exists in wc-qualification.ts. UI needs "what if" mode — no new data required.

### Live Qualification
- **Status:** FULLY POSSIBLE
- **Why:** FD live standings update continuously. Engine re-runs on each standings fetch. positionToStatus() provides instant fallback.
- **Implementation:** Run engine on every standings refresh. Already done on group/standings pages.

### Story Cards
- **Status:** FULLY POSSIBLE (rule-engine approach)
- **Why:** All required inputs available — match data (stage, result, teams), H2H (meetings, results), qualification engine (group winner, best third), static data (rankings, host nations). No AI needed.
- **Cards possible now:** Winner Advances, Must Win, Host Nation, First WC Meeting, Group Winner, Best Third, Underdog, Revenge Match, Road to Final.
- **Missing:** Story card UI rendering. STORY_CARD_ENGINE.md documents the rules.

### Timeline (event stream by minute)
- **Status:** FULLY POSSIBLE
- **Why:** goals[], bookings[], substitutions[] all have minute field. Merge + sort by minute = timeline.
- **Missing:** Only the UI rendering and merge function. Data is complete.

### Venue Experience
- **Status:** FULLY POSSIBLE
- **Why:** wc-venues.ts has all 16 WC venues with: name, capacity, city, country, transport[], faq[], intro, match schedule, nearest airport, distance from city.
- **Already built:** Venue pages exist at `/world-cup-2026/venues/[slug]`.

### Travel Guide
- **Status:** FULLY POSSIBLE
- **Why:** All 16 venues have VenueTransport[] data (mode, description) and airport info.
- **Already built:** Included in venue page data.

### TV Schedule
- **Status:** FULLY POSSIBLE
- **Why:** tv-guide.json has broadcaster data for 25+ countries.
- **Limitation:** Static country-level only, not per-match. Per-match broadcast rights NOT available.

### H2H History
- **Status:** FULLY POSSIBLE
- **Why:** FD head-to-head endpoint returns full match history between two teams. Already integrated in match snapshot.

### Referee Profile
- **Status:** FULLY POSSIBLE
- **Why:** FD provides referees[].name, referees[].nationality, referees[].type per match.
- **Limitation:** No career stats, no photo, no history. Name + nationality only.

### Standings (Group/League)
- **Status:** FULLY POSSIBLE
- **Why:** Full StandingTable with all standard fields. Already rendered.

### Match Score + Status
- **Status:** FULLY POSSIBLE
- **Why:** Core data, fully redundant coverage (FD + AF + authority:v1 + DR).

### Match Events (Goals/Cards/Subs)
- **Status:** FULLY POSSIBLE
- **Why:** Available via FD primary + AF + ESPN enrichment for WC. Three-layer coverage.

### Knockout Bracket
- **Status:** FULLY POSSIBLE
- **Why:** Authority:v1 has all 104 matches. Knockout VM builds bracket with slot labels. Already rendered.

### Qualification Reason
- **Status:** FULLY POSSIBLE
- **Why:** Qualification Engine generates human-readable reason string for every team. Already wired into team and group pages.

### Fan Prediction
- **Status:** FULLY POSSIBLE (internal infrastructure only)
- **Why:** No external data needed. Requires: KV write (vote counts), API route (cast vote), display component. Fully achievable with existing stack.

---

## PARTIALLY POSSIBLE Features

### Momentum
- **Status:** PARTIALLY POSSIBLE
- **Why:** Goals-only momentum chart is possible (timestamp of goals gives scoring bursts). True momentum requires possession %, shots, dangerous attacks — all UNAVAILABLE.
- **What works:** Score progression chart (when goals were scored, who was winning at each minute). HT/FT score comparison.
- **Missing fields:** Possession, shots on target, passes, pressure index.

### Player Spotlight
- **Status:** PARTIALLY POSSIBLE
- **Why:** Goal scorer and card recipient names + IDs are available from match events. Player photo, stats (career goals, caps), nationality — NOT available.
- **What works:** "Goal scorer" badge, "Bookings" listing, assist credit (when available).
- **Missing:** Player photo, career stats, nationality, age, club, FIFA rating.

### Lineups (Formation Display)
- **Status:** PARTIALLY POSSIBLE
- **Why:** FD provides starters/bench occasionally (not guaranteed). ESPN provides starters for FINISHED WC matches. formationPlace is available via ESPN.
- **Missing:** Formation string (4-3-3, 4-2-3-1). API doesn't expose formation pattern.
- **What works:** Player list by starter/bench. Jersey numbers. Positions (abbreviated).

### Golden Boot
- **Status:** PARTIALLY POSSIBLE
- **Why:** Goals[].scorer.name exists per match. But no cross-match aggregation layer exists.
- **What works:** Could be built as a KV-backed scorer tally (cron writes, page reads).
- **Missing:** Aggregation engine. One sprint to build.

### Form String
- **Status:** PARTIALLY POSSIBLE
- **Why:** FD provides form field in standings (e.g., "WWLDW") but it is frequently null for WC group stage entries.
- **What works:** Render when available.
- **Missing:** Reliable availability for all teams/competitions.

### Extra Time / Penalty Shootout Scores
- **Status:** PARTIALLY POSSIBLE
- **Why:** api-football exposes score.extraTime and score.penalties. But these fields are not yet integrated into the authority:v1 canonical model or the snapshot. FD does NOT expose them.
- **What works:** AF can provide them via the secondary provider path.
- **Missing:** Integration into canonical model (one sprint to add).

---

## IMPOSSIBLE Features

### Weather
- **Status:** IMPOSSIBLE
- **Why:** No provider in the stack supplies weather data. Would require a new integration with a weather API (OpenWeatherMap, Weather.com, etc.) that is NOT currently configured.
- **Workaround:** None. Would need a new provider (Priority 3).

### Attendance
- **Status:** IMPOSSIBLE
- **Why:** Neither FD, AF, nor ESPN expose per-match attendance figures. No provider supplies this.
- **Workaround:** None. Would need a new provider.

### Stadium Photos
- **Status:** IMPOSSIBLE
- **Why:** No image CDN or photo API is configured. Photos would require licensing and storage.
- **Workaround:** None. Requires photo library integration.

### Player Form (Multi-match stats)
- **Status:** IMPOSSIBLE
- **Why:** Individual player statistics across multiple matches (touches, distance, shots, rating) are not available from any configured provider.
- **Workaround:** None. Would require a new stats provider (Opta, StatsBomb, etc.).

### xG (Expected Goals)
- **Status:** IMPOSSIBLE
- **Why:** xG requires shot-by-shot data with coordinates, goalkeeper position, and body part. None of the configured providers supply this.
- **Workaround:** None. Would require StatsBomb, Opta, or similar.

### Heatmaps
- **Status:** IMPOSSIBLE
- **Why:** Player position tracking data (x/y coordinates per second) is not available from any provider.
- **Workaround:** None. Enterprise tracking data only.

### Broadcaster (per-match)
- **Status:** IMPOSSIBLE (per-match)
- **Why:** Per-match broadcast rights allocation is not exposed by any provider. Static country-level broadcaster names exist in tv-guide.json but are not match-specific.
- **Workaround:** Static country page only (already exists).

### Injuries
- **Status:** IMPOSSIBLE
- **Why:** Pre-match injury reports and player fitness status are not available from any configured provider.
- **Workaround:** None. Would require a sports news API.

### Golden Glove
- **Status:** IMPOSSIBLE
- **Why:** Goalkeeper statistics (saves per match, clean sheets, save percentage) are not available from any provider. Only goals conceded (from score) can be inferred.
- **Workaround:** None. Would require a stats provider.
