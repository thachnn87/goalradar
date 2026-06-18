/**
 * outcome-prediction.ts — DATA-18U Phase 2
 *
 * Outcome Prediction Engine.
 *
 * Predicts — before execution — the likely outcome of a recommended action:
 *   SuccessProbability      — 0–1 likelihood action resolves the risk
 *   ExpectedRecoveryMinutes — realistic time to GREEN health state
 *   ExpectedSystemState     — what KV/health looks like after success
 *
 * Uses DATA-18Q (adaptive confidence) and DATA-18R (production confidence)
 * learning signals, combined with static outcome specs (DATA-18U Phase 1).
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType, RiskFactorId }  from './auto-remediation';
import type { RepairRecordV2, ActionEffectiveness }  from './action-effectiveness';
import type { EvidenceQuality, ScoreTier }           from './risk-priority';
import type { BlastTier }                            from './blast-radius';
import type { BusinessTier }                         from './business-impact';
import { getOutcomeSpec, recoveryMinutesP50, recoveryMinutesP95 } from './action-outcomes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Confidence source used for prediction. */
export type ConfidenceSource =
  | 'production-history'  // DATA-18R: real production repairs
  | 'adaptive-learning'   // DATA-18Q: adaptive confidence from all records
  | 'registry-default'    // Phase 1 static spec (no history available)
  | 'insufficient-data';  // < 3 records — wide uncertainty

/** Predicted system state after successful execution. */
export interface PredictedSystemState {
  /** Subsystem-level expected outcomes (from Phase 1 spec). */
  subsystemOutcomes: Array<{
    subsystem: string;
    expectedState: string;
    confidence: number;    // 0–1: how certain we are this subsystem recovers
  }>;
  /** Aggregate health state prediction. */
  predictedHealthOutcome: 'GREEN' | 'YELLOW' | 'UNCERTAIN';
  /** Which success conditions are likely to pass. */
  likelyPassingConditions: string[];
  /** Which success conditions are at risk of partial failure. */
  atRiskConditions: string[];
}

/** Full prediction for one action. */
export interface OutcomePrediction {
  action:                   RemediationActionType;
  rfId:                     RiskFactorId | null;

  /** 0–1: probability the action resolves the active risk. */
  successProbability:       number;
  /** Tier summary of success probability. */
  successProbabilityTier:   'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

  /** Best estimate recovery time (minutes). */
  expectedRecoveryMinutes:  number;
  /** Pessimistic recovery time (minutes, P95). */
  worstCaseRecoveryMinutes: number;
  /** Uncertainty band: pessimistic − expected (minutes). */
  recoveryUncertaintyMinutes: number;

  /** Source of confidence signal. */
  confidenceSource:         ConfidenceSource;
  /** Number of production records informing this prediction. */
  productionSampleSize:     number;
  /** Evidence quality classification. */
  evidenceQuality:          EvidenceQuality;

  /** Predicted system state after success. */
  expectedSystemState:      PredictedSystemState;

  /** Plain English: why this probability was assigned. */
  reasoning:                string[];
  /** Caveats that increase uncertainty. */
  caveats:                  string[];
}

/** Summary of multiple predictions for dashboard display. */
export interface OutcomePredictionSummary {
  predictions:         OutcomePrediction[];
  highConfidenceCount: number;
  lowConfidenceCount:  number;
  /** Best action by success probability. */
  topRecommendation:   RemediationActionType | null;
  /** Worst-case total recovery time across all recommended actions (sequential). */
  worstCaseSequentialMinutes: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map success probability (0–1) to a tier label. */
function probabilityTier(p: number): OutcomePrediction['successProbabilityTier'] {
  if (p >= 0.70) return 'HIGH';
  if (p >= 0.40) return 'MEDIUM';
  if (p >= 0.10) return 'LOW';
  return 'UNKNOWN';
}

/** Evidence quality from production sample count + verification coverage. */
function deriveEvidenceQuality(
  productionSamples: number,
  verificationCoverage: number,
): EvidenceQuality {
  if (productionSamples >= 20 && verificationCoverage >= 0.70) return 'HIGH';
  if (productionSamples >= 5  || verificationCoverage >= 0.30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Scale registry P50 recovery time by risk tier — higher severity = slower recovery.
 * Critical situations often involve compound failures that take longer to unwind.
 */
function scaledRecoveryMinutes(
  baseP50: number,
  scoreTier: ScoreTier,
  blastTier: BlastTier,
): number {
  const tierMult: Record<ScoreTier, number> = {
    CRITICAL: 1.5, HIGH: 1.2, MEDIUM: 1.0, LOW: 0.9,
  };
  const blastMult: Record<BlastTier, number> = {
    CRITICAL: 1.4, HIGH: 1.15, MEDIUM: 1.0, LOW: 0.9,
  };
  return Math.round(baseP50 * tierMult[scoreTier] * blastMult[blastTier]);
}

/**
 * Derive confidence source from available records.
 * Priority: production-history > adaptive-learning > registry-default > insufficient-data.
 */
function deriveConfidenceSource(
  productionSamples: number,
  adaptiveSamples:   number,
): ConfidenceSource {
  if (productionSamples >= 5) return 'production-history';
  if (adaptiveSamples   >= 3) return 'adaptive-learning';
  if (adaptiveSamples   >= 1) return 'registry-default';
  return 'insufficient-data';
}

/**
 * Blend production confidence (DATA-18R) and adaptive confidence (DATA-18Q)
 * into a single success probability.
 *
 * Weights:
 *   production ≥ 10 records → 0.80 prod / 0.20 adaptive
 *   production  5–9 records → 0.60 prod / 0.40 adaptive
 *   production  1–4 records → 0.30 prod / 0.70 adaptive
 *   production   0 records  → 0.00 prod / 1.00 adaptive
 *
 * When adaptive confidence is also missing (< 1 record),
 * fall back to registry default (0.65 — moderate optimism).
 */
function blendConfidence(
  productionConfidence: number | null,
  adaptiveConfidence:   number | null,
  productionSamples:    number,
): number {
  const prod = productionConfidence ?? 0.5;
  const adap = adaptiveConfidence   ?? 0.65;

  if (productionSamples >= 10) return prod * 0.80 + adap * 0.20;
  if (productionSamples >=  5) return prod * 0.60 + adap * 0.40;
  if (productionSamples >=  1) return prod * 0.30 + adap * 0.70;
  if (adaptiveConfidence !== null) return adap;
  return 0.65; // registry default: moderate optimism with no data
}

// ---------------------------------------------------------------------------
// Core prediction function
// ---------------------------------------------------------------------------

export interface PredictOutcomeInput {
  action:               RemediationActionType;
  rfId:                 RiskFactorId | null;
  scoreTier:            ScoreTier;
  blastTier:            BlastTier;
  businessTier:         BusinessTier;
  /** From DATA-18R computeProductionConfidence() — null if no prod records. */
  productionConfidence: number | null;
  /** Production repair records for this action (result !== 'dry-run'). */
  productionRecords:    RepairRecordV2[];
  /** From DATA-18Q computeEffectiveness() — null if no records at all. */
  adaptiveEffectiveness: ActionEffectiveness | null;
}

/**
 * Predict the likely outcome of executing an action given current risk context.
 */
export function predictOutcome(input: PredictOutcomeInput): OutcomePrediction {
  const spec = getOutcomeSpec(input.action);

  const productionSamples    = input.productionRecords.length;
  const adaptiveSamples      = input.adaptiveEffectiveness?.sampleSize ?? 0;
  const verRecs              = input.productionRecords.filter(r => r.verificationPassed !== null);
  const verificationCoverage = productionSamples > 0
    ? verRecs.length / productionSamples
    : 0;

  const evidenceQuality    = deriveEvidenceQuality(productionSamples, verificationCoverage);
  const confidenceSource   = deriveConfidenceSource(productionSamples, adaptiveSamples);

  // ── Success probability ──────────────────────────────────────────────────
  const rawProbability = blendConfidence(
    input.productionConfidence,
    input.adaptiveEffectiveness?.adaptiveConfidence ?? null,
    productionSamples,
  );

  // Apply a small penalty for CRITICAL blast+business when the action is
  // system-wide — the risk of unexpected interactions is higher.
  let successProbability = rawProbability;
  const criticalContextPenalty =
    input.blastTier === 'CRITICAL' && input.businessTier === 'CRITICAL' ? 0.05 : 0;
  successProbability = Math.max(0.01, Math.min(0.99, rawProbability - criticalContextPenalty));

  // ── Recovery time ────────────────────────────────────────────────────────
  const baseP50 = recoveryMinutesP50(input.action);
  const baseP95 = recoveryMinutesP95(input.action);

  const expectedRecovery    = scaledRecoveryMinutes(baseP50, input.scoreTier, input.blastTier);
  const worstCaseRecovery   = scaledRecoveryMinutes(baseP95, input.scoreTier, input.blastTier);
  const recoveryUncertainty = worstCaseRecovery - expectedRecovery;

  // Use actual median recovery time from production records if available
  let finalExpectedRecovery = expectedRecovery;
  if (productionSamples >= 3) {
    const successRecs = input.productionRecords.filter(r => r.result === 'success');
    if (successRecs.length >= 2) {
      const avgRecoveryMs = successRecs
        .map(r => r.durationMs ?? 0)
        .reduce((a, b) => a + b, 0) / successRecs.length;
      const avgRecoveryMin = Math.round(avgRecoveryMs / 60_000);
      if (avgRecoveryMin > 0) {
        // Blend registry estimate with empirical: 40% registry, 60% empirical
        finalExpectedRecovery = Math.round(expectedRecovery * 0.40 + avgRecoveryMin * 0.60);
      }
    }
  }

  // ── Predicted system state ───────────────────────────────────────────────
  const subsystemOutcomes = spec.subsystemChanges.map(sc => {
    // Subsystem confidence degrades slightly for CRITICAL context
    const subsysConf = Math.max(0.40,
      successProbability - (sc.changeType === 'SIGNAL' ? 0.10 : 0),
    );
    return {
      subsystem:     sc.subsystem,
      expectedState: sc.expectedState,
      confidence:    Math.round(subsysConf * 100) / 100,
    };
  });

  const predictedHealthOutcome: PredictedSystemState['predictedHealthOutcome'] =
    successProbability >= 0.70 ? 'GREEN'
    : successProbability >= 0.40 ? 'YELLOW'
    : 'UNCERTAIN';

  const likelyPassingConditions = spec.successConditions
    .filter(c => c.required && successProbability >= 0.50)
    .map(c => c.key);

  const atRiskConditions = spec.successConditions
    .filter(c => !c.required || successProbability < 0.50)
    .map(c => c.key);

  // ── Reasoning ────────────────────────────────────────────────────────────
  const reasoning: string[] = [];

  if (confidenceSource === 'production-history') {
    const succRecs = input.productionRecords.filter(r => r.result === 'success');
    reasoning.push(
      `Production history: ${succRecs.length}/${productionSamples} live executions succeeded` +
      ` (${Math.round(successProbability * 100)}% blended confidence)`,
    );
  } else if (confidenceSource === 'adaptive-learning') {
    reasoning.push(
      `Adaptive learning: ${adaptiveSamples} total records, confidence ${Math.round(successProbability * 100)}%` +
      ` (no production executions yet)`,
    );
  } else if (confidenceSource === 'registry-default') {
    reasoning.push(
      `Registry default: ${Math.round(successProbability * 100)}% — minimal history, moderate optimism`,
    );
  } else {
    reasoning.push(
      `Insufficient data: no repair history; confidence defaults to 65%`,
    );
  }

  reasoning.push(
    `Expected recovery: ${finalExpectedRecovery}min (P95: ${worstCaseRecovery}min)` +
    ` — bottleneck: ${spec.recoveryTime.bottleneck}`,
  );

  reasoning.push(
    `Addresses: ${spec.addressesRiskFactors.join(', ') || 'N/A'}` +
    ` | Evidence: ${evidenceQuality}` +
    ` | Context: ${input.scoreTier}/${input.blastTier}`,
  );

  if (criticalContextPenalty > 0) {
    reasoning.push(
      `CRITICAL blast + business context: −${Math.round(criticalContextPenalty * 100)}% probability penalty applied`,
    );
  }

  // ── Caveats ──────────────────────────────────────────────────────────────
  const caveats: string[] = [];

  if (evidenceQuality === 'LOW') {
    caveats.push('LOW evidence: prediction is speculative — no production validation yet');
  }
  if (verificationCoverage < 0.30 && productionSamples > 0) {
    caveats.push(
      `Low verification coverage (${Math.round(verificationCoverage * 100)}%)` +
      ` — success/failure of prior executions may be undetected`,
    );
  }
  if (input.blastTier === 'CRITICAL') {
    caveats.push('CRITICAL blast tier: compound failures may extend recovery beyond P95');
  }
  if (spec.knownSideEffects.length > 0) {
    caveats.push(`Known side effects: ${spec.knownSideEffects[0]}`);
  }
  spec.partialSuccessIndicators.forEach(ind => caveats.push(`Partial-success risk: ${ind}`));

  return {
    action:                     input.action,
    rfId:                       input.rfId,
    successProbability:         Math.round(successProbability * 1000) / 1000,
    successProbabilityTier:     probabilityTier(successProbability),
    expectedRecoveryMinutes:    finalExpectedRecovery,
    worstCaseRecoveryMinutes:   worstCaseRecovery,
    recoveryUncertaintyMinutes: recoveryUncertainty,
    confidenceSource,
    productionSampleSize:       productionSamples,
    evidenceQuality,
    expectedSystemState: {
      subsystemOutcomes,
      predictedHealthOutcome,
      likelyPassingConditions,
      atRiskConditions,
    },
    reasoning,
    caveats,
  };
}

// ---------------------------------------------------------------------------
// Multi-action summary
// ---------------------------------------------------------------------------

/**
 * Predict outcomes for a ranked list of actions and return a summary.
 * Predictions are ordered by successProbability descending.
 */
export function predictOutcomes(
  inputs: PredictOutcomeInput[],
): OutcomePredictionSummary {
  const predictions = inputs
    .map(i => predictOutcome(i))
    .sort((a, b) => b.successProbability - a.successProbability);

  const highConfidenceCount = predictions.filter(
    p => p.successProbabilityTier === 'HIGH',
  ).length;

  const lowConfidenceCount = predictions.filter(
    p => p.successProbabilityTier === 'LOW' || p.successProbabilityTier === 'UNKNOWN',
  ).length;

  const topRecommendation = predictions.length > 0
    ? predictions[0].action
    : null;

  // Worst-case sequential: sum P95 of all recommended actions
  const worstCaseSequentialMinutes = predictions.reduce(
    (sum, p) => sum + p.worstCaseRecoveryMinutes,
    0,
  );

  return {
    predictions,
    highConfidenceCount,
    lowConfidenceCount,
    topRecommendation,
    worstCaseSequentialMinutes,
    generatedAt: new Date().toISOString(),
  };
}
