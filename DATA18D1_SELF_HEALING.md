# DATA-18D.1 Phase 4 — Automatic Self-Healing
## /api/debug/integrity-repair Implementation

Endpoint: `/api/debug/integrity-repair`

---

## Detection Coverage

The endpoint detects 6 failure types across ALL FINISHED WC matches (reads dynamically from FINISHED KV feed):

| Failure Type | Detection Logic | Severity |
|-------------|-----------------|----------|
| `GOALS_MISSING` | `score > 0 && goals.length === 0` | CRITICAL |
| `GOALS_MISMATCH` | `goals.length !== ftHome + ftAway` (when both > 0) | HIGH |
| `LINEUP_MISSING` | `!lineups?.home?.players?.length` | MEDIUM |
| `SUBS_MISSING` | `score > 0 && substitutions.length === 0` | MEDIUM |
| `DR_POISONED` | DR snapshot has `score > 0 && goals.length === 0` | HIGH |
| `SNAPSHOT_MISSING` | no snapshot in KV for a FINISHED match | CRITICAL |

---

## Repair Mechanism

**Single repair action handles all failure types:**

```
DELETE goalradar:match:{id}       (primary)
DELETE goalradar:dr:match:{id}    (DR)
CALL   getOrBuildMatchSnapshot(id)
  → fetches FD match detail
  → calls enrichMatchWithAFEvents(match)
  → AF events: KV cache HIT (7-day TTL) or fresh API fetch
  → writes enriched primary (7d TTL)
  → writes enriched DR (30d TTL)
```

Deleting BOTH primary AND DR before rebuild ensures the downgrade guard has no stale DR to promote. The rebuilt snapshot is always the most current AF-enriched version.

---

## Endpoint Modes

### Dry Run (detection only, no writes)
```bash
curl "https://www.goalradar.org/api/debug/integrity-repair?secret=$CRON_SECRET&dryRun=true"
```

Returns list of matches needing repair without modifying KV.

### Repair (detection + fix)
```bash
curl "https://www.goalradar.org/api/debug/integrity-repair?secret=$CRON_SECRET"
```

Repairs all detected failures. Processes in batches of 3 to avoid overwhelming AF enrichment API.

---

## Expected Response

### Healthy (no repair needed)
```json
{
  "checked": 20,
  "degraded": 0,
  "repaired": 0,
  "verdict": "HEALTHY",
  "message": "All finished WC matches pass integrity checks."
}
```

### After repair
```json
{
  "checked": 20,
  "degraded": 3,
  "repaired": 3,
  "failed": 0,
  "verdict": "ALL_REPAIRED",
  "results": [
    { "matchId": 537351, "failures": ["GOALS_MISSING"], "status": "repaired", "goalsAfter": 8, "lineupAfter": true, "subsAfter": 8, "rebuildMs": 341 }
  ]
}
```

---

## Actual Results

*(Run after deployment)*

### Dry Run First
```
curl "https://www.goalradar.org/api/debug/integrity-repair?secret=$CRON_SECRET&dryRun=true" | jq '{checked, degraded, verdict}'
```

```json
{ "PASTE_DRY_RUN_OUTPUT_HERE": true }
```

### Repair (if degraded > 0)
```json
{ "PASTE_REPAIR_OUTPUT_HERE": true }
```

---

## Self-Healing Coverage vs Existing Mechanisms

| Mechanism | Scope | Detects | Fixes | Frequency |
|-----------|-------|---------|-------|-----------|
| Downgrade guard | Per-match write | Goals missing at write time | Promotes DR | Per page load |
| repair-enrichment cron | All FINISHED | Goals missing | Invalidates → rebuild | Daily |
| **integrity-repair endpoint** | **All FINISHED** | **Goals, goals mismatch, lineup, subs, DR poisoned, missing** | **Delete + rebuild** | **On-demand** |
| enrichment-health endpoint | All FINISHED | Goals missing | None (audit only) | On-demand |
| data18d1-integrity-audit | All FINISHED | All 7 checks | None (audit only) | On-demand |

The `integrity-repair` endpoint is the most comprehensive fix available — it covers all failure modes the cron cannot, including lineup/subs and DR poisoning, and runs on-demand rather than waiting for the daily cycle.

---

## Phase 4 Verdict

Implementation complete. Endpoint deployed at `/api/debug/integrity-repair`.

Features:
- Reads FINISHED matches dynamically (no hardcoded list)
- 6 failure type detection
- Dry-run mode for safe inspection
- Batch repair (3 at a time) with AF enrichment
- Returns per-match repair status and post-repair counts

**Requirement:** Run endpoint after Phase 3 integrity audit to confirm `verdict = "HEALTHY"` after any repairs.
