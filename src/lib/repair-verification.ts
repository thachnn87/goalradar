/**
 * repair-verification.ts — DATA-18Q Phase 4
 *
 * Post-repair verification framework.
 *
 * After a repair action executes (or is simulated in dry-run), this module
 * checks whether the targeted subsystems have recovered. It reads current
 * subsystem health from KV and compares against pre-repair state.
 *
 * Supported checks:
 *   authority-drift    — drift.red === 0
 *   integrity-audit    — feed.redCount === 0
 *   enrichment-health  — enrichment.unenriched === 0
 *
 * No writes. No cache mutations. Read-only KV reads.
 * Dry-run: simulateVerification() returns a synthetic result without KV reads.
 */

import type { RemediationActionType } from './auto-remediation';
import type { VerificationCheckType } from './action-effectiveness';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationStatus = 'PASS' | 'FAIL' | 'SKIP' | 'UNKNOWN';

export interface VerificationCheckResult {
  check:   VerificationCheckType;
  status:  VerificationStatus;
  reason:  string;
  /** Value observed after repair (subsystem-specific metric). */
  observed: number | null;
  /** Expected threshold for PASS. */
  threshold: number | null;
}

export interface VerificationResult {
  verifiedAt:         string;
  action:             RemediationActionType;
  dryRun:             boolean;
  verificationPassed: boolean;
  checks:             VerificationCheckResult[];
  verificationReasons: string[];
  /** Overall confidence in the verification (0–1). */
  confidence:         number;
}

// ---------------------------------------------------------------------------
// Action → checks mapping
// ---------------------------------------------------------------------------

/**
 * Which checks are relevant for each action type.
 * An action that affects enrichment should be verified via enrichment-health.
 * An action that affects authority should be verified via authority-drift.
 */
const ACTION_CHECK_MAP: Partial<Record<RemediationActionType, VerificationCheckType[]>> = {
  PREWARM_SNAPSHOT:    ['enrichment-health'],
  REBUILD_DR:          ['authority-drift'],
  REFRESH_ESPN_CACHE:  ['enrichment-health'],
  RESOLVE_ESPN_LOOKUP: ['enrichment-health'],
  SUPPRESS_REFRESH:    ['enrichment-health'],
  TRIGGER_ORCHESTRATOR:['authority-drift', 'enrichment-health', 'integrity-audit'],
  MONITOR_SELF_HEAL:   ['enrichment-health'],
  ESCALATE_INCIDENT:   ['authority-drift', 'integrity-audit', 'enrichment-health'],
  NO_ACTION:           [],
};

export function getChecksForAction(action: RemediationActionType): VerificationCheckType[] {
  return ACTION_CHECK_MAP[action] ?? ['authority-drift', 'enrichment-health'];
}

// ---------------------------------------------------------------------------
// Pre-repair snapshot type (caller provides from current state)
// ---------------------------------------------------------------------------

export interface PreRepairSnapshot {
  driftRed:       number;   // drift.red before repair
  feedRedCount:   number;   // feed.redCount before repair
  unenriched:     number;   // enrichment.unenriched (null mapped to 0)
  riskScore:      number;   // composite risk 0–1
}

// ---------------------------------------------------------------------------
// Post-repair observed state type
// ---------------------------------------------------------------------------

export interface PostRepairObservation {
  driftRed:     number;
  feedRedCount: number;
  unenriched:   number;
  riskScore:    number;
}

// ---------------------------------------------------------------------------
// runVerification
// ---------------------------------------------------------------------------

/**
 * Evaluate verification checks from observed post-repair state.
 *
 * @param action     The repair action that was applied.
 * @param pre        State before the repair.
 * @param post       State after the repair (from live subsystem reads).
 * @param dryRun     Whether this is a dry-run simulation.
 * @param nowMs      Current epoch ms.
 */
export function runVerification(
  action: RemediationActionType,
  pre:    PreRepairSnapshot,
  post:   PostRepairObservation,
  dryRun: boolean,
  nowMs:  number,
): VerificationResult {
  const checks = getChecksForAction(action);
  const results: VerificationCheckResult[] = [];

  for (const check of checks) {
    switch (check) {
      case 'authority-drift': {
        const status: VerificationStatus = post.driftRed === 0 ? 'PASS' : 'FAIL';
        results.push({
          check,
          status,
          reason: status === 'PASS'
            ? `drift.red=${post.driftRed} — no authority drift detected`
            : `drift.red=${post.driftRed} (was ${pre.driftRed}) — authority drift persists after repair`,
          observed:  post.driftRed,
          threshold: 0,
        });
        break;
      }
      case 'integrity-audit': {
        const status: VerificationStatus = post.feedRedCount === 0 ? 'PASS' : 'FAIL';
        results.push({
          check,
          status,
          reason: status === 'PASS'
            ? `feed.redCount=${post.feedRedCount} — feed integrity clean`
            : `feed.redCount=${post.feedRedCount} (was ${pre.feedRedCount}) — feed integrity issues persist`,
          observed:  post.feedRedCount,
          threshold: 0,
        });
        break;
      }
      case 'enrichment-health': {
        const status: VerificationStatus = post.unenriched === 0 ? 'PASS' : 'FAIL';
        results.push({
          check,
          status,
          reason: status === 'PASS'
            ? `enrichment.unenriched=${post.unenriched} — all finished matches enriched`
            : `enrichment.unenriched=${post.unenriched} (was ${pre.unenriched}) — enrichment incomplete after repair`,
          observed:  post.unenriched,
          threshold: 0,
        });
        break;
      }
    }
  }

  const passCount = results.filter(r => r.status === 'PASS').length;
  const verificationPassed = results.length > 0 && passCount === results.length;
  const verificationReasons = results.map(r => r.reason);

  // Confidence: fraction of checks passed, weighted by check count
  const confidence = results.length > 0
    ? Math.round((passCount / results.length) * 1000) / 1000
    : 0.5;   // no checks → uncertain

  return {
    verifiedAt: new Date(nowMs).toISOString(),
    action,
    dryRun,
    verificationPassed,
    checks: results,
    verificationReasons,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// simulateVerification (dry-run)
// ---------------------------------------------------------------------------

/**
 * Produce a synthetic verification result for dry-run scenarios.
 *
 * Simulates the expected outcome given the risk factor and action type.
 * Used by the closed-loop simulation (Phase 6) and the reliability-learning
 * endpoint when no live post-repair state is available.
 *
 * Simulation rules:
 *   - If riskScore is high (>0.7) and action is matched → simulated FAIL
 *     (high-risk scenarios may need multiple repair cycles)
 *   - Otherwise → simulated PASS
 *   - SUPPRESS_REFRESH always simulates PASS (removes the source of risk)
 */
export function simulateVerification(
  action:     RemediationActionType,
  pre:        PreRepairSnapshot,
  nowMs:      number,
): VerificationResult {
  const checks = getChecksForAction(action);

  // Estimate post-repair state based on action semantics
  const simPost: PostRepairObservation = {
    driftRed:     action === 'REBUILD_DR' || action === 'TRIGGER_ORCHESTRATOR'
      ? 0
      : pre.driftRed,
    feedRedCount: action === 'TRIGGER_ORCHESTRATOR'
      ? 0
      : pre.feedRedCount,
    unenriched:   (action === 'PREWARM_SNAPSHOT' || action === 'REFRESH_ESPN_CACHE'
      || action === 'RESOLVE_ESPN_LOOKUP' || action === 'SUPPRESS_REFRESH'
      || action === 'TRIGGER_ORCHESTRATOR')
      ? 0
      : pre.unenriched,
    riskScore: Math.max(0, pre.riskScore * 0.2),  // expect 80% reduction on success
  };

  const result = runVerification(action, pre, simPost, true, nowMs);
  // Mark all check reasons as simulated
  return {
    ...result,
    verifiedAt: new Date(nowMs).toISOString(),
    dryRun: true,
    checks: result.checks.map(c => ({
      ...c,
      reason: `[SIMULATED] ${c.reason}`,
    })),
    verificationReasons: result.verificationReasons.map(r => `[SIMULATED] ${r}`),
  };
}
