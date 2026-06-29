# LIVE-2 SSR Live Score Authority Report
## GoalRadar · Sprint LIVE-2

Implemented: 2026-06-15
Audit: `LIVE2_AUDIT.md`

---

## Problem

When a user first loaded `/match/[id]` for a live match, the SSR-rendered score
came from `goalradar:/matches/{id}` (per-match detail KV, 60s SWR). This key
lags behind `goalradar:live:matches` (30s TTL) — the source used by `/live` and
`/api/live-score`. First-paint score could be up to 60s stale. Combined with the
MatchLiveZone poll interval (30s), a user could see the wrong score for up to 90s
after loading the page.

---

## Change

**File: `src/lib/match-snapshot.ts`**

Two additions:

1. Import `readKVLiveMatches` from `./live-cache` (KV-direct, no L1, no provider — exported in LIVE-1A).

2. In `buildSnapshot()`, between the detail-load and `assembleSnapshot()` call, an overlay block runs for IN_PLAY/PAUSED matches:

```typescript
if (isLiveStatus(match.status)) {
  try {
    const kvLive = await readKVLiveMatches();
    const numId  = parseInt(matchId, 10);
    const live   = kvLive?.find((m) => m.id === numId);
    if (live) {
      match = { ...match, score: live.score, status: live.status };
      console.log(`[Snapshot] LIVE-OVERLAY match:${matchId} | score=...`);
    }
  } catch {
    // live cache unavailable — use detail score as-is
  }
}
```

**Ephemeral**: the overlay affects only this render's output. The write guard (`writeKVSnapshot` skips live matches) remains. No live snapshot is ever persisted to KV.

---

## Authority rule — after LIVE-2

| Status | Score source | Max first-paint lag |
|--------|-------------|-------------------|
| IN_PLAY / PAUSED | `goalradar:live:matches` (overlay) | **30s** |
| FINISHED | `goalradar:match:{id}` (7d snapshot) | 0 (immutable) |
| SCHEDULED / TIMED | `goalradar:/matches/{id}` (fixture) | 60s (score irrelevant) |

The SSR score source for live matches now matches the `/live` page and `/api/live-score` endpoint — same KV key, same 30s bound.

---

## What is unchanged

| Concern | Status |
|---------|--------|
| `vercel.json` | not touched |
| ISR `revalidate = 60` | unchanged |
| `MatchLiveZone` polling | unchanged — now confirms rather than corrects first-paint score |
| FINISHED / TIMED match rendering | unchanged — `isLiveStatus()` guard skips overlay |
| `prewarmMatchSnapshotKVOnly` | unchanged — calls `assembleSnapshot()` directly, bypasses `buildSnapshot()` |
| Provider call count | unchanged — `readKVLiveMatches()` is KV-only |
| New KV keys | none |
| `writeKVSnapshot` / `readKVSnapshot` guards | unchanged |
| Inflight dedup map (`_buildInflight`) | unchanged — overlay runs inside `buildSnapshot()` which is already protected |

---

## Log evidence (expected in Vercel function logs for live match)

```
[Snapshot] kv-detail-hit match:537358 | age=42s
[LIVE CACHE] hit  | live-matches | KV age 12s
[Snapshot] LIVE-OVERLAY match:537358 | score=4-1 | status=IN_PLAY
[Snapshot] BUILT match:537358 | detail=kv | h2h=ok | standings=ok | wcMatches=48 | 28ms
```

Without the fix the log would show:
```
[Snapshot] kv-detail-hit match:537358 | age=42s
[Snapshot] BUILT match:537358 | detail=kv | ...
```
No overlay line, and the score would be 42s stale.

---

## TypeScript

`npx tsc --noEmit` → 0 errors.

---

## Build

`npm run build` → clean, no warnings.

---

## Production verification

**Performed at 2026-06-15 ~04:14 UTC. No live match active (next kickoff 16:00 UTC).**

Non-live match checks (confirm overlay guard does not fire):

| Match | Status | Source | Score |
|-------|--------|--------|-------|
| 537358 | FINISHED | `snapshot` | 5-1 FT ✅ |
| 537361 | TIMED | `snapshot` | null ✅ |
| `/live` | — | — | "No live matches" ✅ |

These confirm `isLiveStatus()` correctly gates the overlay to IN_PLAY/PAUSED only.

**IN_PLAY verification pending**: next WC match at 2026-06-15T16:00:00Z.

When active, expected observations:
- `/match/[id]` SSR score hero shows same score as `/live` page on first paint
- `/api/live-score/[id]` returns `"source": "kv-live"` and same score
- Server log emits `[Snapshot] LIVE-OVERLAY match:{id} | score=X-Y | status=IN_PLAY`
- No `[LIVE CACHE] miss` log spike (no new provider calls)

---

## Commit

Pending push — see git log.
