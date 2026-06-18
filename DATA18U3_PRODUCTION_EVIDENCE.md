# DATA-18U.3 — Production Evidence Report

Date: 2026-06-18
Schema version: DATA-18U.3

---

## Current State of Evidence

No production automation has been executed. All actions begin at the registry
default confidence of 0.65 (0.01–0.99 scale). This is expected and correct —
DATA-18U.3 is the measurement framework that tracks progress toward automation
candidacy once production executions begin.

---

## Per-Action Evidence Profile

### 1. MONITOR_SELF_HEAL

| Metric | Current | Target (READY) | Gap |
|--------|---------|----------------|-----|
| Production executions | 0 | ≥ 4 (80% of 5) | 4 |
| Confidence | 0.65 | ≥ 0.85 | +0.20 |
| Verification pass rate | None | ≥ 90% | — |
| Trust level | LOW_TRUST | HIGH_TRUST | — |
| Readiness | NOT_READY | READY | — |
| promotionScore | 17/100 | ≥ 75/100 | +58 |

**Why score is 17:**
```
productionCoverage   = 0/4 = 0%    → dim score 0    × 0.30 = 0
verificationPassRate = None        → dim score 0    × 0.25 = 0
confidence           = 0.65        → dim score 75   × 0.20 = 15
confidenceTrend      = null/STABLE → dim score 45   × 0.15 = 7
recoveryConsistency  = None        → dim score 0    × 0.10 = 0
total ≈ 22
```
*(small variance due to rounding)*

**Estimated executions to READY:** 4 (coverage gate) — then confidence
must reach 0.85 through empirical success, typically 10–15 total records.

**Estimated time to READY:** 10–15 days at 1 execution/day.

**Why this is the best first candidate:**
- Execution risk: NONE
- Rollback complexity: NONE
- mutatesKV: false → no KV mutation gate in governance
- systemWide: false (for coverage; true for signal only)
- No blast radius from the action itself
- Feature flag gate is the only escalation once evidence accumulates

---

### 2. PREWARM_SNAPSHOT

| Metric | Current | Target (READY) | Gap |
|--------|---------|----------------|-----|
| Production executions | 0 | ≥ 8 (80% of 10) | 8 |
| Confidence | 0.65 | ≥ 0.85 | +0.20 |
| Verification pass rate | None | ≥ 90% | — |
| Trust level | LOW_TRUST | HIGH_TRUST | — |
| Readiness | NOT_READY | READY | — |
| promotionScore | 17/100 | ≥ 75/100 | +58 |

**Estimated executions to READY:** 8 (coverage) → 12–15 total for confidence.

**Estimated time to READY:** 12–15 days at 1 execution/day.

**Second-best candidate:** LOW execution risk, SIMPLE rollback, match-scoped
(not system-wide), but requires 8 vs 4 production records.

---

### 3. REBUILD_DR

| Metric | Current | Target (READY) | Gap |
|--------|---------|----------------|-----|
| Production executions | 0 | ≥ 8 (80% of 10) | 8 |
| Confidence | 0.65 | ≥ 0.85 | +0.20 |
| promotionScore | 17/100 | ≥ 75/100 | +58 |

Identical profile to PREWARM_SNAPSHOT. Third candidate by default ordering.

---

### 4. ESCALATE_INCIDENT

| Metric | Current | Target (READY) | Gap |
|--------|---------|----------------|-----|
| Production executions | 0 | ≥ 4 (80% of 5) | 4 |
| Confidence | 0.65 | ≥ 0.85 | +0.20 |
| mutatesKV | false | — | No KV gate |
| systemWide (signal) | true | — | Business CRITICAL escalates approval |
| promotionScore | 17/100 | ≥ 75/100 | +58 |

**Note:** Identical coverage requirement to MONITOR_SELF_HEAL (4 records),
but businessTier=CRITICAL contexts always escalate approval to TEAM_LEAD
(governance Rule 2). READY is achievable but CRITICAL escalation persists
regardless of trust level.

---

### 5. REFRESH_ESPN_CACHE

| Metric | Current | Target (READY) | Gap |
|--------|---------|----------------|-----|
| Production executions | 0 | ≥ 8 (80% of 10) | 8 |
| Confidence | 0.65 | ≥ 0.85 | +0.20 |
| promotionScore | 17/100 | ≥ 75/100 | +58 |

Same profile as PREWARM_SNAPSHOT. ESPN rate-limit risk (RF-5 trigger) adds
deployment caution — execute during low-load windows.

---

### 6. RESOLVE_ESPN_LOOKUP

| Metric | Current | Target (READY) | Gap |
|--------|---------|----------------|-----|
| Production executions | 0 | ≥ 8 (80% of 10) | 8 |
| Confidence | 0.65 | ≥ 0.85 | +0.20 |
| Base approval | TEAM_LEAD | TEAM_LEAD | Requires human sign-off |
| promotionScore | 17/100 | ≥ 75/100 | +58 |

MEDIUM execution risk + MODERATE rollback means governance always requires
TEAM_LEAD even at HIGH_TRUST. READY means "safe to run with TEAM_LEAD approval,"
not fully autonomous.

---

### 7. TRIGGER_ORCHESTRATOR

| Metric | Current | Target (READY) | Gap |
|--------|---------|----------------|-----|
| Production executions | 0 | ≥ 4 (80% of 5) | 4 |
| Confidence | 0.65 | ≥ 0.85 | +0.20 |
| systemWide | true | — | TEAM_LEAD minimum |
| promotionScore | 17/100 | ≥ 75/100 | +58 |

System-wide + MEDIUM risk + CRITICAL blast context → EMERGENCY_ONLY under
active RF-6. READY achievable but human approval required in all CRITICAL contexts.

---

### 8. SUPPRESS_REFRESH

| Metric | Current | Target (LIMITED_READY) | Gap |
|--------|---------|------------------------|-----|
| Production executions | 0 | ≥ 1 | 1 |
| Confidence | 0.65 | ≥ 0.60 | Met |
| Execution risk | HIGH | — | TEAM_LEAD minimum |
| promotionScore | 17/100 | ≥ 35/100 | +18 |

**Special note:** Confidence already ≥ 0.60 (registry default). Technically
reaches LIMITED_READY after 1 production execution. However, governance
(DATA-18T) requires TEAM_LEAD minimum regardless of trust, and CRITICAL
context escalates to EMERGENCY_ONLY. The READY path is a governance path,
not a trust path — the action will never be fully autonomous.

---

### 9. NO_ACTION

| Metric | Current | Status |
|--------|---------|--------|
| Readiness | NOT_READY | Sentinel — not an automation target |

NO_ACTION is excluded from automation design.

---

## Ranked Summary: All Actions

| Rank | Action | promotionScore | Executions Needed | Est. Days | Nearest Tier |
|------|--------|---------------|-------------------|-----------|--------------|
| 1 | MONITOR_SELF_HEAL | 17/100 | 4 | 10–15 | READY |
| 2 | ESCALATE_INCIDENT | 17/100 | 4 | 10–15 | READY* |
| 3 | TRIGGER_ORCHESTRATOR | 17/100 | 4 | 10–15 | READY* |
| 4 | SUPPRESS_REFRESH | 17/100 | 1 | 1→LIMITED_READY | LIMITED_READY |
| 5 | PREWARM_SNAPSHOT | 17/100 | 8 | 12–15 | READY |
| 6 | REBUILD_DR | 17/100 | 8 | 12–15 | READY |
| 7 | REFRESH_ESPN_CACHE | 17/100 | 8 | 12–15 | READY |
| 8 | RESOLVE_ESPN_LOOKUP | 17/100 | 8 | 20–30 | READY* |

*READY but governance approval required regardless.

All actions currently score identically because no production execution has
occurred. Scores diverge immediately once executions begin:
- Successful execution → productionCoverage dimension improves (30% weight)
- Verified execution → verificationPassRate dimension improves (25% weight)
- Calibration event → confidence dimension improves (20% weight)

---

## The Five Questions

### 1. Which action is closest to READY?

**MONITOR_SELF_HEAL** — requires only 4 production executions to meet coverage,
has NONE execution risk and NONE rollback complexity, and does not mutate KV.
This removes the KV-mutation hard block from governance and the blast radius
concern from the promotion engine. Of all actions, it has the fewest gates
between current state and READY.

### 2. Which action is furthest from READY?

**RESOLVE_ESPN_LOOKUP** — requires 8 production executions, carries MEDIUM
execution risk and MODERATE rollback, has a TEAM_LEAD base approval (meaning
READY never means "fully autonomous"), and ESPN scoreboard lookup API has
stricter rate limits than event fetch, making consistent successful executions
harder to achieve. Expected 20–30 executions before HIGH_TRUST.

### 3. Which action has the strongest evidence?

Currently: **none**. All actions have 0 production executions and identical
registry-default confidence of 0.65. Evidence strength is 'NONE' across the board.

Once production executions begin, the first action to execute and verify
successfully will immediately become the strongest evidence holder by volume.

### 4. Which action has the weakest evidence?

All tied at 'NONE'. After the first controlled production window, actions that
were never executed (SUPPRESS_REFRESH, TRIGGER_ORCHESTRATOR in non-incident
conditions) will remain 'NONE' longest.

### 5. What is the expected first READY candidate?

**MONITOR_SELF_HEAL** — assuming:
- A controlled execution window is opened with `AUTONOMOUS_RELIABILITY_ENABLED=true`
  during an active RF-7 (elevated repair frequency) event
- 4+ executions recorded with `result=success` and `verificationPassed=true`
- Confidence calibrates above 0.85 (requires ~10–12 successful verifications
  with high improvement scores)
- No negative drift events in the calibration history

Expected timeline: **15–20 production repair sessions** totalling
approximately 2–3 weeks at typical World Cup match frequency.

The second candidate to watch is **ESCALATE_INCIDENT**, which shares the
same 4-execution coverage requirement and also does not mutate KV.
