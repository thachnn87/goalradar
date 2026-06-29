# DATA-16D Flow Audit

Date: 2026-06-17
Phase: 1 of 5

---

## Data Flow: Match Page

```
User visits /match/537397-argentina-vs-algeria
        ↓
getOrBuildMatchSnapshot(537397)          [src/lib/match-snapshot.ts]
        ↓
  1. Read  goalradar:match:537397         [KV snapshot — primary]
  2. Miss? → build from:
       goalradar:/matches/537397         [KV match detail]
     + enrichMatchWithEspnEvents(537397)  [goalradar:espn:event:537397 — 30d TTL]
        ↓
  3. Write goalradar:match:537397         [TTL: 7d if FINISHED, ~time-to-kickoff if UPCOMING]
  4. Write goalradar:dr:match:537397      [TTL: 30d — disaster recovery]
        ↓
Page renders: Argentina 3-0 Algeria, Messi 17'/60'/76'
```

**Match page is working.** Per-match snapshot `goalradar:match:537397` exists with status=FINISHED.

---

## Data Flow: Hub Page (broken path)

```
User visits /world-cup-2026
        ↓
getWCAuthorityMatchesCached()             [src/lib/api.ts:525]
        ↓
  ┌─────────────────────────────────────────────────────────────┐
  │  getUpcomingMatchesCached('WC')                             │
  │    → readKVOnly('/competitions/WC/matches?status=SCHEDULED,TIMED')
  │    → KV key: goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED
  │    → Contains Argentina vs Algeria as TIMED (stale from pre-kickoff cron run)
  ├─────────────────────────────────────────────────────────────┤
  │  getRecentMatchesCached('WC')   ← ROOT CAUSE                │
  │    → readKVOnly('/competitions/WC/matches?dateFrom=2026-05-18&dateTo=2026-06-17')
  │    → KEY ROTATES DAILY AT MIDNIGHT UTC                      │
  │    → KV TTL: 1800s (30 min). No DR fallback.               │
  │    → If key expired or not yet populated today: []          │
  ├─────────────────────────────────────────────────────────────┤
  │  getWCLiveMatches() → goalradar:live:matches                │
  └─────────────────────────────────────────────────────────────┘
        ↓
  Merge with STATE_RANK:
    upcoming (TIMED)  rank=0  → Argentina vs Algeria stays as TIMED
    recent   (empty)          → contributes nothing
    live     (empty)          → contributes nothing
        ↓
  overlayMatchStates([...byId.values()])
    → kv.mget(goalradar:match:537397, ...)
    → If snapshot exists with FINISHED: advances Argentina → FINISHED ✅
    → If snapshot expired or missing:   Argentina stays TIMED ❌
        ↓
  classify() → Argentina's final status determines its section:
    TIMED  → todayMatches  → "Today's Matches" with no score ❌
    FINISHED → recentResults → "Recent Results" with score ✅
```

### Why the overlay fails intermittently

UPCOMING match snapshot TTL = `min(6h, time-until-kickoff + 5 min)`.

For a match at 22:00 UTC, a snapshot written at 21:55 UTC has TTL = 10 minutes.
The snapshot expires at 22:05 UTC. If no one visits the match page before it expires,
`goalradar:match:537397` is absent from KV. The overlay reads null → no advancement.

The prewarm cron re-seeds FINISHED matches once per 24h, so the gap can last up to 24h.

---

## Data Flow: Results Page (broken path)

```
User visits /world-cup-2026-results
        ↓
getRecentMatchesCached('WC')               ← ROOT CAUSE (same as hub)
  key: /competitions/WC/matches?dateFrom=2026-05-18&dateTo=2026-06-17
        ↓
  Problems:
  1. Key changes every day at midnight UTC
  2. KV TTL = 1800s (30 min). No DR key written by refreshEndpoint.
  3. After midnight, new key is EMPTY until cron runs (up to 30 min gap)
  4. dispatchToProvider routes this key to getAllMatches('WC')
     → stores ALL 104 WC matches, not just FINISHED
  5. Results page does not filter for status=FINISHED:
     finishedResults = results.filter(m => !liveIds.has(m.id))
     → includes SCHEDULED/TIMED future matches in the "finishedResults" count
```

**Result:** `played === 0` → "No results yet" when key is empty (daily rollover gap or TTL miss)

---

## Status Value Matrix

| Stage | Status values | How set |
|-------|--------------|---------|
| FD API (raw) | SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, POSTPONED | `football-data.ts fetchRaw` |
| Per-match snapshot (`goalradar:match:{id}`) | same — promoted by `mergeSnapshotState` | `match-snapshot.ts writeKVSnapshot` |
| Upcoming feed (`/matches?status=SCHEDULED,TIMED`) | SCHEDULED, TIMED (+ overlay can advance) | cron `getFixtures()` |
| WC Finished feed (`/matches?status=FINISHED`) | FINISHED (+ overlay for live) | cron `getResults()` |
| Hub display bucket | live / today / upcoming / finished | `classifyMatchState()` (DATA-16D) |
| Results display | FINISHED only (after DATA-16D fix) | `m.status === 'FINISHED'` filter |

---

## Cache Key Inventory

| Cache key | Type | TTL | Written by | Read by |
|-----------|------|-----|-----------|---------|
| `goalradar:match:{id}` | MatchSnapshot | 30s–7d (tier) | match-snapshot.ts | overlayMatchStates, match pages |
| `goalradar:dr:match:{id}` | MatchSnapshot | 30d | match-snapshot.ts | readDRSnapshot |
| `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | Match[] | 1800s | orchestrator → getFixtures | getUpcomingMatchesCached |
| `goalradar:/competitions/WC/matches?status=FINISHED` | Match[] | **43200s** (after fix) | orchestrator → getResults | getWCResultsCached |
| `goalradar:/competitions/WC/matches` | Match[] | 43200s | orchestrator → getAllMatches | getWCKnockoutMatchesCached |
| `goalradar:/competitions/WC/matches?dateFrom=…&dateTo=…` | Match[] | 1800s | orchestrator → getAllMatches (wrong!) | **REMOVED** (no longer used by hub/results) |
| `goalradar:live:matches` | Match[] | 30s | refreshLiveMatches | getWCLiveMatches |
| `goalradar:espn:event:{fdMatchId}` | CachedEspnEvents | 30d | enrichMatchWithEspnEvents | enrichMatchWithEspnEvents |

---

## Root Cause Summary

| Issue | Root cause | Fix |
|-------|-----------|-----|
| Results page "No results yet" | `getRecentMatchesCached('WC')` reads date-scoped key that rotates daily; no DR fallback | Use `getWCResultsCached()` — stable key `/matches?status=FINISHED` |
| Hub shows TIMED matches with no score | Same: date-scoped key returns empty → STATE_RANK merge has no FINISHED entries → overlay-only path unreliable | Same: `getWCAuthorityMatchesCached` now uses `getWCResultsCached()` |
| Overlay unreliable for recent finishers | UPCOMING snapshot TTL = time-to-kickoff+5min, can expire before overlay runs | Secondary fix: FINISHED feed in merge supersedes TIMED without relying on snapshot |
| wc-finished KV entry expires | TTL=1800s = cron interval; any cron delay causes gap | Increase to `WC_STALE` (43200s = 12h) |
