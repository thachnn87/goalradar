# DATA-18U.4 — Evidence Gap Analysis

Date: 2026-06-18
Schema version: DATA-18U.4

All actions currently have **0 production executions** and **registry-default confidence (0.65)**.
Evidence strength is **NONE** across the board.

Promotion thresholds (from trust-framework.ts — authoritative, do not modify independently):

| Gate | Threshold |
|------|-----------|
| Confidence — LIMITED_READY | ≥ 0.60 |
| Confidence — READY (HIGH_TRUST) | ≥ 0.85 |
| Production coverage — READY | ≥ 80% of `productionCoverageRequired` |
| Verification pass rate — READY | ≥ 0.90 |
| Production evidence — any tier | ≥ 1 execution |

---

## Ranked: Easiest → Hardest to READY

### Rank 1 — MONITOR_SELF_HEAL

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Production executions | 0 | ≥ 4 (80% of 5) | **4** |
| Confidence | 0.650 | ≥ 0.850 | **+0.200** |
| Verification pass rate | None | ≥ 90% | **needs data** |
| promotionScore | 17 | ≥ 75 | **+58** |
| progressPercent | 10% | 100% | **90%** |

**Why easiest:**
- Coverage gate = 4 (lowest of all actions needing coverage)
- `executionRisk = NONE` — no blast, no KV mutation gate, no rollback
- `mutatesKV = false` — avoids the KV-mutation hard block in governance
- `baseApprovalLevel = AUTO` — feature flag is the only escalation
- Simulated confidence at 4 executions: **0.780** → near LIMITED_READY threshold
- Simulated confidence at 10 executions: **0.898** → crosses HIGH_TRUST

**Estimated executions to LIMITED_READY:** 3  
**Estimated executions to READY:** 10–12  
**Estimated calendar days (1/day):** 10–12  
**Estimated calendar days (3/day):** 4–5

---

### Rank 2 — ESCALATE_INCIDENT

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Production executions | 0 | ≥ 4 (80% of 5) | **4** |
| Confidence | 0.650 | ≥ 0.850 | **+0.200** |
| Verification pass rate | None | ≥ 90% | **needs data** |
| promotionScore | 17 | ≥ 75 | **+58** |

**Why second:**
- Identical coverage requirement (4 executions) to MONITOR_SELF_HEAL
- `mutatesKV = false` — no KV mutation gate
- **Difference vs Rank 1:** `systemWide = true` means CRITICAL business context
  always escalates approval to TEAM_LEAD (governance Rule 2); READY ≠ autonomous

**Estimated executions to READY:** 10–12  
**Estimated calendar days:** 10–12

---

### Rank 3 — SUPPRESS_REFRESH (LIMITED_READY only)

| Metric | Current | Target (LIMITED_READY) | Gap |
|--------|---------|------------------------|-----|
| Production executions | 0 | ≥ 1 | **1** |
| Confidence | 0.650 | ≥ 0.60 | **Met** |

**Note:** Confidence already meets LIMITED_READY threshold. One production
execution achieves LIMITED_READY. However:
- `executionRisk = HIGH` → minimum TEAM_LEAD in governance
- `systemWide = true` → additional TEAM_LEAD escalation
- CRITICAL blast/business context → EMERGENCY_ONLY approval
- **Will never become fully autonomous** — governance permanently requires human approval

**Estimated executions to LIMITED_READY:** 1  
**Estimated executions to READY:** ~12+ (HIGH_TRUST achievable but governance always TEAM_LEAD+)

---

### Rank 4 — TRIGGER_ORCHESTRATOR

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Production executions | 0 | ≥ 4 (80% of 5) | **4** |
| Confidence | 0.650 | ≥ 0.850 | **+0.200** |
| System-wide | Yes | — | TEAM_LEAD minimum |

**Why rank 4:** Same coverage requirement as MONITOR_SELF_HEAL but `systemWide=true`
and CRITICAL blast context makes governance more restrictive.

**Estimated executions to READY:** 10–12 (with TEAM_LEAD approval)

---

### Rank 5 — PREWARM_SNAPSHOT

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Production executions | 0 | ≥ 8 (80% of 10) | **8** |
| Confidence | 0.650 | ≥ 0.850 | **+0.200** |
| Verification pass rate | None | ≥ 90% | **needs data** |

Higher coverage gate (8 vs 4). Otherwise identical risk profile to MONITOR_SELF_HEAL.

**Estimated executions to READY:** 12–15

---

### Rank 6 — REBUILD_DR

Identical profile to PREWARM_SNAPSHOT. Coverage gate = 8.

**Estimated executions to READY:** 12–15

---

### Rank 7 — REFRESH_ESPN_CACHE

Coverage gate = 8. Additional risk: ESPN rate-limit during high-volume refresh
may trigger RF-5, reducing success rate and slowing confidence accumulation.

**Estimated executions to READY:** 15–20

---

### Rank 8 — RESOLVE_ESPN_LOOKUP

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Production executions | 0 | ≥ 8 (80% of 10) | **8** |
| Base approval | TEAM_LEAD | TEAM_LEAD | Requires human approval |
| Execution risk | MEDIUM | — | Stricter escalation path |

**Why hardest:** MEDIUM execution risk + MODERATE rollback + TEAM_LEAD base
approval + stricter ESPN rate limits = highest bar for consistent evidence.
Partial resolution (ESPN has no mapping for some match IDs) makes 100% success
rate hard to achieve, requiring larger sample sizes for confidence convergence.

**Estimated executions to READY:** 20–30 (with TEAM_LEAD approval)

---

### Rank 9 — NO_ACTION (excluded)

Not an automation target.

---

## Summary Table

| Rank | Action | Execs to Gate | Execs to READY | Est. Days | Notes |
|------|--------|--------------|----------------|-----------|-------|
| 1 | MONITOR_SELF_HEAL | 4 | 10–12 | 10–12 | No KV, no risk |
| 2 | ESCALATE_INCIDENT | 4 | 10–12 | 10–12 | TEAM_LEAD in CRITICAL |
| 3 | SUPPRESS_REFRESH | 1→LIMITED | ~12 | 1→LIMITED | Never fully autonomous |
| 4 | TRIGGER_ORCHESTRATOR | 4 | 10–12 | 10–12 | TEAM_LEAD always |
| 5 | PREWARM_SNAPSHOT | 8 | 12–15 | 12–15 | Low risk, match-scoped |
| 6 | REBUILD_DR | 8 | 12–15 | 12–15 | Match-scoped |
| 7 | REFRESH_ESPN_CACHE | 8 | 15–20 | 15–20 | ESPN rate-limit risk |
| 8 | RESOLVE_ESPN_LOOKUP | 8 | 20–30 | 20–30 | TEAM_LEAD, hard success rate |

---

## What "evidence" means in practice

Evidence is not collected by design or declaration — it is produced as a
**side effect of the system self-healing during real incidents**. The path
to GREEN is:

1. A genuine reliability event fires (RF-7 elevated repair frequency)
2. TEAM_LEAD enables `AUTONOMOUS_RELIABILITY_ENABLED=true` for the window
3. System executes the recommended action with `dryRun=false`
4. RepairRecordV2 is written to `goalradar:repair:history`
5. Verification pass is recorded (`verificationPassed=true`)
6. Confidence calibration runs → `confidence-history` updated
7. Repeat ×10 → MONITOR_SELF_HEAL reaches HIGH_TRUST → READY
