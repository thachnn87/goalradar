# LIVE-1A Production Consistency Audit
## GoalRadar · Sprint LIVE-1A

Generated: 2026-06-15

Observed: `/live` shows Sweden 4-1 Tunisia while `/match/537358` shows Sweden 3-1 Tunisia
at the same timestamp. MatchLiveZone poller is running. Score divergence is persistent.

---

## Data path trace

### `/live` page

```
LivePage (server component, revalidate=30)
  └─ getLiveMatches()                         ← api.ts:183
       └─ getCachedLiveMatches(fetcher)        ← live-cache.ts
            └─ fetchLiveCached(fetcher)
                 ├─ 1. L1 in-process Map      (30s TTL, per-instance)
                 ├─ 2. KV goalradar:live:matches  (30s TTL, cross-instance)
                 └─ 3. providerManager.getLiveMatches()

Returns: Match[] — score comes from whichever layer hit first
```

`LiveRefresher` calls `router.refresh()` every 30s → server component re-runs the chain above.

### `/api/live-score/[matchId]`

```
GET /api/live-score/537358  (force-dynamic, separate serverless instance)
  └─ getLiveMatches()                         ← api.ts:183
       └─ getCachedLiveMatches(fetcher)        ← SAME code path as /live
            └─ fetchLiveCached(fetcher)
                 ├─ 1. L1 in-process Map      ← PER-INSTANCE — NOT shared with /live instance
                 ├─ 2. KV goalradar:live:matches  (same key)
                 └─ 3. provider
  └─ if match found in L1/KV/provider → return {score, source: 'live'}
  └─ else → getOrBuildMatchSnapshot(matchId)
```

### `getOrBuildMatchSnapshot` (snapshot path for live match)

```
getOrBuildMatchSnapshot('537358')
  └─ readKVSnapshot('537358')
       └─ goalradar:match:537358
            └─ isLiveStatus(IN_PLAY) → return null  ← write guard, always null for live
  └─ buildSnapshot('537358')
       └─ readMatchDetailFromKV('537358')
            └─ goalradar:/matches/537358   (60s SWR — the per-match detail KV key)
                                           ← populated by withKVCache on last detail fetch
                                           ← age: up to 60s
       └─ parallel: H2H, WC fixtures, standings (KV-only)
  └─ writeKVSnapshot → SKIPPED (isLiveStatus guard)
  └─ returns snapshot.match.score  ← from goalradar:/matches/537358
```

---

## Score sources at each layer at time of divergence

| Layer | Key | Score | Notes |
|-------|-----|-------|-------|
| `goalradar:live:matches` (KV) | cross-instance | **4-1** | Refreshed by orchestrator after 4th goal |
| L1 in-process — `/live` instance | instance A | 4-1 | Warmed from KV after L1 expired |
| L1 in-process — API endpoint instance | instance B | **3-1** | Warmed from KV before 4th goal, TTL not yet expired |
| `goalradar:/matches/537358` (KV) | cross-instance | 3-1 | Per-match detail, 60s SWR |
| `goalradar:match:537358` (KV snapshot) | cross-instance | null | Never written for live matches |

---

## Exact divergence point

```
fetchLiveCached() on the API endpoint's instance:

  1. l1Get('goalradar:live:matches')
      → entry found, fetchedAt = T-18s, age = 18s < 30s  ← NOT EXPIRED
      → return L1 data: [{ id: 537358, status: 'IN_PLAY', score: { home: 3, away: 1 } }]
      → log: [LIVE CACHE] hit  | live-matches | L1 in-memory

  2. matches.find(m => m.id === 537358) → found! score = 3-1
  
  3. endpoint returns { status: 'IN_PLAY', score: 3-1, source: 'live' }
```

The endpoint DOES find the match in the live cache and DOES return `source: 'live'`. It never falls through to snapshot. The returned score is **3-1 from stale L1**, not 4-1 from KV.

---

## Why `/live` shows 4-1 but the endpoint returns 3-1

`getLiveMatches()` routes through **`fetchLiveCached()`**, which has two cache layers:

- **L1**: in-process `Map` keyed by `'goalradar:live:matches'`, **30s TTL, per-instance**
- **L2**: Vercel KV key `goalradar:live:matches`, **30s TTL, cross-instance**

Vercel deploys serverless functions as independent instances. Each instance maintains its own L1 state. When the KV is updated (after the 4th goal), L1 entries in other instances are NOT invalidated — they expire naturally after their own 30s TTL.

Timeline:
```
T=0    Orchestrator writes KV: { id: 537358, score: 3-1 }
T=5    Instance B (API endpoint) serves a request, L1 warms with 3-1, fetchedAt=T+5
T=20   4th goal scored. KV is stale for next ~10s until next orchestrator run
T=30   Orchestrator writes KV: { id: 537358, score: 4-1 }
T=31   Instance A (/live page) L1 expired → KV hit → warms L1 with 4-1
T=35   MatchLiveZone polls → hits Instance B → L1 age = 30s, not yet expired → returns 3-1
T=35   /live page (Instance A): L1 has 4-1 → shows 4-1
       /api/live-score (Instance B): L1 has 3-1 → returns 3-1 → MatchLiveZone shows 3-1
```

**Root cause**: `getLiveMatches()` → `fetchLiveCached()` → L1 in-process cache is per-instance. The `/live` page and `/api/live-score` run on different instances. The API endpoint instance's L1 is stale. The endpoint returns the stale L1 score instead of the KV score.

---

## Why the snapshot path is not the issue

The endpoint finds the match in L1 and returns it — it never reaches `getOrBuildMatchSnapshot()`. The snapshot divergence (3-1 in `goalradar:/matches/537358` vs 4-1 in `goalradar:live:matches`) is a separate but related issue: the per-match KV key has a 60s SWR, so it can lag by up to 60s behind the live cache. The snapshot path would cause the same symptom through a different mechanism if L1 were bypassed.

---

## Authority rule (goal state)

| Match status | Authoritative source | Why |
|-------------|---------------------|-----|
| IN_PLAY / PAUSED | `goalradar:live:matches` (KV) | 30s TTL; fresh data from `/matches?status=IN_PLAY,PAUSED`; orchestrator-refreshed |
| FINISHED | `goalradar:match:{id}` (snapshot) | 7-day TTL; score never changes |
| SCHEDULED / TIMED | fixture feed | score irrelevant; kickoff time is what matters |

**Invariant**: For a live match, `goalradar:live:matches` is the only source that has real-time score data. The per-match detail KV (`goalradar:/matches/{id}`) lags by up to 60s due to SWR. The in-process L1 can lag by up to 30s per instance. Only the KV key itself is cross-instance consistent within its 30s TTL.

---

## Fix

The `/api/live-score/[matchId]` endpoint must **bypass L1** and read directly from KV for the live cache check. This ensures the endpoint always reads the same data as any other instance that just warmed its L1 from KV.

**Change 1 — `src/lib/live-cache.ts`**: Export `readKVLiveMatches()` — a KV-direct read that bypasses L1.

**Change 2 — `src/app/api/live-score/[matchId]/route.ts`**: Use `readKVLiveMatches()` as the primary source instead of `getLiveMatches()`. Keep `getLiveMatches()` as a fallback for when KV is expired (it will then trigger a fresh provider fetch).

**No other changes needed**:
- `/live` page: continues using `getLiveMatches()` — L1 hit is fine because the page also has `revalidate=30` which naturally re-runs the server component periodically
- ISR: unchanged — no `revalidate` values modified
- Provider traffic: unchanged — `readKVLiveMatches()` adds zero provider calls (KV-only read); `getLiveMatches()` fallback is only triggered when KV is expired, same as today
- No new KV keys

---

## Verification plan

After fix, observe at same timestamp:
1. `/live` shows score X (from live cache)
2. `GET /api/live-score/537358` returns score X and `"source": "kv-live"`
3. `/match/537358` MatchLiveZone shows score X within one polling cycle
4. No log line `[LIVE CACHE] hit  | live-matches | L1 in-memory` on the first API call to a cold instance (should be KV hit instead)
