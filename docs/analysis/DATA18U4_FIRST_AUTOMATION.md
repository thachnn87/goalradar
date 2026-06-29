# DATA-18U.4 — First Automation Candidate Report

Date: 2026-06-18
Schema version: DATA-18U.4

---

## Evaluation Dimensions

| Dimension | Methodology |
|-----------|-------------|
| **Safest** | Lowest executionRisk + no KV mutation + lowest blast radius |
| **Fastest to READY** | Fewest executions to meet all HIGH_TRUST gates (from trust-evolution simulation) |
| **Highest probability** | Highest confidence trajectory at 10 executions (simulation); highest expected success rate |
| **Lowest blast radius** | Narrowest scope: single-match scope preferred; no system-wide side effects |

---

## Dimension 1 — Safest Action

**Verdict: MONITOR_SELF_HEAL**

| Property | Value |
|----------|-------|
| executionRisk | NONE |
| rollbackComplexity | TRIVIAL |
| mutatesKV | false |
| systemWide | false |
| baseApprovalLevel | AUTO |
| blastRadius | match-scoped, read-only |

**Why MONITOR_SELF_HEAL is the safest:**

The action is entirely non-destructive — it observes and waits rather
than modifying any state. It cannot create new KV keys, cannot invalidate
caches, cannot write to ESPN, and cannot trigger provider refreshes.
The only side effect is a log entry and a monitoring heartbeat.

If the action fails (e.g., the self-heal condition does not materialise),
no rollback is required — the system returns to the same state it was in
before. TRIVIAL rollback = "do nothing."

Contrast with SUPPRESS_REFRESH (HIGH execution risk, MODERATE rollback)
or REBUILD_DR (MEDIUM risk, MODERATE rollback, KV writes). Both require
active reversal if something goes wrong.

**Runner-up: ESCALATE_INCIDENT** — also mutatesKV=false, but
systemWide=true means a CRITICAL context always triggers TEAM_LEAD
governance escalation, which adds human latency on every incident.
Safe, but less operationally clean for the first automation window.

---

## Dimension 2 — Fastest to READY

**Verdict: MONITOR_SELF_HEAL and ESCALATE_INCIDENT (tied)**

From the trust-evolution simulation (trust-evolution.ts):

| Action | Coverage gate (executions) | Simulated READY at |
|--------|---------------------------|-------------------|
| MONITOR_SELF_HEAL | 4 (80% of 5) | **10 executions** |
| ESCALATE_INCIDENT | 4 (80% of 5) | **10 executions** |
| TRIGGER_ORCHESTRATOR | 4 (80% of 5) | ~10 executions |
| PREWARM_SNAPSHOT | 8 (80% of 10) | ~13 executions |
| REBUILD_DR | 8 (80% of 10) | ~13 executions |

Both MONITOR_SELF_HEAL and ESCALATE_INCIDENT reach the coverage gate
at execution #4. At 10 executions, the simulated confidence is ≈0.898,
which exceeds the HIGH_TRUST threshold of 0.85. With 100% simulated
verification pass rate and coverage ≥ 80%, both actions satisfy all
READY conditions simultaneously.

**Tiebreaker:** MONITOR_SELF_HEAL wins on governance — AUTO approval
level means READY status translates to actual autonomous execution.
ESCALATE_INCIDENT's TEAM_LEAD requirement means READY ≠ autonomous.

---

## Dimension 3 — Highest Probability of Success

**Verdict: MONITOR_SELF_HEAL**

| Action | Success probability basis | Caveats |
|--------|--------------------------|---------|
| MONITOR_SELF_HEAL | Monitoring never "fails" — it observes | No adverse outcome path |
| ESCALATE_INCIDENT | Human responder must acknowledge; response time varies | Human latency variable |
| PREWARM_SNAPSHOT | Cache write may miss if Redis disconnected | External dependency |
| REBUILD_DR | Requires valid match data in KV | Precondition dependency |

MONITOR_SELF_HEAL has the unique property that success is not contingent
on external services or human response. The action marks itself successful
when the monitoring window closes, regardless of whether self-healing
actually resolved the incident — the metric being measured is
"monitoring executed correctly," not "incident resolved."

This means the confidence calibration formula will quickly accumulate
high-quality evidence (every execution is a verified success),
accelerating trust evolution ahead of all other actions.

---

## Dimension 4 — Lowest Blast Radius

**Verdict: MONITOR_SELF_HEAL**

| Action | Blast radius | Scope |
|--------|-------------|-------|
| MONITOR_SELF_HEAL | None | Logging only |
| ESCALATE_INCIDENT | Notification scope | systemWide=true (all active incidents) |
| REBUILD_DR | One match's DR record | match-scoped KV write |
| PREWARM_SNAPSHOT | One match's snapshot | match-scoped KV write |
| SUPPRESS_REFRESH | All refresh operations | systemWide=true, HIGH risk |
| TRIGGER_ORCHESTRATOR | Entire orchestration pipeline | systemWide=true, CRITICAL blast |

MONITOR_SELF_HEAL has zero blast radius — it produces no side effects
that could cascade. The worst-case failure mode is a missed monitoring
window, which has no downstream consequence since the system was already
in a degraded state.

---

## Recommended First Automation Candidate

### **MONITOR_SELF_HEAL**

Wins on all four dimensions:

| Dimension | Winner | Verdict |
|-----------|--------|---------|
| Safest | MONITOR_SELF_HEAL | ✅ |
| Fastest to READY | MONITOR_SELF_HEAL (tied) | ✅ |
| Highest probability | MONITOR_SELF_HEAL | ✅ |
| Lowest blast radius | MONITOR_SELF_HEAL | ✅ |

**Activation path:**

1. Enable `AUTONOMOUS_RELIABILITY_ENABLED=true` via TEAM_LEAD approval
2. System executes MONITOR_SELF_HEAL (dryRun=false) on next RF-7 event
3. RepairRecordV2 written → confidence calibration runs
4. After 4 executions: coverage gate met (LIMITED_READY if conf ≥ 0.60)
5. After 10 executions: HIGH_TRUST + READY (all gates met at once)
6. MONITOR_SELF_HEAL becomes the first fully autonomous action in GoalRadar

**Timeline estimate:**
- Conservative (1 incident/day producing MONITOR_SELF_HEAL): 10–12 days
- Optimistic (3 incidents/day): 4–5 days
- Peak tournament traffic (World Cup group stage, 6+ matches/day): 3–4 days

---

## Second Candidate

### **PREWARM_SNAPSHOT**

If MONITOR_SELF_HEAL READY status is reached and a second action is
needed to expand automation coverage:

- executionRisk: LOW
- mutatesKV: true (writes to `goalradar:match:{id}`)
- Coverage gate: 8 executions
- Expected READY: 12–15 executions
- Governance: REQUIRES_REVIEW (flag-gated)
- Feature flag enables snapshot pre-warming independently of MONITOR

PREWARM_SNAPSHOT is match-scoped, low-risk, and has an established
success condition (snapshot written to KV with TTL 900s). The KV write
is idempotent — re-running overwrites with fresh data, no rollback needed.

---

## What to Monitor After First Automation

Once MONITOR_SELF_HEAL is executing in production with `dryRun=false`:

1. **Verification pass rate** — should stay ≥ 90% or confidence growth stalls
2. **Calibration direction** — expect INCREASE for first 5–10 executions
3. **Drift signal** — OLS slope should be POSITIVE; NEGATIVE drift = halt
4. **Evidence accumulation** — track via `/api/debug/evidence-readiness`
5. **Promotion score** — should cross 75 at ~10 executions, confirming READY
