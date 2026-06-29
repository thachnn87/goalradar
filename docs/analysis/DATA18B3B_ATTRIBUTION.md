# DATA-18B.3B Phase 2 — Attribution Telemetry

**Date:** 2026-06-19
**Checked At:** 2026-06-19T04:04:18 UTC
**Source:** `/api/debug/authority-attribution` + `/api/debug/authority-adoption`

---

## Summary

| Metric | Today (2026-06-19) | Last 7d | Last 30d |
|--------|-------------------|---------|---------|
| Total authority cache reads | 210 | 454 | 454 |
| Page reads (production) | 166 (79.05%) | 224 (49.34%) | 224 (49.34%) |
| Debug reads | 44 (20.95%) | 53 (11.67%) | 53 (11.67%) |
| Benchmark reads | 0 | 1 (0.22%) | 1 (0.22%) |
| Unknown reads | 0 | 0 | 0 |
| Organic traffic confidence | — | — | MEDIUM |

---

## Bracket Attribution (NEW)

| Field | Value |
|-------|-------|
| Route | `/world-cup-2026/bracket` |
| Reads (today) | **1** |
| Primary hits | 0 |
| DR hits | 0 |
| Cold rebuilds | 1 |
| Avg latency | **543ms** |
| Last read | 2026-06-19T03:47:26.121Z |
| Page share (today) | 0.65% |

**Bracket is confirmed in attribution telemetry.** The 1 read used cold rebuild (543ms) — consistent with the DR staleness guard firing (primary absent, DR stale with `liveCount=1`, age >>120s). No abnormality — same behavior as other routes during the same ISR cycle.

---

## Per-Route Breakdown (Today)

| Route | Reads | Primary | DR | Cold | Avg Latency | Page Share |
|-------|-------|---------|-----|------|------------|------------|
| `/world-cup-2026/[group]` | 96 | 0 | 24 | 72 | 532ms | 62.34% |
| `/world-cup-2026` | 25 | 2 | 9 | 14 | 1403ms | 16.23% |
| `/world-cup-2026/matches-today` | 8 | 2 | 2 | 4 | 304ms | 5.19% |
| `/world-cup-2026/results` | 8 | 2 | 2 | 4 | 443ms | 5.19% |
| `/world-cup-2026/fixtures` | 8 | 2 | 2 | 4 | 427ms | 5.19% |
| `/world-cup-2026/matches-tomorrow` | 8 | 2 | 2 | 4 | 475ms | 5.19% |
| `/world-cup-2026/bracket` | **1** | 0 | 0 | 1 | **543ms** | **0.65%** |
| **Total** | **154** | **10** | **41** | **103** | 648ms | — |

**Note:** All page reads add to 154, but the attribution endpoint reports 166 total (the difference is 12 reads from the second revalidation batch where some routes completed after the adoption snapshot).

**ISR coverage: 7/7 routes (100%)** — first time bracket route appears.

---

## Bracket Read Rate vs Other Routes

The bracket page has `revalidate = 21600` (6-hour ISR interval), vs:
- Hub (`/world-cup-2026`): `revalidate = 30`
- Results: `revalidate = 300`
- Fixtures: `revalidate = 900`
- Group pages: `revalidate = 3600` (estimated from read count)

With a 6-hour interval and a single Vercel ISR deployment, the bracket revalidates ~4 times per 24h window. This is expected — low read count is not a signal of underuse, it reflects the long ISR TTL.

**Next expected bracket revalidations:** ~09:47, ~15:47, ~21:47 UTC (2026-06-19), then ~03:47 UTC (2026-06-20).

---

## Attribution Trend (Recent Days)

| Date | Total Reads | Page Reads | Debug Reads | Production Ratio | ISR Coverage |
|------|------------|-----------|------------|-----------------|-------------|
| 2026-06-19 | 210 | 166 | 44 | 79.05% | 7/7 (100%) |
| 2026-06-18 | 244 | 58 | 9 | 23.77% | 0 per-route |

**Note:** 2026-06-18 shows 0 per-route ISR coverage — telemetry per-route tracking may not have been deployed yet on that date, or reads are attributed to unknown.

---

## Organic Traffic Confidence

| Signal | Value |
|--------|-------|
| Days with page reads | 2 |
| Days with any reads | 2 |
| Page reads ratio (30d) | 49.34% |
| Confidence level | **MEDIUM** |
| Reason | Page reads present (49.34%) but limited to 2 days of data |

Confidence will reach HIGH once ≥3 days of data accumulate with page reads >50%.
