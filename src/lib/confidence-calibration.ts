/**
 * confidence-calibration.ts — DATA-18U.2 Phase 1
 *
 * Confidence Calibration Engine.
 *
 * Continuously adjusts predicted action confidence based on real production
 * outcomes, verification results, and historical accuracy signals.
 *
 * Rules:
 *   - Confidence bounded [0.01, 0.99]
 *   - Small sample sizes: reduced adjustment (damping)
 *   - Large sample sizes: adjustment dominates (converges to empirical rate)
 *   - Production data weighted higher than dry-run or simulation data
 *   - Verification failures penalize confidence
 *   - Verified production successes increase confidence
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType }      from './auto-remediation';
import type { RepairRecordV2 }             from './action-effectiveness';
import type { ActionAccuracyProfile }      from './prediction-verification';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalibrationDirection = 'INCREASE' | 'DECREASE' | 'STABLE';

export type CalibrationSource = 'production' | 'verification' | 'mixed';

export interface ConfidenceCalibration {
  action:            RemediationActionType;

  oldConfidence:     number;   // 0.01–0.99 — input confidence
  adjustment:        number;   // signed delta applied
  newConfidence:     number;   // 0.01–0.99 — output confidence

  direction:         CalibrationDirection;
  reason:            string;

  evidenceCount:     number;
  calibrationSource: CalibrationSource;
}

/** Inputs sourced from DATA-18Q, DATA-18R, DATA-18U Phase 3. */
export interface CalibrationInput {
  action:               RemediationActionType;
  /** Current predicted confidence (0–1). Comes from adaptive or production engine. */
  currentConfidence:    number;
  /** Production repair records (result !== 'dry-run'). */
  productionRecords:    RepairRecordV2[];
  /** Accuracy profile from prediction-verification Phase 3, or null if unavailable. */
  verificationProfile:  ActionAccuracyProfile | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const CONFIDENCE_MIN = 0.01;
const CONFIDENCE_MAX = 0.99;

function clamp(v: number): number {
  return Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, v));
}

/**
 * Damping factor based on sample size.
 * Very few records → small adjustments (avoid over-reacting to noise).
 * Many records → full adjustment (trust the empirical signal).
 *
 *   n < 5   → 0.20
 *   n 5–9   → 0.40
 *   n 10–19 → 0.65
 *   n 20–49 → 0.85
 *   n ≥ 50  → 1.00
 */
function dampingFactor(n: number): number {
  if (n <  5) return 0.20;
  if (n < 10) return 0.40;
  if (n < 20) return 0.65;
  if (n < 50) return 0.85;
  return 1.00;
}

/** Production success rate from repair records. Returns null if n = 0. */
function productionSuccessRate(records: RepairRecordV2[]): number | null {
  if (records.length === 0) return null;
  const succ = records.filter(r => r.result === 'success').length;
  return succ / records.length;
}

/** Average improvement (riskBefore − riskAfter) from RepairRecordV2 fields. */
function avgImprovement(records: RepairRecordV2[]): number | null {
  const withBoth = records.filter(r => r.riskBefore !== null && r.riskAfter !== null);
  if (withBoth.length === 0) return null;
  return withBoth.reduce((s, r) => s + (r.riskBefore! - r.riskAfter!), 0) / withBoth.length;
}

/** Verification pass rate from RepairRecordV2.verificationPassed. */
function verificationPassRate(records: RepairRecordV2[]): number | null {
  const withResult = records.filter(r => r.verificationPassed !== null);
  if (withResult.length === 0) return null;
  return withResult.filter(r => r.verificationPassed).length / withResult.length;
}

// ---------------------------------------------------------------------------
// Core: calibrate one action
// ---------------------------------------------------------------------------

/**
 * Compute a calibrated confidence for one action.
 *
 * Calibration pipeline:
 *   1. Production success rate → primary signal (weight 0.70 × damping)
 *   2. Verification pass rate  → verification signal (weight 0.20 × damping)
 *   3. Prediction accuracy     → from Phase 3 profile (weight 0.10 × damping)
 *   4. Improvement bonus       → small positive bump for verified risk reduction
 *
 * Adjustment = weighted_delta × damping, then clamped.
 */
export function calibrateConfidence(input: CalibrationInput): ConfidenceCalibration {
  const { action, productionRecords, verificationProfile } = input;
  const old = clamp(input.currentConfidence);

  const n      = productionRecords.length;
  const dampen = dampingFactor(n);

  const reasons: string[] = [];
  let totalAdjustment = 0;
  let source: CalibrationSource = 'production';

  // ── Signal 1: production success rate (weight 0.70) ──────────────────────
  const prodRate = productionSuccessRate(productionRecords);
  if (prodRate !== null) {
    const prodDelta  = (prodRate - old) * 0.70 * dampen;
    totalAdjustment += prodDelta;
    reasons.push(
      `Production: ${Math.round(prodRate * 100)}% success rate over ${n} live executions` +
      ` (Δ${prodDelta >= 0 ? '+' : ''}${prodDelta.toFixed(3)})`,
    );
  } else {
    reasons.push('No production executions — production signal absent');
  }

  // ── Signal 2: verification pass rate (weight 0.20) ───────────────────────
  const vpr = verificationPassRate(productionRecords);
  if (vpr !== null) {
    const vprDelta   = (vpr - old) * 0.20 * dampen;
    totalAdjustment += vprDelta;
    source = prodRate !== null ? 'mixed' : 'verification';
    reasons.push(
      `Verification: ${Math.round(vpr * 100)}% post-repair pass rate` +
      ` (Δ${vprDelta >= 0 ? '+' : ''}${vprDelta.toFixed(3)})`,
    );
    // Hard penalty: verification failures below 50% drag confidence down harder
    if (vpr < 0.50) {
      const penalty = (0.50 - vpr) * 0.10 * dampen;
      totalAdjustment -= penalty;
      reasons.push(
        `Verification failure penalty: pass rate ${Math.round(vpr * 100)}% < 50%` +
        ` (Δ-${penalty.toFixed(3)})`,
      );
    }
  } else if (prodRate === null) {
    source = 'verification';
  }

  // ── Signal 3: prediction accuracy from Phase 3 profile (weight 0.10) ─────
  if (verificationProfile !== null && verificationProfile.verifiedPredictions >= 5) {
    const dirAcc     = verificationProfile.directionAccuracy;
    const accDelta   = (dirAcc - old) * 0.10 * dampen;
    totalAdjustment += accDelta;
    if (source === 'production') source = 'mixed';
    reasons.push(
      `Prediction accuracy: ${Math.round(dirAcc * 100)}% direction accuracy over ` +
      `${verificationProfile.verifiedPredictions} verified predictions` +
      ` (Δ${accDelta >= 0 ? '+' : ''}${accDelta.toFixed(3)})`,
    );
  }

  // ── Signal 4: improvement bonus (up to +0.03) ────────────────────────────
  const avgImp = avgImprovement(productionRecords);
  if (avgImp !== null && avgImp > 0) {
    const bonus = Math.min(0.03, avgImp * 0.02 * dampen);
    totalAdjustment += bonus;
    reasons.push(
      `Risk improvement bonus: avg reduction ${avgImp.toFixed(1)} pts → +${bonus.toFixed(3)}`,
    );
  }

  // ── No-data fallback ──────────────────────────────────────────────────────
  if (n === 0 && verificationProfile === null) {
    reasons.push('Insufficient data — confidence unchanged');
    source = 'production';
  }

  // ── Apply and clamp ───────────────────────────────────────────────────────
  const adjustment  = Math.round(totalAdjustment * 1000) / 1000;
  const newConf     = clamp(old + adjustment);
  const actual_adj  = Math.round((newConf - old) * 1000) / 1000;

  const direction: CalibrationDirection =
    actual_adj >  0.002 ? 'INCREASE' :
    actual_adj < -0.002 ? 'DECREASE' :
    'STABLE';

  return {
    action,
    oldConfidence:     Math.round(old     * 1000) / 1000,
    adjustment:        actual_adj,
    newConfidence:     Math.round(newConf * 1000) / 1000,
    direction,
    reason:            reasons.join('; '),
    evidenceCount:     n,
    calibrationSource: source,
  };
}

// ---------------------------------------------------------------------------
// Calibrate all actions at once
// ---------------------------------------------------------------------------

export interface CalibrateAllInput {
  /** Per-action calibration inputs (one entry per action with data). */
  inputs:              CalibrationInput[];
  /** Accuracy profiles from prediction-verification (keyed by action). */
  verificationProfiles: Map<RemediationActionType, ActionAccuracyProfile>;
}

export interface CalibrationReport {
  calibrations:       ConfidenceCalibration[];
  increasing:         RemediationActionType[];
  decreasing:         RemediationActionType[];
  stable:             RemediationActionType[];
  largestIncrease:    ConfidenceCalibration | null;
  largestDecrease:    ConfidenceCalibration | null;
  generatedAt:        string;
}

/**
 * Calibrate confidence for all actions and return a summary report.
 */
export function calibrateAllActions(inputs: CalibrationInput[]): CalibrationReport {
  const calibrations = inputs.map(i => calibrateConfidence(i));

  const increasing = calibrations.filter(c => c.direction === 'INCREASE').map(c => c.action);
  const decreasing = calibrations.filter(c => c.direction === 'DECREASE').map(c => c.action);
  const stable     = calibrations.filter(c => c.direction === 'STABLE').map(c => c.action);

  const largestIncrease = calibrations
    .filter(c => c.direction === 'INCREASE')
    .sort((a, b) => b.adjustment - a.adjustment)[0] ?? null;

  const largestDecrease = calibrations
    .filter(c => c.direction === 'DECREASE')
    .sort((a, b) => a.adjustment - b.adjustment)[0] ?? null;

  return {
    calibrations,
    increasing,
    decreasing,
    stable,
    largestIncrease,
    largestDecrease,
    generatedAt: new Date().toISOString(),
  };
}
