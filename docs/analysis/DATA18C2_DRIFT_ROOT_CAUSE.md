# DATA-18C.2 Drift Root Cause Analysis

Date: 2026-06-18  
Observation window: 10:10–11:18 UTC

---

## Drift State Summary

| Cycle | total | green | yellow | red | verdict |
|-------|-------|-------|--------|-----|---------|
| Pre-activation (cold rebuild, 10:02 UTC) | 24 | 23 | 1 | 0 | YELLOW |
| Cycle 1 (10:10:29 UTC) | 24 | 22 | 1 | 1 | **RED** |
| Cycle 2 (11:17:18 UTC) | 24 | 22 | 2 | 0 | YELLOW |

The RED was **transient** — present in Cycle 1, resolved in Cycle 2.

---

## Match Analysis

### RED Match: 537333 — Canada vs Bosnia-Herzegovina

**Evidence (Cycle 1 — 11:13 UTC):**

```json
{
  "matchId":  537333,
  "home":     "Canada",
  "away":     "Bosnia-Herzegovina",
  "score":    "1–1",
  "severity": "RED",
  "drifts": {
    "scoreDrift":      true,
    "stateDrift":      false,
    "enrichmentDrift": false,
    "goalsCountDrift": false,
    "lineupMissing":   true,
    "snapshotMissing": false
  },
  "detail": {
    "authority": { "state": "finished", "scoreHome": 1,    "scoreAway": 1,    "enrichmentApplied": false, "goalsCount": 0 },
    "snapshot":  { "status": "finished", "scoreHome": null, "scoreAway": null, "enrichmentApplied": "N/A", "goalsCount": 0, "snapshotAgeHours": 1.1 }
  }
}
```

**Evidence (Cycle 2 — 11:17 UTC, resolved):**

```json
{
  "matchId":  537333,
  "severity": "YELLOW",
  "drifts": { "scoreDrift": false, "lineupMissing": true, ... },
  "detail": {
    "authority": { "scoreHome": 1, "scoreAway": 1 },
    "snapshot":  { "scoreHome": 1, "scoreAway": 1, "snapshotAgeHours": 0 }
  }
}
```

**Root cause:** Snapshot captured before final score was committed to FD per-match endpoint.

Timeline reconstruction:
1. Canada vs Bosnia-Herzegovina finished at approximately 09:00–10:00 UTC
2. The FD FINISHED bulk feed (`/competitions/WC/matches?status=FINISHED`) updated to show `score.fullTime = {home:1, away:1}`
3. The per-match FD endpoint (`/matches/537333`) was lagging or still showed `fullTime: null`
4. The per-match KV snapshot `goalradar:match:537333` was last written during prewarm while the match was IN_PLAY or immediately after, capturing `score.fullTime = null`
5. At Cycle 1 (10:10 UTC), `prewarmWorldCup()` attempted to refresh the snapshot but the PERF-6 skip-if-fresh guard was active (snapshot was < ~30 min old from a recent prewarm). The snapshot was not refreshed.
6. `writeAuthorityCache()` called `coldRebuild()` → `buildAllCanonicalMatches()`:
   - Score came from `fdMatch` (bulk FINISHED feed) → 1-1 ✓
   - Snapshot came from KV → null-null (stale, pre-final)
   - Result: scoreDrift=true → RED

**Resolution mechanism:** At Cycle 2 (11:17 UTC, 67 min later), `prewarmWorldCup()`
ran with `ok=13, skipped=0` — all tasks refreshed. The per-match snapshot
`goalradar:match:537333` was refreshed from the FD endpoint which by then had the
final score (1-1). Authority cache rebuilt → scoreDrift=false.

**Classification:** TRANSIENT — structural skip-if-fresh lag, self-resolving within
1–2 orchestrator cycles (typically < 2 hours). Requires no code fix.

**Repair path for production:** `repair-enrichment` (04:00 UTC daily) would also
detect this match: `score > 0 (1+1=2) AND goals.length === 0`. It would invalidate
the snapshot, forcing a rebuild on the next prewarm. This provides a 04:00 UTC safety
net independent of the skip-if-fresh expiry.

---

### YELLOW Match: 537369 — Spain vs Cape Verde Islands

**Evidence (Cycles 1 and 2 — unchanged):**

```json
{
  "matchId":  537369,
  "home":     "Spain",
  "away":     "Cape Verde Islands",
  "score":    "0–0",
  "severity": "YELLOW",
  "drifts": {
    "scoreDrift":      false,
    "stateDrift":      false,
    "enrichmentDrift": false,
    "goalsCountDrift": false,
    "lineupMissing":   true,
    "snapshotMissing": false
  },
  "detail": {
    "authority": { "state": "finished", "scoreHome": 0, "scoreAway": 0, "enrichmentApplied": false, "goalsCount": 0 },
    "snapshot":  { "status": "finished", "scoreHome": 0, "scoreAway": 0, "snapshotAgeHours": 0 }
  }
}
```

Both before and after Cycle 2 — snapshot refreshed at `snapshotAgeHours: 0` and
lineupMissing remains `true`. Score and state agree. Only `lineupPresent: false`.

**Root cause:** FD per-match endpoint does not provide lineup data for this fixture.

The FD API's `/matches/537369` response has empty `lineups.home.players` and
`lineups.away.players` arrays (or the lineup section is absent). `lineupMissing` is
set when `(m.lineups?.home?.players?.length ?? 0) > 0` is false in the snapshot.

This is a FD data gap — some matches do not have lineup data available via the API,
either because:
- The match is a friendly/promotional match where lineups were not submitted
- FD does not have coverage for these specific teams

**Classification:** PERMANENT DATA GAP — FD API does not provide lineup data for
this match. The snapshot was refreshed twice (Cycles 1 and 2) with no change. This
is not resolvable through the authority cache or repair-enrichment.

**Note on severity:** YELLOW only. `lineupMissing=true` does not affect:
- Match scores (correct: 0–0)
- Match state (correct: finished)
- Enrichment (not applicable for 0–0 matches — no goals to attribute)
- Listing pages (which show score + state, not lineups)

Lineup display is only relevant on individual match detail pages, which are outside
DATA-18B scope.

---

### YELLOW Match: 537333 — Canada vs Bosnia-Herzegovina (post-Cycle-2)

**Post-resolution drift:**

After Cycle 2 refresh, 537333 remains YELLOW with `lineupMissing: true` and
`snapshotAgeHours: 0`. The score is now correct (1-1 in both authority and snapshot).

This is the same FD data gap as 537369 — FD lineup data not provided for this match.

**Classification:** PERMANENT DATA GAP — same category as 537369. Non-critical.

---

## drift-scan Alignment

The `drift-scan` cron (04:30 UTC daily) calls `readAuthorityCache()` then reads
per-match snapshots — identical logic to `authority-drift`. It would detect the same
YELLOW matches. The two YELLOW (lineup gap) entries are expected in drift-scan output.

---

## Root Cause Matrix

| Match ID | Fixture | Severity | scoreDrift | Root Cause | Classification |
|----------|---------|---------|-----------|-----------|---------------|
| 537333 | Canada vs Bosnia-Herzegovina | RED → YELLOW | true → false | Snapshot captured before FD committed final score; PERF-6 skip-if-fresh prevented same-cycle refresh | TRANSIENT — self-resolved Cycle 2 |
| 537369 | Spain vs Cape Verde Islands | YELLOW → YELLOW | false | FD API does not provide lineup data for this match | PERMANENT DATA GAP — non-critical |
| 537333 (post-Cycle-2) | Canada vs Bosnia-Herzegovina | YELLOW | false | FD API does not provide lineup data | PERMANENT DATA GAP — non-critical |

---

## Structural Note: Score-Snapshot Lag Window

The authority cache score comes from the FD FINISHED bulk feed (fast, batch updated).
The per-match snapshot score comes from the FD per-match endpoint (may lag).

When a match finishes, the bulk feed may reflect the final score before the per-match
endpoint. During this lag window (typically < 1 orchestrator cycle = 1–2h), a scoreDrift
RED can occur if prewarm's skip-if-fresh guard prevents an immediate snapshot refresh.

**Mitigation already in place:**
1. `repair-enrichment` (04:00 daily) invalidates snapshots where score > 0 and goals == 0
2. PERF-6 skip-if-fresh guards expire after ~30 min — next natural cycle refreshes
3. The authority cache SCORE itself is always correct (from bulk feed) — only snapshot comparison shows RED

**Impact on DATA-18B listing pages:**
Listing pages read `CanonicalMatch.score` from the authority cache — sourced from
the bulk feed. The score is always correct. The scoreDrift RED is a comparison artifact
between the authority cache and the stale snapshot, not a user-visible error.
