# DATA-5 Live State Authority Audit
## GoalRadar · Sprint DATA-5

Generated: 2026-06-15

---

## Production evidence

| Surface | Match 537352 (Ivory Coast vs Ecuador) | Score |
|---------|--------------------------------------|-------|
| `/match/537352` | IN_PLAY ✅ | 1–0 ✅ |
| `/live` | "No live matches right now" ❌ | — ❌ |
| `/schedule?competition=WC` | SCHEDULED (upcoming) ❌ | — ❌ |
| `/world-cup-2026` | Not in Live section ❌ | — ❌ |
| `/` (homepage) | Not in Live section ❌ | — ❌ |

---

## Layer 1 — Raw competition feeds

### Upcoming feed — `/competitions/WC/matches?status=SCHEDULED,TIMED`

**Status for 537352: SCHEDULED**

This feed is explicitly filtered to `status=SCHEDULED,TIMED` by the provider API endpoint. A match in IN_PLAY is NOT returned by this endpoint — it is removed from the feed as soon as its status changes. The KV entry for this key still carries the match as SCHEDULED until the cron calls the provider and the API confirms its removal.

**Retention window:** up to WC_MIN_INTERVAL_SEC = 1800 s (30 min skip guard) after the cron last successfully refreshed this endpoint.

### Recent feed — `/competitions/WC/matches?dateFrom=${from}&dateTo=${today}`

**Status for 537352: SCHEDULED or IN_PLAY — depends on when the cron last refreshed**

This endpoint has no status filter. The football-data.org API returns all statuses for the date range. If the orchestrator refreshed this key after kickoff, the entry shows IN_PLAY. If the orchestrator's last refresh was before kickoff (and the 30-min skip guard is preventing a new fetch), the entry still shows SCHEDULED.

**This is the only bulk feed that CAN carry IN_PLAY — but only with perfect cron timing.**

### Live feed — `goalradar:live:matches`

**Status for 537352: IN_PLAY (if KV not expired) or absent**

Populated by `refreshLiveMatches()` in the orchestrator. TTL: 30s. The orchestrator runs every 15 min — meaning the KV entry is stale for ~14 min 30 s of every 15-min cycle. During that window, on-demand provider calls via `getLiveMatches()` → `fetchLiveCached()` refill the key.

If the provider call fails (see Layer 4), the key stays empty.

---

## Layer 2 — Per-match snapshot `goalradar:match:537352`

**For an IN_PLAY match: this key does not exist (hard write guard)**

`writeKVSnapshot` in `match-snapshot.ts`:
```typescript
if (isLiveStatus(snapshot.match.status)) {
  console.log(`[Snapshot] SKIP write match:${matchId} — status=${snapshot.match.status}`);
  return;
}
```

`readKVSnapshot` in `match-snapshot.ts`:
```typescript
// Live matches: always rebuild — their status changes every minute
if (isLiveStatus(raw.match.status)) {
  console.log(`[Snapshot] SKIP match:${matchId} — status=${raw.match.status}, bypassing stale snapshot`);
  return null;
}

// Scheduled match past its kickoff → may be live now; force rebuild
if ((raw.match.status === 'SCHEDULED' || raw.match.status === 'TIMED')) {
  const kickoffPlus5 = new Date(raw.match.utcDate).getTime() + 5 * 60 * 1_000;
  if (Date.now() > kickoffPlus5) {
    console.log(`[Snapshot] EXPIRED match:${matchId} — kickoff passed, may be live now`);
    return null;
  }
}
```

**Result:** `kv.mget('goalradar:match:537352')` → **null** for any match that is live or past kickoff+5min.

This is intentional design: live-cache.ts owns live state; snapshot cache is for SCHEDULED and FINISHED.

---

## Layer 3 — Live cache KV

**Key:** `goalradar:live:matches`  
**Populated by:** `refreshLiveMatches()` in `src/lib/refresh.ts`  
**TTL:** 30 seconds (`kv.set(..., { ex: 30 })`)  
**Content:** all competitions, IN_PLAY and PAUSED matches

**Refresh path:**
```
orchestrator (every 15 min)
  └─ refreshLiveMatches()
       ├─ if rate-safe mode active → SKIP (return)
       ├─ providerManager.getLiveMatches() → /matches?status=IN_PLAY,PAUSED
       └─ kv.set('goalradar:live:matches', entry, { ex: 30 })
```

**On-demand fallback (page render):**
```
getLiveMatches() → getCachedLiveMatches(fetcher)
  └─ fetchLiveCached(fetcher)
       ├─ L1 in-memory → miss (serverless cold start per request)
       ├─ KV goalradar:live:matches → hit if < 30s old, else miss
       ├─ provider call /matches?status=IN_PLAY,PAUSED → if fails:
       └─ DR key goalradar:dr:live:matches (7-day TTL) → or return []
```

**Why the live cache can be empty during a live match:**

1. Orchestrator runs every 15 min, sets 30s TTL → key expires for ~14 min 30 s of each cycle.
2. During those 14+ min, on-demand calls from `getLiveMatches()` (on /live page load, hub load, etc.) trigger provider calls to `/matches?status=IN_PLAY,PAUSED`.
3. If these provider calls fail (429 due to concurrent requests, API error, or rate-safe mode from prior WC fixture refresh 429s), the DR key is served. If the DR key was last written before the tournament started, it contains no live matches.
4. **Result:** `goalradar:live:matches` returns [] → all pages that read from it see no live matches.

**Why the match page still works while the live cache is empty:**

`getOrBuildMatchSnapshot('537352')`:
- `readKVSnapshot` → null (past kickoff)
- Falls through to `buildSnapshot()` → calls `providerManager.getMatchDetail('537352')` → `/matches/537352`
- `/matches/{id}` is a **single-match endpoint** — different rate limit window from `/matches?status=IN_PLAY,PAUSED`
- **The match page calls the provider for EACH match individually; the live page calls a multi-match aggregate endpoint.** Both may succeed or fail independently.

---

## Layer 4 — Authority merge (`getWCAuthorityMatchesCached()`)

```typescript
export async function getWCAuthorityMatchesCached(): Promise<{ matches: Match[] }> {
  const [upcomingResult, recentResult] = await Promise.allSettled([
    getUpcomingMatchesCached('WC'),   // SCHEDULED/TIMED feed
    getRecentMatchesCached('WC'),     // date-range feed (all statuses)
  ]);
  // ...
  // overlayMatchStates: snapshot null for live matches → no advance
}
```

**THE LIVE FEED IS MISSING FROM THE AUTHORITY MERGE.**

The function merges two feeds. For match 537352 in IN_PLAY state:

| Case | Upcoming | Recent | Overlay | Authority status |
|------|---------|--------|---------|-----------------|
| A: cron ran after kickoff (< 30-min skip) | SCHEDULED | IN_PLAY | null | **IN_PLAY ✅** |
| B: cron skip guard active (within 30 min) | SCHEDULED | SCHEDULED | null | **SCHEDULED ❌** |

Case B is the common case: the WC_MIN_INTERVAL_SEC = 1800s skip guard prevents the recent feed from being refreshed more than once per 30 min. If a match kicks off between two cron refresh windows, the recent feed shows SCHEDULED for up to 30 min.

**The authority function handles FINISHED reliably (results feed always correct within one cycle) but handles IN_PLAY unreliably (depends on cron refresh timing relative to kickoff).**

---

## Layer 5 — Page routing

### `/live` page

```typescript
const data = await getLiveMatches();  // → live-cache.ts → goalradar:live:matches
```

Reads live cache directly. **Correct architecture** — if live cache has matches, page shows them. The problem is the live cache being empty (see Layer 3).

### `/schedule?competition=WC`

```typescript
const authority = await getWCAuthorityMatchesCached();  // no live source
matches = authority.matches;
```

**No live source at all.** Authority-only. A live match stays SCHEDULED on the schedule page unless the recent feed happened to be refreshed after kickoff. This is guaranteed to fail for any match that kicked off within the last 30 min (skip guard) OR if the cron hasn't run yet.

### `/world-cup-2026` (WC hub)

```typescript
const [liveResult, authorityResult, ...] = await Promise.allSettled([
  getWCLiveMatchesCached(),         // live cache (goalradar:live:matches)
  getWCAuthorityMatchesCached(),    // upcoming + recent + overlay
  ...
]);
const liveMatches = liveResult...;
const allLive = dedupById([...liveMatches, ...liveStrays]);  // liveStrays from authority
const todayMatches = allAuthority.filter(m =>
  m.utcDate.startsWith(today) && (m.status === 'SCHEDULED' || m.status === 'TIMED')
);
```

**Has a live source** (`getWCLiveMatchesCached()`) **but depends on the live cache being populated.** If live cache empty → `liveMatches = []`, `liveStrays = []` → `allLive = []`.

Additionally, if authority has the match as SCHEDULED (Case B above), it lands in `todayMatches` — duplicating in both Live (correct) and Today (SCHEDULED, wrong) sections when the live cache IS populated.

### `/` (homepage)

Same pattern as WC hub — uses both `getWCLiveMatchesCached()` and `getWCAuthorityMatchesCached()`. Same failure mode.

---

## Questions answered

### 1. Why does match page show LIVE but /live page show no matches?

The match page calls `providerManager.getMatchDetail(id)` → `/matches/537352` (per-match endpoint).  
The live page calls `providerManager.getLiveMatches()` → `/matches?status=IN_PLAY,PAUSED` (aggregate endpoint).

These are different endpoints with potentially different success/failure states. The per-match endpoint may succeed when the aggregate endpoint fails (rate limit, API error). Additionally, the match page bypasses the live cache entirely (snapshot read guard → null → provider call directly for detail).

### 2. Is `getWCLiveMatchesCached()` empty?

**Yes, at the time of the observation.** `getWCLiveMatchesCached()` reads `goalradar:live:matches`. If the KV entry expired (30s TTL) AND the on-demand provider call to `/matches?status=IN_PLAY,PAUSED` failed, the function returns [].

### 3. Is the live cache stale?

**Yes — structurally, it is almost always stale.** The orchestrator sets a 30s TTL every 15 min. The cache is fresh for only 30s out of every 900s (3.3% of the time). The remaining 96.7% depends on on-demand provider calls succeeding.

### 4. Is the orchestrator failing to populate the live cache?

**Possibly, via rate-safe mode.** If an earlier orchestrator task (WC fixture refresh) gets a 429 from the API, rate-safe mode activates. `refreshLiveMatches()` then skips:
```typescript
if (isRateSafeModeActive()) {
  logRateSafeSkip(endpoint);
  return { status: 'skipped', error: 'rate-safe mode active' };
}
```
The live KV entry expires. On-demand page requests then also fail (still rate-limited). DR key served (stale or empty).

### 5. Does the authority merge handle FINISHED but ignore LIVE?

**Yes — by architecture.** DATA-4 added FINISHED to the authority merge (upcoming + recent). LIVE was not added. The overlay cannot advance SCHEDULED→IN_PLAY (no snapshot written). The authority function has no live feed source.

### 6. Does `overlayMatchStates` advance SCHEDULED → LIVE?

**No.** It reads per-match KV snapshots. Live snapshots are not written (write guard in `writeKVSnapshot`). For a match past kickoff+5min, even SCHEDULED snapshots return null (read guard in `readKVSnapshot`). Without a snapshot, `mergeSnapshotState` returns the list entry unchanged.

### 7. Which single layer is the source of truth for LIVE state today?

**`goalradar:live:matches`** — populated by `refreshLiveMatches()` in the orchestrator and refilled on-demand by `fetchLiveCached()`. It is the only reliable source for IN_PLAY state. However it is not consumed by the authority function or the schedule page.

---

## Root cause

**Three independent failures, one shared theme:**

### RC-1 — Authority function missing live feed (affects /schedule, /world-cup-2026, homepage)

`getWCAuthorityMatchesCached()` merges only the upcoming and recent feeds. Neither reliably carries IN_PLAY status within a 30-min window of kickoff. The overlay cannot advance SCHEDULED→IN_PLAY. A live match appears as SCHEDULED on the schedule page (no live source), and may appear as SCHEDULED in the "Today" section of the WC hub/homepage even when the live section shows it correctly.

**Proof:** `getWCAuthorityMatchesCached()` in `src/lib/api.ts` has `Promise.allSettled([getUpcomingMatchesCached, getRecentMatchesCached])` — `getWCLiveMatches` is absent.

**Fix:** Add `getWCLiveMatches()` as a third feed to the authority merge. IN_PLAY (rank 2) always beats SCHEDULED (rank 0) in the STATE_RANK forward-only rule.

### RC-2 — Live cache reliability gap (affects /live)

`goalradar:live:matches` has 30s TTL. Between orchestrator runs (15 min), on-demand page renders depend on `providerManager.getLiveMatches()` succeeding. If this fails (rate limit, API error, rate-safe mode from earlier 429), the page shows empty. The match page is unaffected because it calls a different endpoint.

**Proof:** `fetchLiveCached()` in `src/lib/live-cache.ts` returns `[]` when provider fails and DR key is empty/stale.

**Fix:** Longer TTL on the live DR key and/or ensure the live cache can be refilled from the authority merge when the direct live endpoint fails. Separately: rate-safe mode should not skip live refresh (it currently does — the comment says it bypasses rate-safe but the code still checks it).

Wait — re-reading the code: `refreshLiveMatches` says "Live matches bypass rate-safe mode" but then immediately checks `if (isRateSafeModeActive()) { return skipped; }`. The comment and code contradict each other. **This is a bug.**

### RC-3 — Schedule page has no live source (affects /schedule)

The schedule page calls only `getWCAuthorityMatchesCached()` — no `getWCLiveMatchesCached()` call. Even if the live cache is perfectly healthy, the schedule page cannot show IN_PLAY matches. This is resolved by RC-1 fix (authority includes live feed).

---

## Decision gate

Root cause is proven. Proceed to implementation.

---

## Implementation plan

### Change 1 — `src/lib/api.ts`: Add live feed to authority merge

```typescript
export async function getWCAuthorityMatchesCached(): Promise<{ matches: Match[] }> {
  const [upcomingResult, recentResult, liveResult] = await Promise.allSettled([
    getUpcomingMatchesCached('WC'),
    getRecentMatchesCached('WC'),
    getWCLiveMatches(),  // NEW: live feed — IN_PLAY/PAUSED
  ]);

  const upcoming = upcomingResult.status === 'fulfilled' ? upcomingResult.value.matches : [];
  const recent   = recentResult.status  === 'fulfilled' ? recentResult.value.matches   : [];
  const live     = liveResult.status    === 'fulfilled' ? liveResult.value.matches     : [];

  const byId = new Map<number, Match>();
  for (const m of upcoming) byId.set(m.id, m);
  for (const m of recent) {
    const existing = byId.get(m.id);
    if (!existing || (STATE_RANK[m.status] ?? 0) >= (STATE_RANK[existing.status] ?? 0)) byId.set(m.id, m);
  }
  for (const m of live) {
    const existing = byId.get(m.id);
    if (!existing || (STATE_RANK[m.status] ?? 0) >= (STATE_RANK[existing.status] ?? 0)) byId.set(m.id, m);
  }

  return { matches: await overlayMatchStates([...byId.values()]) };
}
```

This makes the schedule page show IN_PLAY matches. The WC hub/homepage authority set will have IN_PLAY status, so live matches won't appear as SCHEDULED in the "Today" section.

### Change 2 — `src/lib/refresh.ts`: Fix rate-safe contradiction for live refresh

The comment says "Live matches bypass rate-safe mode" but the code returns early:
```typescript
if (isRateSafeModeActive()) {
  return { status: 'skipped', error: 'rate-safe mode active' };
}
```

**Fix:** Remove the rate-safe check from `refreshLiveMatches`. Live data is the most critical; it should always refresh even during a rate limit event. The 429 from the WC fixture endpoint does not mean the `/matches?status=IN_PLAY,PAUSED` endpoint is also rate-limited. The rate-safe flag should not block live data.

No other changes needed. No ISR changes. No SEO changes. No new cron jobs.
