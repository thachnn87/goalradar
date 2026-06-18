/**
 * action-effectiveness.ts — DATA-18Q Phase 2 + 3
 *
 * Computes per-action effectiveness analytics from extended repair records
 * (RepairRecordV2 — DATA-18Q Phase 1 schema evolution).
 *
 * Phase 2: successRate, avgImprovement, avgRecoveryTime, sampleSize per action.
 * Phase 3: Adaptive numeric confidence (0.00–1.00) derived from historical success,
 *          sample size, and risk reduction — replaces static 'low'|'medium'|'high'.
 *
 * Pure computation — no I/O. Additive — does not modify repair-history.ts.
 */

import type { RemediationActionType } from './auto-remediation';

// ---------------------------------------------------------------------------
// Phase 1 — Extended repair record schema (additive fields)
// ---------------------------------------------------------------------------

/**
 * Extended RepairRecord with outcome comparison fields.
 * These fields are optional so existing RepairRecord archives remain compatible.
 */
export interface RepairRecordV2 {
  ts:            number;
  recordedAt:    string;
  matchId:       number | null;
  home:          string | null;
  away:          string | null;
  action:        RemediationActionType;
  reason:        string;
  result:        'success' | 'failure' | 'skipped' | 'dry-run';
  durationMs:    number;
  triggeredBy:   string;
  featureEnabled: boolean;
  errorMessage:  string | null;

  // ── DATA-18Q Phase 1 additions ──────────────────────────────────────────
  /** Composite risk score (0–1) BEFORE the repair was applied. */
  riskBefore:          number | null;
  /** Composite risk score (0–1) measured after the repair completed. */
  riskAfter:           number | null;
  /** Absolute improvement: riskBefore - riskAfter (positive = better). */
  improvement:         number | null;
  /** Whether a post-repair verification check passed (null = not performed). */
  verificationPassed:  boolean | null;
  /** Which verification checks were run (subset of supported types). */
  verificationChecks:  VerificationCheckType[];
}

export type VerificationCheckType =
  | 'authority-drift'
  | 'integrity-audit'
  | 'enrichment-health';

// ---------------------------------------------------------------------------
// Phase 2 — Per-action effectiveness analytics
// ---------------------------------------------------------------------------

export interface ActionEffectiveness {
  action:          RemediationActionType;
  sampleSize:      number;
  /** Success rate excluding dry-run records (0–100). */
  successRate:     number;
  /** Mean (riskBefore - riskAfter) across records where both are present. */
  avgImprovement:  number | null;
  /** Mean durationMs for successful repairs. */
  avgRecoveryTime: number | null;
  /** Mean riskBefore across all samples (how risky the situations were). */
  avgRiskBefore:   number | null;
  /** Mean riskAfter across successful repairs. */
  avgRiskAfter:    number | null;
  /** Fraction of repairs where verificationPassed=true (null if no checks run). */
  verificationPassRate: number | null;
  /** Adaptive numeric confidence (Phase 3). */
  adaptiveConfidence:   number;
}

export interface EffectivenessReport {
  computedAt:        string;
  totalRecords:      number;
  actionCount:       number;
  byAction:          ActionEffectiveness[];
  /** Top 3 by adaptiveConfidence (sufficient sample + high success). */
  topActions:        ActionEffectiveness[];
  /** Bottom 3 by adaptiveConfidence — candidates for review. */
  weakActions:       ActionEffectiveness[];
  /** All actions ranked by adaptiveConfidence descending. */
  confidenceRanking: Array<{ action: RemediationActionType; confidence: number; sampleSize: number }>;
}

// ---------------------------------------------------------------------------
// Phase 3 — Adaptive confidence model
// ---------------------------------------------------------------------------

/**
 * Compute a numeric confidence score (0.00–1.00) for an action based on:
 *   - Base: historical success rate (0–1)
 *   - Sample size penalty: shrinks toward 0.5 when sampleSize < SAMPLE_FLOOR
 *   - Risk reduction bonus: average improvement contributes up to +0.15
 *   - Verification bonus: verificationPassRate contributes up to +0.10
 *
 * Formula:
 *   raw     = successRate * sampleWeight + 0.5 * (1 - sampleWeight)
 *   bonus   = improvementBonus + verificationBonus
 *   result  = clamp(raw + bonus, 0.01, 0.99)
 */
function computeAdaptiveConfidence(
  successRate:          number,   // 0..100
  sampleSize:           number,
  avgImprovement:       number | null,
  verificationPassRate: number | null,
): number {
  const SAMPLE_FLOOR  = 10;  // below this, uncertainty penalty applies
  const SAMPLE_CAP    = 50;  // above this, full weight

  // Sample weight: ramp from 0.5 at n=1 to 1.0 at n=SAMPLE_CAP
  const sampleWeight = sampleSize >= SAMPLE_CAP
    ? 1.0
    : 0.5 + 0.5 * (sampleSize / SAMPLE_CAP);

  // Base: blend success rate toward 0.5 as sample thins
  const baseFraction = successRate / 100;
  const raw = baseFraction * sampleWeight + 0.5 * (1 - sampleWeight);

  // Sample floor penalty: shrink further below floor
  const floorPenalty = sampleSize < SAMPLE_FLOOR
    ? (SAMPLE_FLOOR - sampleSize) / SAMPLE_FLOOR * 0.15
    : 0;

  // Risk reduction bonus (0..0.15): full bonus at improvement >= 0.5
  const improvementBonus = avgImprovement !== null
    ? Math.min(0.15, avgImprovement * 0.30)
    : 0;

  // Verification bonus (0..0.10): full bonus at 100% pass rate
  const verificationBonus = verificationPassRate !== null
    ? verificationPassRate * 0.10
    : 0;

  const result = raw - floorPenalty + improvementBonus + verificationBonus;
  return Math.round(Math.min(0.99, Math.max(0.01, result)) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// computeEffectiveness
// ---------------------------------------------------------------------------

/**
 * Compute per-action effectiveness analytics from a set of extended repair records.
 *
 * @param records  RepairRecordV2 records, any window (caller filters by time).
 * @param nowMs    Current epoch ms (for computedAt timestamp).
 */
export function computeEffectiveness(
  records: RepairRecordV2[],
  nowMs:   number,
): EffectivenessReport {
  const computedAt = new Date(nowMs).toISOString();

  // Group by action
  const groups = new Map<RemediationActionType, RepairRecordV2[]>();
  for (const r of records) {
    const list = groups.get(r.action) ?? [];
    list.push(r);
    groups.set(r.action, list);
  }

  const byAction: ActionEffectiveness[] = [];

  for (const [action, recs] of groups) {
    const sampleSize  = recs.length;
    const nonDryRun   = recs.filter(r => r.result !== 'dry-run');
    const successes   = nonDryRun.filter(r => r.result === 'success');
    const successRate = nonDryRun.length > 0
      ? Math.round((successes.length / nonDryRun.length) * 1000) / 10
      : 100;

    // avgImprovement — only where both riskBefore and riskAfter are present
    const improvRecs = recs.filter(r => r.riskBefore !== null && r.riskAfter !== null);
    const avgImprovement = improvRecs.length > 0
      ? Math.round(
          improvRecs.reduce((s, r) => s + (r.riskBefore! - r.riskAfter!), 0)
          / improvRecs.length * 1000,
        ) / 1000
      : null;

    // avgRiskBefore/After
    const riskBeforeRecs = recs.filter(r => r.riskBefore !== null);
    const avgRiskBefore = riskBeforeRecs.length > 0
      ? Math.round(
          riskBeforeRecs.reduce((s, r) => s + r.riskBefore!, 0)
          / riskBeforeRecs.length * 1000,
        ) / 1000
      : null;

    const riskAfterRecs = successes.filter(r => r.riskAfter !== null);
    const avgRiskAfter = riskAfterRecs.length > 0
      ? Math.round(
          riskAfterRecs.reduce((s, r) => s + r.riskAfter!, 0)
          / riskAfterRecs.length * 1000,
        ) / 1000
      : null;

    // avgRecoveryTime — successful repairs only
    const durRecs = successes.filter(r => r.durationMs > 0);
    const avgRecoveryTime = durRecs.length > 0
      ? Math.round(durRecs.reduce((s, r) => s + r.durationMs, 0) / durRecs.length)
      : null;

    // verificationPassRate
    const verifiedRecs = recs.filter(r => r.verificationPassed !== null);
    const verificationPassRate = verifiedRecs.length > 0
      ? Math.round(
          verifiedRecs.filter(r => r.verificationPassed).length / verifiedRecs.length * 1000,
        ) / 1000
      : null;

    const adaptiveConfidence = computeAdaptiveConfidence(
      successRate,
      sampleSize,
      avgImprovement,
      verificationPassRate,
    );

    byAction.push({
      action,
      sampleSize,
      successRate,
      avgImprovement,
      avgRecoveryTime,
      avgRiskBefore,
      avgRiskAfter,
      verificationPassRate,
      adaptiveConfidence,
    });
  }

  // Sort by confidence descending
  byAction.sort((a, b) => b.adaptiveConfidence - a.adaptiveConfidence);

  const topActions  = byAction.slice(0, 3);
  const weakActions = [...byAction].reverse().slice(0, 3);

  const confidenceRanking = byAction.map(e => ({
    action:     e.action,
    confidence: e.adaptiveConfidence,
    sampleSize: e.sampleSize,
  }));

  return {
    computedAt,
    totalRecords: records.length,
    actionCount:  groups.size,
    byAction,
    topActions,
    weakActions,
    confidenceRanking,
  };
}
