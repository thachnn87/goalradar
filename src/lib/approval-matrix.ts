/**
 * approval-matrix.ts — DATA-18T Phase 3 + 4
 *
 * Phase 3 — Approval Matrix:
 *   Classifies each recommended action as AUTO | TEAM_LEAD | ADMIN | EMERGENCY_ONLY
 *   based on: Business Impact, Blast Radius, Execution Risk, Evidence Quality.
 *   Escalation rules override the base approval level from the registry.
 *
 * Phase 4 — Execution Readiness:
 *   Determines READY | REVIEW | BLOCKED status using:
 *   productionCoverage, verificationCoverage, evidenceQuality, confidence.
 *
 * Pure computation — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType } from './auto-remediation';
import type { BusinessTier }          from './business-impact';
import type { BlastTier }             from './blast-radius';
import type { EvidenceQuality }       from './risk-priority';
import {
  getGovernance,
  maxApproval,
  escalateApproval,
  APPROVAL_RANK,
  type ApprovalLevel,
  type ExecutionRisk,
} from './action-governance';
import type { BenefitCostResult } from './action-value';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReadinessStatus = 'READY' | 'REVIEW' | 'BLOCKED';

export interface ApprovalDecision {
  action:          RemediationActionType;
  requiredLevel:   ApprovalLevel;
  /** Plain-English reasons why this level was assigned. */
  escalationReasons: string[];
  /** Whether the feature flag alone is sufficient for execution. */
  flagSufficient:  boolean;
}

export interface ReadinessDecision {
  action:              RemediationActionType;
  status:              ReadinessStatus;
  /** Why this status was assigned. */
  reasons:             string[];
  /** Specific blockers that prevent READY status. */
  blockers:            string[];
  /** What would change the status to READY. */
  requirements:        string[];
}

export interface GovernanceVerdict {
  action:            RemediationActionType;
  approval:          ApprovalDecision;
  readiness:         ReadinessDecision;
  benefitCost:       BenefitCostResult;
  /** Combined verdict: can this action proceed? */
  canProceed:        boolean;
  /** Tier summary for dashboard display. */
  tier:              'AUTO_APPROVED' | 'REQUIRES_REVIEW' | 'BLOCKED';
  summary:           string;
}

// ---------------------------------------------------------------------------
// Phase 3 — Approval Matrix
// ---------------------------------------------------------------------------

/**
 * Derive the required approval level for an action given current context.
 *
 * Escalation rules (each adds one tier or jumps to EMERGENCY_ONLY):
 *   1. Business tier CRITICAL                          → escalate once
 *   2. Blast tier CRITICAL                             → escalate once
 *   3. Execution risk HIGH/CRITICAL                    → escalate once
 *   4. Evidence quality LOW                            → use lowEvidenceApprovalLevel
 *   5. System-wide action (mutatesKV + systemWide)     → escalate once
 *   6. Net decision value ≤ 0 (cost > benefit)         → ADMIN minimum
 *   7. Feature flag OFF                                → AUTO becomes TEAM_LEAD (safety gate)
 */
export function deriveApprovalLevel(
  action:           RemediationActionType,
  businessTier:     BusinessTier,
  blastTier:        BlastTier,
  executionRisk:    ExecutionRisk,
  evidenceQuality:  EvidenceQuality,
  netDecisionValue: number,
  featureEnabled:   boolean,
): ApprovalDecision {
  const gov = getGovernance(action);
  const escalationReasons: string[] = [];

  // Start from base level (or low-evidence level if evidence is insufficient)
  let level: ApprovalLevel = evidenceQuality === 'LOW'
    ? gov.lowEvidenceApprovalLevel
    : gov.baseApprovalLevel;

  if (evidenceQuality === 'LOW') {
    escalationReasons.push(`Evidence quality LOW → using lowEvidenceApprovalLevel (${gov.lowEvidenceApprovalLevel})`);
  }

  // Rule 1: Business CRITICAL
  if (businessTier === 'CRITICAL') {
    level = escalateApproval(level);
    escalationReasons.push('Business impact CRITICAL → +1 approval tier');
  }

  // Rule 2: Blast CRITICAL
  if (blastTier === 'CRITICAL') {
    level = escalateApproval(level);
    escalationReasons.push('Blast radius CRITICAL → +1 approval tier');
  }

  // Rule 3: Execution risk HIGH/CRITICAL
  if (executionRisk === 'HIGH' || executionRisk === 'CRITICAL') {
    level = maxApproval(level, 'TEAM_LEAD');
    escalationReasons.push(`Execution risk ${executionRisk} → minimum TEAM_LEAD`);
  }

  // Rule 5: System-wide KV mutating actions need extra care
  if (gov.mutatesKV && gov.systemWide) {
    level = maxApproval(level, 'TEAM_LEAD');
    escalationReasons.push('System-wide KV mutation → minimum TEAM_LEAD');
  }

  // Rule 6: Net decision value ≤ 0
  if (netDecisionValue <= 0) {
    level = maxApproval(level, 'ADMIN');
    escalationReasons.push(`Net decision value ${netDecisionValue.toFixed(3)} ≤ 0 (cost ≥ benefit) → minimum ADMIN`);
  }

  // Rule 7: Feature flag OFF — AUTO becomes TEAM_LEAD (no auto-execution without flag)
  if (!featureEnabled && level === 'AUTO') {
    level = 'TEAM_LEAD';
    escalationReasons.push('AUTONOMOUS_RELIABILITY_ENABLED=false → AUTO escalated to TEAM_LEAD');
  }

  const flagSufficient =
    featureEnabled &&
    level === 'AUTO' &&
    APPROVAL_RANK[level] === 0;

  if (escalationReasons.length === 0) {
    escalationReasons.push(`Base approval level: ${gov.baseApprovalLevel} (no escalations triggered)`);
  }

  return { action, requiredLevel: level, escalationReasons, flagSufficient };
}

// ---------------------------------------------------------------------------
// Phase 4 — Execution Readiness
// ---------------------------------------------------------------------------

/**
 * Determine whether an action is READY, REVIEW, or BLOCKED for execution.
 *
 * READY:   All gates pass — evidence sufficient, approval met, cost/benefit positive.
 * REVIEW:  One or more soft gates need operator review before proceeding.
 * BLOCKED: Hard blockers prevent execution entirely.
 *
 * BLOCKED conditions (any one suffices):
 *   - Evidence quality LOW and action mutates KV and is system-wide
 *   - Approval level EMERGENCY_ONLY
 *   - Net decision value < −0.20 (strongly cost-exceeds-benefit)
 *   - productionCoverage = 0 and action mutates KV
 *
 * REVIEW conditions (all non-blocked, any one suffices):
 *   - Evidence quality LOW
 *   - Approval level ADMIN or TEAM_LEAD
 *   - Net decision value between −0.20 and 0
 *   - verificationCoverage < 0.30
 */
export function deriveReadiness(
  action:               RemediationActionType,
  approval:             ApprovalDecision,
  evidenceQuality:      EvidenceQuality,
  productionCoverage:   number,   // 0–1
  verificationCoverage: number,   // 0–1
  confidence:           number,   // 0–1
  netDecisionValue:     number,
): ReadinessDecision {
  const gov      = getGovernance(action);
  const blockers: string[] = [];
  const reviewReasons: string[] = [];
  const requirements: string[] = [];

  // ── Hard blockers ────────────────────────────────────────────────────────
  if (approval.requiredLevel === 'EMERGENCY_ONLY') {
    blockers.push('Requires EMERGENCY_ONLY approval — cannot auto-proceed');
    requirements.push('Obtain explicit incident commander sign-off');
  }

  if (productionCoverage === 0 && gov.mutatesKV) {
    blockers.push('Zero production executions for a KV-mutating action — unsafe to execute');
    requirements.push(`Collect ≥${gov.productionCoverageRequired} production repair records first`);
  }

  if (evidenceQuality === 'LOW' && gov.mutatesKV && gov.systemWide) {
    blockers.push('LOW evidence + system-wide KV mutation — risk too high without production data');
    requirements.push('Achieve MEDIUM evidence quality before execution');
  }

  if (netDecisionValue < -0.20) {
    blockers.push(`Net decision value ${netDecisionValue.toFixed(3)} < −0.20 — execution cost far exceeds benefit`);
    requirements.push('Reassess action choice; consider alternative with better cost/benefit ratio');
  }

  if (blockers.length > 0) {
    return {
      action,
      status:       'BLOCKED',
      reasons:      blockers,
      blockers,
      requirements,
    };
  }

  // ── Soft review gates ────────────────────────────────────────────────────
  if (evidenceQuality === 'LOW') {
    reviewReasons.push('Evidence quality LOW — confidence in outcome is limited');
    requirements.push('Aim for ≥5 production samples before AUTO approval');
  }

  if (approval.requiredLevel === 'ADMIN' || approval.requiredLevel === 'TEAM_LEAD') {
    reviewReasons.push(`Requires ${approval.requiredLevel} review — human sign-off needed`);
    requirements.push(`Obtain ${approval.requiredLevel} approval before execution`);
  }

  if (netDecisionValue >= -0.20 && netDecisionValue <= 0) {
    reviewReasons.push('Net decision value marginal (≤0) — review cost/benefit before proceeding');
  }

  if (verificationCoverage < 0.30) {
    reviewReasons.push(`Verification coverage ${Math.round(verificationCoverage * 100)}% — post-repair outcomes rarely tracked`);
    requirements.push('Improve verification coverage to ≥30% for reliable confidence scoring');
  }

  if (confidence < 0.40) {
    reviewReasons.push(`Action confidence ${Math.round(confidence * 100)}% — below 40% threshold`);
    requirements.push('Build production repair history to raise confidence above 40%');
  }

  if (reviewReasons.length > 0) {
    return {
      action,
      status:   'REVIEW',
      reasons:  reviewReasons,
      blockers: [],
      requirements,
    };
  }

  // ── READY ────────────────────────────────────────────────────────────────
  return {
    action,
    status:       'READY',
    reasons:      ['All governance gates passed'],
    blockers:     [],
    requirements: [],
  };
}

// ---------------------------------------------------------------------------
// buildGovernanceVerdict
// ---------------------------------------------------------------------------

/**
 * Combine approval and readiness into a single GovernanceVerdict.
 */
export function buildGovernanceVerdict(
  action:               RemediationActionType,
  approval:             ApprovalDecision,
  readiness:            ReadinessDecision,
  benefitCost:          BenefitCostResult,
): GovernanceVerdict {
  const canProceed =
    readiness.status !== 'BLOCKED' &&
    approval.flagSufficient;

  const tier: GovernanceVerdict['tier'] =
    readiness.status === 'BLOCKED'      ? 'BLOCKED'
    : readiness.status === 'REVIEW' || !approval.flagSufficient
                                        ? 'REQUIRES_REVIEW'
    :                                     'AUTO_APPROVED';

  const summary =
    tier === 'AUTO_APPROVED'   ? `${action}: AUTO_APPROVED — execute when flag=true`
    : tier === 'REQUIRES_REVIEW' ? `${action}: REQUIRES_REVIEW (${approval.requiredLevel}) — ${readiness.reasons[0]}`
    :                              `${action}: BLOCKED — ${readiness.blockers[0]}`;

  return { action, approval, readiness, benefitCost, canProceed, tier, summary };
}
