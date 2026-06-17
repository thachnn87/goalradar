# DATA-18D.2 Phase 5 — Simulation Test
## Delete Primary + DR + AF Cache → Rebuild → Verify

Endpoint: `/api/debug/data18d2-simulation`

---

## Test Design

The simulation endpoint proves that after DATA-18D.2 fixes (Phases 2–4), the full rebuild pipeline correctly enriches FINISHED snapshots even when starting from a completely cold state.

**Three levels of cold start simulated:**

1. **Primary snapshot deleted** — forces `getOrBuildMatchSnapshot()` to rebuild
2. **DR snapshot deleted** — removes the downgrade-guard rescue, so rebuilding can't fall back to a cached enriched version
3. **AF events cache deleted** (`goalradar:af:events:{id}`) — forces a fresh API call to api-football, proving the enrichment path works end-to-end (not just from KV cache)

### Target Matches (Default)

| matchId | Match | Score | Goals Expected |
|---------|-------|-------|----------------|
| 537351 | Germany vs Curaçao | 7–1 | 8 |
| 537391 | France vs Senegal | 3–1 | 4 |
| 537392 | Norway vs Iraq | 3–2 | 5 |
| 537397 | Argentina vs Algeria | 3–0 | 3 |

These are the highest-value benchmark matches with the most goal events — maximum enrichment signal.

---

## Pass Criteria

For each scored match (FT score > 0):
- `goalsAfter > 0` — goal events populated after rebuild
- `lineupAfter = true` — lineup populated after rebuild
- `enrichedAfter = true` — `enrichmentApplied` flag set

For 0-0 draws: pass automatically (no goals expected).

---

## Usage

### Dry Run (inspect state only, no deletes)
```bash
curl "https://www.goalradar.org/api/debug/data18d2-simulation?secret=$CRON_SECRET&dryRun=true" | jq .
```

### Full Simulation
```bash
curl "https://www.goalradar.org/api/debug/data18d2-simulation?secret=$CRON_SECRET" | jq .
```

### Single Match
```bash
curl "https://www.goalradar.org/api/debug/data18d2-simulation?secret=$CRON_SECRET&matchId=537351" | jq .
```

---

## Expected Response

```json
{
  "verdict": "PASS",
  "passed": 4,
  "failed": 0,
  "total": 4,
  "dryRun": false,
  "results": [
    {
      "matchId": 537351,
      "status": "pass",
      "score": "7-1",
      "goalsBefore": 8,
      "goalsAfter": 8,
      "cardsBefore": 2,
      "cardsAfter": 2,
      "subsBefore": 6,
      "subsAfter": 6,
      "lineupBefore": true,
      "lineupAfter": true,
      "enrichedAfter": true,
      "rebuildMs": 340,
      "deletedKeys": [
        "goalradar:match:537351",
        "goalradar:dr:match:537351",
        "goalradar:af:events:537351"
      ],
      "notes": []
    }
  ]
}
```

---

## Actual Results

*(Run after deployment and paste here)*

```bash
curl "https://www.goalradar.org/api/debug/data18d2-simulation?secret=$CRON_SECRET" | jq .
```

```json
{ "PASTE_SIMULATION_OUTPUT_HERE": true }
```

---

## Phase 5 Verdict

PENDING — run endpoint after deployment.

**Required:** `verdict = "PASS"`, all 4 matches `status = "pass"`, `goalsAfter > 0` for all scored matches.
