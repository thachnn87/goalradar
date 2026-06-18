/**
 * prediction-verification.ts — DATA-18U Phase 3
 *
 * Prediction Verification.
 *
 * Compares DATA-18U outcome predictions against actual repair outcomes from
 * the repair-history archive (DATA-18Q RepairRecordV2). Measures:
 *
 *   successAccuracy      — predicted success vs actual success/failure
 *   recoveryAccuracy     — predicted recovery minutes vs actual durationMs
 *   confidenceCalibration — how well predicted probability tracks actual rate
 *   overallAccuracyScore  — composite 0–100 for dashboard display
 *
 * Drives continuous improvement: surfaces systematically over/under-confident
 * actions so the prediction engine can be tuned before automation is enabled.
 *
 * Pure computation — no I/O. KV writes allowed only for prediction-history
 * archive (separate from repair-history). Additive — modifies no existing file.
 */

import type { RemediationActionType } from './auto-remediation';
import type { RepairRecordV2 }        from './action-effectiveness';
import type { OutcomePrediction }     from './outcome-prediction';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The verdict of comparing one prediction against one actual outcome. */
export type VerificationVerdict =
  | 'CORRECT'          // predicted success=true, actual success
  | 'CORRECT_FAILURE'  // predicted success=false, actual failure
  | 'FALSE_POSITIVE'   // predicted success=true, actual failure
  | 'FALSE_NEGATIVE'   // predicted success=false, actual success
  | 'UNVERIFIED';      // no matching repair record found within window

/** How well the predicted probability matched the actual base rate. */
export type CalibrationBand =
  | 'WELL_CALIBRATED'   // |predicted − actual| ≤ 0.10
  | 'OVER_CONFIDENT'    // predicted > actual + 0.10
  | 'UNDER_CONFIDENT'   // predicted < actual − 0.10
  | 'INSUFFICIENT_DATA'; // < 5 comparable records

/** Recovery time accuracy tier. */
export type RecoveryAccuracyTier =
  | 'ACCURATE'     // actual within ±30% of predicted
  | 'UNDERSHOT'    // actual > predicted × 1.30 (took longer than predicted)
  | 'OVERSHOT'     // actual < predicted × 0.70 (recovered faster than predicted)
  | 'NO_DATA';     // no recovery times available

/** One verified prediction: prediction paired with its closest matching outcome. */
export interface VerifiedPrediction {
  /** The original prediction. */
  prediction:           OutcomePrediction;
  /** The repair record that matched (by action + proximity in time), or null. */
  matchedRecord:        RepairRecordV2 | null;

  /** Whether the actual result was a success. */
  actualSuccess:        boolean | null;
  /** Actual duration in minutes (from durationMs), or null. */
  actualRecoveryMinutes: number | null;

  /** Predicted probability at time of prediction. */
  predictedProbability: number;
  /** Actual success rate in the matched context (computed from cohort). */
  cohortSuccessRate:    number | null;

  /** Delta: predicted − actual recovery minutes (positive = predicted took longer). */
  recoveryMinutesDelta: number | null;
  /** Recovery accuracy tier. */
  recoveryAccuracyTier: RecoveryAccuracyTier;

  /** Comparison verdict. */
  verdict:              VerificationVerdict;
}

/** Calibration bucket for reliability diagram (groups predictions by probability range). */
export interface CalibrationBucket {
  /** Lower bound of probability range, inclusive (e.g. 0.60). */
  lowerBound:          number;
  /** Upper bound of probability range, exclusive (e.g. 0.70). */
  upperBound:          number;
  /** Mean predicted probability in this bucket. */
  meanPredicted:       number;
  /** Actual success rate in this bucket. */
  actualSuccessRate:   number;
  /** Number of samples in this bucket. */
  sampleCount:         number;
  /** Calibration error for this bucket: |meanPredicted − actualSuccessRate|. */
  calibrationError:    number;
}

/** Per-action accuracy breakdown. */
export interface ActionAccuracyProfile {
  action:                 RemediationActionType;
  totalPredictions:       number;
  verifiedPredictions:    number;

  correctPredictions:     number;   // CORRECT + CORRECT_FAILURE
  falsePositives:         number;
  falseNegatives:         number;

  /** 0–1: (correct + correct_failure) / verified. */
  directionAccuracy:      number;
  /** CalibrationBand from probability calibration. */
  calibrationBand:        CalibrationBand;
  /** Mean absolute recovery error in minutes (null if no data). */
  meanAbsRecoveryError:   number | null;
  /** RecoveryAccuracyTier. */
  recoveryAccuracyTier:   RecoveryAccuracyTier;

  /** Recommended adjustment: positive = raise predicted probability, negative = lower. */
  calibrationAdjustment:  number;   // e.g. +0.08 or −0.12
  /** Plain English: what to do to improve accuracy for this action. */
  improvementHint:        string;
}

/** Full verification report. */
export interface PredictionVerificationReport {
  /** Time range covered by this report. */
  windowMs:            { from: number; to: number };
  totalPredictions:    number;
  verifiedCount:       number;
  unverifiedCount:     number;

  /** Aggregate success-direction accuracy 0–1. */
  overallDirectionAccuracy: number;
  /** Overall calibration across all actions. */
  overallCalibration:  CalibrationBand;
  /** Mean absolute recovery error across all verified predictions (minutes). */
  meanAbsRecoveryError: number | null;
  /** Overall accuracy score 0–100 for dashboard. */
  overallAccuracyScore: number;
  /** Accuracy tier. */
  accuracyTier:        'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'INSUFFICIENT_DATA';

  /** Per-action breakdowns, ordered by totalPredictions descending. */
  byAction:            ActionAccuracyProfile[];
  /** Calibration buckets for reliability diagram. */
  calibrationBuckets:  CalibrationBucket[];
  /** Individual verified predictions. */
  verifiedPredictions: VerifiedPrediction[];

  /** Actions where predictions are systematically too optimistic. */
  overConfidentActions:  RemediationActionType[];
  /** Actions where predictions are systematically too pessimistic. */
  underConfidentActions: RemediationActionType[];
  /** Actions with accurate calibration and sufficient data. */
  wellCalibratedActions: RemediationActionType[];

  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Matching: pair a prediction to the nearest repair record
// ---------------------------------------------------------------------------

/** Maximum window (ms) to match a prediction to a repair record. */
const MATCH_WINDOW_MS = 30 * 60_000; // 30 minutes

/**
 * Match a prediction to a repair record from history.
 * A match requires: same action + repair recorded within MATCH_WINDOW_MS
 * after the prediction was made. Returns the closest match or null.
 */
function matchToRecord(
  prediction:    OutcomePrediction,
  predictionTs:  number,
  records:       RepairRecordV2[],
): RepairRecordV2 | null {
  const candidates = records.filter(r =>
    r.action === prediction.action &&
    r.result !== 'dry-run' &&
    r.ts     >= predictionTs &&
    r.ts     <= predictionTs + MATCH_WINDOW_MS,
  );
  if (candidates.length === 0) return null;
  // Closest in time
  return candidates.reduce((best, r) =>
    Math.abs(r.ts - predictionTs) < Math.abs(best.ts - predictionTs) ? r : best,
  );
}

// ---------------------------------------------------------------------------
// Verify a single prediction
// ---------------------------------------------------------------------------

function verifySingle(
  prediction:    OutcomePrediction,
  predictionTs:  number,
  records:       RepairRecordV2[],
  cohortRecords: RepairRecordV2[],   // all records for same action (for cohort rate)
): VerifiedPrediction {
  const matched = matchToRecord(prediction, predictionTs, records);

  if (!matched) {
    return {
      prediction,
      matchedRecord:        null,
      actualSuccess:        null,
      actualRecoveryMinutes: null,
      predictedProbability: prediction.successProbability,
      cohortSuccessRate:    null,
      recoveryMinutesDelta: null,
      recoveryAccuracyTier: 'NO_DATA',
      verdict:              'UNVERIFIED',
    };
  }

  const actualSuccess       = matched.result === 'success';
  const predictedSuccess    = prediction.successProbability >= 0.50;

  const actualRecoveryMinutes = matched.durationMs > 0
    ? Math.round(matched.durationMs / 60_000)
    : null;

  const recoveryDelta = (actualRecoveryMinutes !== null)
    ? prediction.expectedRecoveryMinutes - actualRecoveryMinutes
    : null;

  // Recovery accuracy tier
  let recoveryAccuracyTier: RecoveryAccuracyTier = 'NO_DATA';
  if (actualRecoveryMinutes !== null && prediction.expectedRecoveryMinutes > 0) {
    const ratio = actualRecoveryMinutes / prediction.expectedRecoveryMinutes;
    if      (ratio > 1.30) recoveryAccuracyTier = 'UNDERSHOT';
    else if (ratio < 0.70) recoveryAccuracyTier = 'OVERSHOT';
    else                   recoveryAccuracyTier = 'ACCURATE';
  }

  // Cohort success rate (all production records for this action, same RF context)
  const cohortSucc    = cohortRecords.filter(r => r.result === 'success').length;
  const cohortSuccessRate = cohortRecords.length >= 3
    ? cohortSucc / cohortRecords.length
    : null;

  // Verdict
  let verdict: VerificationVerdict;
  if ( predictedSuccess &&  actualSuccess) verdict = 'CORRECT';
  else if (!predictedSuccess && !actualSuccess) verdict = 'CORRECT_FAILURE';
  else if ( predictedSuccess && !actualSuccess) verdict = 'FALSE_POSITIVE';
  else                                          verdict = 'FALSE_NEGATIVE';

  return {
    prediction,
    matchedRecord:        matched,
    actualSuccess,
    actualRecoveryMinutes,
    predictedProbability: prediction.successProbability,
    cohortSuccessRate,
    recoveryMinutesDelta: recoveryDelta,
    recoveryAccuracyTier,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Calibration buckets
// ---------------------------------------------------------------------------

const BUCKET_EDGES = [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];

function buildCalibrationBuckets(verified: VerifiedPrediction[]): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = [];

  for (let i = 0; i < BUCKET_EDGES.length - 1; i++) {
    const lo = BUCKET_EDGES[i];
    const hi = BUCKET_EDGES[i + 1];

    const inBucket = verified.filter(v =>
      v.actualSuccess !== null &&
      v.predictedProbability >= lo &&
      v.predictedProbability <  hi,
    );

    if (inBucket.length === 0) continue;

    const meanPredicted     = inBucket.reduce((s, v) => s + v.predictedProbability, 0) / inBucket.length;
    const actualSuccessRate = inBucket.filter(v => v.actualSuccess).length / inBucket.length;
    const calibrationError  = Math.abs(meanPredicted - actualSuccessRate);

    buckets.push({
      lowerBound:       lo,
      upperBound:       hi,
      meanPredicted:    Math.round(meanPredicted     * 1000) / 1000,
      actualSuccessRate: Math.round(actualSuccessRate * 1000) / 1000,
      sampleCount:      inBucket.length,
      calibrationError: Math.round(calibrationError  * 1000) / 1000,
    });
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// Per-action profile
// ---------------------------------------------------------------------------

function buildActionProfile(
  action:   RemediationActionType,
  verified: VerifiedPrediction[],
): ActionAccuracyProfile {
  const mine   = verified.filter(v => v.prediction.action === action);
  const v      = mine.filter(v => v.verdict !== 'UNVERIFIED');

  const correct         = v.filter(vv => vv.verdict === 'CORRECT' || vv.verdict === 'CORRECT_FAILURE').length;
  const falsePositives  = v.filter(vv => vv.verdict === 'FALSE_POSITIVE').length;
  const falseNegatives  = v.filter(vv => vv.verdict === 'FALSE_NEGATIVE').length;
  const directionAccuracy = v.length > 0 ? correct / v.length : 0;

  // Calibration: compare mean predicted probability vs actual success rate
  const withOutcome    = v.filter(vv => vv.actualSuccess !== null);
  const meanPredicted  = withOutcome.length > 0
    ? withOutcome.reduce((s, vv) => s + vv.predictedProbability, 0) / withOutcome.length
    : 0;
  const actualRate     = withOutcome.length > 0
    ? withOutcome.filter(vv => vv.actualSuccess).length / withOutcome.length
    : 0;

  let calibrationBand: CalibrationBand;
  if (withOutcome.length < 5) {
    calibrationBand = 'INSUFFICIENT_DATA';
  } else {
    const delta = meanPredicted - actualRate;
    if      (delta >  0.10) calibrationBand = 'OVER_CONFIDENT';
    else if (delta < -0.10) calibrationBand = 'UNDER_CONFIDENT';
    else                    calibrationBand = 'WELL_CALIBRATED';
  }

  // Recovery accuracy
  const withRecovery = v.filter(vv => vv.recoveryMinutesDelta !== null);
  const meanAbsRecoveryError = withRecovery.length > 0
    ? Math.round(
        withRecovery.reduce((s, vv) => s + Math.abs(vv.recoveryMinutesDelta!), 0) /
        withRecovery.length,
      )
    : null;

  const recoveryTiers = withRecovery.map(vv => vv.recoveryAccuracyTier);
  const dominantTier = (tier: RecoveryAccuracyTier) =>
    recoveryTiers.filter(t => t === tier).length;

  let recoveryAccuracyTier: RecoveryAccuracyTier = 'NO_DATA';
  if (withRecovery.length > 0) {
    const acc      = dominantTier('ACCURATE');
    const under    = dominantTier('UNDERSHOT');
    const over     = dominantTier('OVERSHOT');
    const dominant = Math.max(acc, under, over);
    if      (dominant === acc)   recoveryAccuracyTier = 'ACCURATE';
    else if (dominant === under) recoveryAccuracyTier = 'UNDERSHOT';
    else                         recoveryAccuracyTier = 'OVERSHOT';
  }

  // Calibration adjustment: how much to shift predicted probability
  const calibrationAdjustment = withOutcome.length >= 5
    ? Math.round((actualRate - meanPredicted) * 100) / 100
    : 0;

  // Improvement hint
  let improvementHint: string;
  if (calibrationBand === 'OVER_CONFIDENT') {
    improvementHint =
      `Lower predicted probability by ~${Math.abs(Math.round((meanPredicted - actualRate) * 100))}% ` +
      `— actual success rate (${Math.round(actualRate * 100)}%) trails predicted (${Math.round(meanPredicted * 100)}%)`;
  } else if (calibrationBand === 'UNDER_CONFIDENT') {
    improvementHint =
      `Raise predicted probability by ~${Math.abs(Math.round((actualRate - meanPredicted) * 100))}% ` +
      `— actual success rate (${Math.round(actualRate * 100)}%) exceeds predicted (${Math.round(meanPredicted * 100)}%)`;
  } else if (recoveryAccuracyTier === 'UNDERSHOT') {
    improvementHint =
      `Increase P50 recovery estimate — actual recovery consistently exceeds predicted` +
      (meanAbsRecoveryError !== null ? ` by ~${meanAbsRecoveryError}min on average` : '');
  } else if (recoveryAccuracyTier === 'OVERSHOT') {
    improvementHint =
      `Decrease P50 recovery estimate — actual recovery consistently faster than predicted` +
      (meanAbsRecoveryError !== null ? ` by ~${meanAbsRecoveryError}min on average` : '');
  } else if (calibrationBand === 'INSUFFICIENT_DATA') {
    improvementHint = `Accumulate ≥5 verified predictions to enable calibration tuning`;
  } else {
    improvementHint = `Calibration is accurate — no adjustment needed`;
  }

  return {
    action,
    totalPredictions:    mine.length,
    verifiedPredictions: v.length,
    correctPredictions:  correct,
    falsePositives,
    falseNegatives,
    directionAccuracy:   Math.round(directionAccuracy * 1000) / 1000,
    calibrationBand,
    meanAbsRecoveryError,
    recoveryAccuracyTier,
    calibrationAdjustment,
    improvementHint,
  };
}

// ---------------------------------------------------------------------------
// Overall accuracy score
// ---------------------------------------------------------------------------

/**
 * Composite accuracy score 0–100:
 *   - Direction accuracy (0–1) × 50
 *   - Calibration quality × 30
 *     (WELL_CALIBRATED=1.0, OVER/UNDER=0.5, INSUFFICIENT=0.75)
 *   - Recovery accuracy × 20
 *     (ACCURATE=1.0, UNDERSHOT/OVERSHOT=0.5, NO_DATA=0.75)
 */
function computeOverallScore(
  directionAccuracy:   number,
  overallCalibration:  CalibrationBand,
  recoveryAccuracy:    RecoveryAccuracyTier,
): number {
  const calibScore: Record<CalibrationBand, number> = {
    WELL_CALIBRATED:   1.00,
    OVER_CONFIDENT:    0.50,
    UNDER_CONFIDENT:   0.50,
    INSUFFICIENT_DATA: 0.75,
  };
  const recovScore: Record<RecoveryAccuracyTier, number> = {
    ACCURATE: 1.00,
    UNDERSHOT: 0.50,
    OVERSHOT:  0.50,
    NO_DATA:   0.75,
  };

  return Math.round(
    directionAccuracy         * 50 +
    calibScore[overallCalibration] * 30 +
    recovScore[recoveryAccuracy]   * 20,
  );
}

function accuracyTier(score: number, sampleSize: number): PredictionVerificationReport['accuracyTier'] {
  if (sampleSize < 5) return 'INSUFFICIENT_DATA';
  if (score >= 80)    return 'EXCELLENT';
  if (score >= 65)    return 'GOOD';
  if (score >= 45)    return 'FAIR';
  return 'POOR';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface VerifyPredictionsInput {
  /**
   * Paired list of (prediction, predictionTs) — the timestamp when the
   * prediction was generated (epoch ms). Typically the ts of the risk signal
   * that triggered the prediction.
   */
  predictions:    Array<{ prediction: OutcomePrediction; predictionTs: number }>;
  /**
   * Production repair records from DATA-18Q/repair-history for the same
   * time window. Only records with result !== 'dry-run' are considered.
   */
  repairRecords:  RepairRecordV2[];
  /** Window boundaries for the report. */
  windowMs:       { from: number; to: number };
}

/**
 * Verify a set of outcome predictions against actual repair history.
 * Returns a full verification report with accuracy scores, calibration
 * buckets, and per-action improvement hints.
 */
export function verifyPredictions(input: VerifyPredictionsInput): PredictionVerificationReport {
  const prodRecords = input.repairRecords.filter(r => r.result !== 'dry-run');

  // Build cohort map: action → all production records
  const cohortMap = new Map<RemediationActionType, RepairRecordV2[]>();
  for (const r of prodRecords) {
    const bucket = cohortMap.get(r.action) ?? [];
    bucket.push(r);
    cohortMap.set(r.action, bucket);
  }

  // Verify each prediction
  const verified: VerifiedPrediction[] = input.predictions.map(({ prediction, predictionTs }) =>
    verifySingle(
      prediction,
      predictionTs,
      prodRecords,
      cohortMap.get(prediction.action) ?? [],
    ),
  );

  const verifiedCount   = verified.filter(v => v.verdict !== 'UNVERIFIED').length;
  const unverifiedCount = verified.length - verifiedCount;

  // Overall direction accuracy
  const withVerdict = verified.filter(v => v.verdict !== 'UNVERIFIED');
  const correctCount = withVerdict.filter(
    v => v.verdict === 'CORRECT' || v.verdict === 'CORRECT_FAILURE',
  ).length;
  const overallDirectionAccuracy = withVerdict.length > 0
    ? Math.round((correctCount / withVerdict.length) * 1000) / 1000
    : 0;

  // Overall calibration
  const withOutcome  = verified.filter(v => v.actualSuccess !== null);
  const meanPred     = withOutcome.length > 0
    ? withOutcome.reduce((s, v) => s + v.predictedProbability, 0) / withOutcome.length
    : 0;
  const actualRate   = withOutcome.length > 0
    ? withOutcome.filter(v => v.actualSuccess).length / withOutcome.length
    : 0;
  let overallCalibration: CalibrationBand;
  if (withOutcome.length < 5) {
    overallCalibration = 'INSUFFICIENT_DATA';
  } else {
    const delta = meanPred - actualRate;
    if      (delta >  0.10) overallCalibration = 'OVER_CONFIDENT';
    else if (delta < -0.10) overallCalibration = 'UNDER_CONFIDENT';
    else                    overallCalibration = 'WELL_CALIBRATED';
  }

  // Overall recovery accuracy
  const withRecov    = verified.filter(v => v.recoveryMinutesDelta !== null);
  const meanAbsError = withRecov.length > 0
    ? Math.round(
        withRecov.reduce((s, v) => s + Math.abs(v.recoveryMinutesDelta!), 0) /
        withRecov.length,
      )
    : null;

  // Dominant recovery accuracy tier
  let overallRecoveryTier: RecoveryAccuracyTier = 'NO_DATA';
  if (withRecov.length > 0) {
    const acc   = withRecov.filter(v => v.recoveryAccuracyTier === 'ACCURATE').length;
    const under = withRecov.filter(v => v.recoveryAccuracyTier === 'UNDERSHOT').length;
    const over  = withRecov.filter(v => v.recoveryAccuracyTier === 'OVERSHOT').length;
    const dom   = Math.max(acc, under, over);
    if      (dom === acc)   overallRecoveryTier = 'ACCURATE';
    else if (dom === under) overallRecoveryTier = 'UNDERSHOT';
    else                    overallRecoveryTier = 'OVERSHOT';
  }

  // Calibration buckets
  const calibrationBuckets = buildCalibrationBuckets(verified);

  // Per-action profiles
  const actions = [...new Set(verified.map(v => v.prediction.action))] as RemediationActionType[];
  const byAction = actions
    .map(a => buildActionProfile(a, verified))
    .sort((a, b) => b.totalPredictions - a.totalPredictions);

  // Categorise actions
  const overConfidentActions  = byAction
    .filter(p => p.calibrationBand === 'OVER_CONFIDENT')
    .map(p => p.action);
  const underConfidentActions = byAction
    .filter(p => p.calibrationBand === 'UNDER_CONFIDENT')
    .map(p => p.action);
  const wellCalibratedActions = byAction
    .filter(p => p.calibrationBand === 'WELL_CALIBRATED')
    .map(p => p.action);

  // Overall score
  const score = computeOverallScore(
    overallDirectionAccuracy,
    overallCalibration,
    overallRecoveryTier,
  );

  return {
    windowMs:                 input.windowMs,
    totalPredictions:         verified.length,
    verifiedCount,
    unverifiedCount,
    overallDirectionAccuracy,
    overallCalibration,
    meanAbsRecoveryError:     meanAbsError,
    overallAccuracyScore:     score,
    accuracyTier:             accuracyTier(score, verifiedCount),
    byAction,
    calibrationBuckets,
    verifiedPredictions:      verified,
    overConfidentActions,
    underConfidentActions,
    wellCalibratedActions,
    generatedAt:              new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Single-record convenience: verify one prediction against one repair record
// ---------------------------------------------------------------------------

/**
 * Verify a single prediction against a known repair record.
 * Useful for post-execution inline verification (no archive scan needed).
 */
export function verifySinglePrediction(
  prediction:  OutcomePrediction,
  record:      RepairRecordV2,
): VerifiedPrediction {
  const actualSuccess        = record.result === 'success';
  const predictedSuccess     = prediction.successProbability >= 0.50;
  const actualRecoveryMinutes = record.durationMs > 0
    ? Math.round(record.durationMs / 60_000)
    : null;

  const recoveryDelta = (actualRecoveryMinutes !== null)
    ? prediction.expectedRecoveryMinutes - actualRecoveryMinutes
    : null;

  let recoveryAccuracyTier: RecoveryAccuracyTier = 'NO_DATA';
  if (actualRecoveryMinutes !== null && prediction.expectedRecoveryMinutes > 0) {
    const ratio = actualRecoveryMinutes / prediction.expectedRecoveryMinutes;
    if      (ratio > 1.30) recoveryAccuracyTier = 'UNDERSHOT';
    else if (ratio < 0.70) recoveryAccuracyTier = 'OVERSHOT';
    else                   recoveryAccuracyTier = 'ACCURATE';
  }

  let verdict: VerificationVerdict;
  if ( predictedSuccess &&  actualSuccess) verdict = 'CORRECT';
  else if (!predictedSuccess && !actualSuccess) verdict = 'CORRECT_FAILURE';
  else if ( predictedSuccess && !actualSuccess) verdict = 'FALSE_POSITIVE';
  else                                          verdict = 'FALSE_NEGATIVE';

  return {
    prediction,
    matchedRecord:        record,
    actualSuccess,
    actualRecoveryMinutes,
    predictedProbability: prediction.successProbability,
    cohortSuccessRate:    null,
    recoveryMinutesDelta: recoveryDelta,
    recoveryAccuracyTier,
    verdict,
  };
}
