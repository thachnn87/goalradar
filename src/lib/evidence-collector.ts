/**
 * evidence-collector.ts — DATA-18U.3 Phase 1
 *
 * Evidence Inventory.
 *
 * Aggregates all available production evidence from every reliability
 * data source into a single per-action ActionEvidenceSummary:
 *
 *   repair-history          — execution counts, success/failure, durations
 *   confidence-history      — calibrated confidence + trend
 *   confidence-calibration  — current confidence snapshot
 *   prediction-drift        — confidence direction
 *   trust-framework         — trustLevel + automationReadiness
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType }  from './auto-remediation';
import type { RepairRecordV2 }         from './action-effectiveness';
import type { ConfidenceRecord }       from './confidence-history';
import type { TrustLevel, AutomationReadiness } from './trust-framework';
import type { DriftDirection }         from './prediction-drift';
import type { CalibrationDirection }   from './confidence-calibration';
import { getGovernance }               from './action-governance';
import { recoveryMinutesP50, recoveryMinutesP95 } from './action-outcomes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecoveryStats {
  avgMinutes:  number | null;
  p50Minutes:  number | null;
  p95Minutes:  number | null;
  /** Coefficient of variation (stddev / mean): 0 = perfectly consistent. */
  consistency: number | null;
}

export interface ActionEvidenceSummary {
  action: RemediationActionType;

  // ── Execution counts ──────────────────────────────────────────────────────
  totalExecutions:       number;   // all records (including dry-run)
  productionExecutions:  number;   // result !== 'dry-run'
  successfulExecutions:  number;
  failedExecutions:      number;
  skippedExecutions:     number;

  // ── Verification ─────────────────────────────────────────────────────────
  verificationPassed:    number;
  verificationFailed:    number;
  verificationCoverage:  number;   // 0–1: (passed+failed) / productionExecutions
  verificationPassRate:  number | null;  // null if no verifications

  // ── Recovery timing ───────────────────────────────────────────────────────
  recovery:              RecoveryStats;
  /** Registry P50 estimate (minutes) for comparison. */
  registryP50Minutes:    number;
  /** Registry P95 estimate (minutes) for comparison. */
  registryP95Minutes:    number;

  // ── Confidence ────────────────────────────────────────────────────────────
  confidenceCurrent:     number;   // latest calibrated value
  confidenceBaseline:    number;   // registry default (0.65)
  confidenceDelta:       number;   // current − baseline
  confidenceTrend:       DriftDirection | null;
  calibrationDirection:  CalibrationDirection;

  // ── Trust ─────────────────────────────────────────────────────────────────
  trustLevel:            TrustLevel;
  readiness:             AutomationReadiness;

  // ── Coverage vs requirement ───────────────────────────────────────────────
  productionCoverageRequired: number;
  productionCoverageRatio:    number;   // 0–1 (can exceed 1 if over-covered)

  // ── Evidence quality ──────────────────────────────────────────────────────
  evidenceStrength:      'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  evidenceNote:          string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.min(idx, sorted.length - 1)];
}

function stddev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeRecovery(successRecs: RepairRecordV2[]): RecoveryStats {
  const mins = successRecs
    .map(r => r.durationMs)
    .filter((d): d is number => d > 0)
    .map(d => Math.round(d / 60_000))
    .sort((a, b) => a - b);

  if (mins.length === 0) return { avgMinutes: null, p50Minutes: null, p95Minutes: null, consistency: null };

  const avg = mins.reduce((s, v) => s + v, 0) / mins.length;
  const cv  = avg > 0 ? stddev(mins, avg) / avg : 0;

  return {
    avgMinutes:  Math.round(avg),
    p50Minutes:  percentile(mins, 50),
    p95Minutes:  percentile(mins, 95),
    consistency: Math.round((1 - Math.min(cv, 1)) * 1000) / 1000,  // 0 = chaotic, 1 = consistent
  };
}

function evidenceStrength(
  productionExecutions: number,
  verificationPassRate: number | null,
  confidenceDelta:      number,
): ActionEvidenceSummary['evidenceStrength'] {
  if (productionExecutions === 0)  return 'NONE';
  if (productionExecutions < 5)    return 'WEAK';
  const hasGoodVerify = verificationPassRate !== null && verificationPassRate >= 0.70;
  const hasGoodConf   = confidenceDelta > 0.10;
  if (productionExecutions >= 20 && hasGoodVerify && hasGoodConf) return 'STRONG';
  if (productionExecutions >= 5  && (hasGoodVerify || hasGoodConf)) return 'MODERATE';
  return 'WEAK';
}

function evidenceNote(summary: Omit<ActionEvidenceSummary, 'evidenceStrength' | 'evidenceNote'>): string {
  if (summary.productionExecutions === 0) {
    return `No production executions recorded. Registry defaults apply. ` +
           `Requires ≥${summary.productionCoverageRequired} live executions to exit NOT_READY.`;
  }
  const gap = Math.max(0, summary.productionCoverageRequired - summary.productionExecutions);
  if (gap > 0) {
    return `${summary.productionExecutions}/${summary.productionCoverageRequired} required executions. ` +
           `${gap} more needed to meet coverage gate.`;
  }
  if (summary.trustLevel === 'HIGH_TRUST') {
    return `Coverage met. HIGH_TRUST achieved. Action is a READY candidate.`;
  }
  return `Coverage met (${summary.productionExecutions} executions). ` +
         `Confidence at ${Math.round(summary.confidenceCurrent * 100)}% — target ≥ 85% for HIGH_TRUST.`;
}

// ---------------------------------------------------------------------------
// Core: collect evidence for one action
// ---------------------------------------------------------------------------

export interface CollectEvidenceInput {
  action:               RemediationActionType;
  allRecords:           RepairRecordV2[];          // all repair records for this action
  confidenceRecords:    ConfidenceRecord[];         // confidence-history records for this action
  confidenceCurrent:    number;                    // from calibrateConfidence()
  calibrationDirection: CalibrationDirection;
  driftDirection:       DriftDirection | null;
  trustLevel:           TrustLevel;
  readiness:            AutomationReadiness;
}

export function collectEvidence(input: CollectEvidenceInput): ActionEvidenceSummary {
  const { action, allRecords, confidenceCurrent, calibrationDirection, driftDirection, trustLevel, readiness } = input;
  const gov = getGovernance(action);

  const prod    = allRecords.filter(r => r.result !== 'dry-run');
  const succ    = prod.filter(r => r.result === 'success');
  const fail    = prod.filter(r => r.result === 'failure');
  const skip    = prod.filter(r => r.result === 'skipped');

  const verWithResult = prod.filter(r => r.verificationPassed !== null);
  const verPassed     = verWithResult.filter(r => r.verificationPassed === true).length;
  const verFailed     = verWithResult.filter(r => r.verificationPassed === false).length;
  const vpr: number | null = verWithResult.length > 0 ? verPassed / verWithResult.length : null;

  const recovery         = computeRecovery(succ);
  const confidenceDelta  = Math.round((confidenceCurrent - 0.65) * 1000) / 1000;
  const prodCovRatio     = Math.min(2.0, prod.length / gov.productionCoverageRequired);

  const partial: Omit<ActionEvidenceSummary, 'evidenceStrength' | 'evidenceNote'> = {
    action,
    totalExecutions:            allRecords.length,
    productionExecutions:       prod.length,
    successfulExecutions:       succ.length,
    failedExecutions:           fail.length,
    skippedExecutions:          skip.length,
    verificationPassed:         verPassed,
    verificationFailed:         verFailed,
    verificationCoverage:       prod.length > 0 ? Math.round(verWithResult.length / prod.length * 1000) / 1000 : 0,
    verificationPassRate:       vpr !== null ? Math.round(vpr * 1000) / 1000 : null,
    recovery,
    registryP50Minutes:         recoveryMinutesP50(action),
    registryP95Minutes:         recoveryMinutesP95(action),
    confidenceCurrent:          Math.round(confidenceCurrent * 1000) / 1000,
    confidenceBaseline:         0.65,
    confidenceDelta,
    confidenceTrend:            driftDirection,
    calibrationDirection,
    trustLevel,
    readiness,
    productionCoverageRequired: gov.productionCoverageRequired,
    productionCoverageRatio:    Math.round(prodCovRatio * 1000) / 1000,
  };

  const strength = evidenceStrength(prod.length, vpr, confidenceDelta);
  const note     = evidenceNote(partial);

  return { ...partial, evidenceStrength: strength, evidenceNote: note };
}

// ---------------------------------------------------------------------------
// Collect evidence for all actions
// ---------------------------------------------------------------------------

export interface CollectAllEvidenceInput {
  /** All repair records (90d window recommended). Map will be built internally. */
  allRepairRecords:     RepairRecordV2[];
  /** All confidence-history records (90d window). */
  allConfidenceRecords: ConfidenceRecord[];
  /** Per-action calibrated confidence. */
  confidenceMap:        Map<RemediationActionType, number>;
  /** Per-action calibration direction. */
  directionMap:         Map<RemediationActionType, CalibrationDirection>;
  /** Per-action drift direction. */
  driftMap:             Map<RemediationActionType, DriftDirection>;
  /** Per-action trust classification. */
  trustMap:             Map<RemediationActionType, { trustLevel: TrustLevel; readiness: AutomationReadiness }>;
  /** Actions to evaluate. */
  actions:              RemediationActionType[];
}

export function collectAllEvidence(input: CollectAllEvidenceInput): ActionEvidenceSummary[] {
  const { allRepairRecords, allConfidenceRecords, confidenceMap, directionMap, driftMap, trustMap, actions } = input;

  // Pre-bucket records by action
  const repairByAction  = new Map<RemediationActionType, RepairRecordV2[]>();
  const confByAction    = new Map<RemediationActionType, ConfidenceRecord[]>();

  for (const r of allRepairRecords) {
    const bucket = repairByAction.get(r.action) ?? [];
    bucket.push(r);
    repairByAction.set(r.action, bucket);
  }
  for (const r of allConfidenceRecords) {
    const bucket = confByAction.get(r.action) ?? [];
    bucket.push(r);
    confByAction.set(r.action, bucket);
  }

  return actions.map(action => {
    const trust = trustMap.get(action) ?? { trustLevel: 'LOW_TRUST' as TrustLevel, readiness: 'NOT_READY' as AutomationReadiness };
    return collectEvidence({
      action,
      allRecords:           repairByAction.get(action) ?? [],
      confidenceRecords:    confByAction.get(action)   ?? [],
      confidenceCurrent:    confidenceMap.get(action)   ?? 0.65,
      calibrationDirection: directionMap.get(action)    ?? 'STABLE',
      driftDirection:       driftMap.get(action)        ?? null,
      trustLevel:           trust.trustLevel,
      readiness:            trust.readiness,
    });
  });
}
