# LIVE-2B Audit
## GoalRadar · Live Match Status Divergence — Root Cause Investigation

Date: 2026-06-16
Match: 537364 (Iran vs New Zealand)

---

## Incident

**`/live` shows:**
```
Iran 0–1 New Zealand  ·  LIVE
```

**`/match/537364-iran-vs-new-zealand` shows:**
```
UPCOMING
VS
```

Both were observed at the same timestamp.

---

## Phase 1: Data Path Trace

### Path 1 — `/live` page

```
/app/live/page.tsx
  → getLiveMatches()                            api.ts:181
    → getCachedLiveMatches(provider)            live-cache.ts:210
      → fetchLiveCached()                       live-cache.ts:136
        L1: in-memory (30s TTL) — hit or miss
        L2: kv.get("goalradar:live:matches")    live-cache.ts:148
        L3: football-data.org (on miss)         live-cache.ts:165
```

**KV key:** `goalradar:live:matches`
**TTL:** 30 seconds (hard)
**Entry shape:** `{ matches: Match[], fetchedAt: number }`
**Match.id type:** `number`

The `/live` page reads `goalradar:live:matches` and finds Iran vs New Zealand with
`status: 'IN_PLAY'`, `score.fullTime: {home: 0, away: 1}`. Renders correctly.

---

### Path 2 — `/match/[id]` page

```
/app/match/[id]/page.tsx
  extractMatchId("537364-iran-vs-new-zealand")  → "537364" (string)    url.ts:69
  getOrBuildMatchSnapshot("537364")             match-snapshot.ts:534
    React.cache() deduplication
    readKVSnapshot("537364")                    match-snapshot.ts:217
      kv.get("goalradar:match:537364")
      → null (see Layer 3 analysis below)
    buildSnapshot("537364")                     match-snapshot.ts:341
      readMatchDetailFromKV("537364")           match-snapshot.ts:198
        kv.get("goalradar:/matches/537364")
        → MatchDetail { status: "SCHEDULED", score: {fullTime: {home:null, away:null}} }
      LIVE-2 overlay guard:
        isLiveStatus("SCHEDULED") = false       match-snapshot.ts:360
        → overlay SKIPPED ENTIRELY
      assembleSnapshot("537364", match, ...)
      writeKVSnapshot("537364", snapshot)
        isLiveStatus("SCHEDULED") = false → write proceeds
        getSnapshotTtlSec: kickoff passed → 60s TTL
```

---

## Phase 2: Status at Each Layer for Match 537364

| Layer | KV Key | Status | Score | Notes |
|-------|--------|--------|-------|-------|
| L1 (live cache) | `goalradar:live:matches` | **IN_PLAY** | 0–1 | 30s TTL, written by orchestrator |
| L2 (detail) | `goalradar:/matches/537364` | **SCHEDULED** | null–null | Pre-kickoff prewarm, SWR not yet fired |
| L3 (snapshot) | `goalradar:match:537364` | SCHEDULED or MISSING | null–null | Built from stale detail; or expired by kickoff guard |
| Overlay | N/A | — | — | NOT EXECUTED (condition false) |
| SSR render | — | SCHEDULED | null–null | "UPCOMING VS" rendered |

---

## Phase 3: Root Cause — Exact Failing Line

**File:** `src/lib/match-snapshot.ts`
**Line:** 360 (pre-fix)

```typescript
if (isLiveStatus(match.status)) {   // ← THE BUG
  const kvLive = await readKVLiveMatches();
  const numId  = parseInt(matchId, 10);
  const live   = kvLive?.find((m) => m.id === numId);
  if (live) {
    match = { ...match, score: live.score, status: live.status };
  }
}
```

**The condition `isLiveStatus(match.status)` gates the overlay on the detail
key's status.** When `goalradar:/matches/537364` still shows `SCHEDULED` (SWR
hasn't fired since kickoff), this condition evaluates to `false`, and the overlay
that would inject the live score/status is never entered.

---

### Why `goalradar:/matches/537364` shows SCHEDULED during a live match

The orchestrator prewarm (`prewarmWorldCup`) seeds `goalradar:/matches/{id}` before
kickoff. The entry uses `withKVCache` with a SWR (stale-while-revalidate) TTL. The
SWR fires a background refresh when the entry is read past `freshUntil`, but:

1. The prewarm may have written the entry with a long `freshUntil` (e.g., 2 hours
   before kickoff → `freshUntil = kickoff + 2h`).
2. At kickoff, the entry is still fresh by its own clock → SWR does not fire.
3. `buildSnapshot` calls `readMatchDetailFromKV` which reads without triggering SWR
   (by design, to avoid excessive provider calls from page renders).
4. Result: the detail returns `status: SCHEDULED` even though the match is live.

This is not a bug in the detail cache — it is working as designed. The LIVE-2
overlay was supposed to compensate for this gap. The bug is that the overlay's
own guard reads from the same potentially-stale source it is trying to override.

---

### Why `readKVSnapshot` returns null

`readKVSnapshot` at line 231–237 has an explicit guard:

```typescript
if ((raw.match.status === 'SCHEDULED' || raw.match.status === 'TIMED')) {
  const kickoffPlus5 = new Date(raw.match.utcDate).getTime() + 5 * 60 * 1_000;
  if (Date.now() > kickoffPlus5) {
    console.log(`[Snapshot] EXPIRED match:${matchId} — kickoff passed, may be live now`);
    return null;
  }
}
```

This correctly forces a rebuild when kickoff has passed. So the snapshot is
never served stale. But `buildSnapshot` then produces a new stale snapshot
because the overlay doesn't fire. The 60s TTL ensures the cycle repeats
frequently, but the overlay never fires until the detail key's SWR refreshes.

---

### LIVE-2 overlay — intent vs reality

| Scenario | Intended to catch | Actually catches |
|----------|-------------------|-----------------|
| Detail shows IN_PLAY with stale score | ✅ Yes — overlay updates score | ✅ Yes |
| Detail shows SCHEDULED, match is live | ✅ Yes — should catch this race | ❌ No — condition is false |

The LIVE-2 overlay was designed to handle a 60s staleness window on the score.
It was not designed to handle the case where the detail key itself hasn't
transitioned to IN_PLAY yet. This was the missing case.

---

## Phase 4: Fix Design

### Minimal change (single condition)

Remove the outer `if (isLiveStatus(match.status))` guard.
Move the liveness check to `if (live && isLiveStatus(live.status))`.

**Before:**
```typescript
if (isLiveStatus(match.status)) {         // gate on stale detail
  const kvLive = await readKVLiveMatches();
  const numId  = parseInt(matchId, 10);
  const live   = kvLive?.find((m) => m.id === numId);
  if (live) {
    match = { ...match, score: live.score, status: live.status };
  }
}
```

**After:**
```typescript
try {
  const kvLive = await readKVLiveMatches();
  if (kvLive) {
    const numId = parseInt(matchId, 10);
    const live  = kvLive.find((m) => m.id === numId);
    if (live && isLiveStatus(live.status)) {   // gate on live cache truth
      match = { ...match, score: live.score, status: live.status };
    }
  }
} catch { /* graceful degradation */ }
```

### Why this is safe

- `readKVLiveMatches()` returns null when the live cache is empty/expired — no-op
- For FINISHED matches: not present in live cache → `find` returns undefined → no-op
- For SCHEDULED (not kicked off): not present in live cache → no-op
- For IN_PLAY/PAUSED with stale detail: present in live cache → overlay fires ✅
- Write guard (`writeKVSnapshot`, line 257) still prevents live snapshots from
  being stored in KV — behaviour unchanged
- No new KV keys, no new provider calls, no TTL changes

### Performance impact

`readKVLiveMatches()` is now called unconditionally in every `buildSnapshot` run
(~5–10ms KV read). `buildSnapshot` only runs on snapshot cache miss. For live
matches, snapshots are never written (write guard), so every page hit is a miss and
calls `buildSnapshot` — this was already happening. The extra KV read is therefore
exactly one additional read per live-match page hit, at a cost already paid for
other KV reads in the same function.

---

## ID Type Audit

| Location | Input | Output | Coercion |
|----------|-------|--------|----------|
| `extractMatchId("537364-iran-vs-new-zealand")` | string (URL slug) | `"537364"` (string) | `regex[1]` |
| `getOrBuildMatchSnapshot("537364")` | string | string | passthrough |
| `buildSnapshot("537364")` | string `matchId` | — | passthrough |
| `readMatchDetailFromKV("537364")` | string | reads `goalradar:/matches/537364` | template literal |
| LIVE-2 overlay: `parseInt("537364", 10)` | string | `537364` (number) | explicit |
| Live cache: `kvLive.find(m => m.id === numId)` | number | Match | strict `===` comparison |

**ID type mismatch: none.** `parseInt(matchId, 10)` correctly converts to number
for comparison against `Match.id` (typed as `number` from football-data.org).

---

## Phase 2 Diagnostic Endpoint

Created: `GET /api/debug/match-state/[id]`

Returns the status and score at every KV layer for a given match ID, plus:
- `live2bRaceActive`: boolean — confirms the race condition is present
- `overlayGuardWouldFire`: whether current code (pre-fix) would enter the overlay
- `overlayWouldFireWithFix`: whether the LIVE-2B fix would enter the overlay
- `diagnosis`: human-readable summary of the state

Auth: `CRON_SECRET` (Bearer or `?secret=`) or `NODE_ENV=development`.

```bash
# Check match 537364 in production
curl "https://goalradar.org/api/debug/match-state/537364?secret=$CRON_SECRET"
```

Expected output when race is active:
```json
{
  "matchId": "537364",
  "liveKVStatus": "IN_PLAY",
  "liveKVScore": { "fullTime": { "home": 0, "away": 1 } },
  "detailStatus": "SCHEDULED",
  "detailScore": { "fullTime": { "home": null, "away": null } },
  "snapshotStatus": "SCHEDULED",
  "overlayMatchFound": true,
  "overlayGuardWouldFire": false,
  "overlayWouldFireWithFix": true,
  "live2bRaceActive": true,
  "diagnosis": "LIVE-2B RACE CONFIRMED: live cache says IN_PLAY but detail says SCHEDULED..."
}
```
