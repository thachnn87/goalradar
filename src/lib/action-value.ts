/**
 * action-value.ts — DATA-18T Phase 2
 *
 * Benefit / Cost Analysis.
 *
 * Computes:
 *   ExpectedBenefit    — risk reduction × business impact prevented
 *   ExecutionCost      — risk of the action itself × rollback complexity
 *   RiskAdjustedValue  — benefit scaled by evidence quality confidence
 *   NetDecisionValue   — RiskAdjustedValue - ExecutionCost  (-1..+1)
 *
 * NetDecisionValue > 0 → action is worth taking
 * NetDecisionValue ≤ 0 → cost/risk exceeds expected benefit; reconsider
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType } from './auto-remediation';
import type { BusinessTier }          from './business-impact';
import type { BlastTier }             from './blast-radius';
import type { ScoreTier }             from './risk-priority';
import type { EvidenceQuality }       from './risk-priority';
import {
  EXECUTION_RISK_RANK,
  type ExecutionRisk,
  type RollbackComplexity,
} from './action-governance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenefitCostInput {
  action:               RemediationActionType;
  /** Composite priority score 0–100 — proxy for P(failure) × business impact. */
  priorityScore:        number;
  /** Business criticality of the failure being prevented. */
  businessTier:         BusinessTier;
  /** Blast radius tier of the failure being prevented. */
  blastTier:            BlastTier;
  /** Risk tier of the composite priority score. */
  riskTier:             ScoreTier;
  /** Evidence quality from the KB / repair history. */
  evidenceQuality:      EvidenceQuality;
  /** Adaptive or production confidence (0–1). */
  actionConfidence:     number;
  /** From governance registry. */
  executionRisk:        ExecutionRisk;
  /** From governance registry. */
  rollbackComplexity:   RollbackComplexity;
  /** Number of matches affected (scales blast benefit). */
  matchesAffected:      number;
}

export interface BenefitCostResult {
  action:            RemediationActionType;
  /** 0–1: how much business harm is prevented if action succeeds. */
  expectedBenefit:   number;
  /** 0–1: cost/risk of the action itself (execution risk + rollback complexity). */
  executionCost:     number;
  /** expectedBenefit × actionConfidence (evidence-adjusted benefit). */
  riskAdjustedValue: number;
  /** riskAdjustedValue - executionCost. Range: −1..+1. */
  netDecisionValue:  number;
  /** Human-readable verdict. */
  verdict:           'STRONGLY_RECOMMENDED' | 'RECOMMENDED' | 'MARGINAL' | 'NOT_RECOMMENDED';
  reasoning:         string[];
}

// ---------------------------------------------------------------------------
// Tier → score mapping
// ---------------------------------------------------------------------------

const BIZ_SCORE: Record<BusinessTier, number> = {
  CRITICAL: 1.00, HIGH: 0.75, MEDIUM: 0.45, LOW: 0.20,
};

const BLAST_SCORE: Record<BlastTier, number> = {
  CRITICAL: 1.00, HIGH: 0.75, MEDIUM: 0.45, LOW: 0.20,
};

const ROLLBACK_COST: Record<RollbackComplexity, number> = {
  NONE: 0.00, SIMPLE: 0.05, MODERATE: 0.15, COMPLEX: 0.30, IRREVERSIBLE: 0.50,
};

const EVIDENCE_MULTIPLIER: Record<EvidenceQuality, number> = {
  HIGH: 1.00, MEDIUM: 0.75, LOW: 0.50,
};

// ---------------------------------------------------------------------------
// computeBenefitCost
// ---------------------------------------------------------------------------

/**
 * Compute the benefit/cost profile for a single action recommendation.
 */
export function computeBenefitCost(input: BenefitCostInput): BenefitCostResult {
  // ── Expected Benefit ────────────────────────────────────────────────────
  // How much harm is prevented = weighted combination of:
  //   priority score (P × I from DATA-18S)
  //   business tier (what's at stake)
  //   blast tier (scope of prevention)
  const priorityFrac  = input.priorityScore / 100;
  const bizFrac       = BIZ_SCORE[input.businessTier];
  const blastFrac     = BLAST_SCORE[input.blastTier];

  // Benefit = harmonic-ish blend: weight priority 50%, business 30%, blast 20%
  const expectedBenefit = Math.min(1,
    priorityFrac * 0.50 +
    bizFrac      * 0.30 +
    blastFrac    * 0.20,
  );

  // ── Execution Cost ──────────────────────────────────────────────────────
  // Cost = execution risk normalised (0–1) + rollback complexity cost
  const execRiskScore  = EXECUTION_RISK_RANK[input.executionRisk] / 4;  // 0–1
  const rollbackScore  = ROLLBACK_COST[input.rollbackComplexity];
  // Weight: execution risk 70%, rollback 30%
  const executionCost  = Math.min(1, execRiskScore * 0.70 + rollbackScore * 0.30);

  // ── Risk-Adjusted Value ─────────────────────────────────────────────────
  // Scale benefit down by how reliable the evidence is and our confidence
  const evidenceMultiplier = EVIDENCE_MULTIPLIER[input.evidenceQuality];
  const riskAdjustedValue  = Math.min(1, expectedBenefit * evidenceMultiplier * input.actionConfidence);

  // ── Net Decision Value ──────────────────────────────────────────────────
  const netDecisionValue = Math.round((riskAdjustedValue - executionCost) * 1000) / 1000;

  // ── Verdict ─────────────────────────────────────────────────────────────
  let verdict: BenefitCostResult['verdict'];
  if (netDecisionValue >= 0.40)                verdict = 'STRONGLY_RECOMMENDED';
  else if (netDecisionValue >= 0.10)            verdict = 'RECOMMENDED';
  else if (netDecisionValue >= -0.05)           verdict = 'MARGINAL';
  else                                          verdict = 'NOT_RECOMMENDED';

  // ── Reasoning ───────────────────────────────────────────────────────────
  const reasoning: string[] = [
    `Expected benefit: ${Math.round(expectedBenefit * 100)}% ` +
      `(priority=${input.priorityScore}/100, biz=${input.businessTier}, blast=${input.blastTier})`,
    `Execution cost: ${Math.round(executionCost * 100)}% ` +
      `(risk=${input.executionRisk}, rollback=${input.rollbackComplexity})`,
    `Risk-adjusted value: ${Math.round(riskAdjustedValue * 100)}% ` +
      `(evidence=${input.evidenceQuality} × confidence=${Math.round(input.actionConfidence * 100)}%)`,
    `Net decision value: ${netDecisionValue >= 0 ? '+' : ''}${netDecisionValue.toFixed(3)} → ${verdict}`,
  ];

  if (input.matchesAffected > 0) {
    reasoning.push(`Scope: ${input.matchesAffected} match(es) protected`);
  }

  return {
    action:            input.action,
    expectedBenefit:   Math.round(expectedBenefit   * 1000) / 1000,
    executionCost:     Math.round(executionCost      * 1000) / 1000,
    riskAdjustedValue: Math.round(riskAdjustedValue  * 1000) / 1000,
    netDecisionValue,
    verdict,
    reasoning,
  };
}
