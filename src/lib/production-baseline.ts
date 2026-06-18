/**
 * production-baseline.ts — DATA-18U.4 Phase 2
 *
 * Production Readiness Baseline.
 *
 * Computes the current baseline snapshot for every action:
 *   baselineConfidence      — calibrated confidence (or registry default 0.65)
 *   baselineTrust           — HIGH_TRUST / MEDIUM_TRUST / LOW_TRUST
 *   baselineCoverage        — production executions / coverage required
 *   baselineVerification    — verificationPassRate or null
 *   baselinePromotionScore  — promotionScore 0–100
 *
 * Read-only. No KV writes. No side effects.
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType }  from './auto-remediation';
import type { RepairRecordV2 }         from './action-effectiveness';
import type { TrustLevel, AutomationReadiness } from './trust-framework';
import type { DriftDirection }         from './prediction-drift';
import type { CalibrationDirection }   from './confidence-calibration';
import { getGovernance }               from './action-governance';
import { assessPromotion }             from './trust-promotion';
import { collectEvidence }             from './evidence-collector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionBaseline {
  action:                 RemediationActionType;

  // ── Core metrics ────────────────────────────────────────────────────────
  baselineConfidence:     number;   // 0.01–0.99
  baselineTrust:          TrustLevel;
  baselineCoverage:       number;   // fraction 0–1 (productionExecutions / required)
  baselineVerification:   number | null;  // verificationPassRate or null

  // ── Promotion ────────────────────────────────────────────────────────────
  baselinePromotionScore: number;   // 0–100

  // ── Context ──────────────────────────────────────────────────────────────
  readiness:              AutomationReadiness;
  productionExecutions:   number;
  productionRequired:     number;
  executionsToGate:       number;   // remaining to meet 80% coverage gate
  confidenceGap:          number;   // 0.85 − current (negative means already met)
  verificationGap:        number | null;  // 0.90 − vpr (negative means already met)

  // ── Status narrative ─────────────────────────────────────────────────────
  baselineSummary:        string;
}

export interface BaselineReport {
  baselines:              ActionBaseline[];
  /** Action with highest promotionScore. */
  topCandidate:           RemediationActionType | null;
  /** Actions with promotionScore ≥ 50. */
  nearCandidates:         RemediationActionType[];
  /** Actions with 0 production executions. */
  noEvidenceActions:      RemediationActionType[];
  generatedAt:            string;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface BaselineInput {
  action:               RemediationActionType;
  productionRecords:    RepairRecordV2[];
  confidence:           number;
  trustLevel:           TrustLevel;
  readiness:            AutomationReadiness;
  calibrationDirection: CalibrationDirection;
  driftDirection:       DriftDirection | null;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export function computeBaseline(input: BaselineInput): ActionBaseline {
  const gov = getGovernance(input.action);
  const { productionRecords, confidence, trustLevel, readiness } = input;

  const prod    = productionRecords.filter(r => r.result !== 'dry-run');
  const n       = prod.length;
  const verRecs = prod.filter(r => r.verificationPassed !== null);
  const vpr: number | null = verRecs.length > 0
    ? verRecs.filter(r => r.verificationPassed).length / verRecs.length
    : null;

  const coverageFraction  = Math.min(1.0, n / gov.productionCoverageRequired);
  const coverageGate      = Math.ceil(gov.productionCoverageRequired * 0.80);
  const executionsToGate  = Math.max(0, coverageGate - n);
  const confidenceGap     = Math.round((0.85 - confidence) * 1000) / 1000;
  const verificationGap   = vpr !== null ? Math.round((0.90 - vpr) * 1000) / 1000 : null;

  // Build a synthetic evidence summary for promotion scoring
  const evidenceSummary = collectEvidence({
    action:               input.action,
    allRecords:           productionRecords,
    confidenceRecords:    [],
    confidenceCurrent:    confidence,
    calibrationDirection: input.calibrationDirection,
    driftDirection:       input.driftDirection,
    trustLevel,
    readiness,
  });

  const promotion = assessPromotion(evidenceSummary);

  // Status narrative
  let baselineSummary: string;
  if (readiness === 'READY') {
    baselineSummary = `${input.action}: READY — all gates met (score ${promotion.promotionScore}/100).`;
  } else if (n === 0) {
    baselineSummary =
      `${input.action}: 0 production executions. Needs ${coverageGate} to meet coverage gate. ` +
      `Score: ${promotion.promotionScore}/100.`;
  } else if (executionsToGate > 0) {
    baselineSummary =
      `${input.action}: ${n} executions, ${executionsToGate} more to coverage gate. ` +
      `Confidence ${Math.round(confidence * 100)}%. Score: ${promotion.promotionScore}/100.`;
  } else {
    const remaining: string[] = [];
    if (confidenceGap > 0) remaining.push(`confidence +${Math.round(confidenceGap * 100)}%`);
    if (verificationGap === null) remaining.push('verification data needed');
    else if (verificationGap > 0) remaining.push(`verification pass rate +${Math.round(verificationGap * 100)}%`);
    baselineSummary =
      `${input.action}: coverage met. Still needs: ${remaining.join(', ')}. ` +
      `Score: ${promotion.promotionScore}/100.`;
  }

  return {
    action:                 input.action,
    baselineConfidence:     Math.round(confidence        * 1000) / 1000,
    baselineTrust:          trustLevel,
    baselineCoverage:       Math.round(coverageFraction  * 1000) / 1000,
    baselineVerification:   vpr !== null ? Math.round(vpr * 1000) / 1000 : null,
    baselinePromotionScore: promotion.promotionScore,
    readiness,
    productionExecutions:   n,
    productionRequired:     gov.productionCoverageRequired,
    executionsToGate,
    confidenceGap,
    verificationGap,
    baselineSummary,
  };
}

export function computeAllBaselines(inputs: BaselineInput[]): BaselineReport {
  const baselines = inputs
    .map(i => computeBaseline(i))
    .sort((a, b) => b.baselinePromotionScore - a.baselinePromotionScore);

  const topCandidate     = baselines.length > 0 ? baselines[0].action : null;
  const nearCandidates   = baselines.filter(b => b.baselinePromotionScore >= 50).map(b => b.action);
  const noEvidenceActions = baselines.filter(b => b.productionExecutions === 0).map(b => b.action);

  return { baselines, topCandidate, nearCandidates, noEvidenceActions, generatedAt: new Date().toISOString() };
}
