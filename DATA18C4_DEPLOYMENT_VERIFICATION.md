# DATA-18C.4 Phase 1 — Deployment Verification

**Status:** VERIFIED  
**Collected:** 2026-06-18T15:07–15:09 UTC  
**Production domain:** `https://www.goalradar.org`  

---

## 1. Domain Discovery

Prior DATA-18C sessions tested against `goalradar.vercel.app` — a different Vercel project (3-page static app, buildId `FqdpBCxvrlYTwl2gvKDDT`). The actual production domain was identified from GitHub Actions cron workflows:

```
.github/workflows/orchestrator-cron.yml:       https://www.goalradar.org/api/cron/orchestrator
.github/workflows/drift-scan-cron.yml:          https://www.goalradar.org/api/cron/drift-scan
.github/workflows/health-archive-cron.yml:      https://www.goalradar.org/api/cron/health-archive
.github/workflows/repair-enrichment-cron.yml:   https://www.goalradar.org/api/cron/repair-enrichment
```

All cron jobs target `https://www.goalradar.org`. This is confirmed production.

---

## 2. Infrastructure

| Field | Value |
|---|---|
| Domain | `https://www.goalradar.org` |
| Vercel region | `sin1::iad1` (Singapore edge → US East origin) |
| x-vercel-cache | MISS (API routes: `force-dynamic`, as expected) |
| Site title | GoalRadar — Live Football Scores, World Cup 2026 & Match Schedules |

---

## 3. Endpoint Verification

All five DATA-18C debug endpoints verified live:

| Endpoint | HTTP | Response |
|---|---|---|
| `/api/debug/authority-telemetry` | **200** | JSON — verdict: GREEN |
| `/api/debug/authority-slo` | **200** | JSON — overall: FAIL (DR SLO) |
| `/api/debug/authority-readiness` | **200** | JSON — verdict: READY, score: 100/100 |
| `/api/debug/authority-freshness` | **200** | JSON — source: dr, stale: true |
| `/api/debug/authority-drift` | **200** | JSON — 23 GREEN, 1 YELLOW, 0 RED |

All endpoints authenticated via `CRON_SECRET` Bearer token.

---

## 4. Cache State at Verification Time

```json
{
  "source": "dr",
  "builtAt": "2026-06-18T12:56:38.568Z",
  "ageSec": 7873,
  "ttlTier": "today",
  "stale": true,
  "matchCount": 104,
  "drPresent": true,
  "verdict": "RED",
  "note": "Primary evicted — serving from DR (7873s old)"
}
```

- Last orchestrator write: 12:56:38 UTC (2h 11m before verification)
- Primary TTL (`today` tier) = 300s — expired 2h+ ago
- DR key (7-day TTL) serving 104 matches — functioning correctly
- `authority:last-write` record present (`writeAgeMin`: 130 min at time of readiness check)

---

## 5. Authority Drift State

```json
{
  "total": 24,
  "green": 23,
  "yellow": 1,
  "red": 0,
  "verdict": "YELLOW",
  "note": "1 YELLOW match — enrichment/lineup drift only. Non-critical."
}
```

Match 537369 (Spain vs Cape Verde Islands) — YELLOW for `lineupMissing` only. No score drift, no state drift. Non-critical per DATA-18C.2 root cause analysis.

---

## 6. Telemetry First-Read Snapshot

Telemetry records first appeared on 2026-06-18 (first day after DATA-18C.3 deployment to production).

```json
{
  "checkedAt": "2026-06-18T15:07:03.857Z",
  "verdict": "GREEN",
  "today": {
    "totalReads": 55,
    "primaryHits": 0,
    "drHits": 55,
    "coldRebuilds": 0,
    "primaryHitRatio": 0,
    "drHitRatio": 100,
    "coldRebuildRatio": 0,
    "availability": 100,
    "avgLatencyMs": 42
  }
}
```

55 reads observed since telemetry activation, all served from DR, 0 cold rebuilds.

---

## 7. Burn-In Window Note

Telemetry activation date: 2026-06-18 (today). The 24h minimum burn-in window starts from this point. Data collected in this session covers approximately 90 minutes of production traffic. Full 24h dataset will accumulate overnight via the GitHub Actions orchestrator cron (`*/15 * * * *` schedule, effective ~1-2h cadence).
