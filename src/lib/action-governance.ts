/**
 * action-governance.ts — DATA-18T Phase 1
 *
 * Action Risk Registry.
 *
 * Defines static governance properties for every RemediationActionType:
 *   ExecutionRisk              — how dangerous is executing this action?
 *   RollbackComplexity         — how hard is it to undo?
 *   ApprovalLevel              — minimum human approval tier required
 *   ProductionCoverageRequired — minimum production evidence before auto-approve
 *
 * This registry is the single source of truth for governance decisions.
 * It is consulted by the Approval Matrix (Phase 3) and Execution Readiness
 * (Phase 4) before any action can be scheduled or executed.
 *
 * Pure constants — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType } from './auto-remediation';

// ---------------------------------------------------------------------------
// Governance types
// ---------------------------------------------------------------------------

/** How much inherent risk does executing this action carry? */
export type ExecutionRisk = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * How complex is it to roll back this action if it makes things worse?
 *   NONE        — no state change; trivially reversible
 *   SIMPLE      — single KV delete or TTL reset
 *   MODERATE    — re-run the previous job; takes minutes
 *   COMPLEX     — requires manual operator steps; may need data recovery
 *   IRREVERSIBLE — cannot be undone without full data rebuild
 */
export type RollbackComplexity = 'NONE' | 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'IRREVERSIBLE';

/**
 * Minimum approval tier required to execute this action.
 *   AUTO            — system may execute without human review (flag=true + readiness=READY)
 *   TEAM_LEAD       — engineering team lead must review before execution
 *   ADMIN           — platform admin or senior SRE must approve
 *   EMERGENCY_ONLY  — only permitted during declared incidents with explicit sign-off
 */
export type ApprovalLevel = 'AUTO' | 'TEAM_LEAD' | 'ADMIN' | 'EMERGENCY_ONLY';

/** Minimum number of production (non-dry-run) repair records before AUTO approval. */
export type ProductionCoverageRequirement = 5 | 10 | 20 | 50;

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

export interface ActionGovernanceEntry {
  action:                    RemediationActionType;
  executionRisk:             ExecutionRisk;
  rollbackComplexity:        RollbackComplexity;
  /** Minimum approval level when evidence is sufficient. */
  baseApprovalLevel:         ApprovalLevel;
  /** Minimum approval level when evidence is insufficient. */
  lowEvidenceApprovalLevel:  ApprovalLevel;
  productionCoverageRequired: ProductionCoverageRequirement;
  /** True if this action writes to KV (vs. read-only or signal-only). */
  mutatesKV:                 boolean;
  /** True if this action affects all matches (not scoped to specific matchIds). */
  systemWide:                boolean;
  /** Human-readable description of what the action does. */
  description:               string;
  /** What could go wrong. */
  risks:                     string[];
  /** How to verify success. */
  successCriteria:           string;
  /** How to roll back manually. */
  rollbackProcedure:         string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ACTION_GOVERNANCE_REGISTRY: Record<RemediationActionType, ActionGovernanceEntry> = {

  PREWARM_SNAPSHOT: {
    action:                    'PREWARM_SNAPSHOT',
    executionRisk:             'LOW',
    rollbackComplexity:        'SIMPLE',
    baseApprovalLevel:         'AUTO',
    lowEvidenceApprovalLevel:  'TEAM_LEAD',
    productionCoverageRequired: 10,
    mutatesKV:                 true,
    systemWide:                false,
    description:               'Rebuild expiring FINISHED match snapshots in KV before eviction.',
    risks:                     [
      'Snapshot rebuild may fetch stale upstream data if provider API is degraded',
      'Concurrent prewarm + self-heal may cause brief lock contention',
    ],
    successCriteria:           'enrichment-health: unenriched=0 within 5 minutes of execution',
    rollbackProcedure:         'Delete goalradar:match:{id} keys; self-heal will rebuild on next request',
  },

  REBUILD_DR: {
    action:                    'REBUILD_DR',
    executionRisk:             'LOW',
    rollbackComplexity:        'SIMPLE',
    baseApprovalLevel:         'AUTO',
    lowEvidenceApprovalLevel:  'TEAM_LEAD',
    productionCoverageRequired: 10,
    mutatesKV:                 true,
    systemWide:                false,
    description:               'Write a fresh DR (disaster-recovery) copy from the existing primary snapshot.',
    risks:                     [
      'If primary snapshot is already degraded, DR will clone the degraded state',
      'DR write races with primary refresh window',
    ],
    successCriteria:           'authority-freshness: source=dr present; authority-drift: no NEW RED matches',
    rollbackProcedure:         'Delete goalradar:dr:match:{id}; DR will be recreated next time REBUILD_DR runs',
  },

  REFRESH_ESPN_CACHE: {
    action:                    'REFRESH_ESPN_CACHE',
    executionRisk:             'LOW',
    rollbackComplexity:        'SIMPLE',
    baseApprovalLevel:         'AUTO',
    lowEvidenceApprovalLevel:  'TEAM_LEAD',
    productionCoverageRequired: 10,
    mutatesKV:                 true,
    systemWide:                false,
    description:               'Re-fetch ESPN events and refresh goalradar:espn:event:{id} in KV.',
    risks:                     [
      'ESPN API rate limits — refresh may trigger rate-safe if too many concurrent fetches',
      'ESPN API may return stale or partial data',
    ],
    successCriteria:           'enrichment-health: enrichment rate >= 0.95 within 10 minutes',
    rollbackProcedure:         'Delete goalradar:espn:event:{id}; enrichment will use cached authority data as fallback',
  },

  RESOLVE_ESPN_LOOKUP: {
    action:                    'RESOLVE_ESPN_LOOKUP',
    executionRisk:             'MEDIUM',
    rollbackComplexity:        'MODERATE',
    baseApprovalLevel:         'TEAM_LEAD',
    lowEvidenceApprovalLevel:  'ADMIN',
    productionCoverageRequired: 10,
    mutatesKV:                 true,
    systemWide:                false,
    description:               'Re-run ESPN scoreboard lookup to re-populate espn:lookup:{id} for unresolved matches.',
    risks:                     [
      'ESPN may not have an event mapping for some match IDs — partial resolution is common',
      'Incorrect lookup may map wrong ESPN event to a GoalRadar match',
      'Lookup API has stricter rate limits than event fetch',
    ],
    successCriteria:           'espn:lookup:{id} present for all target matches; enrichment-health: unenriched=0',
    rollbackProcedure:         'Delete goalradar:espn:lookup:{id}; match falls back to authority-only enrichment',
  },

  SUPPRESS_REFRESH: {
    action:                    'SUPPRESS_REFRESH',
    executionRisk:             'HIGH',
    rollbackComplexity:        'MODERATE',
    baseApprovalLevel:         'TEAM_LEAD',
    lowEvidenceApprovalLevel:  'ADMIN',
    productionCoverageRequired: 5,
    mutatesKV:                 true,
    systemWide:                true,
    description:               'Halt all background prewarm and refresh operations until rate-safe expires.',
    risks:                     [
      'Suppressing refresh during active World Cup matches delays score updates globally',
      'If rate-safe expiry is long, all matches go stale simultaneously',
      'System cannot self-heal while refresh is suppressed',
    ],
    successCriteria:           'rate-safe key absent from KV; enrichment resumes within expected TTL cycle',
    rollbackProcedure:         'Delete goalradar:rate-safe:active from KV; normal refresh cycle resumes',
  },

  TRIGGER_ORCHESTRATOR: {
    action:                    'TRIGGER_ORCHESTRATOR',
    executionRisk:             'MEDIUM',
    rollbackComplexity:        'MODERATE',
    baseApprovalLevel:         'TEAM_LEAD',
    lowEvidenceApprovalLevel:  'ADMIN',
    productionCoverageRequired: 5,
    mutatesKV:                 true,
    systemWide:                true,
    description:               'Invoke the WC orchestrator cron to reseed feeds and snapshots.',
    risks:                     [
      'Orchestrator run takes 2–5 minutes; monitoring may show transient RED during rebuild',
      'If feed source is down, orchestrator silently produces empty feed',
      'Double-trigger within a short window wastes rate-limit budget',
    ],
    successCriteria:           'feed-integrity: GREEN; enrichment-health: GREEN within 10 minutes',
    rollbackProcedure:         'No rollback needed — orchestrator is idempotent; run again if feed is wrong',
  },

  MONITOR_SELF_HEAL: {
    action:                    'MONITOR_SELF_HEAL',
    executionRisk:             'NONE',
    rollbackComplexity:        'NONE',
    baseApprovalLevel:         'AUTO',
    lowEvidenceApprovalLevel:  'AUTO',
    productionCoverageRequired: 5,
    mutatesKV:                 false,
    systemWide:                false,
    description:               'Observe self-heal in progress — no intervention; do not interrupt repair locks.',
    risks:                     ['None — read-only observation only'],
    successCriteria:           'repair-lock keys expire; enrichment-health returns GREEN',
    rollbackProcedure:         'N/A — no state change',
  },

  ESCALATE_INCIDENT: {
    action:                    'ESCALATE_INCIDENT',
    executionRisk:             'LOW',
    rollbackComplexity:        'NONE',
    baseApprovalLevel:         'AUTO',
    lowEvidenceApprovalLevel:  'AUTO',
    productionCoverageRequired: 5,
    mutatesKV:                 false,
    systemWide:                true,
    description:               'Alert on-call: persistent degradation requires manual review.',
    risks:                     ['Alert fatigue if escalated too frequently on low-severity events'],
    successCriteria:           'Incident acknowledged by operator; remediation plan initiated',
    rollbackProcedure:         'Dismiss alert if false positive; tune RF-8 threshold if needed',
  },

  NO_ACTION: {
    action:                    'NO_ACTION',
    executionRisk:             'NONE',
    rollbackComplexity:        'NONE',
    baseApprovalLevel:         'AUTO',
    lowEvidenceApprovalLevel:  'AUTO',
    productionCoverageRequired: 5,
    mutatesKV:                 false,
    systemWide:                false,
    description:               'System is healthy — no action required.',
    risks:                     [],
    successCriteria:           'All health gates GREEN',
    rollbackProcedure:         'N/A',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getGovernance(action: RemediationActionType): ActionGovernanceEntry {
  return ACTION_GOVERNANCE_REGISTRY[action];
}

/** Numeric rank for ExecutionRisk (higher = more risky). */
export const EXECUTION_RISK_RANK: Record<ExecutionRisk, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

/** Numeric rank for ApprovalLevel (higher = more restrictive). */
export const APPROVAL_RANK: Record<ApprovalLevel, number> = {
  AUTO: 0, TEAM_LEAD: 1, ADMIN: 2, EMERGENCY_ONLY: 3,
};

/** Escalate approval level by one tier. */
export function escalateApproval(level: ApprovalLevel): ApprovalLevel {
  const order: ApprovalLevel[] = ['AUTO', 'TEAM_LEAD', 'ADMIN', 'EMERGENCY_ONLY'];
  const idx = order.indexOf(level);
  return order[Math.min(idx + 1, order.length - 1)];
}

/** Max of two approval levels. */
export function maxApproval(a: ApprovalLevel, b: ApprovalLevel): ApprovalLevel {
  return APPROVAL_RANK[a] >= APPROVAL_RANK[b] ? a : b;
}
