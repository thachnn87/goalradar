# DATA-18OPS.2D Final Verdict

**Task:** Scheduler Reliability & Cron Monitoring Hardening
**Date:** 2026-06-19
**Verdict: SCHEDULER_READY**

---

## Success Criteria Results

| Criterion | Status |
|-----------|--------|
| cron-status detects stale schedules | ✅ PASS |
| Stale jobs become RED automatically | ✅ PASS (stalenessFactor > 2.0 → RED) |
| Expected cadence enforced | ✅ PASS (per-job expectedIntervalMinutes in registry) |
| Scheduler health score available | ✅ PASS (`healthScore` 0-100 weighted by criticality) |
| Orchestrator outages visible within 2× interval | ✅ PASS (2× 30 min = 60 min → RED) |
| No cron route unverifiable | ✅ PASS (all 4 implemented jobs have KV records) |

---

## What Was Built

### `src/lib/scheduler-health.ts` (new)

Single source of truth for all cron staleness logic.

| Symbol | Purpose |
|--------|---------|
| `SCHEDULER_JOB_CONFIGS` | Per-job registry: `expectedIntervalMinutes`, `criticalityLevel`, `schedulerSource` |
| `computeJobHealth()` | Returns full `SchedulerJobHealth` including staleness factor, outage start, next expected run |
| `worstHealth()` | Aggregate across jobs for overall verdict |
| `jobPriority()` | Criticality × staleness score for ranking |

**Staleness rules:**
```
stalenessFactor = ageMinutes / expectedIntervalMinutes
GREEN  ≤ 1.5×   within expected cadence
YELLOW ≤ 2.0×   investigate scheduler
RED    > 2.0×   outage — immediate attention
UNKNOWN         no KV record found
```

### `src/app/api/debug/cron-status/route.ts` (upgraded)

Backward-compatible upgrade. Legacy fields (`status`, `overall`, `redJobs`, `yellowJobs`) preserved. New per-job fields added: `expectedIntervalMinutes`, `stalenessFactor`, `health`, `stalenessReason`, `nextExpectedRun`, `outageStartedAt`, `outageDurationMinutes`, `schedulerSource`, `criticalityLevel`.

### `src/app/api/debug/scheduler-health/route.ts` (new)

Dashboard endpoint at `/api/debug/scheduler-health`.

| Field | Description |
|-------|-------------|
| `overallHealth` | Worst state across implemented jobs |
| `healthScore` | 0–100 weighted by criticality (critical=3×, important=2×, maintenance=1×) |
| `verdict` | `SCHEDULER_READY` (≥80) / `SCHEDULER_DEGRADED` (≥50) / `SCHEDULER_NOT_READY` |
| `mostCriticalIssue` | Highest-priority degraded job |
| `oldestJob` | Job with greatest ageMinutes |
| `activeOutages` | YELLOW/RED jobs with outage start time and duration |
| `jobs` | All jobs ranked by priority |

---

## Phase-by-Phase Summary

| Phase | Verdict | Evidence |
|-------|---------|---------|
| 1 — Scheduler Audit | ✅ COMPLETE | 4 jobs inventoried; expected intervals documented; monitoring gap quantified |
| 2 — `scheduler-health.ts` | ✅ COMPLETE | Staleness factor logic, per-job config registry, health state derivation |
| 3 — Upgraded `cron-status` | ✅ COMPLETE | Uses `scheduler-health.ts`, backward compat preserved |
| 4 — `scheduler-health` endpoint | ✅ COMPLETE | Dashboard with ranking, outages, score, verdict |
| 5 — Validation | ✅ PASS | Outage at 109 min → factor 3.64 → RED; old logic returned GREEN |
| 6 — Final gate | ✅ SCHEDULER_READY | healthScore 89, overallHealth YELLOW (health-archive GitHub Actions delay) |

---

## Current State at Verdict Time (05:09 UTC)

| Job | Last Run | Age | Factor | Health |
|-----|---------|-----|--------|--------|
| orchestrator | 04:39 UTC | 30.6 min | 1.02× | GREEN |
| health-archive | 02:06 UTC | 183 min | 1.53× | YELLOW |
| repair-enrichment | 18-Jun 09:32 | 1178 min | 0.82× | GREEN |
| drift-scan | 18-Jun 09:32 | 1177 min | 0.82× | GREEN |

`healthScore: 89 / 100` → `SCHEDULER_READY`

Health-archive YELLOW is expected — it runs via GitHub Actions at ~2h effective cadence. 183 min (1.53×) is within the YELLOW zone (1.5–2.0×), not an outage. Will return to GREEN after the next GitHub Actions fire.

---

## Pre-Fix vs Post-Fix Comparison

| Metric | Pre-Fix (04:08 UTC) | Post-Fix |
|--------|--------------------|----- |
| Orchestrator GREEN threshold | 240 min (hardcoded) | 45 min (1.5× × 30 min) |
| Orchestrator at 109 min | **GREEN (wrong)** | **RED (correct)** |
| stalenessFactor exposed | No | Yes (3.64 during outage) |
| outageStartedAt exposed | No | Yes (02:49 UTC during outage) |
| nextExpectedRun exposed | No | Yes |
| Scheduler health score | No | Yes (89/100) |
| Endpoint for dashboard | No | `/api/debug/scheduler-health` |

---

## Remaining Recommendations

1. **UptimeRobot for orchestrator**: The 30-min expected interval assumes UptimeRobot is active. If not configured, the health-archive pattern (120-min effective) should be used. Verify UptimeRobot is live via OPS2_SCHEDULER_HARDENING.md.

2. **health-check route**: Currently `UNIMPLEMENTED`. Once the `/api/cron/health-check` route is created, it will automatically participate in scheduler-health scoring.

3. **Alert on RED**: `/api/debug/scheduler-health` can be polled by an external monitor (UptimeRobot, Grafana) to send alerts when `overallHealth === "RED"`. URL: `https://www.goalradar.org/api/debug/scheduler-health?secret=$CRON_SECRET`.

---

**DATA-18OPS.2D: COMPLETE. Verdict: SCHEDULER_READY.**
