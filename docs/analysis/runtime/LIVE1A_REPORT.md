# LIVE-1A Production Consistency Report
## GoalRadar · Sprint LIVE-1A

Implemented: 2026-06-15

---

## Root cause

`/live` showed Sweden 4-1 Tunisia. `/match/537358` showed Sweden 3-1 Tunisia at the same timestamp. The MatchLiveZone poller was running.

**The endpoint was returning a stale in-process L1 score, not a KV score.**

`getLiveMatches()` routes through `fetchLiveCached()`, which checks L1 (an in-process `Map`) before reading KV. Vercel deploys API routes as independent serverless instances, each with their own L1 state. When the orchestrator writes a new goal to KV, the L1 entries in other instances are not invalidated — they expire naturally after their own 30s TTL.

```
T+0   Orchestrator writes KV: score 3-1
T+5   Instance B (API endpoint) handles a request → L1 warmed with 3-1, fetchedAt = T+5
T+20  4th goal scored
T+30  Orchestrator writes KV: score 4-1
T+31  Instance A (/live page) L1 expired → KV hit → L1 warmed with 4-1 → shows 4-1
T+35  MatchLiveZone polls → Instance B → L1 age = 30s (not yet expired) → returns 3-1
      /live (Instance A): 4-1   /api/live-score (Instance B): 3-1   ← divergence
```

The endpoint found the match in L1 with `source: 'live'` — it never reached the snapshot path. It returned 3-1 from a stale L1 entry.

---

## Fix

### `src/lib/live-cache.ts` — new export

```typescript
export async function readKVLiveMatches(): Promise<Match[] | null>
```

Reads `goalradar:live:matches` directly from KV, bypassing L1. Returns null if KV is disabled, absent, or expired. Used by the live-score endpoint to guarantee cross-instance consistent reads.

### `src/app/api/live-score/[matchId]/route.ts` — source order updated

Old order:
1. `getLiveMatches()` → L1 → KV → provider
2. `getOrBuildMatchSnapshot()`

New order:
1. `readKVLiveMatches()` → **KV direct** (cross-instance consistent)
2. `getLiveMatches()` → L1/KV/provider fallback (if KV expired)
3. `getOrBuildMatchSnapshot()` (FINISHED matches, transition window)

The `source` field in the response now distinguishes:
- `"kv-live"` — served from KV direct (fast path, cross-instance consistent)
- `"live"` — served from L1 or provider via `getLiveMatches()` (fallback)
- `"snapshot"` — served from match snapshot (FINISHED or no live data)

---

## Authority rule — confirmed

| Status | Authoritative KV key | TTL | Via |
|--------|---------------------|-----|-----|
| IN_PLAY / PAUSED | `goalradar:live:matches` | 30s | `readKVLiveMatches()` → KV direct |
| FINISHED | `goalradar:match:{id}` | 7 days | `getOrBuildMatchSnapshot()` |
| SCHEDULED / TIMED | fixture feed | 6h / kickoff | snapshot |

The in-process L1 cache is an optimization for high-traffic scenarios. It must not be the primary source for an endpoint where cross-instance consistency is required.

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/live-cache.ts` | Add `readKVLiveMatches()` — KV-direct read, no L1 |
| `src/app/api/live-score/[matchId]/route.ts` | Use `readKVLiveMatches()` as step 1; `getLiveMatches()` as step 2 fallback |

---

## No-change guarantees

- `/live` page: continues using `getLiveMatches()` unchanged — L1 hit is fine since the page also revalidates every 30s and any L1 lag is bounded
- ISR: no `revalidate` values changed
- Provider traffic: `readKVLiveMatches()` is KV-only (zero provider calls); `getLiveMatches()` fallback only triggers when KV is expired (same frequency as today)
- No new KV keys

---

## TypeScript

`npx tsc --noEmit` → 0 errors.

---

## Verification

After deployment, for an active live match:
1. `GET /api/live-score/{matchId}` should return `"source": "kv-live"` for IN_PLAY matches
2. Score in response must match score on `/live` page within the KV's 30s TTL window
3. MatchLiveZone on the match page updates to the same score within one 30s polling cycle
4. No increase in provider call frequency (confirmed by absence of `[LIVE CACHE] miss` log spikes)
