# DATA-18U.3 — Promotion Rules

Date: 2026-06-18
Schema version: DATA-18U.3

These rules govern how actions move between readiness tiers. They are
implemented in `src/lib/trust-framework.ts` and `src/lib/trust-promotion.ts`.
**Do not modify thresholds without updating both files and this document.**

---

## Readiness Tiers

```
NOT_READY → LIMITED_READY → READY
```

Promotion is always forward. Demotion can move an action backward.

---

## Promotion: NOT_READY → LIMITED_READY

An action exits NOT_READY when ALL of the following are true:

| Gate | Requirement | Source |
|------|-------------|--------|
| Production evidence | `productionExecutions ≥ 1` | repair-history |
| Confidence | `calibratedConfidence ≥ 0.60` | confidence-calibration |

**Notes:**
- `productionExecutions = 0` is a hard absolute block. No amount of dry-run
  history, simulation data, or high confidence can substitute.
- Confidence 0.60 means > 50% of the blended production/adaptive signal
  points toward success. The calibration engine must converge above this.
- No verification data is required to reach LIMITED_READY. It is required
  for the next tier.

**promotionScore threshold:** Typically ≥ 35/100 when these gates are met.

---

## Promotion: LIMITED_READY → READY

An action reaches READY when ALL of the following are true simultaneously:

| Gate | Requirement | Source |
|------|-------------|--------|
| Trust level | `trustLevel = HIGH_TRUST` | trust-framework |
| Production evidence | `productionExecutions ≥ 1` | repair-history |
| Confidence | `calibratedConfidence ≥ 0.85` | confidence-calibration |
| Production coverage | `productionExecutions ≥ 80% of productionCoverageRequired` | action-governance |
| Verification pass rate | `verificationPassRate ≥ 0.90` | repair-history (verificationPassed field) |

These are independent gates — all five must be satisfied simultaneously.

**HIGH_TRUST is not reachable without all three sub-gates:**
```
confidence ≥ 0.85
productionCoverage ≥ 80%
verificationPassRate ≥ 90%
```

**promotionScore threshold:** ≥ 75/100 indicates READY candidacy.

---

## promotionScore Formula

```
score = productionCoverage   × 30
      + verificationPassRate × 25
      + confidence           × 20
      + confidenceTrend      × 15
      + recoveryConsistency  × 10
```

Each dimension is normalised 0–100 before weighting.

### Dimension normalisation

**productionCoverage (0–100):**
```
ratio = min(1, productionExecutions / (productionCoverageRequired × 0.80))
score = ratio × 100
```

**verificationPassRate (0–100):**
```
score = min(100, (verificationPassRate / 0.90) × 100)
score = 10 if no verification data but productionExecutions > 0
score = 0  if no production executions
```

**confidence (0–100):**
```
score = max(0, (confidence - 0.01) / (0.85 - 0.01) × 100)
```

**confidenceTrend (0–100):**
```
baseline = 50
POSITIVE drift  → +25
NEGATIVE drift  → −25
INCREASE calib  → +25
DECREASE calib  → −25
null drift      → −5
```
Clamped to [0, 100].

**recoveryConsistency (0–100):**
```
score = (1 - coefficientOfVariation) × 100
score = 20 if productionExecutions > 0 but no recovery data
score = 0  if no production executions
```

---

## Demotion Rules

An action is demoted from READY → LIMITED_READY if:

| Condition | Trigger |
|-----------|---------|
| Confidence drops below 0.85 | After calibration event with large negative adjustment |
| productionExecutions drops below 80% coverage | Records pruned past 90-day retention window |
| verificationPassRate drops below 0.90 | New failure records added that push rate below threshold |

An action is demoted from LIMITED_READY → NOT_READY if:

| Condition | Trigger |
|-----------|---------|
| Confidence drops below 0.60 | After severe calibration decrease |
| All production records pruned | 90-day window slides past all records |

Demotion is automatic — the trust-framework recalculates from scratch on
every API call. There is no persistent "tier" stored in KV.

---

## Trust Decay Rules

### Confidence decay

Confidence decays when the calibration engine observes:
- New repair failures (`result = 'failure'`)
- Low verification pass rate (`verificationPassed = false` records)
- Negative drift (OLS slope < 0 over ≥ 3 daily snapshots)

The damping factor caps the per-event adjustment:
```
n < 5   → damping = 0.20  (noise-resistant)
n < 10  → damping = 0.40
n < 20  → damping = 0.65
n < 50  → damping = 0.85
n ≥ 50  → damping = 1.00  (fully converged)
```

A single failure with 50+ records changes confidence by at most:
```
(0.00 - currentConf) × 0.70 × 1.00 = small negative delta
```

### Archive window decay

All confidence and repair records expire after 90 days (REPAIR_RETENTION_MS,
CONFIDENCE_RETENTION_MS). An action that was once READY but has not been
executed for > 90 days will lose its production coverage and may demote.

This is intentional — stale evidence should not gate future automation.

---

## Confidence Stagnation Rules

An action is considered **stagnant** if:

1. `calibrationDirection = 'STABLE'` AND
2. `confidenceTrend = null` (no drift history) AND
3. `productionExecutions < productionCoverageRequired` AND
4. No new repair records in last 30 days

Stagnation indicators appear in `gapsToHighTrust[]` but do not constitute
a blocker on their own. The system cannot promote itself — it requires
production executions to generate new signal.

**Stagnation response:** The evidence dashboard (`/api/debug/evidence-dashboard`)
surfaces stagnant actions under `topDecliningActions` when confidenceDelta ≤ 0.

---

## Summary: Gate Reference

| From → To | Hard Gate | Soft Gates |
|-----------|-----------|------------|
| NOT_READY → LIMITED_READY | productionExecutions ≥ 1, confidence ≥ 0.60 | verificationCoverage ≥ 30% |
| LIMITED_READY → READY | HIGH_TRUST (all 3 sub-gates) + evidence | POSITIVE drift, no recent failures |
| READY → demoted | Any HIGH_TRUST gate fails | Repeated verification failures |
| Any tier | NEGATIVE drift (warning only) | reversal required for HIGH_TRUST |
