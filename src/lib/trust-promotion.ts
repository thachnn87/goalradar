/**
 * trust-promotion.ts — DATA-18U.3 Phase 2
 *
 * Trust Promotion Engine.
 *
 * Determines exactly why an action is NOT_READY, LIMITED_READY, or READY,
 * and computes a promotionScore (0–100) ranking how close it is to the
 * next readiness tier.
 *
 * promotionScore weights:
 *   30% production coverage  (executions vs required)
 *   25% verification pass rate
 *   20% confidence
 *   15% confidence trend (drift + calibration direction)
 *   10% recovery consistency
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType }  from './auto-remediation';
import type { AutomationReadiness }    from './trust-framework';
import type { ActionEvidenceSummary }  from './evidence-collector';
import { getGovernance }               from './action-governance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromotionRequirement {
  /** Short identifier. */
  key:         string;
  /** What is needed. */
  description: string;
  /** Current value (numeric or label). */
  currentValue: string;
  /** Target value. */
  targetValue:  string;
  /** 0–1: how close to meeting this requirement. */
  progress:     number;
  /** Is this a hard blocker (fails silently → NOT_READY)? */
  isBlocker:    boolean;
}

export interface PromotionOpportunity {
  /** Action to take to improve promotion score. */
  action:      string;
  /** Which dimension this improves. */
  dimension:   'coverage' | 'verification' | 'confidence' | 'trend' | 'recovery';
  /** Expected score gain. */
  expectedGain: number;
  /** Priority: HIGH if gain ≥ 15, MEDIUM ≥ 5, LOW otherwise. */
  priority:    'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PromotionAssessment {
  action:               RemediationActionType;
  currentReadiness:     AutomationReadiness;
  nextReadiness:        AutomationReadiness | null;   // null if already READY

  promotionScore:       number;   // 0–100 weighted composite
  /** Per-dimension scores (each 0–100, before weighting). */
  dimensionScores: {
    productionCoverage:   number;
    verificationPassRate: number;
    confidence:           number;
    confidenceTrend:      number;
    recoveryConsistency:  number;
  };

  missingRequirements:  PromotionRequirement[];
  promotionBlockers:    PromotionRequirement[];   // subset of missing that are hard blockers
  promotionOpportunities: PromotionOpportunity[];

  /** How many more production executions are needed to meet coverage gate. */
  remainingExecutionsNeeded: number;
  /**
   * Rough estimate of calendar days to reach next readiness tier,
   * assuming 1 production execution per day (conservative).
   */
  estimatedDaysToReady: number | null;

  promotionSummary: string;
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

const W_COVERAGE     = 0.30;
const W_VERIFY       = 0.25;
const W_CONFIDENCE   = 0.20;
const W_TREND        = 0.15;
const W_RECOVERY     = 0.10;

// HIGH_TRUST thresholds (mirrors trust-framework.ts — do not modify)
const HIGH_CONF      = 0.85;
const HIGH_COV_RATIO = 0.80;
const HIGH_VERIFY    = 0.90;

// MEDIUM_TRUST threshold
const MED_CONF       = 0.60;

// ---------------------------------------------------------------------------
// Dimension scorers (each returns 0–100)
// ---------------------------------------------------------------------------

function scoreCoverage(summary: ActionEvidenceSummary): number {
  // Full score at HIGH_COV_RATIO (80% of requirement met)
  const ratio = summary.productionCoverageRatio;
  if (ratio >= HIGH_COV_RATIO) return 100;
  return Math.round((ratio / HIGH_COV_RATIO) * 100);
}

function scoreVerification(summary: ActionEvidenceSummary): number {
  const vpr = summary.verificationPassRate;
  if (vpr === null) {
    // No verification data — partial credit for having coverage
    return summary.productionExecutions > 0 ? 10 : 0;
  }
  if (vpr >= HIGH_VERIFY) return 100;
  return Math.round((vpr / HIGH_VERIFY) * 100);
}

function scoreConfidence(summary: ActionEvidenceSummary): number {
  const c = summary.confidenceCurrent;
  if (c >= HIGH_CONF) return 100;
  // Scale: 0.01 → 0, 0.85 → 100
  return Math.round(Math.max(0, (c - 0.01) / (HIGH_CONF - 0.01) * 100));
}

function scoreTrend(summary: ActionEvidenceSummary): number {
  let score = 50; // neutral baseline
  // Calibration direction contribution
  if (summary.calibrationDirection === 'INCREASE') score += 25;
  else if (summary.calibrationDirection === 'DECREASE') score -= 25;
  // Drift direction contribution
  if (summary.confidenceTrend === 'POSITIVE') score += 25;
  else if (summary.confidenceTrend === 'NEGATIVE') score -= 25;
  else if (summary.confidenceTrend === null) score -= 5; // unknown = slight penalty
  return Math.max(0, Math.min(100, score));
}

function scoreRecovery(summary: ActionEvidenceSummary): number {
  const cons = summary.recovery.consistency;
  if (cons === null) {
    // No recovery data — partial credit for having any executions
    return summary.productionExecutions > 0 ? 20 : 0;
  }
  return Math.round(cons * 100);
}

// ---------------------------------------------------------------------------
// Build requirements list
// ---------------------------------------------------------------------------

function buildRequirements(summary: ActionEvidenceSummary): PromotionRequirement[] {
  const reqs: PromotionRequirement[] = [];
  const gov = getGovernance(summary.action);

  // 1. Production coverage
  const coverageNeeded = Math.ceil(gov.productionCoverageRequired * HIGH_COV_RATIO);
  const coverageMet    = summary.productionExecutions >= coverageNeeded;
  reqs.push({
    key:          'production-coverage',
    description:  `≥${coverageNeeded} production executions (80% of required ${gov.productionCoverageRequired})`,
    currentValue: String(summary.productionExecutions),
    targetValue:  String(coverageNeeded),
    progress:     Math.min(1, summary.productionExecutions / coverageNeeded),
    isBlocker:    true,
  });
  void coverageMet;

  // 2. Confidence
  const confMet = summary.confidenceCurrent >= HIGH_CONF;
  if (!confMet) {
    reqs.push({
      key:          'confidence',
      description:  `Confidence ≥ ${Math.round(HIGH_CONF * 100)}%`,
      currentValue: `${Math.round(summary.confidenceCurrent * 100)}%`,
      targetValue:  `${Math.round(HIGH_CONF * 100)}%`,
      progress:     Math.min(1, (summary.confidenceCurrent - 0.01) / (HIGH_CONF - 0.01)),
      isBlocker:    true,
    });
  }

  // 3. Verification pass rate
  const vpr    = summary.verificationPassRate;
  const verMet = vpr !== null && vpr >= HIGH_VERIFY;
  if (!verMet) {
    reqs.push({
      key:          'verification-pass-rate',
      description:  `Verification pass rate ≥ ${Math.round(HIGH_VERIFY * 100)}%`,
      currentValue: vpr !== null ? `${Math.round(vpr * 100)}%` : 'No data',
      targetValue:  `${Math.round(HIGH_VERIFY * 100)}%`,
      progress:     vpr !== null ? Math.min(1, vpr / HIGH_VERIFY) : 0,
      isBlocker:    true,
    });
  }

  // 4. Production evidence exists (hard gate for LIMITED_READY+)
  if (summary.productionExecutions === 0) {
    reqs.push({
      key:          'any-production-evidence',
      description:  'At least 1 production execution recorded',
      currentValue: '0',
      targetValue:  '1',
      progress:     0,
      isBlocker:    true,
    });
  }

  // 5. No negative drift
  if (summary.confidenceTrend === 'NEGATIVE') {
    reqs.push({
      key:          'no-negative-drift',
      description:  'Confidence drift must not be NEGATIVE',
      currentValue: 'NEGATIVE',
      targetValue:  'FLAT or POSITIVE',
      progress:     0,
      isBlocker:    false,   // soft: blocks HIGH_TRUST path, not LIMITED_READY
    });
  }

  // 6. Verification coverage (advisory)
  if (summary.verificationCoverage < 0.30 && summary.productionExecutions > 0) {
    reqs.push({
      key:          'verification-coverage',
      description:  'Verification coverage ≥ 30%',
      currentValue: `${Math.round(summary.verificationCoverage * 100)}%`,
      targetValue:  '30%',
      progress:     Math.min(1, summary.verificationCoverage / 0.30),
      isBlocker:    false,
    });
  }

  return reqs;
}

// ---------------------------------------------------------------------------
// Build opportunities
// ---------------------------------------------------------------------------

function buildOpportunities(
  summary:         ActionEvidenceSummary,
  dimensionScores: PromotionAssessment['dimensionScores'],
): PromotionOpportunity[] {
  const opps: PromotionOpportunity[] = [];

  if (dimensionScores.productionCoverage < 100) {
    const gap  = Math.max(0, Math.ceil(summary.productionCoverageRequired * HIGH_COV_RATIO) - summary.productionExecutions);
    const gain = Math.round((100 - dimensionScores.productionCoverage) * W_COVERAGE);
    opps.push({
      action:       `Execute ${gap} more production repair(s) for ${summary.action}`,
      dimension:    'coverage',
      expectedGain: gain,
      priority:     gain >= 15 ? 'HIGH' : gain >= 5 ? 'MEDIUM' : 'LOW',
    });
  }

  if (dimensionScores.verificationPassRate < 100) {
    const gain = Math.round((100 - dimensionScores.verificationPassRate) * W_VERIFY);
    opps.push({
      action:       `Enable post-repair verification for ${summary.action} to track verificationPassed`,
      dimension:    'verification',
      expectedGain: gain,
      priority:     gain >= 15 ? 'HIGH' : gain >= 5 ? 'MEDIUM' : 'LOW',
    });
  }

  if (dimensionScores.confidence < 100) {
    const gap  = Math.max(0, HIGH_CONF - summary.confidenceCurrent);
    const gain = Math.round((100 - dimensionScores.confidence) * W_CONFIDENCE);
    opps.push({
      action:       `Increase success rate to raise confidence by ≥${Math.round(gap * 100)}% points`,
      dimension:    'confidence',
      expectedGain: gain,
      priority:     gain >= 15 ? 'HIGH' : gain >= 5 ? 'MEDIUM' : 'LOW',
    });
  }

  if (dimensionScores.confidenceTrend < 75) {
    opps.push({
      action:       `Achieve POSITIVE confidence drift over ≥3 consecutive snapshots`,
      dimension:    'trend',
      expectedGain: Math.round((75 - dimensionScores.confidenceTrend) * W_TREND),
      priority:     summary.confidenceTrend === 'NEGATIVE' ? 'HIGH' : 'MEDIUM',
    });
  }

  if (dimensionScores.recoveryConsistency < 80 && summary.productionExecutions > 0) {
    opps.push({
      action:       `Improve recovery time consistency (reduce variance in durationMs)`,
      dimension:    'recovery',
      expectedGain: Math.round((80 - dimensionScores.recoveryConsistency) * W_RECOVERY),
      priority:     'LOW',
    });
  }

  return opps.sort((a, b) => b.expectedGain - a.expectedGain);
}

// ---------------------------------------------------------------------------
// Core: assess one action
// ---------------------------------------------------------------------------

export function assessPromotion(summary: ActionEvidenceSummary): PromotionAssessment {
  const ds = {
    productionCoverage:   scoreCoverage(summary),
    verificationPassRate: scoreVerification(summary),
    confidence:           scoreConfidence(summary),
    confidenceTrend:      scoreTrend(summary),
    recoveryConsistency:  scoreRecovery(summary),
  };

  const promotionScore = Math.round(
    ds.productionCoverage   * W_COVERAGE  +
    ds.verificationPassRate * W_VERIFY    +
    ds.confidence           * W_CONFIDENCE +
    ds.confidenceTrend      * W_TREND     +
    ds.recoveryConsistency  * W_RECOVERY,
  );

  const allReqs     = buildRequirements(summary);
  const missing     = allReqs.filter(r => r.progress < 1.0);
  const blockers    = missing.filter(r => r.isBlocker);
  const opps        = buildOpportunities(summary, ds);

  const nextReadiness: AutomationReadiness | null =
    summary.readiness === 'READY'         ? null
    : summary.readiness === 'LIMITED_READY' ? 'READY'
    : summary.confidenceCurrent >= MED_CONF && summary.productionExecutions > 0
      ? 'LIMITED_READY'
      : 'NOT_READY';

  // Remaining executions needed
  const coverageNeeded           = Math.ceil(getGovernance(summary.action).productionCoverageRequired * HIGH_COV_RATIO);
  const remainingExecutionsNeeded = Math.max(0, coverageNeeded - summary.productionExecutions);

  // Estimated days (1 execution/day = conservative)
  const estimatedDaysToReady =
    summary.readiness === 'READY' ? 0
    : blockers.length === 0        ? 1
    : remainingExecutionsNeeded > 0 ? remainingExecutionsNeeded
    : null;

  // Summary sentence
  let promotionSummary: string;
  if (summary.readiness === 'READY') {
    promotionSummary = `${summary.action} is READY — all gates met.`;
  } else if (blockers.length === 0) {
    promotionSummary = `${summary.action} meets all hard requirements; soft gates pending (score ${promotionScore}/100).`;
  } else {
    const topBlocker = blockers[0];
    promotionSummary =
      `${summary.action}: score ${promotionScore}/100. ` +
      `Top blocker: ${topBlocker.description} ` +
      `(${topBlocker.currentValue} → ${topBlocker.targetValue}).`;
  }

  return {
    action:                    summary.action,
    currentReadiness:          summary.readiness,
    nextReadiness,
    promotionScore,
    dimensionScores:           ds,
    missingRequirements:       missing,
    promotionBlockers:         blockers,
    promotionOpportunities:    opps,
    remainingExecutionsNeeded,
    estimatedDaysToReady,
    promotionSummary,
  };
}

// ---------------------------------------------------------------------------
// Assess all actions, rank by promotionScore
// ---------------------------------------------------------------------------

export interface PromotionReport {
  assessments:         PromotionAssessment[];   // ranked descending by promotionScore
  nearestReadyAction:  RemediationActionType | null;
  readyCandidates:     RemediationActionType[];
  limitedReadyCandidates: RemediationActionType[];
  notReadyCandidates:  RemediationActionType[];
  generatedAt:         string;
}

export function assessAllPromotions(summaries: ActionEvidenceSummary[]): PromotionReport {
  const assessments = summaries
    .map(s => assessPromotion(s))
    .sort((a, b) => b.promotionScore - a.promotionScore);

  const ready        = assessments.filter(a => a.currentReadiness === 'READY').map(a => a.action);
  const limited      = assessments.filter(a => a.currentReadiness === 'LIMITED_READY').map(a => a.action);
  const notReady     = assessments.filter(a => a.currentReadiness === 'NOT_READY').map(a => a.action);

  const nearestReady =
    ready.length > 0   ? ready[0]
    : limited.length > 0 ? limited[0]
    : assessments.length > 0 ? assessments[0].action
    : null;

  return {
    assessments,
    nearestReadyAction:      nearestReady,
    readyCandidates:         ready,
    limitedReadyCandidates:  limited,
    notReadyCandidates:      notReady,
    generatedAt:             new Date().toISOString(),
  };
}
