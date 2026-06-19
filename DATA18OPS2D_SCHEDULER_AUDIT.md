# DATA-18OPS.2D Phase 1 — Scheduler Audit

**Date:** 2026-06-19
**Status:** COMPLETE

---

## Inventory of All Scheduled Workloads

### 1. Orchestrator

| Field | Value |
|-------|-------|
| Job ID | `orchestrator` |
| Endpoint | `/api/cron/orchestrator` |
| Criticality | **CRITICAL** |
| Workflow file | `.github/workflows/orchestrator-cron.yml` |
| GitHub Actions schedule | `*/15 * * * *` (every 15 min attempt) |
| GitHub Actions effective cadence | ~2h (measured on this repo) |
| Hard-cadence scheduler | UptimeRobot (30 min) — intended; see OPS2_SCHEDULER_HARDENING.md |
| **Expected interval** | **30 minutes** (UptimeRobot cadence) |
| **staleness factor threshold** | GREEN ≤1.5× (≤45 min), YELLOW ≤2.0× (≤60 min), RED >2.0× (>60 min) |
| Last run (pre-fix) | 2026-06-19T02:19:43 UTC |
| Last run (post-fix) | 2026-06-19T04:39:22 UTC |
| Typical duration | ~113s (12 sequential tasks with 7s rate-limit spacing) |
| Job timeout | 10 min (GitHub Actions), 540s curl timeout |

**What it does:** WC fixtures refresh, standings, prewarmWorldCup, writes authority cache (primary + DR KV). Most critical job — drives data freshness for all WC listing pages.

**Monitoring gap detected:** `greenMaxMin` was 240 min (4h) — masked a 109-minute outage that was causing 62% cold rebuild rate and DR stale-live state.

---

### 2. Health Archive

| Field | Value |
|-------|-------|
| Job ID | `health-archive` |
| Endpoint | `/api/cron/health-archive` |
| Criticality | **IMPORTANT** |
| Workflow file | `.github/workflows/health-archive-cron.yml` |
| GitHub Actions schedule | `*/15 * * * *` (every 15 min attempt) |
| GitHub Actions effective cadence | ~1-2h (measured) |
| **Expected interval** | **120 minutes** (GitHub Actions effective cadence) |
| **staleness factor threshold** | GREEN ≤3h (≤1.5×), YELLOW ≤4h (≤2.0×), RED >4h |
| Last run | 2026-06-19T02:06:54 UTC |
| Age at audit (04:08 UTC) | 122 min (1.02× expected) → GREEN |
| Typical duration | ~3-10s |

**What it does:** Writes timestamped health snapshots to KV ZSET `goalradar:health:archive`. Powers SLO compliance and incident detection in reliability subsystem.

---

### 3. Repair Enrichment

| Field | Value |
|-------|-------|
| Job ID | `repair-enrichment` |
| Endpoint | `/api/cron/repair-enrichment` |
| Criticality | **MAINTENANCE** |
| Workflow file | `.github/workflows/repair-enrichment-cron.yml` |
| GitHub Actions schedule | `0 4 * * *` (daily at 04:00 UTC) |
| **Expected interval** | **1440 minutes** (24h) |
| **staleness factor threshold** | GREEN ≤36h (≤1.5×), YELLOW ≤48h (≤2.0×), RED >48h |
| Last run | 2026-06-18T09:32:30 UTC |
| Age at audit (04:08 UTC) | 1116 min (0.78×) → GREEN |
| Typical duration | ~5-15s |

**What it does:** Scans all finished WC matches, invalidates snapshots where score > 0 but goals.length = 0 (enrichment gap). Writes to KV only if degraded matches found.

---

### 4. Drift Scan

| Field | Value |
|-------|-------|
| Job ID | `drift-scan` |
| Endpoint | `/api/cron/drift-scan` |
| Criticality | **MAINTENANCE** |
| Workflow file | `.github/workflows/drift-scan-cron.yml` |
| GitHub Actions schedule | `30 4 * * *` (daily at 04:30 UTC) |
| **Expected interval** | **1440 minutes** (24h) |
| **staleness factor threshold** | GREEN ≤36h (≤1.5×), YELLOW ≤48h (≤2.0×), RED >48h |
| Last run | 2026-06-18T09:32:31 UTC |
| Age at audit (04:08 UTC) | 1116 min (0.78×) → GREEN |
| Typical duration | ~3-8s |

**What it does:** Reads authority cache vs match snapshots for all finished WC matches, logs score/state/enrichment drift. Logging only — no writes.

---

## Staleness Summary at Audit Time (04:08 UTC)

| Job | Last Run | Age (min) | Expected Interval | Staleness Factor | Old Status | New Status |
|-----|---------|-----------|------------------|-----------------|-----------|-----------|
| orchestrator | 02:19 UTC | 109 | 30 min | **3.63×** | GREEN ❌ | **RED** ✅ |
| health-archive | 02:06 UTC | 122 | 120 min | 1.02× | GREEN | GREEN ✅ |
| repair-enrichment | 18-Jun 09:32 | 1116 | 1440 min | 0.78× | GREEN | GREEN ✅ |
| drift-scan | 18-Jun 09:32 | 1116 | 1440 min | 0.78× | GREEN | GREEN ✅ |

**The orchestrator would have been RED under the new thresholds.** The old thresholds (4-hour GREEN window) masked the outage.

---

## Verification Artifacts

| Job | KV Key | Record Type |
|-----|--------|------------|
| orchestrator | `goalradar:cron:orchestrator:last-run` (fallback: `goalradar:prewarm:last-run`) | `CronRunRecord` |
| health-archive | `goalradar:cron:health-archive:last-run` | `CronRunRecord` |
| repair-enrichment | `goalradar:cron:repair-enrichment:last-run` | `CronRunRecord` |
| drift-scan | `goalradar:cron:drift-scan:last-run` | `CronRunRecord` |

All records written by `recordCronRun()` in `src/lib/cron-recorder.ts` with TTL=10 days.
