# DATA-17.1 Phase 4 — Duplicate Authority Detection
## All Readers of Each Feed: Merge Logic and Duplicate KV Reads

Date: 2026-06-17  
Status: Complete graph from static analysis — no live KV reads.

---

## 1. Feed Reader Graph

### Feed A: `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED`

```
Written by:
  orchestrator → wc-upcoming task → refreshEndpoint() → withKVCache()
  Cadence: every 30 min (skip-if-fresh guard: skip if < 30 min since last write)
  TTL: 15 min fresh / 30 min stale

Read by:
  getUpcomingMatchesCached('WC')
    ├── getWCAuthorityMatchesCached()       ← used by Hub, Results, Schedule, Fixtures, Group
    ├── matches-today/page.tsx              ← LEGACY (direct read, no authority merge)
    ├── matches-tomorrow/page.tsx           ← LEGACY
    ├── predictions/page.tsx                ← LEGACY
    ├── teams/[slug]/page.tsx               ← LEGACY
    ├── watch-live/page.tsx                 ← LEGACY
    └── match-snapshot.ts (assembleSnapshot) ← snapshot build path (wcGroupMatches fallback)
```

**Duplicate read risk:** On a Hub ISR render, `getUpcomingMatchesCached('WC')` is called once.
The in-memory `withCache()` deduplicates within the same request. No inter-page duplicate.

---

### Feed B: `goalradar:/competitions/WC/matches?status=FINISHED`

```
Written by:
  orchestrator → wc-finished task → refreshEndpoint() → withKVCache()
  Cadence: every 30 min
  TTL: 15 min fresh / 12 h stale (DATA-16D intentional — results don't change)

Read by:
  getWCResultsCached()
    ├── getWCAuthorityMatchesCached()       ← used by Hub, Results, Schedule, Fixtures, Group
    └── matches-today/page.tsx              ← LEGACY (direct read)

  getWCResults()  [non-Cached, SWR-triggering variant]
    └── orchestrator → wc-finished task    ← writes this feed; also reads it via withKVCache
```

**Duplicate read detected:**
- `getWCResultsCached()` is called inside `getWCAuthorityMatchesCached()` for all 5 authority pages
- `matches-today/page.tsx` ALSO calls `getWCResultsCached()` directly (bypassing authority merge)
- These are separate page requests, so no within-request dedup issue
- HOWEVER: `matches-today` uses raw feed without STATE_RANK merge; a match could appear in both
  the FINISHED result AND in the SCHEDULED feed rendered on the same page for different sections

---

### Feed C: `goalradar:/competitions/WC/matches` (all statuses)

```
Written by:
  orchestrator → wc-all-matches task → refreshEndpoint()
  Cadence: every 30 min
  TTL: 6 h fresh / 12 h stale

Read by:
  getWCKnockoutMatchesCached()
    └── Hub page (knockout bracket section only)
```

No duplicates — single reader.

---

### Feed D: `goalradar:live:matches:WC`

```
Written by:
  orchestrator → refreshLiveMatches() → writeLiveCache()
  Cadence: every 30 min (not real-time unless live refresh loop is active)

Read by:
  getWCLiveMatches()
    └── getWCAuthorityMatchesCached()       ← Hub, Results, Schedule, Fixtures, Group

  getWCLiveMatchesCached()
    └── matches-today/page.tsx              ← LEGACY
```

**Note:** During a live match, the live refresh loop should write this key every 30 s.
However, the orchestrator cron fires every 30 min. Between cron runs with no live refresh
loop active, live scores may be 30 min stale on authority pages.

---

### Feed E: `goalradar:match:{id}` (per-match snapshot, 104 keys)

```
Written by:
  writeKVSnapshot() in match-snapshot.ts
  Triggered by: any /match/{id} page load that results in a KV miss

Read by:
  overlayMatchStates()              ← called 3× per authority page request (SEE BELOW)
    ├── inside getUpcomingMatchesCached('WC')     ← overlay #1
    ├── inside getWCResultsCached()                ← overlay #2
    └── inside getWCAuthorityMatchesCached()       ← overlay #3 (REDUNDANT)

  getOrBuildMatchSnapshot(id)
    └── /match/[id]/page.tsx                      ← single-match read
```

---

## 2. Triple Overlay — The Core Duplicate Read

`overlayMatchStates()` in `src/lib/api.ts`:

```typescript
// Called with up to 104 match objects
// Reads: kv.mget(`goalradar:match:{id}` for each match)
async function overlayMatchStates(matches: Match[]): Promise<Match[]> {
  const keys = matches.map(m => `goalradar:match:${m.id}`);
  const snaps = await kv.mget<(MatchSnapshot | null)[]>(...keys);
  // ... advance state based on snapshot ...
}
```

**Call graph for one Hub ISR render:**

```
getWCAuthorityMatchesCached()
  ├── getUpcomingMatchesCached('WC')
  │     └── withCache()        [L1 memory cache — prevents concurrent calls]
  │           └── readKVOnly('/competitions/WC/matches?status=SCHEDULED,TIMED')
  │                 └── overlayMatchStates(104 matches)
  │                       └── kv.mget(104 keys)   ← READ #1
  │
  ├── getWCResultsCached()
  │     └── withCache()        [L1 memory cache]
  │           └── readKVOnly('/competitions/WC/matches?status=FINISHED')
  │                 └── overlayMatchStates(N finished matches)
  │                       └── kv.mget(N keys)     ← READ #2
  │
  ├── getWCLiveMatches()
  │     (no overlay — live cache returns raw match objects)
  │
  └── overlayMatchStates([...byId.values()])       ← READ #3 (REDUNDANT)
        └── kv.mget(104 keys)
```

**Redundancy:** READ #3 re-reads the same 104 snapshot keys that READs #1 and #2 already read.
The third overlay input is the merged authority set, which has ALREADY been overlaid by the
component feeds. No new information is gained in READ #3 — it can only change a match's state
if a snapshot was written between the start of READ #1 and the start of READ #3, which is
effectively impossible (all three run within the same async resolution of `Promise.allSettled`).

**KV cost per authority page ISR render:**
- READ #1: up to 104 mget operations (chunked at 100 → 2 KV commands)
- READ #2: up to N mget operations (where N = count of FINISHED matches)
- READ #3: up to 104 mget operations (chunked → 2 KV commands)
- Total: up to 6 KV mget commands for snapshot reads alone, per ISR render

With Hub `revalidate=30`, this is up to 12 KV mget commands per minute just for snapshot
overlay, serving no additional information.

---

## 3. API-AUDIT Duplicate FINISHED Feed Warnings (Symptom #7)

`getWCResultsCached()` is called:
1. Inside `getWCAuthorityMatchesCached()` for every authority page
2. Directly from `matches-today/page.tsx`

Both read `goalradar:/competitions/WC/matches?status=FINISHED`. Within the same serverless
instance, `withCache()` (L1 in-memory) deduplicates calls to `getWCResultsCached()` for the
same request. But across serverless instances (Vercel's edge runtime spins up separate
processes for each route), both instances will independently read from KV.

The "API-AUDIT duplicate FINISHED feed warnings" in Vercel logs are generated by the
`[API-AUDIT]` structured log emitted in `api.ts` when the same KV key is read by multiple
callers. The warning specifically fires because:

1. `getWCResultsCached()` reads the key
2. `overlayMatchStates()` (overlay #2) reads snapshot keys for the SAME matches
3. `overlayMatchStates()` (overlay #3) reads those keys AGAIN
4. The audit log detects the FINISHED feed endpoint being resolved multiple times in
   the same request cycle (`withCache` counter increments > 1)

This is the "duplicate FINISHED feed" the log warns about — not cross-instance duplication,
but redundant within-request overlay reads triggered by the triple-overlay architecture.

---

## 4. Complete Feed × Reader Matrix

| Feed | Authority pages (5) | Match Detail | matches-today | predictions | tomorrow | teams | watch-live |
|------|---------------------|-------------|---------------|-------------|---------|-------|------------|
| SCHEDULED,TIMED | ✓ (via auth) | ✗ | ✓ (direct) | ✓ (direct) | ✓ (direct) | ✓ (direct) | ✓ (direct) |
| FINISHED (stable) | ✓ (via auth) | ✗ | ✓ (direct) | ✗ | ✗ | ✗ | ✗ |
| ALL (knockout) | Hub only | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| live cache | ✓ (via auth) | ✗ | ✓ (direct) | ✗ | ✗ | ✗ | ✗ |
| match snapshot (overlay) | 3× per request | ✓ (single) | ✗ | ✗ | ✗ | ✗ | ✗ |
| date-scoped recent | ✗ | ✓ (in build) | ✗ | ✓ (direct) | ✗ | ✓ (direct) | ✗ |

**Legend:** ✓ = reads this feed; ✗ = does not read this feed

---

## 5. Duplicate Authority: Definition and Count

A "duplicate authority" is any case where the same match appears in two or more feeds that
a single page reads, with no merge to resolve conflicts.

| Page | Match could appear twice? | How |
|------|--------------------------|-----|
| Hub / Results / Schedule / Fixtures / Group | NO — STATE_RANK merge deduplicates | — |
| matches-today | YES | FINISHED feed + SCHEDULED feed both read; match finishing TODAY in both |
| predictions | POSSIBLE | SCHEDULED feed may still contain a match that FINISHED (stale SCHEDULED) |

The authority pages are correct. The legacy pages have the duplicate risk.
