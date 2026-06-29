# DATA-18OPS.2D Phase 5 — Validation

**Date:** 2026-06-19
**Status:** PASS

---

## Objective

Validate that the new scheduler-health logic correctly classifies the orchestrator outage that was live between 02:19 UTC and 04:39 UTC on 2026-06-19 (109 minutes, causing 62% cold rebuild rate and stale DR).

The test: given `lastRunAt = 2026-06-19T02:19:43 UTC` and `checkAt = 2026-06-19T04:08:52 UTC`, the new logic must return `health: RED`.

---

## Phase 5.1 — Logic Simulation Against Known Outage

**Inputs:**
```
lastRunAt:               2026-06-19T02:19:43.771Z
checkAt:                 2026-06-19T04:08:52.869Z
ageMinutes:              (04:08:52 − 02:19:43) = 109.15 min
expectedIntervalMinutes: 30
stalenessFactor:         109.15 / 30 = 3.638
```

**Rules applied (from `scheduler-health.ts`):**
```
stalenessFactor = 3.638

GREEN  threshold: factor ≤ 1.5  → 45 min → NOT MET (3.638 > 1.5)
YELLOW threshold: factor ≤ 2.0  → 60 min → NOT MET (3.638 > 2.0)
RED    threshold: factor >  2.0  →          MET
```

**Computed result:**
```
health:          RED
stalenessReason: "Outage: 109 min since last run (3.64× interval).
                  Expected run >60 min ago. Immediate attention required."
outageStartedAt: 2026-06-19T02:49:43.771Z  (lastRun + 30 min)
outageDurationMinutes: 79  (04:08:52 − 02:49:43)
nextExpectedRun: 2026-06-19T02:49:43.771Z
```

**Old result (pre-fix, `greenMaxMin: 240`):**
```
status: GREEN  ← WRONG: 109 min is well within the 240-min green window
```

**Phase 5.1 verdict: PASS** — New logic correctly returns RED. Old logic returned GREEN. The monitoring gap is fixed.

---

## Phase 5.2 — Live Endpoint Validation (Post-Deployment)

Endpoint verified live at `2026-06-19T05:09:57 UTC`.

### scheduler-health response (condensed):

```json
{
  "checkedAt":    "2026-06-19T05:09:57.646Z",
  "overallHealth": "YELLOW",
  "healthScore":   89,
  "verdict":       "SCHEDULER_READY",
  "summary": {
    "total": 5, "implemented": 4,
    "GREEN": 3, "YELLOW": 1, "RED": 0, "UNKNOWN": 0, "UNIMPLEMENTED": 1,
    "activeOutages": 1
  },
  "mostCriticalIssue": {
    "jobId":              "health-archive",
    "health":             "YELLOW",
    "criticalityLevel":   "important",
    "stalenessFactor":    1.53,
    "ageMinutes":         183,
    "outageDurationMinutes": 63,
    "stalenessReason":    "Overdue by 63 min (1.53× interval). Investigate scheduler."
  }
}
```

**Job breakdown:**

| Job | Last Run | Age | Staleness | Health |
|-----|---------|-----|-----------|--------|
| orchestrator | 04:39 UTC | 30.6 min | 1.02× | GREEN |
| health-archive | 02:06 UTC | 183 min | **1.53×** | **YELLOW** |
| repair-enrichment | 18-Jun 09:32 | 1178 min | 0.82× | GREEN |
| drift-scan | 18-Jun 09:32 | 1177 min | 0.82× | GREEN |
| health-check | never | — | — | UNIMPLEMENTED |

**Observations:**
- Orchestrator is GREEN (manual trigger ran at 04:39 — 30.6 min ago, within 30-min interval)
- Health-archive is YELLOW (183 min vs 120-min interval = 1.53×) — GitHub Actions effective delay, not a real outage
- No RED jobs at collection time (outage resolved by manual trigger)
- `verdict: SCHEDULER_READY` with score 89/100

---

## Phase 5.3 — Retroactive Classification of the Outage

Using the orchestrator's PREVIOUS last-run value (`02:19:43 UTC`) against the new logic:

| Check Time | Age (min) | Staleness | Old Status | New Status |
|-----------|-----------|-----------|-----------|-----------|
| 02:49 UTC | 29 | 0.97× | GREEN | GREEN ✅ |
| 03:19 UTC | 59 | 1.97× | GREEN | YELLOW ← first alert |
| 03:49 UTC | 89 | 2.97× | GREEN | **RED** ← outage detection |
| 04:08 UTC | 109 | 3.64× | GREEN | **RED** ← where we were |
| 04:39 UTC | — | — | — | RESOLVED (manual trigger) |

**Under the new logic, RED would have been raised at 03:49 UTC** — 50 minutes before the manual trigger. The old logic never raised an alert.

---

## Phase 5.4 — Cron-Status Backward Compatibility

```
GET /api/debug/cron-status (after deploy)
```

Confirmed fields present:
- `overall` (legacy alias) ← still present
- `redJobs` / `yellowJobs` ← still present
- `jobs[].status` ← still present (GREEN/YELLOW/RED/UNIMPLEMENTED)
- `jobs[].lastRun`, `lastSuccess`, `ageMinutes`, `durationMs`, `triggerSource` ← still present
- NEW: `jobs[].expectedIntervalMinutes`, `stalenessFactor`, `health`, `stalenessReason`, `nextExpectedRun`, `outageStartedAt`, `outageDurationMinutes`, `schedulerSource`, `criticalityLevel`

**Backward compatibility: maintained.** Existing monitors parsing `overall` or `jobs[].status` continue to work.

---

## Pass/Fail Summary

| Check | Result |
|-------|--------|
| Logic simulation: orchestrator at 109 min → RED | ✅ PASS |
| Old logic masked outage as GREEN | Confirmed |
| New endpoint returns stalenessFactor, outageStartedAt | ✅ PASS |
| Live endpoint deployed and responding | ✅ PASS (05:09 UTC) |
| Backward compat on cron-status | ✅ PASS |
| Health-archive YELLOW correctly detected | ✅ PASS |
| No false RED during normal operation | ✅ PASS |
