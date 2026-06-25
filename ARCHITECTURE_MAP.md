# ARCHITECTURE MAP — World Cup 2026
**Phase:** DATA-18WC.RESET Phase 1  
**Date:** 2026-06-25  
**Scope:** Every WC feature mapped Source → Repository → Cache → Pipeline → ViewModel → Component → Page

---

## Overview

```
FD API (football-data.org)
  ↓  cron/orchestrator.ts  [writes to KV, never called by pages]
  ↓
  ├─ goalradar:wc:authority:v1  ← PRIMARY CACHE (CanonicalMatch[104])
  │     ↓  readAuthorityCache()
  │     ├─ getWCAuthorityMatchesV2()       → hub upcoming/live/results
  │     ├─ buildKnockoutViewModel()        → all knockout consumers
  │     └─ computeWCStandingsFromAuthority() → standings fallback
  │
  ├─ /competitions/WC/matches  ← LEGACY KV (Match[104], pilot=false)
  │     ↓  getWCKnockoutMatchesCached()
  │     └─ buildKnockoutViewModel() (pilot=false path)
  │
  ├─ /competitions/WC/standings  ← STANDINGS KV
  │     ↓  getStandingsCached('WC')
  │     └─ all standings consumers
  │
  └─ goalradar:live:matches  ← LIVE KV (30s TTL)
        ↓  getCurrentLiveMatches()
        └─ hub live section, watch-live page
```

---

## Feature Maps

### HUB — `/world-cup-2026`

```
Source:         FD API → authority cache (primary) + legacy KV (knockout fallback)
Repository:     src/app/world-cup-2026/page.tsx
Cache Read:     getWCAuthorityMatchesV2()      → all 104 matches
                getWCKnockoutMatchesCached()   → knockout preview [VIOLATION: should use vm]
                getStandingsCached('WC')       → 12 group tables
                getCurrentLiveMatches()        → live match state overlay
Pipeline:       page.tsx inline: classifyMatchState() partitions to live/today/upcoming/finished
ViewModel:      no ViewModel — inline assembly (VIOLATION: should use buildKnockoutViewModel)
Component:      MatchCard, WCGroupTable, WCBracket, WCCountdown, WCPageNav
Page:           /world-cup-2026
ISR TTL:        30s
```

**Issue:** Hub page uses `getWCKnockoutMatchesCached()` independently — does NOT read from `buildKnockoutViewModel()`. The bracket preview section on the hub renders from a different data source than `/world-cup-2026/bracket`.

---

### STANDINGS — `/world-cup-2026-standings`

```
Source:         FD API → /competitions/WC/standings KV
                Fallback: computeWCStandingsFromAuthority() from authority cache
                Fallback 2: WC_STATIC_GROUPS (static data)
Repository:     src/app/world-cup-2026-standings/page.tsx
Cache Read:     getStandingsCached('WC')
Pipeline:       calculateQualificationStatus() → qualMap per team
ViewModel:      StandingTable[] with qualMap (no dedicated ViewModel function)
Component:      GroupTable (local), WCPageNav, CompetitionSelector
Page:           /world-cup-2026-standings
ISR TTL:        3600s (1h)
```

---

### GROUPS OVERVIEW — `/world-cup-2026-groups`

```
Source:         Same as STANDINGS
Repository:     src/app/world-cup-2026-groups/page.tsx
Cache Read:     getStandingsCached('WC')
Pipeline:       calculateQualificationStatus()
ViewModel:      StandingTable[] (same as standings)
Component:      WCGroupTable, WCPageNav
Page:           /world-cup-2026-groups
ISR TTL:        3600s
```

**Note:** `/world-cup-2026-groups` and `/world-cup-2026-standings` render nearly identical data. Potential dedup candidate.

---

### GROUP DETAIL — `/world-cup-2026/[group]`

```
Source:         FD API → standings KV + authority cache
Repository:     src/app/world-cup-2026/[group]/page.tsx
Cache Read:     getStandingsCached('WC') + getWCAuthorityMatchesV2()
Pipeline:       filter matches to group; calculateQualificationStatus()
ViewModel:      No ViewModel — inline assembly
Component:      WCGroupTable, MatchCard
Page:           /world-cup-2026/a through /world-cup-2026/l
ISR TTL:        900s (15min)
```

---

### BRACKET — `/world-cup-2026/bracket`

```
Source:         FD API → authority:v1 (pilot=true) or /WC/matches KV (pilot=false)
Repository:     src/app/world-cup-2026/bracket/page.tsx
Cache Read:     buildKnockoutViewModel() [Sprint 15]
Pipeline:       buildKnockoutViewModel() → KnockoutViewModel
ViewModel:      KnockoutViewModel (src/lib/knockout-vm.ts) ✓
Component:      MatchCard, WCBracket, LocalKnockoutRound, FinalCard, ThirdPlaceCard, WCPageNav
Page:           /world-cup-2026/bracket
ISR TTL:        900s (15min)
```

---

### ROUND PAGES — `/world-cup-2026/{round}`

```
Source:         Same as BRACKET (shared pipeline)
Repository:     src/components/WCRoundPage.tsx [shared component]
                src/app/world-cup-2026/round-of-32/page.tsx
                src/app/world-cup-2026/round-of-16/page.tsx
                src/app/world-cup-2026/quarter-finals/page.tsx
                src/app/world-cup-2026/semi-finals/page.tsx
                src/app/world-cup-2026/third-place/page.tsx
                src/app/world-cup-2026/final/page.tsx
Cache Read:     buildKnockoutViewModel() [Sprint 15] → vm.byStage(round.stage) ✓
Pipeline:       WCRoundPage delegates to buildKnockoutViewModel() ✓
ViewModel:      KnockoutViewModel ✓
Component:      MatchCard, ScheduleSlots, WCPageNav
Page:           6 routes above
ISR TTL:        900s (15min)
```

**Note:** `/world-cup-2026/third-place-playoff` ALSO exists as a separate file. It is a duplicate. Must redirect to `/world-cup-2026/third-place`.

---

### SEO BRACKET — `/world-cup-2026-bracket`

```
Source:         Unknown — separate from /world-cup-2026/bracket
Repository:     src/app/world-cup-2026-bracket/page.tsx
Cache Read:     buildKnockoutViewModel() [needs verification]
Pipeline:       Unknown
ViewModel:      Unknown
Component:      Unknown
Page:           /world-cup-2026-bracket
ISR TTL:        Unknown
```

**Note:** This is a root-level SEO slug separate from the nested `/world-cup-2026/bracket`. Potential duplication — needs investigation.

---

### SCHEDULE — `/world-cup-2026-schedule`

```
Source:         FD API → /competitions/WC/matches?status=SCHEDULED,TIMED KV
Repository:     src/app/world-cup-2026-schedule/page.tsx
Cache Read:     getUpcomingMatchesCached('WC')
Pipeline:       overlayMatchStates() overlay applied inside getUpcomingMatchesCached
ViewModel:      Match[] (no dedicated ViewModel)
Component:      MatchCard
Page:           /world-cup-2026-schedule
ISR TTL:        Unknown
```

---

### RESULTS — `/world-cup-2026-results`

```
Source:         FD API → /competitions/WC/matches?status=FINISHED KV
Repository:     src/app/world-cup-2026-results/page.tsx
Cache Read:     getWCResultsCached()
Pipeline:       overlayMatchStates() overlay
ViewModel:      Match[] (no dedicated ViewModel)
Component:      MatchCard
Page:           /world-cup-2026-results
ISR TTL:        Unknown
```

**Duplicate:** Also `/world-cup-2026/results` exists as a nested route.

---

### FIXTURES — `/world-cup-2026/fixtures`

```
Source:         Same as SCHEDULE
Repository:     src/app/world-cup-2026/fixtures/page.tsx
Cache Read:     getUpcomingMatchesCached('WC')
Pipeline:       Same as schedule
ViewModel:      Match[]
Component:      MatchCard
Page:           /world-cup-2026/fixtures
ISR TTL:        Unknown
```

**Semantic overlap with `/world-cup-2026-schedule`.**

---

### TEAM LIST — `/world-cup-2026/teams`

```
Source:         Static — WC_ALL_TEAMS constant in wc-all-teams.ts
Repository:     src/app/world-cup-2026/teams/page.tsx
Cache Read:     None (static)
Pipeline:       None
ViewModel:      WCTeam[] static
Component:      Team grid (inline)
Page:           /world-cup-2026/teams
ISR TTL:        static
```

---

### TEAM DETAIL — `/world-cup-2026/teams/[slug]`

```
Source:         FD API → /teams/{id} KV + /teams/{id}/matches KV
Repository:     src/app/world-cup-2026/teams/[slug]/page.tsx
Cache Read:     getTeamCached(id) + getTeamMatchesCached(id)
Pipeline:       Team enrichment — match with WC squad metadata
ViewModel:      TeamDetail + Match[] (no dedicated ViewModel)
Component:      WCTeamPageContent
Page:           /world-cup-2026/teams/[slug]
ISR TTL:        3600s
```

---

### LIVE MATCHES — `/world-cup-2026/watch-live`

```
Source:         goalradar:live:matches KV (30s TTL)
Repository:     src/app/world-cup-2026/watch-live/page.tsx
Cache Read:     getWCLiveMatchesCached()
Pipeline:       Filter to IN_PLAY/PAUSED
ViewModel:      Match[] filtered
Component:      MatchCard + streaming guide content
Page:           /world-cup-2026/watch-live
ISR TTL:        30s
```

---

## Architecture Issues Summary

| # | Issue | Severity | File |
|---|---|---|---|
| A1 | Hub page calls `getWCKnockoutMatchesCached()` directly — bypasses KnockoutViewModel | HIGH | `src/app/world-cup-2026/page.tsx` |
| A2 | `/world-cup-2026/third-place-playoff` duplicate route | MEDIUM | `src/app/world-cup-2026/third-place-playoff/page.tsx` |
| A3 | SEO route `/world-cup-2026-bracket` vs nested `/world-cup-2026/bracket` — unclear relationship | MEDIUM | `src/app/world-cup-2026-bracket/page.tsx` |
| A4 | `/world-cup-2026/results` + `/world-cup-2026-results` dual routes | LOW | Both |
| A5 | `/world-cup-2026/fixtures` + `/world-cup-2026-schedule` semantic overlap | LOW | Both |
| A6 | Hub page inline bracket preview assembly (should use buildKnockoutViewModel) | HIGH | `src/app/world-cup-2026/page.tsx` |
| A7 | No ViewModel for standings (StandingTable[] assembled inline per page) | LOW | Multiple |
