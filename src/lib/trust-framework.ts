/**
 * trust-framework.ts — DATA-18U.2 Phase 4
 *
 * Trust Classification Framework.
 *
 * Classifies each action's current trust level for future automation gating.
 * This classification is the gate used by DATA-18V.
 *
 * Trust levels:
 *   HIGH_TRUST   — confidence ≥ 0.85, productionCoverage ≥ 80%, verificationPassRate ≥ 90%
 *   MEDIUM_TRUST — confidence ≥ 0.60 (does not meet HIGH requirements)
 *   LOW_TRUST    — confidence < 0.60
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType }        from './auto-remediation';
import type { RepairRecordV2 }               from './action-effectiveness';
import type { CalibrationDirection }         from './confidence-calibration';
import type { DriftDirection }               from './prediction-drift';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrustLevel = 'HIGH_TRUST' | 'MEDIUM_TRUST' | 'LOW_TRUST';

export type AutomationReadiness = 'READY' | 'LIMITED_READY' | 'NOT_READY';

export interface TrustClassification {
  action:               RemediationActionType;

  trustLevel:           TrustLevel;
  automationReadiness:  AutomationReadiness;

  /** Current calibrated confidence (0–1). */
  confidence:           number;
  /** Fraction of required production coverage met (0–1). */
  productionCoverage:   number;
  /** Fraction of post-repair verifications that passed (0–1 or null). */
  verificationPassRate: number | null;

  /** Number of live production executions. */
  productionSamples:    number;
  /** Whether any production evidence exists. */
  hasProductionEvidence: boolean;

  /** Calibration direction signal. */
  calibrationDirection: CalibrationDirection;
  /** Drift direction from history. */
  driftDirection:       DriftDirection | null;

  /** Plain English reasons for this classification. */
  reasons:              string[];
  /** What would be needed to reach HIGH_TRUST. */
  gapsToHighTrust:      string[];
}

export interface TrustReport {
  classifications:      TrustClassification[];
  highTrustActions:     RemediationActionType[];
  mediumTrustActions:   RemediationActionType[];
  lowTrustActions:      RemediationActionType[];
  readyActions:         RemediationActionType[];
  limitedReadyActions:  RemediationActionType[];
  notReadyActions:      RemediationActionType[];
  generatedAt:          string;
}

// ---------------------------------------------------------------------------
// Thresholds (DATA-18V gate — do not loosen without production evidence)
// ---------------------------------------------------------------------------

const HIGH_TRUST_CONFIDENCE  = 0.85;
const HIGH_TRUST_COVERAGE    = 0.80;   // ≥ 80% of productionCoverageRequired met
const HIGH_TRUST_VERIFY_RATE = 0.90;

const MEDIUM_TRUST_CONFIDENCE = 0.60;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface TrustInput {
  action:               RemediationActionType;
  /** Calibrated confidence from confidence-calibration.ts */
  confidence:           number;
  /** Production repair records (result !== 'dry-run'). */
  productionRecords:    RepairRecordV2[];
  /** Minimum production records required (from action-governance.ts registry). */
  productionCoverageRequired: number;
  /** Calibration direction from the most recent calibration event. */
  calibrationDirection: CalibrationDirection;
  /** Drift direction from prediction-drift.ts, or null if insufficient history. */
  driftDirection:       DriftDirection | null;
}

// ---------------------------------------------------------------------------
// Core: classify one action
// ---------------------------------------------------------------------------

/**
 * Classify the trust level and automation readiness for one action.
 *
 * READY requires HIGH_TRUST + production evidence.
 * LIMITED_READY requires MEDIUM_TRUST + any production evidence.
 * NOT_READY otherwise.
 */
export function classifyTrust(input: TrustInput): TrustClassification {
  const { action, confidence, productionRecords, productionCoverageRequired } = input;

  const n                  = productionRecords.length;
  const hasProductionEvidence = n > 0;
  const productionCoverage = Math.min(1.0, n / productionCoverageRequired);

  // Verification pass rate
  const verRecs = productionRecords.filter(r => r.verificationPassed !== null);
  const vpr: number | null = verRecs.length > 0
    ? verRecs.filter(r => r.verificationPassed).length / verRecs.length
    : null;

  const reasons: string[]      = [];
  const gapsToHighTrust: string[] = [];

  // ── Trust level ────────────────────────────────────────────────────────
  let trustLevel: TrustLevel;

  const meetsHighConf   = confidence           >= HIGH_TRUST_CONFIDENCE;
  const meetsHighCov    = productionCoverage   >= HIGH_TRUST_COVERAGE;
  const meetsHighVerify = vpr !== null && vpr  >= HIGH_TRUST_VERIFY_RATE;

  if (meetsHighConf && meetsHighCov && meetsHighVerify) {
    trustLevel = 'HIGH_TRUST';
    reasons.push(
      `Confidence ${Math.round(confidence * 100)}% ≥ 85%`,
      `Production coverage ${Math.round(productionCoverage * 100)}% ≥ 80%`,
      `Verification pass rate ${Math.round(vpr! * 100)}% ≥ 90%`,
    );
  } else if (confidence >= MEDIUM_TRUST_CONFIDENCE) {
    trustLevel = 'MEDIUM_TRUST';
    reasons.push(`Confidence ${Math.round(confidence * 100)}% ≥ 60% but below HIGH_TRUST threshold`);

    if (!meetsHighConf) {
      gapsToHighTrust.push(
        `Raise confidence to ≥ 85% (currently ${Math.round(confidence * 100)}%)`,
      );
    }
    if (!meetsHighCov) {
      gapsToHighTrust.push(
        `Accumulate ≥ ${Math.ceil(productionCoverageRequired * HIGH_TRUST_COVERAGE)} production records ` +
        `(currently ${n}/${productionCoverageRequired} required)`,
      );
    }
    if (!meetsHighVerify) {
      const vprStr = vpr !== null ? `${Math.round(vpr * 100)}%` : 'none';
      gapsToHighTrust.push(
        `Achieve ≥ 90% verification pass rate (currently ${vprStr})`,
      );
    }
  } else {
    trustLevel = 'LOW_TRUST';
    reasons.push(`Confidence ${Math.round(confidence * 100)}% < 60%`);

    gapsToHighTrust.push(
      `Raise confidence to ≥ 85% (currently ${Math.round(confidence * 100)}%)`,
    );
    if (!meetsHighCov) {
      gapsToHighTrust.push(
        `Accumulate ≥ ${Math.ceil(productionCoverageRequired * HIGH_TRUST_COVERAGE)} production records ` +
        `(currently ${n}/${productionCoverageRequired} required)`,
      );
    }
    if (!meetsHighVerify) {
      gapsToHighTrust.push(`Achieve ≥ 90% verification pass rate`);
    }
  }

  // Drift note
  if (input.driftDirection === 'NEGATIVE') {
    reasons.push('WARNING: confidence is on a NEGATIVE drift — trending down');
    gapsToHighTrust.push('Reverse negative confidence drift before automation candidacy');
  } else if (input.driftDirection === 'POSITIVE') {
    reasons.push('POSITIVE drift: confidence improving — on track for higher trust');
  }

  // Calibration note
  if (input.calibrationDirection === 'DECREASE') {
    reasons.push('Recent calibration event decreased confidence');
  } else if (input.calibrationDirection === 'INCREASE') {
    reasons.push('Recent calibration event increased confidence');
  }

  // ── Automation readiness ──────────────────────────────────────────────
  // READY: HIGH_TRUST + production evidence (hard gate — cannot waive)
  // LIMITED_READY: MEDIUM_TRUST + any production evidence
  // NOT_READY: LOW_TRUST or no production evidence
  let automationReadiness: AutomationReadiness;

  if (trustLevel === 'HIGH_TRUST' && hasProductionEvidence) {
    automationReadiness = 'READY';
  } else if (trustLevel === 'MEDIUM_TRUST' && hasProductionEvidence) {
    automationReadiness = 'LIMITED_READY';
  } else {
    automationReadiness = 'NOT_READY';
    if (!hasProductionEvidence) {
      reasons.push('No production executions — cannot become READY without live evidence');
      gapsToHighTrust.push(
        `Execute action in production at least once to establish a baseline ` +
        `(productionCoverageRequired = ${productionCoverageRequired})`,
      );
    }
  }

  return {
    action,
    trustLevel,
    automationReadiness,
    confidence:            Math.round(confidence           * 1000) / 1000,
    productionCoverage:    Math.round(productionCoverage   * 1000) / 1000,
    verificationPassRate:  vpr !== null ? Math.round(vpr  * 1000) / 1000 : null,
    productionSamples:     n,
    hasProductionEvidence,
    calibrationDirection:  input.calibrationDirection,
    driftDirection:        input.driftDirection,
    reasons,
    gapsToHighTrust,
  };
}

// ---------------------------------------------------------------------------
// Full trust report
// ---------------------------------------------------------------------------

/**
 * Classify trust for all actions and return a summary report.
 */
export function classifyAllTrust(inputs: TrustInput[]): TrustReport {
  const classifications = inputs.map(i => classifyTrust(i));

  return {
    classifications,
    highTrustActions:    classifications.filter(c => c.trustLevel === 'HIGH_TRUST').map(c => c.action),
    mediumTrustActions:  classifications.filter(c => c.trustLevel === 'MEDIUM_TRUST').map(c => c.action),
    lowTrustActions:     classifications.filter(c => c.trustLevel === 'LOW_TRUST').map(c => c.action),
    readyActions:        classifications.filter(c => c.automationReadiness === 'READY').map(c => c.action),
    limitedReadyActions: classifications.filter(c => c.automationReadiness === 'LIMITED_READY').map(c => c.action),
    notReadyActions:     classifications.filter(c => c.automationReadiness === 'NOT_READY').map(c => c.action),
    generatedAt:         new Date().toISOString(),
  };
}
