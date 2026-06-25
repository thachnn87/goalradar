# WC_SELECTOR_GRAPH.md — Selector Audit
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

## Selector Chains

### Authority Path (HEALTHY)
```
FD API /competitions/WC/matches
  ↓ refreshEndpoint()              src/lib/refresh.ts
  ↓ KV: goalradar:/competitions/WC/matches  TTL 21600s
  ↓ prewarmWorldCup()              src/lib/prewarm/worldcup.ts
  ↓ KV: goalradar:match:{id}       TTL 900s per match
  ↓ writeAuthorityCache()          src/lib/authority-cache.ts
  ↓ KV: goalradar:wc:authority:v1  TTL 30–900s
  ↓ getWCAuthorityMatchesV2()      src/lib/api.ts
  ↓ overlayMatchStates()           applies per-match snapshot overrides
  ↓ classifyMatchState()           src/lib/match-classify.ts
  ↓ Page RSC (ISR)
  ↓ Production HTML
```

### Standings Path (BROKEN)
```
FD API /competitions/WC/standings
  ↓ refreshEndpoint()              src/lib/refresh.ts
  ↓ KV: goalradar:/competitions/WC/standings  TTL 7200s
     [KEY MISSING — FD API returns error or restricted; refreshEndpoint does NOT write on error]
  ↓ getStandingsCached('WC')       src/lib/api.ts
  ↓ readKVOnly() → NULL
  ↓ FALLBACK: getStaticWCGroupTables()  src/lib/wc-static-groups.ts
  ↓ Returns zeroed StandingTable[] built from wc-all-teams.ts
  ↓ calculateQualificationStatus() src/lib/wc-qualification.ts
     Input: all zeros → all UNDECIDED
  ↓ Page RSC (ISR 3600s)
  ↓ HTML: "0 pts, 0 games, UNDECIDED" for every team
```

### Live Path (HEALTHY)
```
FD API /matches?dateFrom=T&dateTo=T (today)
  ↓ refreshLiveMatches()           src/lib/refresh.ts
  ↓ KV: goalradar:live:matches     TTL 30s
  ↓ getCurrentLiveMatches()        src/lib/wc-live-ssot.ts
  ↓ liveMatchIds.has(id)           prevents ghost-live
  ↓ effectiveBucket()              demotes stale LIVE to finished
  ↓ Hub page (ISR 30s)
```

---

## Duplicate Selectors

| Duplication | Location | Notes |
|---|---|---|
| `calculateQualificationStatus` called in both hub and groups page | `page.tsx:89`, `groups/page.tsx:89` | **Intentional** — each page needs its own qualification map; not a bug |
| `getStandingsCached('WC')` called in hub, groups, team pages, group detail pages | Multiple pages | **Intentional** — each page is a separate RSC; withCache() deduplicates within one request |

No duplicate selectors that constitute a bug were found. The qualification engine is called once per page render, which is correct.

---

## Dead Selectors

| Function | Status | Notes |
|---|---|---|
| `getStaticUpcomingMatches` | Removed (per comment in hub page.tsx) | Fallback handled inside `getUpcomingMatchesCached` |
| Legacy `positionToStatus()` | Not found in current codebase | Was replaced by `calculateQualificationStatus()` |
| `WC_GROUP_FIXTURES`, `WC_ALL_FIXTURES`, `getGroupFixtures`, `getTeamFixtures` | Removed from wc-fixtures.ts | Per SEO-7/DATA-9 comment; group fixtures now from API |

---

## Outdated Selectors

| Issue | File | Details |
|---|---|---|
| `isStaticFallback()` exported from wc-static-groups.ts but its call site was moved | src/lib/wc-static-groups.ts | Function exists but groups page now uses `matchesPlayed` check directly — `isStaticFallback` may be unused |
| Groups page body copy says "Groups A–L · 48 nations" | groups/page.tsx:118 | Format is 12 groups A-L with 4 teams each; copy is correct |
