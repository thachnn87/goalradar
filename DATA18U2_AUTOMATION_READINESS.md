# DATA-18U.2 — Automation Readiness Report

Date: 2026-06-18
Schema version: DATA-18U.2
Feature flag: `AUTONOMOUS_RELIABILITY_ENABLED=false` (default)

---

## Summary

| Action | Trust Level | Confidence | Prod Coverage | Verify Rate | Readiness |
|--------|------------|-----------|---------------|-------------|-----------|
| PREWARM_SNAPSHOT | LOW_TRUST | 0.65* | 0% | None | NOT_READY |
| REBUILD_DR | LOW_TRUST | 0.65* | 0% | None | NOT_READY |
| REFRESH_ESPN_CACHE | LOW_TRUST | 0.65* | 0% | None | NOT_READY |
| RESOLVE_ESPN_LOOKUP | LOW_TRUST | 0.65* | 0% | None | NOT_READY |
| SUPPRESS_REFRESH | LOW_TRUST | 0.65* | 0% | None | NOT_READY |
| TRIGGER_ORCHESTRATOR | LOW_TRUST | 0.65* | 0% | None | NOT_READY |
| MONITOR_SELF_HEAL | LOW_TRUST | 0.65* | 0% | None | NOT_READY |
| ESCALATE_INCIDENT | LOW_TRUST | 0.65* | 0% | None | NOT_READY |
| NO_ACTION | LOW_TRUST | 0.65* | 0% | None | NOT_READY |

*Registry default (0.65) — no production execution history yet.

**All actions: NOT_READY**

This is correct and expected. DATA-18U.2 is a measurement system built before
any production automation exists. Every action starts at LOW_TRUST because no
live execution data has yet been collected. This report will evolve as the system
accumulates production evidence.

---

## Readiness States

| State | Requirements |
|-------|-------------|
| **READY** | HIGH_TRUST + production evidence exists |
| **LIMITED_READY** | MEDIUM_TRUST (confidence ≥ 60%) + any production evidence |
| **NOT_READY** | LOW_TRUST OR zero production evidence |

**Critical constraint:** No action may be marked READY without:
1. `trustLevel = HIGH_TRUST` (confidence ≥ 0.85, coverage ≥ 80%, verify ≥ 90%)
2. At least one live production execution recorded

---

## Per-Action Analysis

### PREWARM_SNAPSHOT

**Readiness: NOT_READY**

| Metric | Current | Required for READY |
|--------|---------|-------------------|
| Confidence | 0.65 (default) | ≥ 0.85 |
| Production records | 0 | ≥ 8 (80% of 10 required) |
| Verify pass rate | None | ≥ 90% |
| Drift | No history | Stable or POSITIVE |

**Path to READY:**
1. Execute PREWARM_SNAPSHOT in production during a controlled window
2. Accumulate ≥ 8 production records with verification enabled
3. Maintain ≥ 85% success rate + ≥ 90% verification pass rate
4. Observe stable or POSITIVE confidence drift over ≥ 3 snapshots

**Risk assessment:** LOW execution risk. Single-match scoped. SIMPLE rollback.
This is the most natural first candidate for LIMITED_READY once evidence exists.

---

### REBUILD_DR

**Readiness: NOT_READY**

| Metric | Current | Required for READY |
|--------|---------|-------------------|
| Confidence | 0.65 (default) | ≥ 0.85 |
| Production records | 0 | ≥ 8 (80% of 10 required) |
| Verify pass rate | None | ≥ 90% |

**Path to READY:** Same pattern as PREWARM_SNAPSHOT.

**Risk assessment:** LOW execution risk. SIMPLE rollback (delete DR key).
Second natural candidate after PREWARM_SNAPSHOT.

---

### REFRESH_ESPN_CACHE

**Readiness: NOT_READY**

| Metric | Current | Required for READY |
|--------|---------|-------------------|
| Confidence | 0.65 (default) | ≥ 0.85 |
| Production records | 0 | ≥ 8 (80% of 10 required) |

**Path to READY:** As above. Carry risk: ESPN rate limits may trigger RF-5 during
high-frequency refresh cycles. Verify rate safety before automation.

---

### RESOLVE_ESPN_LOOKUP

**Readiness: NOT_READY**

| Metric | Current | Required for READY |
|--------|---------|-------------------|
| Confidence | 0.65 (default) | ≥ 0.85 |
| Base approval | TEAM_LEAD | TEAM_LEAD must grant runtime approval |
| Production records | 0 | ≥ 8 |

**Path to READY:** High bar. MEDIUM execution risk + MODERATE rollback means
governance will require TEAM_LEAD even at HIGH_TRUST. LIMITED_READY is achievable
with ≥ 5 production records + 60% confidence; READY requires full HIGH_TRUST.

---

### SUPPRESS_REFRESH

**Readiness: NOT_READY — elevated gate**

| Metric | Current | Required for READY |
|--------|---------|-------------------|
| Confidence | 0.65 (default) | ≥ 0.85 |
| Execution risk | HIGH | Requires TEAM_LEAD base + escalation on CRITICAL context |
| System-wide | Yes | TEAM_LEAD minimum regardless of trust |
| Production records | 0 | ≥ 4 (80% of 5 required) |

**Why this will never reach AUTO_APPROVED alone:**
SUPPRESS_REFRESH has `executionRisk=HIGH` and `systemWide=true`. Governance
(DATA-18T) always escalates to minimum TEAM_LEAD regardless of confidence.
Under CRITICAL business/blast context, it escalates to EMERGENCY_ONLY.

**Path to LIMITED_READY:** Accumulate ≥ 4 production records + reach 60% confidence.
**Path to READY:** HIGH_TRUST achieved + TEAM_LEAD explicit runtime approval (not feature flag alone).

---

### TRIGGER_ORCHESTRATOR

**Readiness: NOT_READY — system-wide gate**

| Metric | Current | Required for READY |
|--------|---------|-------------------|
| Confidence | 0.65 (default) | ≥ 0.85 |
| System-wide | Yes | TEAM_LEAD minimum |
| Production records | 0 | ≥ 4 (80% of 5 required) |

Same system-wide constraint as SUPPRESS_REFRESH. READY requires HIGH_TRUST + TEAM_LEAD approval.

---

### MONITOR_SELF_HEAL

**Readiness: NOT_READY → nearest to LIMITED_READY**

| Metric | Current | Required for READY |
|--------|---------|-------------------|
| Confidence | 0.65 (default) | ≥ 0.85 |
| Execution risk | NONE | No execution cost penalty |
| MutatesKV | No | No KV mutation gate |
| Production records | 0 | ≥ 4 (80% of 5 required) |

**Why this is the best near-term candidate:**
Read-only action. Zero execution cost. Zero rollback cost. Feature flag
is the only gate once confidence reaches AUTO approval level. With ≥ 4
production records and ≥ 60% confidence, this immediately reaches LIMITED_READY.
With ≥ 85% confidence + coverage, it reaches READY.

**Path to LIMITED_READY:** Accumulate ≥ 4 repair records marked
`action=MONITOR_SELF_HEAL`, ensure confidence ≥ 0.60.

---

### ESCALATE_INCIDENT

**Readiness: NOT_READY → second nearest**

| Metric | Current | Required for READY |
|--------|---------|-------------------|
| Confidence | 0.65 (default) | ≥ 0.85 |
| MutatesKV | No | No KV mutation gate |
| System-wide | Yes (alert signal) | No TEAM_LEAD gate from system-wide alone (mutatesKV=false) |
| Production records | 0 | ≥ 4 |

**Risk note:** businessTier=CRITICAL escalates to TEAM_LEAD (governance Rule 2).
Pure observation + signal — no KV data changed. READY achievable but CRITICAL
context events will always go to TEAM_LEAD regardless.

---

### NO_ACTION

**Readiness: NOT_READY (trivially)**

NO_ACTION is a sentinel for "system is healthy." It is never executed as an
automation target. Excluded from future DATA-18V automation design.

---

## What Needs to Happen Before Any Action Becomes READY

### Step 1 — First production executions (flag=true controlled window)
Enable `AUTONOMOUS_RELIABILITY_ENABLED=true` for a controlled window with
a TEAM_LEAD present. Allow the system to execute 1–3 repair actions per
action type and record results as `RepairRecordV2`.

### Step 2 — Verification coverage
Ensure each repair execution triggers a verification pass
(`verificationPassed` field set on the repair record). Target ≥ 30%
verification coverage to exit REVIEW gate.

### Step 3 — Confidence calibration convergence
After ≥ 5 production records per action, the calibration engine has
sufficient damping-adjusted signal to move confidence away from the 0.65
default. Actions with consistent success will climb toward 0.80+.

### Step 4 — Drift stabilisation
After ≥ 3 confidence history snapshots (minimum 3 days with calibration
events), drift detection activates. POSITIVE drift is required — NEGATIVE
drift blocks READY regardless of point-in-time confidence.

### Step 5 — HIGH_TRUST gate
Once confidence ≥ 0.85, productionCoverage ≥ 80%, and verificationPassRate
≥ 90% for an action, it classifies as HIGH_TRUST. With production evidence,
it immediately becomes READY.

---

## Projected Readiness Timeline (baseline estimate)

| Action | Est. records to LIMITED_READY | Est. records to READY |
|--------|-------------------------------|----------------------|
| MONITOR_SELF_HEAL | 4 | 10–15 |
| PREWARM_SNAPSHOT | 5 | 12–15 |
| REBUILD_DR | 5 | 12–15 |
| ESCALATE_INCIDENT | 4 | 15–20 |
| REFRESH_ESPN_CACHE | 5 | 15–20 |
| RESOLVE_ESPN_LOOKUP | 5 | 20–30 |
| TRIGGER_ORCHESTRATOR | 4 | 25–40 (TEAM_LEAD approval still required) |
| SUPPRESS_REFRESH | 4 | Never AUTO — always TEAM_LEAD+ |

---

## Governance Integration

This readiness report feeds directly into DATA-18T governance:
- `trustLevel` is used by the approval matrix as context
- `automationReadiness=READY` signals that governance may grant AUTO approval
  when `AUTONOMOUS_RELIABILITY_ENABLED=true`
- `automationReadiness=NOT_READY` means governance will BLOCK regardless of
  priority score or business impact

The trust framework is the DATA-18V gate. DATA-18V Controlled Automation
must not proceed until ≥ 1 action reaches READY.
