# DATA-18A.1 Failure Mode Analysis

Date: 2026-06-17
Reviewer: Architecture review — no code changes.

---

## Failure Mode Index

| # | Failure | Current blast radius | Future blast radius |
|---|---------|---------------------|---------------------|
| F1 | FD unavailable | MEDIUM | MEDIUM |
| F2 | ESPN unavailable | LOW | LOW |
| F3 | Live cache unavailable | LOW | LOW |
| F4 | Snapshot unavailable | LOW | LOW |
| F5 | Authority cache unavailable | N/A (doesn't exist) | LOW (with DR) |
| F6 | Stale DR copy | LOW | LOW |
| F7 | Partial rebuild failure | N/A | LOW |
| F8 | KV write failure | LOW | LOW |

---

## F1 — FD Unavailable

**What this means:** Football-Data.org API returns 4xx/5xx/timeout. The orchestrator
cannot refresh bulk feed caches.

### Current behaviour

The bulk feed caches have TTLs of 12h (FINISHED) and 30min (SCHEDULED/TIMED).
All pages read from KV — no direct FD API calls on page load.
`withCache()` in `api.ts` uses L1 in-memory cache + KV. If KV is fresh, pages
continue serving correct data for up to 12h (FINISHED) or 30min (UPCOMING).

After 30min: upcoming/schedule pages may show stale fixtures (wrong kickoff times,
wrong match order). **No page crashes.** All functions catch and return empty arrays.

After 12h: results pages may show stale scores. Still no crash.

**Blast radius:** MEDIUM — data becomes stale after TTL expires, but pages remain up.

### Future behaviour (with authority cache)

`readAuthorityCache()` reads `goalradar:wc:authority:v1` (primary TTL: 30s–900s).
If FD is down and the orchestrator stops writing, the primary key expires.
`readAuthorityCache()` falls through to DR copy (`goalradar:dr:wc:authority:v1`, 7d).

**Future blast radius:** LOW-MEDIUM — DR copy serves up to 7 days of stale but
consistent data across all pages simultaneously. The blast radius is actually
**smaller** than current (where each page independently falls back to stale KV entries
with different TTLs and potentially inconsistent states across pages).

### Recovery path

- Current: wait for FD to recover; orchestrator auto-refreshes on next cron cycle.
- Future: same. Authority cache rebuilds automatically on next orchestrator run.

### Gap identified

The authority cache design does not specify a DR TTL for the SCHEDULED/TIMED
bulk feed when FD is down. The current fallback for `getUpcomingMatchesCached`
returns `{ matches: [] }` after TTL expires with no DR copy. This means the
authority cache builder during FD outage would produce a canonical set with
FINISHED matches only (from DR) and no upcoming fixtures.

**Recommendation:** The authority cache DR copy (7d TTL) must be treated as
authoritative during FD outages — it contains all 104 matches in their last-known
state, which is better than a partial rebuild.

---

## F2 — ESPN Unavailable

**What this means:** ESPN scoreboard API returns errors or timeouts during
`enrichMatchWithEspnEvents()`.

### Current behaviour

`enrichMatchWithEspnEvents()` is best-effort. Any error returns the original
`match` unchanged. The snapshot is written WITHOUT events (goals/cards = []).
Pages show correct scores but no goal scorers.

The snapshot TTL for FINISHED is 7d — ESPN events are cached at
`goalradar:espn:event:{fdId}` for 12h, and if that cache is warm, the
snapshot build succeeds even if ESPN is down (reads from KV cache, not ESPN API).

**Blast radius:** LOW — match pages show no goal scorers. Score is correct.

### Future behaviour

Same. `buildCanonicalMatch()` reads events from the snapshot (which may be
empty if ESPN was unavailable at snapshot build time). `enrichmentApplied=false`.

**No regression from current behaviour.**

### Recovery path

When ESPN recovers, the next page visit to a match page triggers `buildSnapshot()`
which calls `enrichMatchWithEspnEvents()`. If `goalradar:espn:event:{fdId}` is
still warm, the enrichment is applied from KV. The authority cache is rebuilt on
the next orchestrator cycle, picking up the newly enriched snapshot.

---

## F3 — Live Cache Unavailable

**What this means:** `goalradar:live:matches` is absent or expired (30s TTL miss,
or `readKVLiveMatches()` throws).

### Current behaviour

`getWCLiveMatches()` returns `{ matches: [] }` on error (try/catch). The authority
merge in `getWCAuthorityMatchesCached()` uses `liveResult.value.matches = []` — the
live feed contributes nothing. Pages show matches as SCHEDULED/TIMED until the FD
results feed (12h TTL) marks them FINISHED.

Gap: during a live match, if the 30s live cache expires AND the snapshot is absent,
the match shows as SCHEDULED on listing pages for up to 30s. Acceptable for listing
pages. The match detail page reads directly from `getOrBuildMatchSnapshot()` which
does a live overlay — unaffected.

**Blast radius:** LOW — listing pages show stale status for up to 30s. Match detail
pages are unaffected.

### Future behaviour (with authority cache)

The live refresh loop writes to the authority cache at the same 30s cadence as the
live cache. If the live cache is unavailable, the authority cache also stops getting
live updates (same 30s gap). No regression.

**Gap identified:** The authority cache design (`DATA18A_CACHE_STRATEGY.md`) states
the live refresh loop "reads the current canonical cache, applies live entries,
writes back." But if the live cache is the input to this process AND the live cache
is unavailable, the live refresh loop has nothing to apply. The primary authority
cache TTL is 30s during live matches — so the page serves the last-known state for
up to 30s, then gets a stale-but-not-wrong result from DR. This is acceptable.

---

## F4 — Snapshot Unavailable

**What this means:** `kv.mget(goalradar:match:{id})` returns nulls for all 104 keys.
This can occur after a KV namespace wipe, TTL expiry cascade, or cold-start.

### Current behaviour

`overlayMatchStates()` receives all nulls from mget. `mergeSnapshotState(m, null)`
returns `m` unchanged. Pages serve the raw bulk feed data (correct scores from FD
results feed, but no goal scorer events). Match detail pages trigger `buildSnapshot()`
on demand (rebuilds from FD detail + ESPN on page visit).

**Blast radius:** LOW for listing pages (scores correct, no events). Match detail
pages self-heal on first visit.

### Future behaviour

`buildAllCanonicalMatches()` receives null for all snapshots. `buildCanonicalMatch(m, null, ...)` produces `CanonicalMatch` with `goals=[], cards=[], subs=[], lineups=null, enrichmentApplied=false`. Functionally identical to current behaviour.

**The authority cache correctly handles snapshot-miss by design.** No regression.

### One gap

If all 104 snapshots are absent AND the authority cache has just expired AND FD is
also slow, the cold rebuild takes: 3 bulk reads + 104-key mget(all null) + build.
The 104-key mget returning 104 nulls is fast (KV MISS batch response). Total cold
rebuild time estimate: ~200ms. Acceptable.

---

## F5 — Authority Cache Unavailable

**What this means (future only):** `goalradar:wc:authority:v1` is absent and
`goalradar:dr:wc:authority:v1` is also absent.

This can occur: first deploy of S3 before first orchestrator run, or KV namespace
wipe affecting both keys.

### Future behaviour

`readAuthorityCache()`:
1. Primary miss
2. DR miss
3. Calls `buildAndCacheAuthority()` (cold rebuild)
4. Cold rebuild reads 3 bulk feeds + 104 mget + builds → writes new primary

Pages serve the cold-rebuilt result. First-request latency for that ISR cycle
increases by ~200ms (vs ~5ms for a KV hit). Subsequent requests within the TTL
window serve the cached result normally.

**Blast radius:** LOW — one slow page load per region per cold miss. No data loss.

### Gap

The cold rebuild path is implicit in the design (`buildAndCacheAuthority()`) but
not yet implemented (that's DATA-18B). The plan must ensure this path is in place
before S3.

---

## F6 — Stale DR Copy

**What this means:** Orchestrator has been down for >7d. Both primary and DR copies
have expired. Cold rebuild is the only path.

### Current behaviour

Each bulk feed has its own DR (FINISHED feed has stable TTL, upcoming has no DR).
After 7d with no orchestrator:
- FINISHED feed KV likely expired (12h TTL)
- Per-match snapshots alive (7d TTL for FINISHED, DR 30d)
- Pages fall back to empty arrays or static bundled fixtures

**Blast radius:** MEDIUM — pages show static WC fixture data (correct teams/dates,
stale scores if matches have finished since bundled data was built).

### Future behaviour

After 7d with no orchestrator + DR expired, cold rebuild reads from FD API directly
(triggering provider calls). If FD is also unavailable, the page returns the static
bundled fixture fallback.

**Assessment:** The DR copy covering 7 days is adequate for operational recovery.
A production incident lasting >7 days is an extraordinary event and out of design scope.

---

## F7 — Partial Rebuild Failure

**What this means (future only):** The authority cache builder starts building,
succeeds for 50 matches, then throws. The KV write never happens. The previous
cached value remains until its TTL expires.

### Why this can't produce partial writes

`kv.set()` is atomic in Cloudflare KV. Either the full 104-match JSON is written,
or nothing is written. There is no partial-write scenario at the KV level.

The only partial failure scenario: the builder crashes mid-computation (memory error,
network error fetching bulk feeds). In this case the builder returns without writing
anything, and the previous authority cache value remains valid until its TTL.

**Blast radius:** LOW — pages continue serving the previous valid authority cache.

### Gap

The `buildAllCanonicalMatches()` caller (orchestrator) should catch errors from the
builder and emit a log. Currently not specified in the design. Add to DATA-18B scope.

---

## F8 — KV Write Failure

**What this means:** `kv.set('goalradar:wc:authority:v1', ...)` throws.

### Current behaviour

All existing KV writes are fire-and-forget (snapshot writes) or wrapped in
try/catch (withCache). A write failure means the next read gets the stale value.

### Future behaviour

The authority cache write should be:
1. **Awaited** (not fire-and-forget) — pages depend on freshness
2. **Logged** on failure — so ops can detect stale authority cache
3. **Non-fatal** — a write failure should not crash the orchestrator cron

```typescript
try {
  await kv.set('goalradar:wc:authority:v1', matches, { ex: ttl });
  console.log('[Authority] wrote primary cache', { matches: matches.length, ttl });
} catch (err) {
  console.error('[Authority] primary write failed — pages will serve previous cache', err);
  // Do not rethrow — orchestrator continues
}
```

The DR write can be fire-and-forget (lower priority). The primary write must be
awaited and logged.

**Blast radius:** LOW with proper logging. The previous cache value serves until
its TTL expires, then the DR copy takes over.

---

## 9. Summary Table

| Failure | Pre-authority | Post-authority | Change |
|---------|--------------|----------------|--------|
| FD down >30min | Pages show stale upcoming fixtures | DR authority cache serves all 104 consistent | Improvement |
| ESPN down | No events on match pages | Same | No change |
| Live cache miss (30s) | Status stale for 30s on listing pages | Same | No change |
| All snapshots missing | No events on any page | Same | No change |
| Authority cache cold miss | N/A | 1 slow request, auto-heals | New |
| Stale DR (>7d outage) | Static fallback | Static fallback | No change |
| Partial rebuild failure | N/A | Previous cache persists | No change |
| KV write failure | Snapshot silently stale | Authority cache stale, logged | Improvement |

**Overall assessment:** The authority cache strictly improves failure behaviour for
all scenarios except introducing one new failure mode (F5 cold miss) that is
self-healing within one request.
