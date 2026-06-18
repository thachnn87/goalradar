/**
 * evidence-progress.ts — DATA-18U.4 Phase 3
 *
 * Evidence Accumulation Tracker.
 *
 * For every action, computes exactly how far it has progressed toward
 * each trust gate and what remains. Outputs EvidenceProgress with
 * percent-complete per dimension and absolute remaining gaps.
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType }      from './auto-remediation';
import type { AutomationReadiness, TrustLevel } from './trust-framework';
import type { ActionEvidenceSummary }      from './evidence-collector';
import { getGovernance }                   from './action-governance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Progress toward one specific gate. */
export interface GateProgress {
  gate:         string;
  current:      number;
  target:       number;
  remaining:    number;
  progressPct:  number;   // 0–100
  met:          boolean;
}

/** Full per-action evidence progress. */
export interface EvidenceProgress {
  action:               RemediationActionType;
  currentReadiness:     AutomationReadiness;
  currentTrust:         TrustLevel;

  /** 0–100: weighted progress toward READY (mirrors promotionScore logic). */
  progressPercent:      number;

  // ── Per-gate remaining ────────────────────────────────────────────────────
  remainingExecutions:  number;   // to meet 80% coverage gate
  remainingVerification: number | null;  // gap in pass rate to 0.90 (null = no data yet)
  remainingConfidence:  number;   // gap to 0.85 (0 if already met)
  remainingCoverage:    number;   // fraction still needed (0 if met)

  // ── Gate details ─────────────────────────────────────────────────────────
  gates:                GateProgress[];

  // ── ETA ──────────────────────────────────────────────────────────────────
  /** Conservative: 1 execution/day. */
  etaDaysConservative:  number | null;
  /** Optimistic: 3 executions/day. */
  etaDaysOptimistic:    number | null;

  progressNote:         string;
}

// ---------------------------------------------------------------------------
// Targets (mirrors trust-framework.ts — do not change independently)
// ---------------------------------------------------------------------------

const TARGET_CONFIDENCE  = 0.85;
const TARGET_VERIFY_RATE = 0.90;
const COVERAGE_RATIO     = 0.80;

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export function computeEvidenceProgress(summary: ActionEvidenceSummary): EvidenceProgress {
  const gov           = getGovernance(summary.action);
  const coverageGate  = Math.ceil(gov.productionCoverageRequired * COVERAGE_RATIO);
  const n             = summary.productionExecutions;
  const vpr           = summary.verificationPassRate;
  const conf          = summary.confidenceCurrent;

  // ── Gate 1: any production evidence ───────────────────────────────────
  const evidenceGate: GateProgress = {
    gate:        'any-production-evidence',
    current:     Math.min(n, 1),
    target:      1,
    remaining:   n === 0 ? 1 : 0,
    progressPct: n > 0 ? 100 : 0,
    met:         n > 0,
  };

  // ── Gate 2: production coverage (80% of required) ─────────────────────
  const coverageGateProgress: GateProgress = {
    gate:        'production-coverage',
    current:     n,
    target:      coverageGate,
    remaining:   Math.max(0, coverageGate - n),
    progressPct: Math.round(Math.min(100, n / coverageGate * 100)),
    met:         n >= coverageGate,
  };

  // ── Gate 3: confidence ≥ 0.85 ──────────────────────────────────────────
  const confProgress: GateProgress = {
    gate:        'confidence',
    current:     conf,
    target:      TARGET_CONFIDENCE,
    remaining:   Math.max(0, Math.round((TARGET_CONFIDENCE - conf) * 1000) / 1000),
    progressPct: Math.round(Math.min(100, Math.max(0, (conf - 0.01) / (TARGET_CONFIDENCE - 0.01) * 100))),
    met:         conf >= TARGET_CONFIDENCE,
  };

  // ── Gate 4: verification pass rate ≥ 0.90 ─────────────────────────────
  const verGate: GateProgress = {
    gate:        'verification-pass-rate',
    current:     vpr ?? 0,
    target:      TARGET_VERIFY_RATE,
    remaining:   vpr !== null ? Math.max(0, Math.round((TARGET_VERIFY_RATE - vpr) * 1000) / 1000) : TARGET_VERIFY_RATE,
    progressPct: vpr !== null ? Math.round(Math.min(100, vpr / TARGET_VERIFY_RATE * 100)) : 0,
    met:         vpr !== null && vpr >= TARGET_VERIFY_RATE,
  };

  const gates = [evidenceGate, coverageGateProgress, confProgress, verGate];

  // ── Overall progress (weighted gate completion) ────────────────────────
  // Mirrors promotionScore weights loosely: coverage 30, verify 25, conf 20, trend 15, recovery 10
  // Here we weight: evidence×5 + coverage×30 + verify×30 + confidence×35
  const progressPercent = Math.round(
    evidenceGate.progressPct           *  5 / 100 +
    coverageGateProgress.progressPct   * 30 / 100 +
    verGate.progressPct                * 30 / 100 +
    confProgress.progressPct           * 35 / 100,
  );

  // ── Remaining gaps ──────────────────────────────────────────────────────
  const remainingExecutions   = coverageGateProgress.remaining;
  const remainingVerification = vpr !== null ? verGate.remaining : null;
  const remainingConfidence   = confProgress.remaining;
  const remainingCoverage     = Math.max(0, 1.0 - summary.productionCoverageRatio);

  // ── ETA: bottleneck is whichever unmet gate requires the most executions ─
  // Confidence requires ~2 executions per 0.03 improvement (empirical from calibration)
  const executionsForConf = remainingConfidence > 0
    ? Math.ceil(remainingConfidence / 0.03 * 2)
    : 0;
  const totalExecutionsNeeded = Math.max(remainingExecutions, executionsForConf);

  const etaDaysConservative = totalExecutionsNeeded > 0 ? totalExecutionsNeeded : null;
  const etaDaysOptimistic   = totalExecutionsNeeded > 0 ? Math.max(1, Math.ceil(totalExecutionsNeeded / 3)) : null;

  // ── Progress note ───────────────────────────────────────────────────────
  const unmetGates = gates.filter(g => !g.met);
  let progressNote: string;
  if (unmetGates.length === 0) {
    progressNote = `All gates met — READY.`;
  } else if (n === 0) {
    progressNote = `0% evidence: no production executions recorded. ` +
                   `${coverageGate} needed to reach coverage gate.`;
  } else {
    const topUnmet = unmetGates[0];
    progressNote =
      `${progressPercent}% complete. Top unmet gate: ${topUnmet.gate} ` +
      `(${topUnmet.current} / ${topUnmet.target}, ${topUnmet.progressPct}%). ` +
      `Est. ${etaDaysConservative ?? 0}d conservative / ${etaDaysOptimistic ?? 0}d optimistic.`;
  }

  return {
    action:               summary.action,
    currentReadiness:     summary.readiness,
    currentTrust:         summary.trustLevel,
    progressPercent,
    remainingExecutions,
    remainingVerification,
    remainingConfidence,
    remainingCoverage,
    gates,
    etaDaysConservative,
    etaDaysOptimistic,
    progressNote,
  };
}

/** Compute progress for all actions, sorted by progressPercent descending. */
export function computeAllProgress(summaries: ActionEvidenceSummary[]): EvidenceProgress[] {
  return summaries
    .map(s => computeEvidenceProgress(s))
    .sort((a, b) => b.progressPercent - a.progressPercent);
}
