/**
 * prediction-drift.ts — DATA-18U.2 Phase 3
 *
 * Prediction Drift Detection.
 *
 * Detects whether prediction accuracy for each action is improving (POSITIVE),
 * degrading (NEGATIVE), or flat (FLAT) over time, using a sliding window of
 * confidence history records.
 *
 * Drift is computed from a minimum of 3 time-ordered accuracy snapshots.
 * Uses linear regression slope over the snapshot series to classify direction.
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType } from './auto-remediation';
import type { ConfidenceRecord }      from './confidence-history';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriftDirection = 'POSITIVE' | 'NEGATIVE' | 'FLAT';

export interface DriftSignal {
  action:              RemediationActionType;

  drift:               DriftDirection;
  /** Most recent confidence value. */
  currentAccuracy:     number;
  /** Confidence value at the start of the observation window. */
  previousAccuracy:    number;
  /** currentAccuracy − previousAccuracy. Positive = improving. */
  delta:               number;

  /** Linear regression slope over all snapshots (confidence per day). */
  confidenceTrend:     number;
  /** Number of data points used. */
  snapshotCount:       number;

  recommendation:      string;
}

export interface DriftReport {
  signals:            DriftSignal[];
  positiveActions:    RemediationActionType[];
  negativeActions:    RemediationActionType[];
  flatActions:        RemediationActionType[];
  /** Action with largest positive delta. */
  topImproving:       RemediationActionType | null;
  /** Action with largest negative delta. */
  topDegrading:       RemediationActionType | null;
  generatedAt:        string;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Minimum absolute delta to register as non-FLAT drift. */
const DRIFT_THRESHOLD = 0.03;
/** Minimum snapshots required for drift detection. */
const MIN_SNAPSHOTS   = 3;

// ---------------------------------------------------------------------------
// Internal: ordinary least squares slope
// ---------------------------------------------------------------------------

/**
 * Compute the OLS slope (change per unit x) over (x, y) pairs.
 * x = days since first observation, y = confidence value.
 */
function olsSlope(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  if (n < 2) return 0;

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;

  const num = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
  const den = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);

  return den === 0 ? 0 : num / den;
}

// ---------------------------------------------------------------------------
// Internal: build time-ordered snapshots from history records
// ---------------------------------------------------------------------------

/**
 * Bucket confidence records into daily snapshots (mean newConfidence per day).
 * Returns at most one value per calendar day, sorted ascending.
 */
function buildSnapshots(
  records:  ConfidenceRecord[],
  nowMs:    number,
): Array<{ dayIndex: number; confidence: number }> {
  if (records.length === 0) return [];

  const MS_PER_DAY = 86_400_000;
  const buckets    = new Map<number, number[]>();

  for (const r of records) {
    const daysAgo = Math.floor((nowMs - r.ts) / MS_PER_DAY);
    const list    = buckets.get(daysAgo) ?? [];
    list.push(r.newConfidence);
    buckets.set(daysAgo, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b - a) // oldest first (largest daysAgo first → low dayIndex)
    .map(([daysAgo, vals], idx) => ({
      dayIndex:   idx,
      confidence: vals.reduce((s, v) => s + v, 0) / vals.length,
    }));
}

// ---------------------------------------------------------------------------
// Core: detect drift for one action
// ---------------------------------------------------------------------------

/**
 * Detect drift for a single action from its confidence history.
 * Returns null if fewer than MIN_SNAPSHOTS are available.
 */
export function detectPredictionDrift(
  action:   RemediationActionType,
  records:  ConfidenceRecord[],
  nowMs:    number,
): DriftSignal | null {
  const snapshots = buildSnapshots(records, nowMs);
  if (snapshots.length < MIN_SNAPSHOTS) return null;

  const first   = snapshots[0].confidence;
  const last    = snapshots[snapshots.length - 1].confidence;
  const delta   = Math.round((last - first) * 1000) / 1000;

  const slope = olsSlope(snapshots.map(s => ({ x: s.dayIndex, y: s.confidence })));
  const confidenceTrend = Math.round(slope * 1000) / 1000; // per day

  let drift: DriftDirection;
  if      (delta >  DRIFT_THRESHOLD) drift = 'POSITIVE';
  else if (delta < -DRIFT_THRESHOLD) drift = 'NEGATIVE';
  else                               drift = 'FLAT';

  // Recommendation
  let recommendation: string;
  if (drift === 'POSITIVE') {
    recommendation =
      `Confidence trending up (Δ+${delta.toFixed(3)}, slope +${confidenceTrend.toFixed(4)}/day). ` +
      `Continue accumulating production evidence — approaching automation candidacy.`;
  } else if (drift === 'NEGATIVE') {
    recommendation =
      `Confidence degrading (Δ${delta.toFixed(3)}, slope ${confidenceTrend.toFixed(4)}/day). ` +
      `Investigate recent repair failures. Do not promote to automation until drift reverses.`;
  } else {
    recommendation =
      `Confidence stable (Δ${delta.toFixed(3)}). ` +
      `Accumulate more verified production outcomes to establish a clear trend.`;
  }

  return {
    action,
    drift,
    currentAccuracy:  Math.round(last  * 1000) / 1000,
    previousAccuracy: Math.round(first * 1000) / 1000,
    delta,
    confidenceTrend,
    snapshotCount:    snapshots.length,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Multi-action drift report
// ---------------------------------------------------------------------------

export interface DriftInput {
  action:  RemediationActionType;
  records: ConfidenceRecord[];
}

/**
 * Detect drift for all actions and return a summary report.
 * Actions with insufficient history are silently omitted from signals.
 */
export function detectAllDrift(inputs: DriftInput[], nowMs: number): DriftReport {
  const signals: DriftSignal[] = inputs
    .map(i => detectPredictionDrift(i.action, i.records, nowMs))
    .filter((s): s is DriftSignal => s !== null);

  const positiveActions = signals.filter(s => s.drift === 'POSITIVE').map(s => s.action);
  const negativeActions = signals.filter(s => s.drift === 'NEGATIVE').map(s => s.action);
  const flatActions     = signals.filter(s => s.drift === 'FLAT').map(s => s.action);

  const topImproving = signals
    .filter(s => s.drift === 'POSITIVE')
    .sort((a, b) => b.delta - a.delta)[0]?.action ?? null;

  const topDegrading = signals
    .filter(s => s.drift === 'NEGATIVE')
    .sort((a, b) => a.delta - b.delta)[0]?.action ?? null;

  return {
    signals,
    positiveActions,
    negativeActions,
    flatActions,
    topImproving,
    topDegrading,
    generatedAt: new Date().toISOString(),
  };
}
