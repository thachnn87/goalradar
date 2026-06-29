# DATA-18B Implementation Report
## Authority Cache Builder

Date: 2026-06-17
Status: Complete — all deliverables shipped.

---

## Summary of Deliverables

| # | Deliverable | File | Status |
|---|------------|------|--------|
| 1 | Authority cache module | `src/lib/authority-cache.ts` | ✅ |
| 2 | Dormant V2 function | `src/lib/api.ts` — `getWCAuthorityMatchesV2()` | ✅ |
| 3 | Shadow diff endpoint | `src/app/api/debug/authority-compare/route.ts` | ✅ |
| 4 | Unit tests | `src/lib/__tests__/canonical-match.test.ts` | ✅ 27/27 pass |
| 5 | Live refresh loop design | Section 5 of this document | ✅ |
| 6 | `npx tsc --noEmit` | 0 errors | ✅ |

---

## 1. `src/lib/authority-cache.ts`

New dormant module. Not imported by any page or cron until DATA-18C.

### Exported API

```typescript
// Build + write authority cache (called by cron in DATA-18C)
writeAuthorityCache(builtAt: string): Promise<AuthorityCacheEnvelope>

// Read authority cache (called by getWCAuthorityMatchesV2)
readAuthorityCache(builtAt: string): Promise<CanonicalMatch[]>

// Batch-build from pre-read inputs (pure — no KV/network)
buildAllCanonicalMatches(
  fdMatches:   Match[],
  liveMap:     Map<number, LiveEntry>,
  snapshotMap: Map<number, MatchSnapshot>,
  espnIdMap:   Map<number, string>,
  builtAt:     string,
): CanonicalMatch[]

// Per-process telemetry counters
getAuthorityTelemetry(): AuthorityTelemetry

// KV key constants
AUTHORITY_KEY    = 'goalradar:wc:authority:v1'
AUTHORITY_DR_KEY = 'goalradar:dr:wc:authority:v1'
```

### Versioned Cache Envelope

```typescript
interface AuthorityCacheEnvelope {
  version:    1;         // increment to bust stale DR copies
  builtAt:    string;    // ISO-8601
  matchCount: number;    // always 104 for WC
  liveCount:  number;    // IN_PLAY/PAUSED count at build time
  ttlTier:    'live' | 'today' | 'normal';
  matches:    CanonicalMatch[];
}
```

**Version field purpose:** If the shape of `AuthorityCacheEnvelope` or `CanonicalMatch`
changes in a future DATA-18x task, incrementing `version` to `2` causes all reads of
the old DR copy (7-day TTL) to fall through — they check `envelope.version === 1` and
fail the guard, triggering a cold rebuild instead of serving a structurally incompatible
cached payload.

### TTL Tiers

| Tier | Condition | TTL | Aligns with |
|------|-----------|-----|-------------|
| `live` | Any match is IN_PLAY or PAUSED | 30s | Hub `revalidate=30` |
| `today` | Any match kicks off today UTC | 300s | Results `revalidate=300` |
| `normal` | No live or today matches | 900s | Schedule `revalidate=300` |

The DR copy always uses 7-day TTL regardless of tier — same as all other DR keys in the codebase.

### Single-Flight Lock (Cold Rebuild Protection)

```
module-level: _rebuildInflight: Promise<CanonicalMatch[]> | null
```

When `readAuthorityCache()` falls through to cold rebuild:
1. If `_rebuildInflight !== null` → return the existing promise (coalesce)
2. If `_rebuildInflight === null` → start new rebuild, assign to `_rebuildInflight`
3. `finally` block always sets `_rebuildInflight = null`

This is the same pattern as `_buildInflight` in `match-snapshot.ts`.

**Impact:** During a Hub page ISR at `revalidate=30` with no authority cache, up to
N concurrent Next.js workers in the same process will all await the same rebuild promise
instead of each independently doing 104 snapshot KV reads + 104 ESPN lookup reads.

### Authority Telemetry

All hits/misses/rebuilds are logged with structured `[Authority]` prefix:

```
[Authority] HIT  | goalradar:wc:authority:v1 | source=primary | 104 matches | live=2 | built 18s ago | ttl=live
[Authority] MISS | goalradar:wc:authority:v1 | cold rebuild started
[Authority] SET  | goalradar:wc:authority:v1 | 104 matches | live=0 | built in 847ms | ttl=900s
[Authority] COALESCE | cold rebuild already in-flight — awaiting
[Authority] REBUILT  | 104 matches in 847ms | snapshots=104 | espnIds=52 | live=0
```

Per-process counters via `getAuthorityTelemetry()`:
- `hits` — primary KV hits
- `drHits` — DR fallback hits
- `coldRebuilds` — full rebuild count
- `writeCount` — writeAuthorityCache() call count
- `lastBuildMs` — most recent cold rebuild duration
- `lastWriteMs` — most recent writeAuthorityCache() duration

### Cold Rebuild Data Sources

`coldRebuild()` reads the same sources as `getWCAuthorityMatchesCached()`, minus `overlayMatchStates()`:

```
getUpcomingMatchesCached('WC')   → SCHEDULED/TIMED feed
getWCResultsCached()             → FINISHED feed
getWCLiveMatches()               → IN_PLAY/PAUSED (live feed, source for liveMap)

kv.mget(goalradar:match:{id} × 104)     → snapshot map
kv.mget(goalradar:espn:lookup:{id} × 104) → ESPN ID map

→ buildAllCanonicalMatches() → CanonicalMatch[104]
```

The `overlayMatchStates()` call is NOT included — it's superseded by `buildCanonicalMatch()`'s
explicit liveMap + STATE_RANK merge. This is the intentional architecture change
(documented in DATA18A1_MIGRATION_REVIEW.md S1 hidden assumption #2).

### mget Chunking

Both `readSnapshotMap()` and `readEspnIdMap()` chunk mget at 100 keys per call.
For 104 WC matches: 2 chunks of 100+4. Redis protocol supports larger batches,
but chunking at 100 matches the observable pattern in `overlayMatchStates()` (MAX_OVERLAY=120)
and keeps individual command payloads well under the 1 MB Vercel KV per-command limit.

---

## 2. `src/lib/api.ts` — `getWCAuthorityMatchesV2()`

```typescript
export async function getWCAuthorityMatchesV2(
  builtAt: string,
): Promise<{ matches: import('./canonical-match').CanonicalMatch[] }> {
  const { readAuthorityCache } = await import('./authority-cache');
  const matches = await readAuthorityCache(builtAt);
  return { matches };
}
```

**Design notes:**
- Dynamic `import('./authority-cache')` — avoids a static import of the dormant module
  at the top of `api.ts`. The module is loaded only when `getWCAuthorityMatchesV2()` is
  actually called (currently: only by the shadow diff endpoint).
- Return type uses inline `import('./canonical-match').CanonicalMatch[]` — avoids a
  naming collision with the existing `export type CanonicalMatch = Match` alias that
  DATA-17 placed in `api.ts`. That alias will be replaced in DATA-18E (S4a).
- `builtAt` passed in by caller — no `Date.now()` inside for determinism (same rule
  as `buildCanonicalMatch()`).

**NOT exported from any page.** All WC pages continue to use `getWCAuthorityMatches()`.

---

## 3. Shadow Diff Endpoint

`GET /api/debug/authority-compare`

**Auth:** `X-Internal-Token: {INTERNAL_TOKEN}` header required if `INTERNAL_TOKEN` env var is set.  
**Headers returned:** `X-Robots-Tag: noindex`, `Cache-Control: no-store`.  
**Removed in:** DATA-18F (S5).

### Response shape

```json
{
  "gate":           "GREEN | RED",
  "checkedAt":      "2026-06-17T12:34:56.789Z",
  "benchmarkCount": 4,
  "oldPathCount":   104,
  "newPathCount":   104,
  "diffs": [
    {
      "matchId": 537397,
      "checks": {
        "scoreIdentical":    true,
        "enrichmentApplied": true,
        "goalsLengthMatch":  true,
        "stateFinished":     true,
        "integrityOk":       true
      },
      "gate": "GREEN",
      "detail": {
        "old": { "state": "FINISHED", "scoreHome": 3, "scoreAway": 0, ... },
        "new": { "state": "finished", "scoreHome": 3, "scoreAway": 0, ... }
      }
    }
  ],
  "note": "All benchmark matches GREEN — S3 gate passed."
}
```

### S3 Gate (from DATA18A_MIGRATION_PLAN.md S2)

`gate === "GREEN"` requires ALL of the following for all 4 benchmark matches:
- `scoreIdentical=true` — `score.fullTime.home/away` identical between old and new paths
- `enrichmentApplied=true` — new path populated goals/cards/subs (FINISHED WC matches)
- `goalsLengthMatch=true` — new path has `goals.length > 0` (benchmark matches confirmed enriched)
- `stateFinished=true` — new path derived `state === 'finished'`
- `integrityOk=true` — `integrity.status === 'ok'` (C2 + C3 pass)

If `gate === "RED"` → file DATA-18C.1 remediation; do NOT proceed to S3.

---

## 4. Unit Tests

File: `src/lib/__tests__/canonical-match.test.ts`

27 tests, 0 failures.

### Test coverage

| Suite | Tests | What is covered |
|-------|-------|----------------|
| State resolution | 10 | All 8 MatchStatus values; snapshot advancement; live entry advancement; live entry cannot downgrade FINISHED; live wins over snapshot |
| Score preference | 3 | Snapshot newer → wins; FD newer → wins (B1 guard); non-FINISHED → FD wins |
| `validateCanonicalMatch` | 5 | C3: null score FINISHED=fail; C3: valid score=pass; C3: scheduled null=pass; C2: unreconciled ID=fail; C2: reconciled=pass; all pass → ok |
| Enrichment flags | 3 | No snapshot; snapshot+no events; snapshot+goals |
| Provenance | 3 | fdFeed stored correctly; espnMatchId stored; builtAt stored |

```
Test Suites: 1 passed, 1 total
Tests:       27 passed, 27 total
Time:        2.739 s
```

---

## 5. Live Refresh Loop Design (S4a Prerequisite)

**Problem:** The Hub page has `revalidate=30`. During a live match, the Hub must serve
scores at most 30s stale. With the authority cache:
- If the cache TTL is 30s, every Hub ISR revalidation reads a fresh authority cache.
- But who WRITES the authority cache every 30s?

**Current cron cadence:** The orchestrator cron runs every 15 minutes. In DATA-18C (S2),
`writeAuthorityCache()` is added to the cron — meaning the cache is rebuilt every 15 min.
For the Hub this is acceptable for non-live matches (TTL=900s >> 15 min cron gap).

**For live matches:** The authority cache must be updated at 30s cadence, not 15 min.

### Design: Live Authority Refresh Path

```
Live refresh (refresh.ts / cron-live.ts, every 30s during live matches)
    ↓
1. getLiveMatches()                    — fetch /matches?status=IN_PLAY,PAUSED
2. If any WC matches IN_PLAY/PAUSED:
     a. Write live-cache (already done by refresh.ts)
     b. Call writeAuthorityCache(builtAt)   ← NEW in DATA-18E (S4a prep)
        — reads cached FD feeds (no provider call — still stale-while-revalidate)
        — reads liveMap from fresh step 1 result
        — writes authority cache with TTL=30s
3. Hub ISR at revalidate=30 reads fresh authority cache within the 30s TTL
```

**Key constraint:** `writeAuthorityCache()` during live refresh must NOT trigger new
FD API calls. The FD bulk feeds (upcoming/results) are already cached in KV. The live
cache just received fresh data in step 1. So `writeAuthorityCache()` in this context
does only KV reads (snapshots, ESPN IDs, bulk feeds from L2/L1) + one KV write.
Expected duration: 50–200ms (2 × 100-key mget + 2 × kv.set).

**Implementation home:** `src/lib/refresh.ts` (the existing live refresh module).
`writeAuthorityCache()` is called inside the WC-branch of the live refresh after the
live cache is written. Gated by `AUTHORITY_CACHE_ENABLED=true` (same flag as S2).

**Activation stage:** DATA-18E (S4a), immediately before the Hub page migrates to
`getWCAuthorityMatchesV2()`. The live refresh must be active before the Hub reads
from the authority cache.

**No live matches:** When there are no live matches, `writeAuthorityCache()` is NOT
called from the live refresh path. It relies on the 15-minute cron cycle, which is
sufficient for the `ttlTier=today` (TTL=300s) and `ttlTier=normal` (TTL=900s) cases.

---

## 6. TypeScript Validation

```
npx tsc --noEmit → 0 errors
```

All 4 new/modified files compile cleanly:
- `src/lib/authority-cache.ts`
- `src/lib/api.ts`
- `src/app/api/debug/authority-compare/route.ts`
- `src/lib/__tests__/canonical-match.test.ts`

---

## Constraints Satisfied

| Constraint | Status |
|-----------|--------|
| No production behaviour changes | ✅ `authority-cache.ts` not imported by any page |
| No page output changes | ✅ All pages still call `getWCAuthorityMatches()` |
| No cache key changes | ✅ No existing keys modified; new keys dormant |
| No provider changes | ✅ No new provider calls |
| No deployment activation | ✅ No feature flags set; no cron changes |
| `npx tsc --noEmit` → 0 errors | ✅ Confirmed |

---

## What DATA-18C Must Deliver

1. Orchestrator cron change — after bulk feed refresh, call `writeAuthorityCache(builtAt)`:
   - Gated by `AUTHORITY_CACHE_ENABLED=true` (env var, default false in production)
   - Fire-and-forget (does not block the cron response)

2. Validate S2 mandatory gate via shadow endpoint:
   - All 4 benchmark matches must show `gate: "GREEN"`
   - Confirm `enrichmentApplied=true`, `integrity.status=ok`, `state=finished`
   - If any RED → file DATA-18C.1, do NOT proceed to S3

3. `DATA18C_SHADOW_VALIDATION.md` — evidence document

---

## Rollback

| Scope | Rollback action |
|-------|----------------|
| `authority-cache.ts` | Delete file — no pages import it |
| `api.ts` addition | Delete `getWCAuthorityMatchesV2()` — not called by pages |
| Shadow endpoint | Delete `src/app/api/debug/authority-compare/` — not linked in sitemap |
| Unit tests | Delete `canonical-match.test.ts` — no production impact |
