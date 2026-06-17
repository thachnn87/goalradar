# DATA-18A.2 Remediation Report
## Blocking Issues B1–B5 — Applied Fixes

Date: 2026-06-17
Status: Complete — all 5 blocking issues resolved.

---

## Summary

| Issue | Description | Fix location | Fix type |
|-------|-------------|-------------|---------|
| B1 | Stale snapshot score overwrites corrected FD score | `canonical-match.ts:score resolution` | Code fix |
| B2 | Dead branch in `deriveState()` — both paths return `'scheduled'` | `canonical-match.ts:deriveState()` | Code fix |
| B3 | `inferFdFeed()` infers incorrectly for live matches | `canonical-match.ts:buildCanonicalMatch()` | API change + removal |
| B4 | Dual `liveStatus`/`liveMinute` params allow inconsistent callers | `canonical-match.ts:buildCanonicalMatch()` | API change |
| B5 | Shadow comparison marked optional in migration plan | `DATA18A_MIGRATION_PLAN.md` | Doc update |

---

## B1 — Score Staleness Fix

### Problem

```typescript
// Before (DATA-18A)
if (
  snapshot !== null &&
  resolvedStatus === 'FINISHED' &&
  snapshot.match.score?.fullTime?.home !== null
) {
  score = snapshot.match.score;  // ← NO timestamp check
}
```

A 7-day-old snapshot (within its TTL) unconditionally overwrote the FD results
feed score. If FD corrected a score after the snapshot was built, the wrong score
would be served for up to 7 days.

### Fix applied

```typescript
// After (DATA-18A.2)
if (snapshot !== null && resolvedStatus === 'FINISHED') {
  const snapTs      = snapshot.generatedAt;
  const fdTs        = new Date(fdMatch.lastUpdated).getTime();
  const snapScore   = snapshot.match.score;
  const snapIsNewer = snapTs > fdTs;

  if (snapIsNewer && snapScore?.fullTime?.home !== null && snapScore?.fullTime?.away !== null) {
    score = snapScore;
  }
}
```

Guard: `snapIsNewer = snapshot.generatedAt > new Date(fdMatch.lastUpdated).getTime()`.

**Behaviour change:**
- Before: snapshot score always wins for FINISHED (regardless of age)
- After: snapshot score wins only if snapshot is more recent than FD feed

**Why snapshot score is ever preferred at all:** The snapshot may have confirmed
a final score before the FD bulk results feed was next refreshed by the cron
(up to 12h delay). When the snapshot IS newer, it has the authoritative confirmed
score. When FD is newer (e.g., post-correction), FD wins. This is the correct
precedence.

**Production impact:** None — `canonical-match.ts` is dormant.

---

## B2 — Dead `deriveState()` Branch Removed

### Problem

```typescript
// Before (DATA-18A) — dead branch
if (status === 'SCHEDULED' || status === 'TIMED') {
  const matchDay = utcDate.split('T')[0];
  return matchDay <= todayUTC ? 'scheduled' : 'scheduled';  // both return 'scheduled'
}
```

The conditional `matchDay <= todayUTC` evaluated to both `'scheduled'` in both
branches. The `utcDate` parameter was never used. The dead code was misleading:
it implied date comparison was meaningful, but `CanonicalMatch.state` has no
`'today'` variant.

The `utcDate` and `todayUTC` parameters to `deriveState()` were also removed —
they were only used by the dead branch.

### Fix applied

```typescript
// After (DATA-18A.2) — clean
function deriveState(status: MatchStatus): CanonicalMatch['state'] {
  if (status === 'IN_PLAY' || status === 'PAUSED')  return 'live';
  if (status === 'FINISHED')                        return 'finished';
  if (status === 'SCHEDULED' || status === 'TIMED') return 'scheduled';
  return 'cancelled';
}
```

Function signature simplified from `(status, utcDate, todayUTC)` to `(status)`.
`buildCanonicalMatch()` no longer passes `todayUTC` to `deriveState()`.

**Behaviour change:** None — both paths already returned `'scheduled'`.

**Additional benefit:** `buildCanonicalMatch()` no longer requires a `todayUTC`
parameter solely for `deriveState()`. The `todayUTC` parameter was removed from
`buildCanonicalMatch()` entirely — the function is now fully stateless and requires
no external date context.

---

## B3 — `inferFdFeed()` Removed; `fdFeed` Explicit Parameter Added

### Problem

```typescript
// Before (DATA-18A) — incorrect inference
function inferFdFeed(status: MatchStatus): CanonicalMatchSource['fdBulkFeed'] {
  if (status === 'FINISHED') return 'results';
  if (status === 'SCHEDULED' || status === 'TIMED') return 'scheduled';
  return 'all';  // ← IN_PLAY match inferred as 'all' — wrong
}
```

An IN_PLAY match (`resolvedStatus === 'IN_PLAY'`) was inferred as coming from an
`'all'` feed, but it actually came from the scheduled feed and was promoted by the
live cache. The provenance metadata was wrong.

### Fix applied

`inferFdFeed()` is removed entirely. `buildCanonicalMatch()` now accepts an explicit
`fdFeed: 'scheduled' | 'results' | 'all'` parameter:

```typescript
// After (DATA-18A.2) — explicit
export function buildCanonicalMatch(
  fdMatch:     Match,
  fdFeed:      'scheduled' | 'results' | 'all',  // ← caller states which feed
  snapshot:    MatchSnapshot | null,
  liveEntry:   LiveEntry | null,
  espnMatchId: string | undefined,
  builtAt:     string,
): CanonicalMatch
```

The caller (`buildAllCanonicalMatches()`, to be written in DATA-18B) knows
which feed each match came from because it reads each feed separately before
merging. It passes the feed discriminator explicitly.

**Behaviour change:** None at runtime — `inferFdFeed()` was only used to populate
`source.fdBulkFeed` (provenance metadata, not displayed to users).

---

## B4 — Dual Live Parameters Merged into `LiveEntry` Object

### Problem

```typescript
// Before (DATA-18A) — two separate params
export function buildCanonicalMatch(
  fdMatch:     Match,
  snapshot:    MatchSnapshot | null,
  liveStatus:  MatchStatus | null,      // ← split
  liveMinute:  number | undefined,      // ← split
  espnMatchId: string | undefined,
  todayUTC:    string,
  builtAt:     string,
)
```

A caller could pass `liveStatus = 'IN_PLAY'` with `liveMinute = undefined` — an
inconsistent pair. The params are semantically one concept (the live cache entry).

### Fix applied

```typescript
// After (DATA-18A.2) — unified
export interface LiveEntry {
  status: MatchStatus;
  minute?: number;
}

export function buildCanonicalMatch(
  fdMatch:     Match,
  fdFeed:      'scheduled' | 'results' | 'all',
  snapshot:    MatchSnapshot | null,
  liveEntry:   LiveEntry | null,         // ← single object or null
  espnMatchId: string | undefined,
  builtAt:     string,
)
```

Callers pass either `null` (match not live) or `{ status: 'IN_PLAY', minute: 45 }`.
The `minute` field remains optional within `LiveEntry` to handle cases where the
provider sends IN_PLAY without a minute value.

`todayUTC` parameter also removed (B2 fix — `deriveState()` no longer needs it).

**Net signature change:** 7 params → 6 params. `liveStatus` + `liveMinute` + `todayUTC`
removed; `fdFeed` + `liveEntry` added.

---

## B5 — Shadow Comparison Made Mandatory Gate

### Problem

`DATA18A_MIGRATION_PLAN.md` S2 described the shadow comparison endpoint as
"optional, internal-only." This allowed S3 to proceed without validated parity
evidence between old and new paths.

### Fix applied

Migration plan updated:

1. Shadow comparison endpoint marked **required, not optional**.
2. S2 now has an explicit mandatory gate:

   > **S3 is BLOCKED until this endpoint returns all-GREEN for all 4 benchmark matches**

3. Gate criteria expanded to include `integrity.status === 'ok'` check (C2 team
   IDs and C3 score non-null must pass for all 4 benchmark matches).

4. Failure path added: "If any check fails → file DATA-18C.1 remediation; do NOT proceed to S3."

5. S4 split into S4a (Hub + Schedule) and S4b (Fixtures + Group) — separate PRs
   with S4a stable ≥24h before S4b proceeds.

6. Rollback table updated for S4a + S4b.

7. S3 scope updated to include explicit `statusBadge()` migration note (PAUSED vs
   IN_PLAY distinction under `CanonicalMatch.state === 'live'`).

---

## Additional: IntegrityResult Scaffolding Added

Per DATA-18A.1 recommendation, `IntegrityResult` types and `validateCanonicalMatch()`
added to `canonical-match.ts`:

```typescript
export type IntegrityStatus = 'ok' | 'warning' | 'degraded';
export interface IntegrityCheck { id: string; result: 'pass' | 'warn' | 'fail'; message?: string; }
export interface IntegrityResult { status: IntegrityStatus; checks: IntegrityCheck[]; }
```

Minimum viable checks implemented:
- **C2** — event team IDs reconciled to FD homeTeam.id or awayTeam.id (DATA-14A regression guard)
- **C3** — FINISHED match has non-null fullTime score

`CanonicalMatch.integrity: IntegrityResult` field added to the interface.
`CanonicalMatch.enrichmentAttempted: boolean` field added (distinguishes "enriched 0-0" from "never enriched").

`buildCanonicalMatch()` calls `validateCanonicalMatch(partial)` as its last step
and stores the result in `integrity`.

---

## Additional: Lineups Excluded from CanonicalMatch

Per DATA-18A.1 cache scalability recommendation, `lineups` field removed from
`CanonicalMatch`. Rationale documented in interface:

> Listing pages (Hub/Results/Schedule/Fixtures/Group) never display lineups.
> Match detail pages read lineups directly from `goalradar:match:{id}` snapshot.
> Excluding lineups reduces the authority cache payload by ~8 KB/match
> (from ~1.1 MB to ~200 KB for a fully-enriched 104-match tournament).

---

## TypeScript Validation

```
npx tsc --noEmit → 0 errors
```

All fixes applied; dormant file compiles cleanly.
