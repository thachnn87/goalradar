# LIVE-2 SSR Live Score Authority Audit
## GoalRadar · Sprint LIVE-2

Generated: 2026-06-15

---

## Current score source for an IN_PLAY match page (SSR first-paint)

```
User GETs /match/537358-sweden-vs-tunisia

getOrBuildMatchSnapshot('537358')          [React.cache() dedup within render]
  │
  ├─ readKVSnapshot('537358')
  │    └─ goalradar:match:537358           → null  (isLiveStatus write guard)
  │
  ├─ _buildInflight / KV lock
  │
  └─ buildSnapshot('537358')
       │
       ├─ readMatchDetailFromKV('537358')
       │    └─ goalradar:/matches/537358   ← 60s SWR
       │         score: { home: 3, away: 1 }   ← up to 60s stale
       │
       └─ assembleSnapshot(...)
            └─ snapshot.match.score = { home: 3, away: 1 }  ← STALE
```

The per-match detail KV key `goalradar:/matches/{id}` has a **60s SWR window**. A goal scored at T+0 won't appear in this key until the next `withKVCache` refresh, which can be up to 60s later.

Meanwhile `goalradar:live:matches` has a **30s TTL** and is refreshed by the orchestrator. It carries the current IN_PLAY score within 30s of any change.

---

## Score lag comparison

| Source | Key | TTL/SWR | Max lag | Used by |
|--------|-----|---------|---------|---------|
| `goalradar:live:matches` | live cache | 30s TTL | 30s | `/live` page, `/api/live-score` step 1 |
| `goalradar:/matches/{id}` | per-match detail | 60s SWR | 60s | `buildSnapshot()` → SSR score hero |
| `goalradar:match:{id}` | snapshot | never written for live | — | bypassed (isLiveStatus guard) |

For a live match, the SSR first-paint score uses the **60s SWR** source. After hydration, `MatchLiveZone` polls `/api/live-score` which reads KV-direct (LIVE-1A). The user can see a 30s-stale score on first paint, then the correct score only after the first polling cycle (up to another 30s).

**Worst case**: user loads page 1s after a goal. Score from `goalradar:/matches/{id}` shows pre-goal score (up to 60s lag). MatchLiveZone takes up to 30s to poll. User sees wrong score for up to 60s before hydration + up to 30s more = **90s total stale window**.

After LIVE-2 fix: SSR uses `goalradar:live:matches` directly (30s lag). MatchLiveZone then confirms same source. **Stale window: 30s max** (matches the live cache TTL).

---

## Exact divergence point in `buildSnapshot()` — match-snapshot.ts:340

```typescript
async function buildSnapshot(matchId: string): Promise<MatchSnapshot> {
  const t0 = Date.now();

  // Step 1: read per-match detail from KV (60s SWR)
  let match: MatchDetail | null = await readMatchDetailFromKV(matchId);
  let detailSource: 'kv' | 'provider' = 'kv';

  if (!match) {
    detailSource = 'provider';
    match = await getMatchDetail(matchId);     // throws on not found
  }

  // ← HERE: no live cache overlay
  //   match.score still from goalradar:/matches/{id} (60s SWR)

  return assembleSnapshot(matchId, match, detailSource, t0);
  //                               ↑
  //             match.score becomes snapshot.match.score → SSR hero
}
```

`assembleSnapshot()` at line 407 directly assigns the `match` object into `snapshot.match`. There is no live-cache score overlay anywhere in this path.

---

## Fix location and design

Insert a live-cache overlay step in `buildSnapshot()`, between the detail-load and `assembleSnapshot()` call:

```
After match is loaded (KV detail or provider):
  if isLiveStatus(match.status):
    kvLive = await readKVLiveMatches()         ← KV-direct, no L1, no provider
    live = kvLive?.find(m => m.id === match.id)
    if live found:
      match = { ...match, score: live.score, status: live.status }
      → snapshot.match.score now from goalradar:live:matches (30s lag)
      → snapshot.match.status reflects current live status (IN_PLAY vs PAUSED)
```

**Authority rule after fix:**

| Status | Score source | Max lag |
|--------|-------------|---------|
| IN_PLAY / PAUSED | `goalradar:live:matches` (overlay) | 30s |
| FINISHED | `goalradar:match:{id}` (snapshot, 7d TTL) | 0 (immutable) |
| SCHEDULED / TIMED | `goalradar:/matches/{id}` (fixture) | 60s |

---

## Invariants preserved

1. **No provider calls**: `readKVLiveMatches()` is KV-only (exported in LIVE-1A, no L1, no provider).
2. **No new KV keys**: reads only `goalradar:live:matches` (already exists).
3. **Write guard unchanged**: `writeKVSnapshot()` still skips live matches. The overlay only affects this render's output — it is NOT persisted.
4. **ISR unchanged**: `revalidate = 60` on match page stays. Each re-render rebuilds the snapshot fresh anyway (live matches never hit the KV snapshot cache).
5. **MatchLiveZone unchanged**: poller continues as before; now it confirms rather than corrects the first-paint score.
6. **FINISHED matches unaffected**: `isLiveStatus()` returns false for FINISHED; overlay is skipped.
7. **`prewarmMatchSnapshotKVOnly` unaffected**: calls `assembleSnapshot()` directly, bypasses `buildSnapshot()`. Prewarm is for UPCOMING matches; live write guard discards the prewarm result anyway.
8. **Inflight coalescing unaffected**: the overlay happens inside `buildSnapshot()`, which is already protected by the `_buildInflight` map.

---

## Edge cases

| Case | Behaviour |
|------|-----------|
| Live cache absent/expired at render time | `readKVLiveMatches()` returns null; overlay skipped silently; falls back to detail score |
| Match just transitioned IN_PLAY (detail says SCHEDULED) | If live cache has it as IN_PLAY, overlay updates both score and status |
| Match just transitioned FINISHED (live cache still has it) | Live cache drains within 30s; detail KV gets FINISHED status; `isLiveStatus(match.status)` returns false → no overlay; snapshot uses correct FINISHED score |
| Live cache has score `{ fullTime: {home: 0, away: 0} }` at kickoff | Overlay applies correctly — 0-0 is the right score |
