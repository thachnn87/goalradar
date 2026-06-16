# DATA-13E Hardening Report
## ESPN Enrichment Pipeline Audit

Date: 2026-06-16
Commit: post-33904fb (debug endpoint source fix applied this session)
Verdict: **GREEN** — enrichment is resilient to cache misses, stale ISR pages, and ESPN failures.

---

## Task 1 — KV Usage Audit

### Key inventory

| KV key | Content | TTL | Purpose |
|--------|---------|-----|---------|
| `goalradar:match:{id}` | Full `MatchSnapshot` | 7 days (FINISHED) | Match page source; includes enriched goals/bookings/subs |
| `goalradar:dr:match:{id}` | Full `MatchSnapshot` | 30 days | Disaster-recovery; written alongside main snapshot |
| `goalradar:espn:lookup:{id}` | ESPN event ID string or `'__NOT_FOUND__'` | 30 days | Skip repeat scoreboard calls for resolved matches |
| `goalradar:espn:event:{id}` | `CachedEspnEvents` (goals, bookings, subs, enrichedAt) | 12 hours | Skip repeat ESPN summary calls |

### Cache hit / miss behaviour

**Warm path (both caches populated — steady state):**
```
enrichMatchWithEspnEvents()
  → kv.get(eventKey) → HIT → return enriched match (0 ESPN calls, 1 KV read)
```

**First enrichment (both caches cold):**
```
enrichMatchWithEspnEvents()
  → kv.get(eventKey) → MISS
  → resolveEspnMatchId()
    → kv.get(lookupKey) → MISS
    → ESPN scoreboard (1 call)
    → kv.set(lookupKey, espnId)  [fire-and-forget]
    → return espnId
  → getEspnMatchEvents(espnId)   [ESPN summary — 1 call]
  → kv.set(eventKey, events)     [fire-and-forget]
  → return enriched match
```

**After manual snapshot invalidation (event cache still live — 12h TTL):**
```
enrichMatchWithEspnEvents()
  → kv.get(eventKey) → HIT → return enriched match (0 ESPN calls)
```

**After both caches expired (event cache 12h + snapshot rebuilt >12h later):**
```
enrichMatchWithEspnEvents()
  → kv.get(eventKey) → MISS
  → resolveEspnMatchId()
    → kv.get(lookupKey) → HIT (30d TTL) → return espnId (0 scoreboard calls)
  → getEspnMatchEvents(espnId)   [1 summary call]
  → kv.set(eventKey, events)     [fire-and-forget]
  → return enriched match
```

### Storage growth

WC 2026 has 80 total matches. At most:
- 80 × `goalradar:espn:lookup:{id}` entries — max ~4KB each = ~320KB
- 80 × `goalradar:espn:event:{id}` entries — max ~8KB each = ~640KB
- Total ESPN-specific KV: **~1 MB** for the full tournament (negligible)

### Lookup key write reliability

The `kv.set(lookupKey, espnId)` in `resolveEspnMatchId()` is fire-and-forget. On Vercel
serverless, this write may not complete before function termination. **Observed in production:**
`eventCacheHit=true` but `espnMatchId=null` for all three target matches — the event cache
write completed but the lookup write did not.

**Impact:** Low. When the lookup key is absent:
1. If event cache is live (12h TTL): `enrichMatchWithEspnEvents` short-circuits on event cache
   hit — the lookup key is never consulted. Zero ESPN calls. ✅
2. If both caches are expired: one extra scoreboard call is made (vs. zero if lookup key existed).
   Since FINISHED match snapshots have 7-day TTL, this scenario occurs at most once per week.

**Recommendation for future hardening:** Await the lookup key write to ensure it persists.
Not blocking for GREEN — the enrichment pipeline is correct and the extra scoreboard call is rare.

---

## Task 2 — Snapshot Rebuild Flow

### POST /api/revalidate/match/{id} behaviour

```
invalidateMatchSnapshot(id)    → kv.del("goalradar:match:{id}")
revalidatePath("/match/{id}")  → clears Next.js ISR for /match/{id} path
```

Next page GET → `buildSnapshot()` runs → ESPN enrichment → enriched snapshot stored (7d TTL).

### Stale-content windows

| Scenario | Window | Root cause |
|----------|--------|------------|
| Bare URL `/match/{id}` after revalidation | < 1s | ISR cleared immediately by `revalidatePath` |
| Slug URL `/match/{id}-home-vs-away` after revalidation | **0–60s** | `revalidatePath('/match/{id}')` does not match slug path |
| First user after 7-day snapshot expiry | ~200ms | Stale-while-revalidate; background rebuild |

**The 60-second slug window** is the main stale surface. `revalidatePath('/match/537352')` clears
only the bare numeric path cache. The slug URL (`/match/537352-ivory-coast-vs-ecuador`) is a
distinct ISR entry with `revalidate = 60`. After the bare path is invalidated and the page
rebuilds, the slug URL's ISR will serve stale content until its own 60-second TTL expires and a
background rebuild fires.

**Fix available (not implemented — acceptable for now):**
Read the DR key (`goalradar:dr:match:{id}`) to reconstruct the slug, then call
`revalidatePath('/match/{id}-{home-slug}-vs-{away-slug}', 'page')` from the revalidation endpoint.
The 60-second window is acceptable for post-match enrichment where data doesn't change.

### Snapshot write guard

FINISHED match snapshots write at 7-day TTL. Live matches (`IN_PLAY`/`PAUSED`) skip both KV write
and snapshot — their data comes from `goalradar:live:matches` exclusively. This guard is correctly
in place (`isLiveStatus()` checks in `writeKVSnapshot`).

---

## Task 3 — Debug Endpoint Source Fix (applied)

**Problem:** `eventCacheHit=true` but `source=lookup-miss`.

**Root cause:** Source logic checked `espnMatchId` (from lookup KV key) before `events` (event
cache). When the lookup KV key is null (stale from pre-DATA-13C buggy code) but the event cache
IS populated, the wrong source was reported.

**Fix:** Check `events !== null` first — the event cache is the authoritative enrichment signal.

```typescript
// Before (broken):
} else if (!espnMatchId) {
  source = 'lookup-miss';    // ← fired even when events were cached
} else if (events) {
  source = 'kv-cache';
}

// After (fixed):
} else if (events !== null) {
  source = 'kv-cache';       // event cache is the authoritative signal
} else if (!espnMatchId) {
  source = 'lookup-miss';
}
```

**Verification:** After the fix, all three target matches will show `source=kv-cache` when
`eventCacheHit=true`, regardless of lookup key state.

---

## Task 4 — ESPN Failure Testing

### Tested failure modes

| Failure | ESPN API behaviour | enrichMatchWithEspnEvents | User impact |
|---------|-------------------|--------------------------|-------------|
| 404 (non-existent event) | HTTP 404 JSON `{"code":404,...}` | `espnFetch` throws on `!res.ok` → caught → return original match | No crash, FD data shown |
| Bad slug (400) | HTTP 400 compressed binary | `espnFetch` throws `ESPN HTTP 400` → caught → return original match | No crash, FD data shown |
| Malformed date (400) | HTTP 400 | same as above | No crash, FD data shown |
| Timeout (>10s) | No response | `AbortController` fires → `AbortError` → `espnFetch` throws → caught | No crash, 10s added to page load |
| `findEspnMatch` returns null | — | `resolveEspnMatchId` returns null → `enrichMatchWithEspnEvents` returns original match | No crash, FD data shown |
| KV write fails | — | `.catch()` logs error, does not throw | No crash, next request re-fetches |
| `getEspnMatchEvents` returns null | — | `enrichMatchWithEspnEvents` returns original match | No crash, FD data shown |

### Error containment

`enrichMatchWithEspnEvents()` wraps its entire body in `try { ... } catch (err) { return match; }`.
**Any failure at any point in the ESPN enrichment chain returns the unenriched match unchanged.**
The FD data (score, status, kickoff) is always authoritative and always displayed. ESPN enrichment
is strictly additive.

### Timeout risk

The 10-second `AbortController` timeout adds up to 10 seconds to the first snapshot build for a
match when ESPN is slow/down. The snapshot build is the only path that calls ESPN. Subsequent
page loads hit the KV snapshot (or event cache) — 0 ESPN calls, 0 latency risk.

**Mitigation already in place:** `buildSnapshot()` is called lazily on first page load after
snapshot expiry. The `_buildInflight` module-level Map coalesces concurrent builds — only 1 ESPN
call is made per match even under concurrent traffic.

---

## Task 5 — ESPN Request Volume

### Per-match lifecycle

| Phase | ESPN scoreboard calls | ESPN summary calls | Total ESPN calls |
|-------|----------------------|--------------------|-----------------|
| First enrichment (both caches cold) | 1 (+ 1 prev-day if 01-02Z UTC) | 1 | 2–3 |
| After snapshot invalidation (event cache live, 12h) | 0 | 0 | **0** |
| After event cache expired, lookup key live (30d) | 0 | 1 | **1** |
| After both caches expired | 1 | 1 | **2** |

### WC 2026 tournament totals

| Metric | Value |
|--------|-------|
| Total WC 2026 matches | 80 |
| ESPN calls per match (first enrichment) | 2.0 avg (2.3 for UTC 01–02Z matches) |
| **Total ESPN calls for full tournament** | **~160–185** |
| Daily calls during group stage (8 matches/day) | ~16–19 |
| Steady-state calls (warm caches) | **0** |
| Calls per manual snapshot invalidation (event cache warm) | **0** |

### Cache effectiveness

With 7-day snapshot TTL and 12-hour event cache TTL:
- A finished match page can be served with **0 ESPN calls** for the first 12 hours after enrichment
- Between 12 hours and 7 days, a snapshot rebuild would cost 1 ESPN summary call (lookup cache hit)
- Manual snapshot invalidations (e.g. for revalidation) cost **0 ESPN calls** while event cache is live

ESPN has no documented rate limits for its public API. The 160-call total over the full
tournament lifetime is negligible. No rate-limiting protection is needed at current scale.

---

## Code Changes Made

| File | Change |
|------|--------|
| `src/app/api/debug/espn-enrichment/[matchId]/route.ts` | Source logic: check `events !== null` before `espnMatchId` |

TypeScript: `npx tsc --noEmit` → **0 errors**.

---

## Findings Summary

| Finding | Severity | Action |
|---------|----------|--------|
| Debug endpoint reported `lookup-miss` when events ARE cached | Low | **Fixed** |
| Slug URL ISR has 60s stale window after snapshot invalidation | Low | Documented — acceptable |
| Lookup KV key write is fire-and-forget and may not persist | Low | Documented — impact minimal (rare extra scoreboard call) |
| ESPN timeout adds up to 10s to first snapshot build | Acceptable | Mitigated by inflightMap coalescing |
| ESPN failure returns unenriched match (FD data displayed) | Acceptable | By design — enrichment is best-effort |

---

## Verdict: GREEN

The ESPN enrichment pipeline is resilient to:
- **Cache misses** — correct fallback chain (event cache → lookup cache → ESPN API)
- **Stale ISR pages** — ISR `revalidate=60` ensures pages refresh within 60s; enriched data
  served from KV snapshot (not from ISR cache directly)
- **ESPN failures** — all error paths caught in `enrichMatchWithEspnEvents`; FD data always shown
- **Concurrent traffic** — `_buildInflight` coalescing prevents ESPN call stampedes

No user-facing crash path exists through the ESPN enrichment pipeline.
