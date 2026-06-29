# DATA-18C.0 Phase 3 — Snapshot Health
## Primary and DR Snapshot Integrity for All FINISHED WC Matches

Audit timestamp: 2026-06-17T09:30:14Z  
Data source: live KV mget of `goalradar:match:{id}` and `goalradar:dr:match:{id}`

---

## 1. Coverage

| Dimension | Count |
|-----------|-------|
| FINISHED matches in feed | 20 (actual FINISHED status) |
| Primary snapshots present | 20 / 20 — **100%** |
| DR snapshots present | 20 / 20 — **100%** |
| Snapshots with correct FINISHED status | 20 / 20 |
| Snapshots with `goals.length > 0` | 1 / 20 — **5%** |
| DR copies with `goals.length > 0` | 1 / 20 — **5%** |

100% snapshot coverage. 95% have zero enrichment.

---

## 2. Age Distribution

Two distinct cohorts visible in the data:

| Cohort | Age | Matches | Description |
|--------|-----|---------|-------------|
| Prewarm rebuild | 5.2 h | 19 | Built by prewarm cron at ~04:18 UTC |
| Fresh build | 1.0 h | 1 | Austria vs Jordan (537398), built after match ended |
| Today pre-kick | 0.2 h | 3 | TIMED matches (Portugal, England, Ghana — wrong feed) |

All prewarm-rebuilt snapshots share the same age (5.2 h) confirming a single batch
rebuild at 04:18 UTC. There is no spread across the 6 days of matches played, which
would indicate individual page visits driving snapshot builds. The prewarm cron is the
sole driver of snapshot refreshes for all matches except Austria vs Jordan.

---

## 3. Snapshot Status Verification

All 20 FINISHED match snapshots report `snapshotStatus: FINISHED`. The `status` field
in the snapshot reflects the FD API status at build time. No SCHEDULED/TIMED snapshots
remain for any FINISHED match — state is correct for the snapshot itself.

However, `snapshotGoals: 0` for 18 matches despite non-zero scores. The status is right;
the events are missing.

---

## 4. Enrichment Flags Derivation

`MatchSnapshot` does not have an explicit `enrichmentAttempted` or `enrichmentApplied`
field — those belong to `CanonicalMatch` (DATA-18A). From the snapshot data:

| Derived field | Method | Value for 18 poisoned matches |
|---------------|--------|-------------------------------|
| `enrichmentApplied` | `goals.length > 0` | FALSE |
| `enrichmentAttempted` | Cannot derive from snapshot alone | Unknown |
| `goalsFromFD` | Would require checking FD detail response | Unknown |

The Authority Cache builder (`buildCanonicalMatch`) will compute `enrichmentApplied = false`
for all 18 poisoned matches.

---

## 5. `generatedAt` Field

`generatedAt` is the epoch-ms timestamp stored in the snapshot at build time.

- Prewarm cohort: `generatedAt ≈ 1781659800000` (04:18 UTC Jun 17, 2026)
- Austria vs Jordan: `generatedAt ≈ 1781686800000` (08:30 UTC Jun 17, 2026)

Age is confirmed by: `snapshotAgeHours = (now - generatedAt) / 3_600_000`

The snapshot's age drives the B1 staleness guard in `buildCanonicalMatch`:
```typescript
// B1: if snapshot is newer than FD bulk-feed match, snapshot score wins
if (snapshot && snapshot.generatedAt > fdMatchLastUpdated) use snapshot.score
```

For the 18 poisoned matches, the snapshot's score IS correct (matches FD). But goals=0.

---

## 6. `fdLastUpdated` Field

`fdLastUpdated` is NOT a field in the current `MatchSnapshot` type. The snapshot stores
`match: MatchDetail` (the full FD match detail response). The FD API does not return a
`lastUpdated` field for match events. The B1 guard in `canonical-match.ts` uses
`snapshot.generatedAt` vs `builtAt` for recency comparison, not a FD timestamp.

---

## 7. DR Consistency

For all 20 FINISHED matches: `drAgeHours === snapshotAgeHours` (within rounding).

This confirms both primary and DR were written in the same batch write (`writeKVSnapshot` +
`writeDRSnapshot` called together in `buildSnapshot()`). No DR copy is from a different
build epoch. The DR copies are not recovering from a prior healthy state — they reflect
exactly the same failed enrichment that the primary snapshots do.

---

## 8. Per-Match Health Status

| matchId | snap age | snap goals | DR age | DR goals | `integrity.status` (derived) |
|---------|----------|-----------|--------|----------|-------------------------------|
| 537327 | 5.2 h | 0 | 5.2 h | 0 | degraded (C3: FINISHED, null goals) |
| 537328 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537333 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537334 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537339 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537340 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537345 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537346 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537351 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537352 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537357 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537358 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537363 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537364 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537369 | 5.2 h | 0 | 5.2 h | 0 | ok (0–0 score, null goals is correct) |
| 537370 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537391 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537392 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537397 | 5.2 h | 0 | 5.2 h | 0 | degraded |
| 537398 | 1.0 h | 4 | 1.0 h | 4 | ok |

`integrity.status` is derived from `validateCanonicalMatch()`:
- C3: FINISHED match with null/undefined score → `degraded`
- Score is present (non-null) for all 18, BUT goals=0 is not a C3 failure — C3 checks the
  score field, not goals. So `integrity.status` would be `ok` for all 20 matches.

**Correction:** `validateCanonicalMatch()` checks:
- C2: team ID reconciliation → not checkable from snapshot audit
- C3: `state=finished && (score.fullTime.home === null || score.fullTime.away === null)` → FAILS

All 18 poisoned matches HAVE non-null scores (e.g., 2-0, 3-1), so C3 does NOT fail.
`integrity.status = 'ok'` for all 20 FINISHED matches from the C2/C3 checks.

However, `enrichmentApplied = false` for 18 of them — these would not pass the shadow diff
gate's `enrichmentApplied=true` requirement.

---

## 9. What the Authority Cache Would Produce Today

If `writeAuthorityCache()` ran at this moment:
```
buildAllCanonicalMatches(fdMatches, liveMap, snapshotMap, espnIdMap, builtAt)
```

For each of the 18 poisoned FINISHED matches:
- `fdFeed: 'results'` (correct)
- `score: { fullTime: { home: X, away: Y } }` (correct from FD)
- `goals: []` (from snapshot — empty)
- `enrichmentAttempted: false` (no ESPN ID → skipped; AF attempted → unknown)
- `enrichmentApplied: false` (goals.length === 0)
- `integrity: { status: 'ok', issues: [] }` (C2 and C3 pass — score is present)
- `state: 'finished'` (derived from FINISHED status — correct)

The Authority Cache would be structurally valid but enrichment-empty for 90% of matches.
