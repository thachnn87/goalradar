# CACHE TRACE
**Phase:** DATA-18WC.VERIFY Phase 8  
**Date:** 2026-06-25

---

## Purpose

Trace which cache key produced each production page. Every authority page must trace to `goalradar:wc:authority:v1`.

---

## Cache Registry (from CACHE_OWNERSHIP.md — RESET Phase 9)

| Cache Key | TTL | Written by | Read by |
|---|---|---|---|
| `goalradar:wc:authority:v1` | 900s (cron-overwritten) | `buildAllCanonicalMatches()` cron | `readAuthorityCache()` → `getWCAuthorityMatchesV2`, `buildKnockoutViewModel` |
| `goalradar:live:matches` | 30s | live-score cron | `getCurrentLiveMatches()` |
| `/competitions/WC/matches?status=SCHEDULED,TIMED` | 15min | upcoming cron from FD API | `getUpcomingMatchesCached('WC')` → `getWCAuthorityMatchesCached` |
| `/competitions/WC/matches?status=FINISHED` | 12h | results cron from FD API | `getWCResultsCached()` → `getWCAuthorityMatchesCached` |
| `goalradar:wc:standings:v1` | varies | standings cron | `getStandingsCached('WC')` |
| `goalradar:match:{id}` | 900s | match-snapshot cron | match detail pages |

---

## Page → Cache Key Trace

### Knockout Pages (all via `buildKnockoutViewModel`)

When `AUTHORITY_CACHE_PILOT=true` (current production state):

```
buildKnockoutViewModel()
  └─► getWCAuthorityMatchesV2(builtAt)
        └─► readAuthorityCache()
              └─► KV GET goalradar:wc:authority:v1       ← PRIMARY
                    DR fallback: goalradar:wc:authority:dr:v1
                    Cold rebuild: buildAllCanonicalMatches()
```

| Page | Route | Cache Key | ISR TTL |
|---|---|---|---|
| Hub | `/world-cup-2026` | `goalradar:wc:authority:v1` | 30s |
| Bracket | `/world-cup-2026/bracket` | `goalradar:wc:authority:v1` | 900s |
| Round of 32 | `/world-cup-2026/round-of-32` | `goalradar:wc:authority:v1` | 900s |
| Round of 16 | `/world-cup-2026/round-of-16` | `goalradar:wc:authority:v1` | 900s |
| Quarter-Finals | `/world-cup-2026/quarter-finals` | `goalradar:wc:authority:v1` | 900s |
| Semi-Finals | `/world-cup-2026/semi-finals` | `goalradar:wc:authority:v1` | 900s |
| Third-Place | `/world-cup-2026/third-place` | `goalradar:wc:authority:v1` | 900s |
| Final | `/world-cup-2026/final` | `goalradar:wc:authority:v1` | 900s |
| SEO Bracket | `/world-cup-2026-bracket` | `goalradar:wc:authority:v1` | 900s |

All 9 knockout pages share the same ISR revalidation root through the same KV read path.

---

### Non-Knockout Pages

```
getWCAuthorityMatchesV2(builtAt)
  └─► KV GET goalradar:wc:authority:v1
```

| Page | Route | Cache Key | ISR TTL |
|---|---|---|---|
| Fixtures | `/world-cup-2026/fixtures` | `goalradar:wc:authority:v1` | 300s |

```
getWCAuthorityMatchesCached()
  └─► getUpcomingMatchesCached('WC')  → KV GET /competitions/WC/matches?status=SCHEDULED,TIMED
  └─► getWCResultsCached()            → KV GET /competitions/WC/matches?status=FINISHED
  └─► getWCLiveMatches()              → KV GET goalradar:live:matches
  └─► overlayMatchStates()            → KV GET goalradar:match:{id} (per match)
```

| Page | Route | Cache Keys | ISR TTL |
|---|---|---|---|
| Groups | `/world-cup-2026-groups` | merged KV buckets | 300s |
| **Schedule** (**pre-fix**) | `/world-cup-2026-schedule` | **merged KV buckets** | 300s |

```
getStandingsCached('WC')
  └─► KV GET goalradar:wc:standings:v1
        fallback: computeWCStandingsFromAuthority() → goalradar:wc:authority:v1
```

| Page | Route | Cache Keys | ISR TTL |
|---|---|---|---|
| Standings | `/world-cup-2026-standings` | `goalradar:wc:standings:v1` | 3600s |

```
getWCResultsCached()
  └─► KV GET /competitions/WC/matches?status=FINISHED
```

| Page | Route | Cache Key | ISR TTL |
|---|---|---|---|
| Results | `/world-cup-2026-results` | `/competitions/WC/matches?status=FINISHED` | 300s |

---

## ISR Staleness Matrix

ISR TTL determines the maximum lag between data change in KV and page update.

| TTL | Pages | Max lag |
|---|---|---|
| 30s | Hub | 30s |
| 300s | Fixtures, Groups, Schedule, Results | 5 min |
| 900s | Bracket, R32–Final, SEO Bracket | 15 min |
| 3600s | Standings | 1 hour |

---

## D1 Cache Fix (post-repair)

After migrating `/world-cup-2026-schedule` to `getWCAuthorityMatchesV2`:

```
Schedule page (post-fix)
  └─► getWCAuthorityMatchesV2(builtAt)
        └─► KV GET goalradar:wc:authority:v1   ← SAME key as fixtures/knockout pages
```

Schedule joins the `goalradar:wc:authority:v1` consumer family. All upcoming matches (up to 48) will be visible, sourced from the same 104-match canonical dataset.

---

## Live State Cache

All pages that show live state (hub, bracket pages) also read from:

```
getCurrentLiveMatches()
  └─► KV GET goalradar:live:matches (30s TTL)
```

Live state is overlaid at page render time, not baked into the authority cache.
