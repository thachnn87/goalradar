# DATA-18C.0 Phase 6 — Readiness Gate
## Can DATA-18C Shadow Validation Produce Meaningful Results Today?

Audit timestamp: 2026-06-17T09:30:14Z  
Based on: Phases 1–5 findings from live KV inspection

---

## Gate Verdict

```
████████████████████████████████████████████
  DATA-18C SHADOW VALIDATION STATUS: RED
████████████████████████████████████████████
```

Shadow validation (`/api/debug/authority-compare`) **cannot produce meaningful results today**.

If run right now, the shadow diff endpoint would return:
```json
{
  "gate": "RED",
  "diffs": [
    { "matchId": 537351, "gate": "RED", "checks": { "enrichmentApplied": false, "goalsLengthMatch": false } },
    { "matchId": 537391, "gate": "RED", "checks": { "enrichmentApplied": false, "goalsLengthMatch": false } },
    { "matchId": 537392, "gate": "RED", "checks": { "enrichmentApplied": false, "goalsLengthMatch": false } },
    { "matchId": 537397, "gate": "RED", "checks": { "enrichmentApplied": false, "goalsLengthMatch": false } }
  ]
}
```

All 4 benchmark matches fail `enrichmentApplied` and `goalsLengthMatch`. The gate criteria
require BOTH to be true for GREEN. None can pass.

---

## Blocking Defects

### BLOCKER 1 — Universal Enrichment Failure (Critical)
**18 of 20 FINISHED matches have 0 goals in their snapshots.**

- Snapshot age for all 18: 5.2 hours (prewarm-rebuilt at 04:18 UTC)
- ESPN ID count: 0 of 20 matches have ESPN lookups
- AF enrichment: either not attempted or returned empty for all 18
- Prewarm path builds from cached bulk FD data (no goals) → enrichment fails → 0-goal snapshot pinned for 7 days

All 4 benchmark matches (537351, 537391, 537392, 537397) are in this set.

**Fix required before DATA-18C:**
Delete or expire the 18 poisoned snapshots so fresh builds from `/matches/{id}` FD
endpoint run on next page visits. FD match detail returns full goal data for recent matches.
Alternatively, run a repair script that calls `getMatchDetail(id)` and rebuilds each snapshot.

### BLOCKER 2 — ESPN ID Mapping Completely Missing
**0 of 20 FINISHED matches have ESPN ID lookup keys.**

Key: `goalradar:espn:lookup:{fdMatchId}` — 30-day TTL — 0 present.

Two possible causes:
- (A) ESPN search API is not matching current WC 2026 match IDs by date/team lookup
- (B) All lookups returned `LookupMiss` sentinels (stored as objects, not positive strings)

**Impact on Authority Cache:** `buildAllCanonicalMatches()` receives an empty `espnIdMap`.
`buildCanonicalMatch()` sets `espnMatchId: undefined` for all matches. This is not a
structural failure — `canonical-match.ts` handles absent ESPN IDs gracefully. But the
shadow diff gate's `enrichmentApplied=true` check fails because ESPN is the primary
enrichment provider.

**Fix required before DATA-18C:** Investigate whether ESPN's league slug for WC 2026 (`fifa.world`)
matches the current API. If changed, update `ESPN_WC_LEAGUE` env var. Run the lookup resolver
manually via `/api/debug/hybrid-enrichment/refresh-lookup` for 2–3 test matches.

### BLOCKER 3 — FINISHED Feed Has No DR Key
**`goalradar:dr:/competitions/WC/matches?status=FINISHED` does not exist.**

**Risk:** If the FINISHED feed primary key expires between cron runs (unlikely but possible
if cron fails), `getWCResultsCached()` returns `{ matches: [] }` with no DR fallback.
Results page immediately shows 0 matches.

**Impact on DATA-18C:** The `coldRebuild()` path in `readAuthorityCache()` calls
`getWCResultsCached()`. If the FINISHED feed is empty (KV miss), the cold rebuild produces
an authority cache with 0 FINISHED matches — shadow diff would show all FINISHED matches
as MISSING (RED gate for different reason).

**Fix:** The DR key will be written by the next successful `getWCResults()` (SWR variant)
call — i.e., the next time `refreshEndpoint('/competitions/WC/matches?status=FINISHED', ...)`
runs in the orchestrator AND the data is stale enough to trigger the full SWR path. This
should self-resolve on the next orchestrator run where the FINISHED data is > 15 min old
(FIXTURES_FRESH). The 12-min-old data at audit time is within the fresh window, so the
cron may have skipped the DR write. **Not blocking if DATA-18C is run > 30 min from now.**

---

## Non-Blocking Issues (Fix Before DATA-18D)

### ISSUE 4 — 3 TIMED Matches in FINISHED Feed
537403 (Portugal vs Congo DR), 537409 (England vs Croatia), 537410 (Ghana vs Panama)
have `fdStatus=TIMED` but appear in the FINISHED KV key.

**Likely cause:** The FD API's `/competitions/WC/matches?status=FINISHED` endpoint
returned these today-scheduled matches in its response. Possible FD API quirk where
matches on the same day as finished matches are included. The authority merge handles
this correctly (STATE_RANK TIMED=0, so these don't override anything), but it pollutes
the FINISHED feed.

**Impact on shadow diff:** Not directly blocking. These matches are TIMED and will not
be in the shadow diff benchmark set. They would show as `stateFinished=false` in any
future diff check, but they're not in the current 4 benchmark matches.

### ISSUE 5 — Triple Overlay (Performance, Not Blocking)
3× `overlayMatchStates()` per authority page request = 104 wasted snapshot reads per Hub ISR.
50% duplicate KV operations. Documented in Phase 5. Not a DATA-18C blocker.

### ISSUE 6 — Stale Scheduled Count = 0 (Good)
No SCHEDULED/TIMED matches with past kickoff dates in the upcoming feed at audit time.
Symptom #2 (Austria vs Jordan in "Today's Matches") is not actively occurring right now.
The FINISHED feed was refreshed 12 min ago and correctly shows Austria vs Jordan as FINISHED.
The authority merge correctly supersedes the SCHEDULED entry.

---

## Pre-Requisite Checklist for DATA-18C

| # | Action | Priority | Estimated effort |
|---|--------|----------|-----------------|
| **P1** | Repair 18 poisoned snapshots (delete KV keys, allow organic rebuild) | **BLOCKING** | 5 min (script or manual KV delete) |
| **P2** | Investigate ESPN ID mapping for WC 2026 — verify `fifa.world` league slug | **BLOCKING** | 30 min investigation + fix |
| **P3** | Verify FINISHED feed DR key exists before running shadow validation | Non-blocking (self-heals) | 0 min if waiting > 30 min |
| **P4** | Optionally fix 3 TIMED matches in FINISHED feed (FD API quirk) | Non-blocking | Investigate root cause |
| **P5** | Verify AF enrichment path independently (not tested here) | Non-blocking | 15 min investigation |

---

## Conditions for GREEN Gate

Shadow validation will produce GREEN when ALL of the following are true for benchmark matches
537351, 537391, 537392, 537397:

| Condition | Required state | Current state |
|-----------|---------------|---------------|
| `scoreIdentical` | FD score matches authority cache score | PASS (scores are correct) |
| `enrichmentApplied` | `goals.length > 0` in authority cache | **FAIL (goals=0)** |
| `goalsLengthMatch` | `goals.length > 0` | **FAIL (goals=0)** |
| `stateFinished` | `state === 'finished'` | PASS (status correct) |
| `integrityOk` | `integrity.status === 'ok'` | PASS (C2/C3 pass) |

3 of 5 checks pass. 2 are RED. Both require enrichment data in the snapshots.

---

## Estimated Time to Green

| Action | Time |
|--------|------|
| Delete 18 poisoned snapshot KV keys (primary + DR) | ~5 min |
| Wait for organic rebuild via page visits or prewarm | ~30 min |
| Investigate and fix ESPN ID lookup | ~1 hour |
| Wait for ESPN IDs to be populated | ~30 min |
| Re-run shadow validation | ~1 min |
| **Total estimated time to GREEN** | **~2 hours** |

---

## Summary

| Finding | Severity | Blocks DATA-18C? |
|---------|----------|-----------------|
| 18/20 FINISHED matches: 0 goals in snapshot | CRITICAL | YES |
| 0/20 ESPN ID mappings present | CRITICAL | YES |
| FINISHED feed: no DR key | HIGH | Conditional |
| 3 TIMED matches in FINISHED feed | MEDIUM | NO |
| Triple overlay (performance) | LOW | NO |
