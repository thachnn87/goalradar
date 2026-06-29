# WC_DATA_INTEGRITY_REMEDIATION.md — DATA-18WC.9C Phase 8

**Date:** 2026-06-24
**Scope:** Remediation plans for all risks in WC_DATA_INTEGRITY_RISK_REGISTER.md
**IMPORTANT:** This is a planning document only. No code has been changed. All plans are subject to review and approval before implementation.

---

## R1. PROVIDER BOUNDARY NORMALIZATION (P0-1, P0-2, P1-1, P1-3, P1-4, P3-1, P3-3)

**Addresses:** P0-1 (DR poison), P0-2 (deriveState wrong state), P1-1 (STATE_RANK gap), P1-3 (isLive guard), P1-4 (StatusPill), P3-1 (AWARDED), P3-3 (future values)

**Root cause:** FD provider uses `res.json() as Promise<T>` with no normalization. Any non-canonical status string enters the system unchallenged.

**Remediation:** Create `src/lib/providers/normalize-status.ts` (already designed in `WC_PROVIDER_NORMALIZATION_AUDIT.md §10`):

```typescript
const FD_STATUS_ALIASES: Record<string, MatchStatus> = {
  'LIVE':    'IN_PLAY',   // FD v4 WC-specific alias
  'AWARDED': 'FINISHED',  // FD walkover/forfeit
};

export function normalizeFDStatus(raw: string): MatchStatus {
  if (raw in FD_STATUS_ALIASES) return FD_STATUS_ALIASES[raw];
  const known: MatchStatus[] = ['SCHEDULED','TIMED','IN_PLAY','PAUSED','FINISHED','POSTPONED','SUSPENDED','CANCELLED'];
  if (known.includes(raw as MatchStatus)) return raw as MatchStatus;
  console.warn(`[normalizeFDStatus] Unknown FD status: "${raw}" — defaulting to SCHEDULED`);
  return 'SCHEDULED';
}
```

**Where to apply:**
1. `src/lib/providers/football-data.ts` — in `fetchRaw<T>()` or in each method that returns `Match[]`/`MatchDetail`:
   - After `res.json()` cast, normalize `match.status` for every match in the response
2. `src/lib/prewarm/worldcup.ts` — in `toMatchDetail()`, normalize `m.status` before spread
3. `src/lib/match-snapshot.ts` — `isLiveStatus()` should call `normalizeFDStatus()` on the status before checking, as belt-and-suspenders

**Downstream fixes that become unnecessary once R1 is applied:**
- `isLiveStatus()` gap — normalized "LIVE" → "IN_PLAY" upstream
- `deriveState()` gap — "LIVE" never reaches it
- `STATE_RANK` gap — "LIVE" never reaches it
- `StatusPill` raw display — "LIVE" never reaches UI

**Estimated impact:** Resolves P0-1, P0-2, P1-1, P1-3, P1-4, P3-1, P3-3 in a single change.

**Risk of change:** LOW — normalizing known aliases is additive. Unknown status falls to 'SCHEDULED' with a warning log (observable). No existing functionality removed.

---

## R2. SNAPSHOT DR PURGE FOR MATCH 537412 (P0-1 — Immediate)

**Addresses:** The existing 30-day DR snapshot for match 537412

**Background:** Even after R1 is deployed, the DR snapshot for match 537412 may carry `status: "LIVE"` from before the fix. When the primary snapshot expires (15min TTL), the system falls to DR and re-serves "LIVE". R1 prevents new poison but does not clean existing DR keys.

**Remediation:**

Option A — Manual KV deletion:
```
KV key: goalradar:dr:match:537412
KV key: goalradar:dr:/matches/537412   (detail DR, if present)
```
Delete both keys. Next page load for `/match/537412` will trigger a fresh FD API call, build a clean snapshot, and write correct DR keys.

Option B — DR Purge Admin Endpoint:
Create `/api/admin/cache/purge-dr` endpoint (internal, CRON_SECRET auth) that accepts a list of match IDs and deletes their DR snapshot and DR detail keys. Useful for future incidents.

**Estimated impact:** Immediate resolution of match 537412 "LIVE" display.

---

## R3. isLiveStatus() DEFENSE-IN-DEPTH (P0-1 — Belt-and-Suspenders)

**Addresses:** Snapshot write guard gap

**Background:** Even with R1 at the FD boundary, `isLiveStatus()` is the last line of defense before writing to the 30-day DR snapshot. It should be robust against any status value.

**Remediation:**
```typescript
// src/lib/match-snapshot.ts
function isLiveStatus(status: string): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED' || status === 'LIVE';
}
```

Adding `'LIVE'` as a recognized live status ensures that even if normalization fails upstream, the snapshot write guard catches it and prevents the "LIVE" from being written. A match with "LIVE" status would instead skip the snapshot write and trigger a background rebuild — correct behavior.

**Note:** This is secondary to R1. If R1 is applied, "LIVE" never reaches this function. This is belt-and-suspenders.

---

## R4. STATE_RANK COMPLETENESS (P1-1)

**Addresses:** STATE_RANK gap for "LIVE" and "AWARDED"

**Remediation:**
```typescript
// src/lib/match-state-overlay.ts
const STATE_RANK: Record<string, number> = {
  SCHEDULED: 0, TIMED: 0,
  POSTPONED: 1, SUSPENDED: 1, CANCELLED: 1,
  IN_PLAY: 2, PAUSED: 2,
  LIVE: 2,      // FD v4 alias for IN_PLAY
  AWARDED: 3,   // Technical win — treated as FINISHED rank
  FINISHED: 3,
};
```

**Note:** If R1 is applied, "LIVE" never reaches STATE_RANK. This is still valuable as defense-in-depth and documents the mapping intent.

---

## R5. deriveState() COMPLETENESS (P0-2)

**Addresses:** Authority state derivation for "LIVE" and "AWARDED"

**Remediation:**
```typescript
// src/lib/canonical-match.ts
function deriveState(status: string): CanonicalState {
  if (status === 'IN_PLAY' || status === 'PAUSED' || status === 'LIVE') return 'live';
  if (status === 'FINISHED' || status === 'AWARDED') return 'finished';
  if (status === 'CANCELLED' || status === 'POSTPONED' || status === 'SUSPENDED') return 'cancelled';
  return 'scheduled';
}
```

**Note:** Secondary to R1. If R1 normalizes "LIVE" → "IN_PLAY" before reaching `deriveState()`, this change is not needed. Still valuable as defense-in-depth.

---

## R6. DR PURGE TOOLING (Operational)

**Addresses:** Lack of operator tooling to clean poisoned DR keys

**Background:** There is currently no way to explicitly purge DR keys for specific matches. The only recovery path is to wait for DR TTL expiry (7d–30d). This is unacceptable for P0/P1 incidents.

**Remediation:** Add DR purge capability to the admin debug API:

```typescript
// New endpoint: POST /api/debug/wc/dr-purge
// Auth: CRON_SECRET header
// Body: { matchIds: number[], scopes: ('snapshot' | 'detail' | 'authority' | 'all')[] }

// Deletes:
// - goalradar:dr:match:{id} for each matchId (if scopes includes 'snapshot')
// - goalradar:dr:/matches/{id} for each matchId (if scopes includes 'detail')
// - goalradar:dr:wc:authority:v1 (if scopes includes 'authority')
```

**Impact:** Enables incident response without code deployment. Single DR purge + authority rebuild restores correct state within seconds.

---

## R7. OBSERVABILITY — DR SNAPSHOT STATUS INSPECTION (Operational)

**Addresses:** The debug endpoint for match-state does not inspect DR keys directly

**Background:** During the production scan, `snapshotStatus: "SNAPSHOT_KEY_MISSING"` confirmed the primary snapshot was gone, but the endpoint did not report on the DR snapshot status. This made it impossible to confirm whether the 30-day DR poison was still present.

**Remediation:** Extend `GET /api/debug/wc/match-state/{id}` to include:
```json
{
  "drSnapshotStatus": "DR_SNAPSHOT_PRESENT | DR_SNAPSHOT_MISSING | DR_SNAPSHOT_ERROR",
  "drSnapshotStatus_value": "LIVE | CANCELLED | ...",
  "drSnapshotAgeMs": 86400000,
  "drDetailStatus": "DR_DETAIL_PRESENT | DR_DETAIL_MISSING",
  "drDetailStatus_value": "LIVE | CANCELLED | ..."
}
```

**Impact:** Operators can confirm DR poison state without manual KV inspection.

---

## R8. AF FAILOVER — C2_TEAM_ID BLOCKING OPTION (P2-1)

**Addresses:** ESPN event team IDs not matching FD team IDs

**Background:** `validateCanonicalMatch()` flags C2_TEAM_ID as a warning (not a blocking error). Goals/bookings with wrong team attribution are still written to the snapshot.

**Remediation Option A — Blocking:** Change C2_TEAM_ID from a warning flag to a blocking condition: if event team ID matches neither home nor away team ID, drop the event from the snapshot rather than writing potentially wrong attribution.

**Remediation Option B — Reconciliation:** Improve ESPN team ID reconciliation using `espn-id-map.ts` — build a mapping from ESPN string team ID to FD integer team ID, validated at snapshot build time.

**Recommended:** Option B (reconciliation). Option A risks dropping valid events if the ID mapping is wrong. Option B increases correctness without data loss risk.

---

## R9. parseRound() THIRD-PLACE MATCH (P2-3)

**Addresses:** WC 2026 Third-Place match stage parsing failure

**Background:** WC 2026 has a third-place playoff. AF's round string for this match is unknown. `parseRound()` falls through to raw string for unrecognized rounds.

**Remediation:**
```typescript
// src/lib/providers/api-football.ts:parseRound()
stage: round.includes('Group') ? 'GROUP_STAGE'
     : round.includes('Round of 32') ? 'LAST_32'
     : round.includes('Round of 16') ? 'LAST_16'
     : round.includes('Quarter') ? 'QUARTER_FINALS'
     : round.includes('Semi') ? 'SEMI_FINALS'
     : round.includes('3rd Place') || round.includes('Third Place') || round.includes('Bronze') ? 'THIRD_PLACE'
     : round.includes('Final') ? 'FINAL'
     : round,
```

**Timing:** Must be applied before the third-place match (July 2026).

---

## IMPLEMENTATION PRIORITY AND SEQUENCING

### Phase 1 — Immediate (before next WC match in play)
| Remediation | Risk | Complexity | Deploy Sequence |
|-------------|------|-----------|----------------|
| **R2**: Purge DR keys for match 537412 | LOW | Minutes | 1st — operational, no deployment |
| **R1**: normalizeFDStatus() at FD boundary | LOW | 1 file, ~20 lines | 2nd — core fix |
| **R3**: isLiveStatus() defense-in-depth | LOW | 1 line | 3rd — with R1 |
| **R7**: Extend match-state debug endpoint | LOW | ~20 lines | 4th — observability |

### Phase 2 — Before Knockout Stage (belt-and-suspenders)
| Remediation | Risk | Complexity |
|-------------|------|-----------|
| **R4**: STATE_RANK completeness | LOW | 2 lines |
| **R5**: deriveState() completeness | LOW | 1 line |
| **R6**: DR purge admin endpoint | MEDIUM | New endpoint, auth |
| **R9**: parseRound() third-place | LOW | 1 line |

### Phase 3 — Post-WC / Maintenance
| Remediation | Risk | Complexity |
|-------------|------|-----------|
| **R8**: ESPN team ID reconciliation | MEDIUM | ID mapping table |
| AF shortName/TLA mapping | LOW | Static lookup table |
| AF competition.code validation | LOW | Null check |

---

## GATE CONDITION

**All Phase 1 items must be approved and merged before any WC knockout match reaches IN_PLAY status.**

The current orchestrator stall (2h+) must also be investigated and resolved independently of the normalization fixes. The orchestrator health is operational, not a data-integrity code change.
