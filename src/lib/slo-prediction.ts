/**
 * slo-prediction.ts — DATA-18P Phase 5
 *
 * Extends DATA-18N/DATA-18H SLO compliance with forward-looking breach prediction.
 *
 * Uses linear regression over the last N archive records to extrapolate the
 * 24-hour compliance trajectory and compute P(SLO breach within 24 h).
 *
 * Pure computation — no I/O. Additive — does not modify slo-compliance.ts.
 *
 * SLO targets (from DATA18G_SLO.md):
 *   scoreAccuracy24h     — target 99.99%  — drift.red === 0
 *   authorityFreshness24h — target 99%   — !stale && source=primary
 *   enrichmentCoverage24h — target 95%   — unenriched === 0
 */

import type { HealthArchiveRecord } from './health-archive';
import { computeSLO }               from './slo-compliance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SLOPrediction {
  /** SLO name. */
  name:              string;
  /** SLO target compliance % (e.g. 99.99). */
  target:            number;
  /** Current compliance % over the observed window. */
  currentPct:        number;
  /** Extrapolated compliance % in 24 h if trend continues. */
  predictedPct24h:   number;
  /** P(compliance drops below target within 24 h). 0..1. */
  breachProbability: number;
  /** 'improving' | 'stable' | 'degrading' based on slope. */
  trend:             'improving' | 'stable' | 'degrading';
  /** Number of archive records used for prediction. */
  observations:      number;
  /** true if current value is already below target. */
  alreadyBreached:   boolean;
  /** Confidence in the prediction. */
  confidence:        'low' | 'medium' | 'high';
}

export interface SLOBreachPrediction {
  scoreAccuracy24h:      SLOPrediction;
  authorityFreshness24h: SLOPrediction;
  enrichmentCoverage24h: SLOPrediction;
  /** true if any SLO is predicted to breach within 24 h. */
  anyPredictedBreach:    boolean;
  /** ISO timestamp of the prediction. */
  predictedAt:           string;
}

// ---------------------------------------------------------------------------
// Linear regression helper
// ---------------------------------------------------------------------------

/**
 * Simple OLS slope over (x=index, y=value) pairs.
 * Returns the slope (change per unit index), or 0 if fewer than 2 points.
 */
function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  const num   = xs.reduce((s, x, i) => s + (x - xMean) * (values[i] - yMean), 0);
  const den   = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

/**
 * Convert slope + current value to a P(breach within 24h horizon).
 *
 * Strategy:
 *   - If already breached → 0.99 (almost certain continued breach)
 *   - If trend is strongly negative and projected value crosses target:
 *       P = clamp(0.1 + distance_to_target / range * 0.8, 0, 0.99)
 *   - If stable or improving → low P
 */
function breachProbability(
  currentPct:    number,
  predictedPct:  number,
  target:        number,
  alreadyBreached: boolean,
): number {
  if (alreadyBreached) return 0.99;
  const gap = currentPct - target;          // positive = safe headroom
  const delta = predictedPct - currentPct; // negative = declining

  if (predictedPct < target) {
    // Projection crosses target within the horizon
    const crossDepth = Math.abs(predictedPct - target);
    return Math.min(0.90, 0.55 + crossDepth / Math.max(1, target) * 2);
  }

  if (delta < -0.5 && gap < 2) {
    // Declining fast and close to target → moderate risk
    return Math.min(0.45, 0.1 + (2 - gap) * 0.1 + Math.abs(delta) * 0.05);
  }

  if (delta < 0 && gap < 1) {
    // Slow decline, very close to target
    return 0.25;
  }

  return Math.max(0, 0.05 - gap * 0.005);  // healthy headroom → very low P
}

function trendLabel(slope: number): 'improving' | 'stable' | 'degrading' {
  if (slope >  0.3) return 'improving';
  if (slope < -0.3) return 'degrading';
  return 'stable';
}

function confidenceLevel(observations: number): 'low' | 'medium' | 'high' {
  if (observations >= 12) return 'high';
  if (observations >= 4)  return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// predictSLOBreaches
// ---------------------------------------------------------------------------

/**
 * Predict SLO compliance for the next 24 h using the supplied archive records.
 *
 * @param records  Health archive records, oldest → newest.
 *                 Uses the most recent 48 records for regression (≈12 h at 15-min intervals).
 * @param nowMs    Current epoch ms (for predictedAt timestamp).
 */
export function predictSLOBreaches(
  records: HealthArchiveRecord[],
  nowMs:   number,
): SLOBreachPrediction {
  const predictedAt = new Date(nowMs).toISOString();

  // Use the most recent 48 records for regression (≈12 h of history at 15-min intervals)
  const window = records.slice(-48);
  const n = window.length;

  // Overall SLO metrics from the observed window
  const overall = computeSLO(window);

  // ── Score Accuracy ──────────────────────────────────────────────────────────
  const scoreValues = window.map(r =>
    r.drift.verdict !== 'ERROR' && r.drift.red === 0 ? 100 : 0,
  );
  const scoreSlope       = linearSlope(scoreValues);
  const scoreCurrent     = overall.scoreAccuracy.compliancePct;
  // Each archive record is ~15 min; 24 h = 96 periods ahead
  const scorePredicted   = Math.min(100, Math.max(0, scoreCurrent + scoreSlope * 96));
  const scoreBreached    = scoreCurrent < 99.99;
  const scoreBreachProb  = breachProbability(scoreCurrent, scorePredicted, 99.99, scoreBreached);

  const scoreAccuracy24h: SLOPrediction = {
    name:              'Score Accuracy',
    target:            99.99,
    currentPct:        scoreCurrent,
    predictedPct24h:   Math.round(scorePredicted * 100) / 100,
    breachProbability: Math.round(scoreBreachProb * 1000) / 1000,
    trend:             trendLabel(scoreSlope),
    observations:      n,
    alreadyBreached:   scoreBreached,
    confidence:        confidenceLevel(n),
  };

  // ── Authority Freshness ─────────────────────────────────────────────────────
  const freshValues = window.map(r =>
    r.freshness.verdict !== 'ERROR' && !r.freshness.stale && r.freshness.source === 'primary'
      ? 100 : 0,
  );
  const freshSlope      = linearSlope(freshValues);
  const freshCurrent    = overall.freshness.compliancePct;
  const freshPredicted  = Math.min(100, Math.max(0, freshCurrent + freshSlope * 96));
  const freshBreached   = freshCurrent < 99;
  const freshBreachProb = breachProbability(freshCurrent, freshPredicted, 99, freshBreached);

  const authorityFreshness24h: SLOPrediction = {
    name:              'Authority Freshness',
    target:            99,
    currentPct:        freshCurrent,
    predictedPct24h:   Math.round(freshPredicted * 100) / 100,
    breachProbability: Math.round(freshBreachProb * 1000) / 1000,
    trend:             trendLabel(freshSlope),
    observations:      n,
    alreadyBreached:   freshBreached,
    confidence:        confidenceLevel(n),
  };

  // ── Enrichment Coverage ──────────────────────────────────────────────────────
  const enrichValues = window
    .filter(r => r.enrichment.rate !== null)
    .map(r => (r.enrichment.rate! >= 0.95 ? 100 : 0));
  const enrichSlope      = linearSlope(enrichValues);
  const enrichCurrent    = overall.enrichment.compliancePct;
  const enrichPredicted  = Math.min(100, Math.max(0, enrichCurrent + enrichSlope * 96));
  const enrichBreached   = enrichCurrent < 95;
  const enrichBreachProb = breachProbability(enrichCurrent, enrichPredicted, 95, enrichBreached);

  const enrichmentCoverage24h: SLOPrediction = {
    name:              'Enrichment Coverage',
    target:            95,
    currentPct:        enrichCurrent,
    predictedPct24h:   Math.round(enrichPredicted * 100) / 100,
    breachProbability: Math.round(enrichBreachProb * 1000) / 1000,
    trend:             trendLabel(enrichSlope),
    observations:      n,
    alreadyBreached:   enrichBreached,
    confidence:        confidenceLevel(n),
  };

  const anyPredictedBreach =
    scoreBreachProb  > 0.3 ||
    freshBreachProb  > 0.3 ||
    enrichBreachProb > 0.3;

  return {
    scoreAccuracy24h,
    authorityFreshness24h,
    enrichmentCoverage24h,
    anyPredictedBreach,
    predictedAt,
  };
}
