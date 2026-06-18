# DATA-18T — Reliability Governance Layer

Date: 2026-06-18
Feature flag: `AUTONOMOUS_RELIABILITY_ENABLED=false` (default)
Schema version: `DATA-18T`

---

## Architecture Overview

```
DATA-18S Reliability Decision Engine
         │
         ▼
src/lib/action-governance.ts   ← Phase 1: Action Risk Registry (per-action static properties)
src/lib/action-value.ts        ← Phase 2: Benefit/Cost Analysis
src/lib/approval-matrix.ts     ← Phase 3+4: Approval Matrix + Execution Readiness
         │
         └──► /api/debug/reliability-governance  ← Phase 5: Governance Dashboard
```

All components are **additive** — zero existing files modified.
All operations are **read-only** (no KV writes, no automatic execution).

---

## Phase 1 — Action Risk Registry (`src/lib/action-governance.ts`)

### Registry entries

| Action | ExecutionRisk | RollbackComplexity | BaseApproval | LowEvidenceApproval | MutatesKV | SystemWide |
|--------|--------------|-------------------|-------------|--------------------|-----------| -----------|
| PREWARM_SNAPSHOT | LOW | SIMPLE | AUTO | TEAM_LEAD | Yes | No |
| REBUILD_DR | LOW | SIMPLE | AUTO | TEAM_LEAD | Yes | No |
| REFRESH_ESPN_CACHE | LOW | SIMPLE | AUTO | TEAM_LEAD | Yes | No |
| RESOLVE_ESPN_LOOKUP | MEDIUM | MODERATE | TEAM_LEAD | ADMIN | Yes | No |
| SUPPRESS_REFRESH | HIGH | MODERATE | TEAM_LEAD | ADMIN | Yes | Yes |
| TRIGGER_ORCHESTRATOR | MEDIUM | MODERATE | TEAM_LEAD | ADMIN | Yes | Yes |
| MONITOR_SELF_HEAL | NONE | NONE | AUTO | AUTO | No | No |
| ESCALATE_INCIDENT | LOW | NONE | AUTO | AUTO | No | Yes |
| NO_ACTION | NONE | NONE | AUTO | AUTO | No | No |

### Production coverage requirements

| Action | Min production records for AUTO approval |
|--------|------------------------------------------|
| SUPPRESS_REFRESH | 5 |
| TRIGGER_ORCHESTRATOR | 5 |
| MONITOR_SELF_HEAL | 5 |
| ESCALATE_INCIDENT | 5 |
| PREWARM_SNAPSHOT | 10 |
| REBUILD_DR | 10 |
| REFRESH_ESPN_CACHE | 10 |
| RESOLVE_ESPN_LOOKUP | 10 |

---

## Phase 2 — Benefit/Cost Analysis (`src/lib/action-value.ts`)

### Formula

```
expectedBenefit   = priorityScore/100 × 0.50 + bizTierScore × 0.30 + blastTierScore × 0.20
executionCost     = executionRiskRank/4 × 0.70 + rollbackCost × 0.30
riskAdjustedValue = expectedBenefit × evidenceMultiplier × confidence
netDecisionValue  = riskAdjustedValue − executionCost      (range: −1..+1)
```

### Tier/score mappings

| BusinessTier | Score | BlastTier | Score | EvidenceQuality | Multiplier |
|-------------|-------|-----------|-------|----------------|-----------|
| CRITICAL | 1.00 | CRITICAL | 1.00 | HIGH | 1.00 |
| HIGH | 0.75 | HIGH | 0.75 | MEDIUM | 0.75 |
| MEDIUM | 0.45 | MEDIUM | 0.45 | LOW | 0.50 |
| LOW | 0.20 | LOW | 0.20 | | |

### Verdict thresholds

| NetDecisionValue | Verdict |
|-----------------|---------|
| ≥ 0.40 | STRONGLY_RECOMMENDED |
| 0.10 – 0.39 | RECOMMENDED |
| −0.05 – 0.09 | MARGINAL |
| < −0.05 | NOT_RECOMMENDED |

---

## Phase 3 — Approval Matrix (`src/lib/approval-matrix.ts`)

### Escalation rules (additive — each rule can escalate one tier)

| Rule | Condition | Effect |
|------|-----------|--------|
| 1 | Evidence quality LOW | Use lowEvidenceApprovalLevel |
| 2 | Business tier CRITICAL | +1 tier |
| 3 | Blast tier CRITICAL | +1 tier |
| 4 | Execution risk HIGH/CRITICAL | Minimum TEAM_LEAD |
| 5 | MutatesKV + systemWide | Minimum TEAM_LEAD |
| 6 | NetDecisionValue ≤ 0 | Minimum ADMIN |
| 7 | Feature flag=false + level=AUTO | Escalate to TEAM_LEAD |

### Approval levels

| Level | Meaning |
|-------|---------|
| AUTO | System may execute when flag=true and readiness=READY |
| TEAM_LEAD | Engineering team lead must review before execution |
| ADMIN | Platform admin or senior SRE must approve |
| EMERGENCY_ONLY | Only during declared incidents with explicit sign-off |

---

## Phase 4 — Execution Readiness

### BLOCKED conditions (any one suffices)

- Approval level = EMERGENCY_ONLY
- `productionCoverage = 0` AND `mutatesKV = true`
- Evidence LOW AND mutatesKV AND systemWide
- `netDecisionValue < −0.20`

### REVIEW conditions (all non-blocked, any one suffices)

- Evidence quality LOW
- Approval level ADMIN or TEAM_LEAD
- NetDecisionValue between −0.20 and 0
- verificationCoverage < 30%
- Confidence < 40%

### READY condition

All of the above gates pass with no review triggers.

---

## Phase 5 — `/api/debug/reliability-governance`

### Response buckets

```json
{
  "summary": {
    "total": 3,
    "autoApproved": 1,
    "requiresReview": 1,
    "blocked": 1
  },
  "autoApproved": [
    {
      "action": "MONITOR_SELF_HEAL",
      "tier": "AUTO_APPROVED",
      "approval": { "requiredLevel": "AUTO", "flagSufficient": false },
      "readiness": { "status": "READY", "reasons": ["All governance gates passed"] },
      "benefitCost": { "netDecisionValue": 0.412, "verdict": "STRONGLY_RECOMMENDED" }
    }
  ],
  "requiresReview": [
    {
      "action": "PREWARM_SNAPSHOT",
      "tier": "REQUIRES_REVIEW",
      "approval": { "requiredLevel": "TEAM_LEAD", "escalationReasons": ["AUTONOMOUS_RELIABILITY_ENABLED=false → AUTO escalated to TEAM_LEAD"] },
      "readiness": { "status": "REVIEW", "blockers": [] }
    }
  ],
  "blocked": [
    {
      "action": "SUPPRESS_REFRESH",
      "tier": "BLOCKED",
      "readiness": { "status": "BLOCKED", "blockers": ["Zero production executions for a KV-mutating action"] }
    }
  ]
}
```

---

## Phase 6 — Validation: 5 GoalRadar Incidents

### Scenario 1 — PREWARM_SNAPSHOT: Sufficient Evidence, Flag-Gated

**Decision input (from DATA-18S):**
```
factor: snapshots-expiring-4h
priorityScore: 64, tier: HIGH
businessTier: HIGH, blastTier: HIGH
```

**Benefit/Cost:**
```
expectedBenefit   = 64/100*0.50 + 0.75*0.30 + 0.75*0.20 = 0.32+0.225+0.15 = 0.695
executionCost     = (1/4)*0.70 + 0.05*0.30              = 0.175+0.015     = 0.190
evidenceMultiplier = HIGH → 1.00, confidence=0.95
riskAdjustedValue = 0.695 × 1.00 × 0.95                = 0.660
netDecisionValue  = 0.660 − 0.190                       = +0.470
verdict: STRONGLY_RECOMMENDED
```

**Approval matrix:**
```
base:         AUTO  (LOW execution risk, sufficient evidence)
Rule 7:       flag=false → AUTO → TEAM_LEAD
escalations:  ["AUTONOMOUS_RELIABILITY_ENABLED=false → AUTO escalated to TEAM_LEAD"]
requiredLevel: TEAM_LEAD
flagSufficient: false
```

**Readiness:**
```
Review gate:  requiredLevel=TEAM_LEAD → "Requires TEAM_LEAD review"
status: REVIEW
requirements: ["Obtain TEAM_LEAD approval before execution"]
```

**Verdict: REQUIRES_REVIEW**
Summary: `PREWARM_SNAPSHOT: REQUIRES_REVIEW (TEAM_LEAD) — Requires TEAM_LEAD review`

**Governance outcome:** Safe to execute the moment flag=true AND team lead approves.
Zero blockers. Strongly recommended benefit/cost. ✅ No production writes.

---

### Scenario 2 — SUPPRESS_REFRESH: No Production Data → BLOCKED

**Decision input:**
```
factor: rate-safe-mode
priorityScore: 95, tier: CRITICAL
businessTier: CRITICAL, blastTier: CRITICAL
productionSamples: 0 (never executed live)
```

**Benefit/Cost:**
```
expectedBenefit   = 0.95*0.50 + 1.00*0.30 + 1.00*0.20 = 0.475+0.300+0.200 = 0.975
executionCost     = (3/4)*0.70 + 0.15*0.30             = 0.525+0.045      = 0.570
evidenceMultiplier = LOW → 0.50, confidence=0.50
riskAdjustedValue = 0.975 × 0.50 × 0.50               = 0.244
netDecisionValue  = 0.244 − 0.570                      = −0.326
verdict: NOT_RECOMMENDED
```

**Approval matrix:**
```
base:         TEAM_LEAD  (HIGH execution risk)
Rule 1:       evidence LOW → lowEvidenceApprovalLevel=ADMIN
Rule 2:       business CRITICAL → +1 → ADMIN already
Rule 3:       blast CRITICAL → escalateApproval(ADMIN) = EMERGENCY_ONLY
Rule 5:       systemWide+mutatesKV → min TEAM_LEAD (already exceeded)
escalations:  [evidence LOW, business CRITICAL, blast CRITICAL]
requiredLevel: EMERGENCY_ONLY
```

**Readiness:**
```
BLOCKED: "Requires EMERGENCY_ONLY approval — cannot auto-proceed"
BLOCKED: "Zero production executions for a KV-mutating action"
BLOCKED: "Net decision value −0.326 < −0.20"
status: BLOCKED
requirements: [
  "Obtain explicit incident commander sign-off",
  "Collect ≥5 production repair records first",
  "Reassess action choice"
]
```

**Verdict: BLOCKED**
Summary: `SUPPRESS_REFRESH: BLOCKED — Requires EMERGENCY_ONLY approval`

**Governance outcome:** Even with priority score 95/100 (the highest possible), this action
is correctly BLOCKED because there is no production evidence and all three hard-block
conditions fire simultaneously. The governance layer prevents a high-confidence
recommendation from becoming a dangerous auto-execution.
✅ No production writes.

---

### Scenario 3 — MONITOR_SELF_HEAL: AUTO_APPROVED (read-only, no risk)

**Decision input:**
```
factor: elevated-repair-frequency (6 active repair-locks)
priorityScore: 45, tier: MEDIUM
businessTier: LOW, blastTier: MEDIUM
productionSamples: 13
evidenceQuality: MEDIUM
```

**Benefit/Cost:**
```
expectedBenefit   = 0.45*0.50 + 0.20*0.30 + 0.45*0.20 = 0.225+0.060+0.090 = 0.375
executionCost     = (0/4)*0.70 + 0.00*0.30             = 0.000             = 0.000
evidenceMultiplier = MEDIUM → 0.75, confidence=0.92
riskAdjustedValue = 0.375 × 0.75 × 0.92               = 0.259
netDecisionValue  = 0.259 − 0.000                      = +0.259
verdict: RECOMMENDED
```

**Approval matrix:**
```
base:          AUTO  (NONE execution risk, MEDIUM evidence)
Rule 5:        mutatesKV=false → no escalation
Rule 7:        flag=false + level=AUTO → TEAM_LEAD
escalations:   ["AUTONOMOUS_RELIABILITY_ENABLED=false → AUTO escalated to TEAM_LEAD"]
requiredLevel: TEAM_LEAD
```

**Readiness:**
```
Review gate:   requiredLevel=TEAM_LEAD
status:        REVIEW
```

**Governance note:** MONITOR_SELF_HEAL is read-only (mutatesKV=false). The only escalation
is the feature flag gate. Once flag=true, this would be AUTO_APPROVED immediately.
✅ No production writes.

---

### Scenario 4 — ESCALATE_INCIDENT: AUTO_APPROVED (observability-only)

**Decision input:**
```
factor: archive-trajectory-yellow (trailing=7)
priorityScore: 70, tier: HIGH
businessTier: CRITICAL (SEO risk after sustained degradation)
blastTier: HIGH
productionSamples: 8, evidenceQuality: MEDIUM
confidence: 0.50 (escalation has no direct outcome — always marginal)
```

**Benefit/Cost:**
```
expectedBenefit   = 0.70*0.50 + 1.00*0.30 + 0.75*0.20 = 0.350+0.300+0.150 = 0.800
executionCost     = (1/4)*0.70 + 0.00*0.30             = 0.175             = 0.175
evidenceMultiplier = MEDIUM → 0.75, confidence=0.50
riskAdjustedValue = 0.800 × 0.75 × 0.50               = 0.300
netDecisionValue  = 0.300 − 0.175                      = +0.125
verdict: RECOMMENDED
```

**Approval matrix:**
```
base:          AUTO  (LOW execution risk)
Rule 2:        business CRITICAL → escalateApproval(AUTO) = TEAM_LEAD
Rule 7:        flag=false + level=AUTO... (already TEAM_LEAD, no further change)
escalations:   ["Business impact CRITICAL → +1 approval tier",
                "AUTONOMOUS_RELIABILITY_ENABLED=false → AUTO escalated to TEAM_LEAD"]
requiredLevel: TEAM_LEAD
```

**Readiness:**
```
Review gate:   requiredLevel=TEAM_LEAD
status:        REVIEW
```

**Governance note:** ESCALATE_INCIDENT does not mutate KV and is not system-wide in terms
of data changes — it only records an alert. However, business CRITICAL escalates it to
TEAM_LEAD because alerting decisions during CRITICAL situations need human oversight.
With flag=true and team lead approval, this fires immediately.
✅ No production writes.

---

### Scenario 5 — TRIGGER_ORCHESTRATOR: REVIEW (sufficient evidence, but system-wide)

**Decision input:**
```
factor: finished-feed-absent
priorityScore: 68, tier: HIGH
businessTier: CRITICAL, blastTier: CRITICAL
productionSamples: 6, evidenceQuality: MEDIUM
confidence: 0.83
```

**Benefit/Cost:**
```
expectedBenefit   = 0.68*0.50 + 1.00*0.30 + 1.00*0.20 = 0.340+0.300+0.200 = 0.840
executionCost     = (2/4)*0.70 + 0.15*0.30             = 0.350+0.045      = 0.395
evidenceMultiplier = MEDIUM → 0.75, confidence=0.83
riskAdjustedValue = 0.840 × 0.75 × 0.83               = 0.523
netDecisionValue  = 0.523 − 0.395                      = +0.128
verdict: RECOMMENDED
```

**Approval matrix:**
```
base:          TEAM_LEAD  (MEDIUM execution risk, lowEvidence=ADMIN but evidence=MEDIUM)
Rule 2:        business CRITICAL → escalate(TEAM_LEAD) = ADMIN
Rule 3:        blast CRITICAL → escalate(ADMIN) = EMERGENCY_ONLY
escalations:   ["Business impact CRITICAL → +1", "Blast radius CRITICAL → +1"]
requiredLevel: EMERGENCY_ONLY → but netDecisionValue>0 and productionCoverage>0
```

**Wait — re-evaluate:** netDecisionValue=+0.128 (positive), productionCoverage=1.0 (6 live runs).
No hard-block conditions fire. But EMERGENCY_ONLY triggers the approval gate.

**Readiness:**
```
BLOCKED: "Requires EMERGENCY_ONLY approval — cannot auto-proceed"
status: BLOCKED
requirements: ["Obtain explicit incident commander sign-off"]
```

**Verdict: BLOCKED (approval gate)**
Summary: `TRIGGER_ORCHESTRATOR: BLOCKED — Requires EMERGENCY_ONLY approval`

**Governance insight:** Despite a positive benefit/cost ratio and sufficient evidence,
TRIGGER_ORCHESTRATOR + CRITICAL blast + CRITICAL business correctly escalates to
EMERGENCY_ONLY. The governance layer is intentionally conservative: a system-wide
orchestrator trigger during a feed-absent incident has cascading blast radius, and
the policy requires human incident command — not just a feature flag.

This is the governance layer working correctly: the decision engine recommends the action,
the business impact assessment quantifies the stakes, and governance enforces that a human
must confirm before GoalRadar's entire World Cup data pipeline is reseeded.
✅ No production writes.

---

## Governance Summary: 5 Scenarios

| Scenario | Action | Priority | NetValue | Approval | Readiness | Verdict |
|----------|--------|----------|----------|----------|-----------|---------|
| 1. Snapshot expiry | PREWARM_SNAPSHOT | 64 HIGH | +0.470 | TEAM_LEAD (flag-gated) | REVIEW | REQUIRES_REVIEW |
| 2. Rate-safe mode | SUPPRESS_REFRESH | 95 CRITICAL | −0.326 | EMERGENCY_ONLY | BLOCKED | BLOCKED |
| 3. Self-heal storm | MONITOR_SELF_HEAL | 45 MEDIUM | +0.259 | TEAM_LEAD (flag-gated) | REVIEW | REQUIRES_REVIEW |
| 4. Archive trajectory | ESCALATE_INCIDENT | 70 HIGH | +0.125 | TEAM_LEAD (biz CRITICAL) | REVIEW | REQUIRES_REVIEW |
| 5. Feed absent | TRIGGER_ORCHESTRATOR | 68 HIGH | +0.128 | EMERGENCY_ONLY (blast CRITICAL) | BLOCKED | BLOCKED |

**Key governance properties demonstrated:**

1. **High priority ≠ auto-approved.** SUPPRESS_REFRESH scores 95/100 but is BLOCKED. The governance layer correctly prevents high-confidence recommendations from becoming dangerous auto-executions without evidence.

2. **Positive NetValue ≠ safe to execute.** TRIGGER_ORCHESTRATOR has NDV=+0.128 but is BLOCKED because blast+business both hit CRITICAL — the approval matrix correctly overrides the cost/benefit calculation.

3. **Read-only actions are naturally cheaper.** MONITOR_SELF_HEAL reaches the review gate only via the feature flag rule, not via any substantive escalation — its zero execution cost makes it trivially cost-beneficial.

4. **Evidence quality gates compound correctly.** SUPPRESS_REFRESH with 0 production samples triggers three simultaneous BLOCKED conditions: EMERGENCY_ONLY approval + zero-coverage KV mutation + negative NDV.

5. **Feature flag is a universal safety gate.** With flag=false, every AUTO action escalates to TEAM_LEAD. This means the governance layer enforces human review for every action until the flag is explicitly enabled, regardless of how safe the action appears.

---

## Constraints Verification

| Constraint | Met? |
|-----------|------|
| No automatic execution | ✅ execute=false throughout; governance prevents it |
| No KV mutations | ✅ all paths read-only; endpoint makes no writes |
| No Match Detail changes | ✅ no page files touched |
| No Authority Cache redesign | ✅ authority-cache.ts unmodified |
| Additive only | ✅ 4 new files, 0 existing files modified |
| Feature flag OFF | ✅ AUTONOMOUS_RELIABILITY_ENABLED=false |
