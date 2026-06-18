/**
 * trust-evolution.ts — DATA-18U.4 Phase 5
 *
 * Trust Evolution Model.
 *
 * Pure simulation — no KV reads or writes. Models how confidence,
 * promotionScore, and trustLevel evolve as production executions accumulate.
 *
 * Simulates: 1, 3, 5, 10, 20 successes for every action.
 * Uses the same calibration formula as confidence-calibration.ts so the
 * simulation matches what the real engine will produce.
 *
 * No side effects. Additive — modifies no existing file.
 */

import type { RemediationActionType }           from './auto-remediation';
import type { TrustLevel, AutomationReadiness } from './trust-framework';
import { getGovernance }                        from './action-governance';

// ---------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------->

export interface EvolutionSnapshot {
  /** Number of successful production executions at this point. */
  successCount:       number;
  /** Simulated calibrated confidence at this point. */
  confidence:         number;
  /** Simulated promotionScore 0–100. */
  promotionScore:     number;
  /** Simulated trust level. */
  trustLevel:         TrustLevel;
  /** Simulated readiness. */
  readiness:          AutomationReadiness;
  /** Whether coverage gate is met at this point. */
  coverageMet:        boolean;
  /** Whether confidence gate is met at this point. */
  confidenceMet:      boolean;
  /** Whether verification gate is met at this point (assuming 100% verify). */
  verificationMet:    boolean;
  /** Whether all HIGH_TRUST gates are met. */
  allGatesMet:        boolean;
}

export interface ActionEvolution {
  action:             RemediationActionType;
  /** Simulation checkpoints. */
  snapshots:          EvolutionSnapshot[];
  /** Success count at which LIMITED_READY is first reached (null if not in range). */
  limitedReadyAt:     number | null;
  /** Success count at which READY is first reached (null if not in range). */
  readyAt:            number | null;
  /** Confidence at each checkpoint. */
  confidenceEvolution: number[];
  /** PromotionScore at each checkpoint. */
  promotionEvolution:  number[];
  /** Trust level at each checkpoint. */
  trustEvolution:      TrustLevel[];
}

export interface TrustEvolutionReport {
  simulations:         ActionEvolution[];
  /** Action that reaches READY with fewest executions. */
  fastestToReady:      RemediationActionType | null;
  /** Action with highest simulated confidence at 10 executions. */
  highestAt10:         RemediationActionType | null;
  generatedAt:         string;
}

// ---------------------------------------------------------------------------
// Simulation checkpoints
// ---------------------------------------------------------------------------

const CHECKPOINTS = [1, 3, 5, 10, 20] as const;

// ---------------------------------------------------------------------------
// Confidence simulation
//
// Mirrors the calibration formula from confidence-calibration.ts exactly.
// Assumes: every execution is a success + verificationPassed=true.
// Avg improvement: 30 risk points (conservative estimate).
// ---------------------------------------------------------------------------

const AVG_IMPROVEMENT = 30;   // simulated avg risk reduction per action
const BASELINE        = 0.65; // registry default

function dampingFactor(n: number): number {
  if (n <  5) return 0.20;
  if (n < 10) return 0.40;
  if (n < 20) return 0.65;
  if (n < 50) return 0.85;
  return 1.00;
}

function simulateConfidence(n: number): number {
  // Apply calibration formula iteratively across n executions
  // Each execution: prodRate=1.0 (all success), vpr=1.0 (all verified)
  let conf = BASELINE;

  for (let i = 1; i <= n; i++) {
    const d         = dampingFactor(i);
    const prodDelta = (1.00 - conf) * 0.70 * d;
    const vprDelta  = (1.00 - conf) * 0.20 * d;
    const hardPenalty = 0;  // vpr=1.0, no penalty
    const improvBonus = Math.min(0.03, AVG_IMPROVEMENT * 0.02 * d);
    conf = Math.max(0.01, Math.min(0.99, conf + prodDelta + vprDelta + improvBonus - hardPenalty));
  }

  return Math.round(conf * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Promotion score simulation
// ---------------------------------------------------------------------------

function simulatePromotionScore(
  n:    number,
  conf: number,
  gov:  ReturnType<typeof getGovernance>,
): number {
  const coverageGate = Math.ceil(gov.productionCoverageRequired * 0.80);
  const covRatio     = Math.min(1.0, n / coverageGate);
  const vpr          = n >= 1 ? 1.00 : 0;   // assume all verified

  const dCoverage = covRatio >= 1.0 ? 100 : Math.round(covRatio * 100);
  const dVerify   = vpr >= 0.90 ? 100 : Math.round(vpr / 0.90 * 100);
  const dConf     = conf >= 0.85 ? 100 : Math.round(Math.max(0, (conf - 0.01) / (0.85 - 0.01) * 100));
  // Trend: assume POSITIVE after ≥3 executions, STABLE before
  const dTrend    = n >= 3 ? 100 : 50;
  // Recovery: assume consistent after ≥3 successful executions
  const dRecovery = n >= 3 ? 90 : (n >= 1 ? 20 : 0);

  return Math.round(
    dCoverage * 0.30 +
    dVerify   * 0.25 +
    dConf     * 0.20 +
    dTrend    * 0.15 +
    dRecovery * 0.10,
  );
}

// ---------------------------------------------------------------------------
// Trust classification simulation
// ---------------------------------------------------------------------------

function simulateTrust(
  n:    number,
  conf: number,
  gov:  ReturnType<typeof getGovernance>,
): { trustLevel: TrustLevel; readiness: AutomationReadiness; coverageMet: boolean; confMet: boolean; verMet: boolean; allMet: boolean } {
  const coverageGate = Math.ceil(gov.productionCoverageRequired * 0.80);
  const coverageMet  = n >= coverageGate;
  const confMet      = conf >= 0.85;
  const vpr          = n >= 1 ? 1.00 : 0;   // assume all verified
  const verMet       = vpr >= 0.90;
  const allMet       = coverageMet && confMet && verMet;
  const hasProd      = n > 0;

  const trustLevel: TrustLevel =
    allMet ? 'HIGH_TRUST' :
    conf >= 0.60 ? 'MEDIUM_TRUST' :
    'LOW_TRUST';

  const readiness: AutomationReadiness =
    allMet && hasProd ? 'READY' :
    conf >= 0.60 && hasProd ? 'LIMITED_READY' :
    'NOT_READY';

  return { trustLevel, readiness, coverageMet, confMet, verMet, allMet };
}

// ---------------------------------------------------------------------------
// Core: simulate one action
// ---------------------------------------------------------------------------

export function simulateEvolution(action: RemediationActionType): ActionEvolution {
  const gov = getGovernance(action);
  const snapshots: EvolutionSnapshot[] = [];

  let limitedReadyAt: number | null = null;
  let readyAt:        number | null = null;

  for (const n of CHECKPOINTS) {
    const conf     = simulateConfidence(n);
    const score    = simulatePromotionScore(n, conf, gov);
    const trust    = simulateTrust(n, conf, gov);

    if (trust.readiness === 'LIMITED_READY' && limitedReadyAt === null) limitedReadyAt = n;
    if (trust.readiness === 'READY'         && readyAt        === null) readyAt        = n;

    snapshots.push({
      successCount:    n,
      confidence:      conf,
      promotionScore:  score,
      trustLevel:      trust.trustLevel,
      readiness:       trust.readiness,
      coverageMet:     trust.coverageMet,
      confidenceMet:   trust.confMet,
      verificationMet: trust.verMet,
      allGatesMet:     trust.allMet,
    });
  }

  return {
    action,
    snapshots,
    limitedReadyAt,
    readyAt,
    confidenceEvolution: snapshots.map(s => s.confidence),
    promotionEvolution:  snapshots.map(s => s.promotionScore),
    trustEvolution:      snapshots.map(s => s.trustLevel),
  };
}

// ---------------------------------------------------------------------------
// Simulate all actions
// ---------------------------------------------------------------------------

const ALL_ACTIONS: RemediationActionType[] = [
  'PREWARM_SNAPSHOT', 'REBUILD_DR', 'REFRESH_ESPN_CACHE', 'RESOLVE_ESPN_LOOKUP',
  'SUPPRESS_REFRESH', 'TRIGGER_ORCHESTRATOR', 'MONITOR_SELF_HEAL',
  'ESCALATE_INCIDENT', 'NO_ACTION',
];

export function simulateAllEvolutions(
  actions: RemediationActionType[] = ALL_ACTIONS,
): TrustEvolutionReport {
  const simulations = actions.map(a => simulateEvolution(a));

  // Fastest to READY = smallest readyAt (excluding null, excluding NO_ACTION)
  const withReady = simulations.filter(s => s.readyAt !== null && s.action !== 'NO_ACTION');
  withReady.sort((a, b) => a.readyAt! - b.readyAt!);
  const fastestToReady = withReady.length > 0 ? withReady[0].action : null;

  // Highest confidence at 10 executions
  const at10 = simulations
    .filter(s => s.action !== 'NO_ACTION')
    .map(s => ({
      action: s.action,
      conf:   s.snapshots.find(p => p.successCount === 10)?.confidence ?? 0,
    }))
    .sort((a, b) => b.conf - a.conf);
  const highestAt10 = at10.length > 0 ? at10[0].action : null;

  return { simulations, fastestToReady, highestAt10, generatedAt: new Date().toISOString() };
}
