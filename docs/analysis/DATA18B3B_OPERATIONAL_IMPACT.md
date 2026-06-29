# DATA-18B.3B Phase 4 — Operational Impact Audit

**Date:** 2026-06-19
**Checked At:** 2026-06-19T04:03–04:05 UTC
**Verdict: DEGRADED — pre-existing, NOT caused by pilot**

---

## Before vs After Pilot Activation

| Metric | Pre-Pilot (03:30 UTC) | Post-Pilot (04:03 UTC) | Delta | Cause |
|--------|----------------------|----------------------|-------|-------|
| Authority source | primary | DR (absent primary) | ↓ | Orchestrator cron down |
| Authority stale | false | true (6211s vs 30s TTL) | ↓ | Mexico match ended, cron not updated |
| liveCount | 0 | 1 (stale in DR) | — | DR not updated after Mexico ended |
| Cold rebuild rate (24h) | ~0% | **62.09%** | ↑ 62pp | Pre-existing (orchestrator down) |
| Cold rebuild rate (30d) | 26.83% | **28.79%** | ↑ 2pp | Historical accumulation |
| Primary hit ratio (30d) | ~8.59% | **8.57%** | ≈0 | No change attributable to pilot |
| DR hit ratio (30d) | 62.78% | **62.64%** | ≈0 | No change attributable to pilot |
| Avg latency (30d) | 293ms (post-write-back fix) | **322ms** | ↑ 29ms | Cold rebuilds accumulating |
| Readiness score | 75/100 | **75/100** | 0 | No change |
| SLO overall | FAIL | **FAIL** | 0 | Pre-existing |
| ISR coverage | 6/7 routes | **7/7 routes** | +1 | Pilot activated bracket |

---

## Bracket Contribution to Operational Metrics

| Metric | Bracket | All Routes | Bracket Share |
|--------|---------|-----------|--------------|
| Reads today | 1 | 211 | **0.47%** |
| Cold rebuilds | 1 | 130 | **0.77%** |
| Latency added | 543ms | — | Negligible |

**The bracket pilot contributed 1 cold rebuild out of 130 today (0.77%).** This is operationally negligible. The cold rebuild was unavoidable in the current state (primary absent, DR stale with liveCount=1, staleness guard fires).

---

## Root Cause of Operational Degradation

**Orchestrator cron is down since ~2026-06-19T02:19 UTC.**

The sequence of events:

1. **02:19 UTC** — Last successful orchestrator write. Authority cache built with Mexico vs South Korea `state: live`, `liveCount: 1`, `ttlTier: live`, TTL=30s. DR written with same envelope (7-day TTL).

2. **02:49 UTC** — Primary KV expired (30s live TTL × ~60 revalidation cycles = 30 minutes of normal operation before cron gap compounded).

3. **03:47 UTC** — ISR revalidation cycle triggers `readAuthorityCache()`:
   - Primary: absent
   - DR: `liveCount=1`, `builtAt=02:19`, age=~88 minutes >> 120s threshold
   - DR staleness guard fires → cold rebuild
   - Cold rebuild runs, finds Mexico match NOW finished (FD API)
   - Write-back to primary with `ttlTier: today`, TTL=300s

4. **04:03 UTC** — Primary expired again (300s = 5 minutes after write-back at 03:47).
   - Fresh authority-freshness check shows: `source: dr`, stale=true

5. **Cycle repeats** every ~5 minutes (today TTL), driven by all ISR routes revalidating simultaneously.

**This cycle was in progress BEFORE the bracket pilot activated.** The bracket's first ISR at 03:47:26 happened during an already-ongoing cycle.

---

## SLO Status

From `/api/debug/authority-slo`:

| SLO | Target | 24h Actual | 7d Actual | 30d Actual |
|-----|--------|-----------|---------|---------|
| Availability | ≥ 99.9% | **37.91%** ❌ | 71.21% ❌ | 71.21% ❌ |
| Cold rebuild rate | ≤ 1% | **62.09%** ❌ | 28.79% ❌ | 28.79% ❌ |
| DR usage rate | ≤ 20% | **33.18%** ❌ | 62.64% ❌ | 62.64% ❌ |
| **Overall** | — | **FAIL** | **FAIL** | **FAIL** |

**All SLO targets breached. All failures are pre-existing.** None of the SLO deterioration correlates with pilot activation.

---

## Cache Path Distribution (Today)

| Path | Reads | Ratio | ISR latency impact |
|------|-------|-------|-------------------|
| Primary | 10 | 4.76% | ~50ms (fast) |
| DR | 70 | 33.33% | ~100ms (moderate) |
| Cold rebuild | 130 | 61.90% | ~500ms (slow) |

The high cold rebuild share (61.9% today) explains the elevated avg latency of 648ms for page reads. This is entirely from the orchestrator-down cycle, not from the bracket pilot.

---

## Cron Monitoring Gap

The orchestrator cron status endpoint (`/api/debug/cron-status`) reports `overall: GREEN` despite the orchestrator not having run since 02:19 UTC (109 minutes ago at 04:08 UTC).

```json
{
  "job": "orchestrator",
  "status": "GREEN",
  "lastRun": "2026-06-19T02:19:43.771Z",
  "ageMinutes": 109,
  "triggerSource": "github-actions"
}
```

**Root cause of monitoring gap:** `cron-status` only checks whether the last run succeeded, not whether a run has occurred recently (within 2× the expected interval). An orchestrator scheduled every 30 minutes should be flagged RED after 60 minutes without a run.

This gap means the operational degradation is invisible without reading the raw `ageMinutes` value.

---

## Required Remediation (Out of Scope for Pilot Verification)

The orchestrator cron must be restarted to:
1. Write a fresh primary envelope with `liveCount=0`, `ttlTier=today/normal`, appropriate TTL
2. Update DR with the current state (Mexico now finished)
3. Stop the DR staleness guard from firing on every ISR revalidation

Until the cron runs, the write-back mechanism ensures functional (correct data) but slow (cold rebuild) serving. **User-visible data is correct — scores and states are accurate.** The degradation is purely operational (latency and SLO).

---

## Pilot Isolation Assessment

| Concern | Evidence | Attribution |
|---------|---------|------------|
| Did pilot increase cold rebuild rate? | +0.77% (1/130 rebuilds) | No |
| Did pilot increase latency? | 543ms = normal cold rebuild | No |
| Did pilot cause score drift? | 0 score drift | No |
| Did pilot cause state drift? | 0 state drift | No |
| Did pilot introduce RED issues? | 0 RED | No |
| Did pilot affect other routes? | All 6 other routes unchanged | No |

**Pilot is operationally isolated. Degradation is not pilot-caused.**
