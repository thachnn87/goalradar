# FINAL_VERDICT — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Sprint:** DATA-18WC.PHASE0 — API Capability Matrix
**Status:** COMPLETE ✅

---

## Phase 0 Rule

Everything in this document was verified from source code, KV architecture, and provider implementation files. No field was assumed available. No feature was assumed buildable. If a field could not be confirmed, it is marked UNAVAILABLE.

---

## Final Feature × Data Table

| Feature | Data Ready | Provider / Source | Confidence | Owner | Status |
|---|---|---|---|---|---|
| Match Score (FT) | ✅ YES | football-data.org → authority:v1 | HIGH | FD | PRODUCTION |
| Match Status (live) | ✅ YES | live cache → authority:v1 | HIGH | live-cache.ts | PRODUCTION |
| Match Events (goals/cards/subs) | ✅ YES (WC enriched) | FD + AF + ESPN | HIGH | enrichment pipeline | PRODUCTION |
| WC Group Stage standings | ✅ YES | football-data.org | HIGH | FD standings endpoint | PRODUCTION |
| League Standings | ✅ YES | football-data.org | HIGH | FD standings endpoint | PRODUCTION |
| Qualification Status (WC) | ✅ YES | Qualification Engine | HIGH | qualification-engine.ts | PRODUCTION |
| Qualification Reason | ✅ YES | Qualification Engine | HIGH | qualification-engine.ts | PRODUCTION |
| Qualification Probability | ✅ YES | Qualification Engine | HIGH | qualification-engine.ts | PRODUCTION |
| Knockout Bracket | ✅ YES | authority:v1 + knockout-vm.ts | HIGH | knockout-vm.ts | PRODUCTION |
| TBD Slot Labels | ✅ YES | knockout-vm.ts + standings | HIGH | knockout-vm.ts | PRODUCTION |
| Head-to-Head | ✅ YES | football-data.org | MEDIUM | FD H2H endpoint | PRODUCTION |
| Match Narrative (Story Engine) | ✅ YES | match-story-engine.ts | HIGH | match-story-engine.ts | PRODUCTION |
| WC Knockout Language | ✅ YES | WC_KNOCKOUT template | HIGH | match-story-engine.ts | PRODUCTION |
| WC Group Language | ✅ YES | WC_GROUP template | HIGH | match-story-engine.ts | PRODUCTION |
| Venue (name) | ✅ YES | FD match.venue | HIGH | FD | PRODUCTION |
| Venue (full profile) | ✅ YES | wc-venues.ts (static) | HIGH | wc-venues.ts | PRODUCTION |
| Team Profile (name/crest/coach) | ✅ YES | football-data.org | HIGH | FD getTeam | PRODUCTION |
| Team Squad | ✅ YES | football-data.org | HIGH | FD getTeam | PRODUCTION |
| WC Team Data (48 teams) | ✅ YES | wc-all-teams.ts | HIGH | static | PRODUCTION |
| Match FAQs | ✅ YES | buildFaqs() | HIGH | match page | PRODUCTION |
| JSON-LD (SportsEvent, Article, FAQ) | ✅ YES | match page | HIGH | match page | PRODUCTION |
| Referee (name + nationality) | ✅ YES | FD referees[] | HIGH | FD | PRODUCTION |
| TV Guide (country-level) | ✅ YES | tv-guide.json | HIGH | static | PRODUCTION |
| Score Duration (ET / PK flag) | ✅ YES | FD score.duration | HIGH | FD | PRODUCTION |
| Road to Final UI | ✅ DATA | authority:v1 + Story Engine | HIGH | knockout-vm.ts | P0 — UI ONLY |
| Qualification Simulator UI | ✅ DATA | Qual Engine | HIGH | qualification-engine.ts | P0 — UI ONLY |
| Story Cards | ✅ DATA | MatchSnapshot + H2H + qual engine | HIGH | (TBD component) | P0 — UI ONLY |
| Match Timeline | ✅ DATA | Snapshot events | HIGH | (TBD component) | P0 — UI ONLY |
| Knockout Journey (team path) | ✅ DATA | authority:v1 | HIGH | (TBD component) | P0 — UI ONLY |
| Probability Display | ✅ DATA | Qual Engine | HIGH | (TBD component) | P0 — UI ONLY |
| ET / Penalty Exact Scores | ⚠️ PARTIAL | api-football (not integrated) | MEDIUM | af-id-map.ts | P1 — INTEGRATE |
| Fan Prediction | ⚠️ NONE | Internal KV system (not built) | HIGH | (TBD KV system) | P1 — BUILD INTERNAL |
| Golden Boot Leaderboard | ⚠️ PARTIAL | goals[].scorer (aggregation missing) | MEDIUM | (TBD cron) | P1 — AGGREGATE |
| Momentum Chart (goal-based) | ⚠️ PARTIAL | goals timeline (no possession) | MEDIUM | (TBD component) | P1 — LIMITED SCOPE |
| Player Spotlight (basic) | ⚠️ PARTIAL | Name/goals (no photo/nationality) | MEDIUM | (TBD component) | P1 — NO PHOTO |
| Lineups Display | ⚠️ PARTIAL | FD + ESPN (formation string absent) | MEDIUM | enrichment | P1 — PARTIAL |
| Formation Display | ⚠️ PARTIAL | AF provides string; not integrated | LOW | af-id-map.ts | P2 — INTEGRATE |
| Player Nationality / Age / Club | ❌ NO | Not from FD, AF, or ESPN | HIGH | NO PROVIDER | P2 — NEW SOURCE |
| Live FIFA Rankings | ❌ NO | Static only; no rankings API | HIGH | NO PROVIDER | P2 — NEW SOURCE |
| Player Career Stats | ❌ NO | No provider | HIGH | NO PROVIDER | P3 — BLOCKED |
| xG / Shots / Possession | ❌ NO | No provider | HIGH | NO PROVIDER | P3 — BLOCKED |
| Heatmaps | ❌ NO | No provider | HIGH | NO PROVIDER | P3 — BLOCKED |
| Goalkeeper Stats | ❌ NO | No provider | HIGH | NO PROVIDER | P3 — BLOCKED |
| Attendance | ❌ NO | No provider | HIGH | NO PROVIDER | P3 — BLOCKED |
| Weather | ❌ NO | No provider | HIGH | NO PROVIDER | P3 — BLOCKED |
| Player Ratings | ❌ NO | No provider | HIGH | NO PROVIDER | P3 — BLOCKED |
| Stadium Photos | ❌ NO | No assets | HIGH | NO ASSETS | P3 — BLOCKED |
| Broadcaster (per-match) | ❌ NO | No rights API | HIGH | NO PROVIDER | P3 — BLOCKED |
| Injury Reports | ❌ NO | No provider | HIGH | NO PROVIDER | P3 — BLOCKED |
| VAR Decisions | ❌ NO | No provider | HIGH | NO PROVIDER | P3 — BLOCKED |

---

## Summary Counts

| Status | Count |
|---|---|
| PRODUCTION (live today) | 24 |
| P0 — UI only needed | 6 |
| P1 — Small data gap | 6 |
| P2 — New integration needed | 3 |
| P3 — BLOCKED (no provider) | 12 |
| **Total features evaluated** | **51** |

---

## Key Decisions from Phase 0

### Confirmed Architecture (KEEP AS-IS)

1. **Three-tier KV caching** (L1 in-memory → L2 KV SWR → L3 DR) is correct and sufficient.
2. **authority:v1** is the single truth for all WC listing pages. No page should query FD directly.
3. **PERF-7A constraint** (KV-read-only at render time) is not violated by any current page.
4. **Story Engine** (`match-story-engine.ts`) is the ONE narrative source. `buildReportSections()` deleted. No regression.
5. **WC enrichment chain** (FD → AF → ESPN) is the correct fallback order for FINISHED WC matches.

### Confirmed Gaps (CLOSE IN P1)

6. **ET/PK exact scores** — api-football already exposes them. Wire into canonical model.
7. **Fan Prediction** — No external provider needed. Internal KV POST/GET system.
8. **Golden Boot** — Aggregation of existing goals[] data. One cron task.

### Confirmed Absent (DO NOT FAKE)

9. xG, shots, possession, attendance, weather, player ratings — **zero data from any provider**.
10. Never display estimated, invented, or zero values for these fields.
11. Hide UI sections when data is absent. Do not show empty states for P3 features.

---

## Deliverables Checklist

| File | Status |
|---|---|
| PROVIDER_INVENTORY.md | ✅ Written |
| FIELD_MATRIX.md | ✅ Written |
| API_CAPABILITY_MATRIX.md | ✅ Written |
| FEATURE_GAP_ANALYSIS.md | ✅ Written |
| DATA_OWNERSHIP.md | ✅ Written |
| CACHE_CAPABILITY.md | ✅ Written |
| EXPERIENCE_CAPABILITY.md | ✅ Written |
| MISSING_DATA.md | ✅ Written |
| PRODUCTION_CAPABILITY.md | ✅ Written |
| IMPLEMENTATION_PRIORITY.md | ✅ Written |
| FINAL_VERDICT.md | ✅ Written |

**Phase 0 complete. No code was changed. No UI was modified. All findings are from source.**
