# CONSUMER MATRIX
**Phase:** DATA-18WC.VERIFY Phase 2  
**Date:** 2026-06-25

---

## Purpose

Complete inventory of every WC page: Source → Pipeline → ViewModel → Component → Route → Cache → Expected Output → Actual Production Output.

---

## Matrix

| Page | Source Function | Pipeline Entry | ViewModel | Component | Route | Cache Key | ISR TTL | Expected | Actual | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Hub | `getWCAuthorityMatchesV2` + `buildKnockoutViewModel` | authority:v1 | `KnockoutViewModel` | `WCBracket` + `MatchCard` | `/world-cup-2026` | `goalradar:wc:authority:v1` | 30s | All upcoming, bracket R16–Final | 16 upcoming, bracket R16–Final (R32=TBD) | ✅ |
| Bracket nested | `buildKnockoutViewModel` | authority:v1 | `KnockoutViewModel` | `WCBracket` + `WCRoundPage` | `/world-cup-2026/bracket` | `goalradar:wc:authority:v1` | 900s | 16+8+4+2+1+1 by stage | R32:16, R16:8, QF:4, SF:2, 3P:1, F:1 | ✅ |
| Round of 32 | `buildKnockoutViewModel` | authority:v1 | `KnockoutViewModel.r32` | `WCRoundPage` | `/world-cup-2026/round-of-32` | `goalradar:wc:authority:v1` | 900s | 16 matches | 16 matches | ✅ |
| Round of 16 | `buildKnockoutViewModel` | authority:v1 | `KnockoutViewModel.r16` | `WCRoundPage` | `/world-cup-2026/round-of-16` | `goalradar:wc:authority:v1` | 900s | 8 matches | 8 matches | ✅ |
| Quarter-Finals | `buildKnockoutViewModel` | authority:v1 | `KnockoutViewModel.qf` | `WCRoundPage` | `/world-cup-2026/quarter-finals` | `goalradar:wc:authority:v1` | 900s | 4 matches | 4 matches | ✅ |
| Semi-Finals | `buildKnockoutViewModel` | authority:v1 | `KnockoutViewModel.sf` | `WCRoundPage` | `/world-cup-2026/semi-finals` | `goalradar:wc:authority:v1` | 900s | 2 matches | 2 matches | ✅ |
| Third-Place | `buildKnockoutViewModel` | authority:v1 | `KnockoutViewModel.thirdPlace` | `WCRoundPage` | `/world-cup-2026/third-place` | `goalradar:wc:authority:v1` | 900s | 1 match | 1 match | ✅ |
| Final | `buildKnockoutViewModel` | authority:v1 | `KnockoutViewModel.final` | `WCRoundPage` | `/world-cup-2026/final` | `goalradar:wc:authority:v1` | 900s | 1 match | 1 match | ✅ |
| Fixtures | `getWCAuthorityMatchesV2` | authority:v1 | none (CanonicalMatch[]) | `MatchCard` | `/world-cup-2026/fixtures` | `goalradar:wc:authority:v1` | 300s | All 104 matches | 40+ matches | ✅ |
| Standings | `getStandingsCached('WC')` | FD standings API | none | `WCGroupTable` | `/world-cup-2026-standings` | `goalradar:wc:standings:v1` | 3600s | 12 groups | 12 groups | ✅ |
| Results | `getWCResultsCached` | FD FINISHED feed | none | `MatchCard` | `/world-cup-2026-results` | `/competitions/WC/matches?status=FINISHED` | 300s | Recent results | 24 results | ✅ |
| Groups | `getWCAuthorityMatchesCached` + `getStandingsCached` | merged KV buckets | none | `WCGroupTable` | `/world-cup-2026-groups` | merged | 300s | 12 groups | 12 groups | ⚠️ |
| **Schedule** | **`getWCAuthorityMatchesCached`** | **merged KV buckets** | none | `MatchCard` | `/world-cup-2026-schedule` | merged | 300s | **All upcoming (48 max)** | **4 matches** | ❌ |
| SEO Bracket | `buildKnockoutViewModel` | authority:v1 | `KnockoutViewModel` | none (plain HTML) | `/world-cup-2026-bracket` | `goalradar:wc:authority:v1` | 900s | All 6 rounds | All 6 rounds | ✅ |

---

## Source Function Registry

| Function | Source | Returns | Used by |
|---|---|---|---|
| `getWCAuthorityMatchesV2(builtAt)` | `goalradar:wc:authority:v1` | `CanonicalMatch[]` | Hub, Fixtures |
| `buildKnockoutViewModel()` | `goalradar:wc:authority:v1` (via AUTHORITY_CACHE_PILOT) | `KnockoutViewModel` | Hub, Bracket, R32–Final, SEO Bracket |
| `getWCAuthorityMatchesCached()` | Merged: upcoming KV + results KV + live KV | `Match[]` | Groups, Schedule (⚠️) |
| `getStandingsCached('WC')` | FD standings API + `computeWCStandingsFromAuthority()` fallback | `StandingsResponse` | Standings, Groups |
| `getWCResultsCached()` | `/competitions/WC/matches?status=FINISHED` KV | `Match[]` | Results |
| `getCurrentLiveMatches()` | `goalradar:live:matches` KV (30s TTL) | `Match[]` | Hub (live overlay) |

---

## ViewModel Consumers

| ViewModel | Fields used | Consumers |
|---|---|---|
| `KnockoutViewModel.bracketMatches` | R16–Final only (excludes LAST_32, THIRD_PLACE) | Hub (WCBracket), Bracket page (WCBracket) |
| `KnockoutViewModel.r32` | LAST_32 matches | Round of 32, Bracket page |
| `KnockoutViewModel.r16` | LAST_16 matches | Round of 16, Bracket page |
| `KnockoutViewModel.qf` | QUARTER_FINALS | Quarter-Finals, Bracket page |
| `KnockoutViewModel.sf` | SEMI_FINALS | Semi-Finals, Bracket page |
| `KnockoutViewModel.thirdPlace` | THIRD_PLACE | Third-Place, Bracket page |
| `KnockoutViewModel.final` | FINAL | Final, Bracket page |
| `KnockoutViewModel.byStage(stage)` | Dynamic stage lookup | SEO Bracket |

---

## Route Normalization Status

| Route | Status |
|---|---|
| `/world-cup-2026/third-place-playoff` | ✅ 301 → `/world-cup-2026/third-place` |
| `/world-cup-2026/standings` | ✅ 301 → `/world-cup-2026-standings` |
| `/world-cup-2026/scores` | ✅ 301 → `/world-cup-2026-results` |
| `/world-cup-2026/knockout` | ✅ 301 → `/world-cup-2026-bracket` |

---

## Divergence Summary

| # | Surface | Expected Source | Actual Source | Gap |
|---|---|---|---|---|
| D1 | `/world-cup-2026-schedule` | `getWCAuthorityMatchesV2` | `getWCAuthorityMatchesCached` | FD API window limits visible upcoming matches → shows 4 instead of all upcoming |
| D2 | Hub WCBracket R32 | R32 teams visible | TBD slots | RESET behavioral change: `bracketMatches` excludes R32 — documented, acceptable |
