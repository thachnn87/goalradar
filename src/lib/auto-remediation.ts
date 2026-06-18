/**
 * auto-remediation.ts — DATA-18P Phase 1 + 2
 *
 * Maps DATA-18N predictive risk factors to concrete remediation actions and
 * evaluates them into a dry-run RemediationPlan.
 *
 * Feature flag: AUTONOMOUS_RELIABILITY_ENABLED
 *   false (default) — evaluateAutoRemediation() returns plan with execute=false
 *   true            — reserved for future activation; still dry-run in this phase
 *
 * CONSTRAINTS:
 *   - No production writes in this module.
 *   - No match-detail rendering changes.
 *   - No Authority Cache schema changes.
 *   - No CanonicalMatch changes.
 *   - No ESPN/AF provider contract changes.
 *   - Additive only.
 */

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

export const AUTONOMOUS_RELIABILITY_ENABLED =
  process.env.AUTONOMOUS_RELIABILITY_ENABLED === 'true';

// ---------------------------------------------------------------------------
// Risk factor IDs (mirror DATA-18N signal names)
// ---------------------------------------------------------------------------

export type RiskFactorId =
  | 'RF-1'   // Snapshot TTL expiry
  | 'RF-2'   // DR snapshot absent
  | 'RF-3'   // ESPN event cache expiry
  | 'RF-4'   // ESPN lookup ID absent
  | 'RF-5'   // Rate-safe mode active
  | 'RF-6'   // Feed stale / absent
  | 'RF-7'   // Active repair-lock count (self-heal storm)
  | 'RF-8';  // Archive trajectory (persistent degradation)

// ---------------------------------------------------------------------------
// Remediation action catalogue
// ---------------------------------------------------------------------------

/**
 * Every action is EITHER:
 *   - A KV write to refresh a specific cache entry (PREWARM_SNAPSHOT, REBUILD_DR,
 *     REFRESH_ESPN_CACHE, RESOLVE_ESPN_LOOKUP)
 *   - A control signal (SUPPRESS_REFRESH, TRIGGER_ORCHESTRATOR)
 *   - An observability directive (MONITOR_SELF_HEAL, ESCALATE_INCIDENT)
 *   - A no-op (NO_ACTION)
 *
 * DATA-18P Phase 2 implements dry-run evaluation only.
 * Actual execution is gated by AUTONOMOUS_RELIABILITY_ENABLED=true (future).
 */
export type RemediationActionType =
  | 'PREWARM_SNAPSHOT'       // Rebuild expiring FINISHED snapshot before eviction
  | 'REBUILD_DR'             // Write a fresh DR copy from the existing primary snapshot
  | 'REFRESH_ESPN_CACHE'     // Re-fetch ESPN events and refresh goalradar:espn:event:{id}
  | 'RESOLVE_ESPN_LOOKUP'    // Re-run ESPN scoreboard lookup to re-populate espn:lookup:{id}
  | 'SUPPRESS_REFRESH'       // Halt background prewarm until rate-safe expires
  | 'TRIGGER_ORCHESTRATOR'   // Invoke the WC orchestrator cron (feed + snapshot reseed)
  | 'MONITOR_SELF_HEAL'      // Self-heal already in progress — observe, do not intervene
  | 'ESCALATE_INCIDENT'      // Alert: persistent degradation requires manual review
  | 'NO_ACTION';             // System healthy — nothing to do

export type ActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface RemediationAction {
  type:        RemediationActionType;
  priority:    ActionPriority;
  /** Matches this action targets, if match-scoped. Empty for system-wide actions. */
  matchIds:    number[];
  reason:      string;
  /** Estimated P(failure within 24 h) if this action is NOT taken. */
  riskIfSkipped: number;
}

// ---------------------------------------------------------------------------
// Risk → Action mapping table
// ---------------------------------------------------------------------------

/**
 * Static mapping: each RiskFactorId maps to a primary action type,
 * priority ceiling, and base P(failure) if not acted on.
 *
 * Multiple risk factors can be active simultaneously; the engine deduplicates
 * and selects the highest-priority composite action.
 */
export const RISK_ACTION_MAP: Record<
  RiskFactorId,
  { action: RemediationActionType; priority: ActionPriority; baseRisk: number }
> = {
  'RF-1': { action: 'PREWARM_SNAPSHOT',    priority: 'HIGH',     baseRisk: 0.20 },
  'RF-2': { action: 'REBUILD_DR',          priority: 'MEDIUM',   baseRisk: 0.15 },
  'RF-3': { action: 'REFRESH_ESPN_CACHE',  priority: 'MEDIUM',   baseRisk: 0.15 },
  'RF-4': { action: 'RESOLVE_ESPN_LOOKUP', priority: 'MEDIUM',   baseRisk: 0.15 },
  'RF-5': { action: 'SUPPRESS_REFRESH',    priority: 'CRITICAL', baseRisk: 0.92 },
  'RF-6': { action: 'TRIGGER_ORCHESTRATOR',priority: 'HIGH',     baseRisk: 0.40 },
  'RF-7': { action: 'MONITOR_SELF_HEAL',   priority: 'MEDIUM',   baseRisk: 0.30 },
  'RF-8': { action: 'ESCALATE_INCIDENT',   priority: 'HIGH',     baseRisk: 0.70 },
};

/**
 * Compound risk escalation: when multiple RFs are active together,
 * these pairs escalate the primary action's priority and risk estimate.
 */
export const COMPOUND_ESCALATIONS: Array<{
  factors: [RiskFactorId, RiskFactorId];
  escalateTo: ActionPriority;
  escalatedRisk: number;
  note: string;
}> = [
  {
    factors:       ['RF-1', 'RF-5'],
    escalateTo:    'CRITICAL',
    escalatedRisk: 0.92,
    note:          'Snapshot expiry + rate-safe = near-certain unenriched rebuild',
  },
  {
    factors:       ['RF-1', 'RF-3'],
    escalateTo:    'HIGH',
    escalatedRisk: 0.60,
    note:          'Snapshot expiry + ESPN cache expiry = enrichment-at-risk',
  },
  {
    factors:       ['RF-1', 'RF-2'],
    escalateTo:    'HIGH',
    escalatedRisk: 0.45,
    note:          'Snapshot expiry + DR absent = downgrade guard disabled',
  },
  {
    factors:       ['RF-3', 'RF-4'],
    escalateTo:    'HIGH',
    escalatedRisk: 0.55,
    note:          'ESPN event expiry + lookup absent = enrichment total block',
  },
];

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

/** Minimal representation of a DATA-18N risk factor (subset of the full response). */
export interface RiskFactorInput {
  factor:   string;   // e.g. 'snapshots-expiring-4h', 'rate-safe-mode'
  severity: 'GREEN' | 'YELLOW' | 'RED';
  detail:   string;
}

/** Minimal representation of a DATA-18N matchAtRisk entry. */
export interface MatchRiskInput {
  matchId:      number;
  riskType:     string;
  severity:     'GREEN' | 'YELLOW' | 'RED';
  expiresInSec: number | null;
}

export interface PredictiveRiskInput {
  riskLevel:        'GREEN' | 'YELLOW' | 'RED';
  riskFactors:      RiskFactorInput[];
  matchesAtRisk:    MatchRiskInput[];
  rateSafeMode:     { active: boolean; expiresAt: string | null };
  repairFrequency:  { activeRepairLocks: number };
}

export interface RemediationPlanAction {
  action:        RemediationActionType;
  priority:      ActionPriority;
  matchIds:      number[];
  reason:        string;
  riskIfSkipped: number;
  confidence:    'low' | 'medium' | 'high';
}

export interface RemediationPlan {
  /** Flag state at evaluation time. */
  featureEnabled:  boolean;
  /** Whether this plan can be executed (flag=true AND not dry-run). */
  execute:         boolean;
  dryRun:          boolean;
  evaluatedAt:     string;
  overallRisk:     'GREEN' | 'YELLOW' | 'RED';
  /** Ordered by priority (CRITICAL first). */
  actions:         RemediationPlanAction[];
  /** Compound escalations triggered. */
  escalations:     string[];
  /** Estimated P(any gate RED within 24h) if no action taken. */
  compositeRisk:   number;
  note:            string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const PRIORITY_RANK: Record<ActionPriority, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

function maxPriority(a: ActionPriority, b: ActionPriority): ActionPriority {
  return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b;
}

function probToConfidence(p: number): 'low' | 'medium' | 'high' {
  if (p >= 0.7) return 'high';
  if (p >= 0.4) return 'medium';
  return 'low';
}

/** Map a DATA-18N factor name to its canonical RiskFactorId. */
function classifyFactor(factorName: string): RiskFactorId | null {
  if (factorName.includes('rate-safe'))              return 'RF-5';
  if (factorName.includes('snapshots-expiring'))     return 'RF-1';
  if (factorName.includes('dr-snapshot'))            return 'RF-2';
  if (factorName.includes('espn-events-expiring'))   return 'RF-3';
  if (factorName.includes('espn-lookup'))            return 'RF-4';
  if (factorName.includes('feed'))                   return 'RF-6';
  if (factorName.includes('repair'))                 return 'RF-7';
  if (factorName.includes('archive'))                return 'RF-8';
  return null;
}

// ---------------------------------------------------------------------------
// evaluateAutoRemediation
// ---------------------------------------------------------------------------

/**
 * Evaluate predictive risk and produce a remediation plan.
 *
 * @param risk    Output from /api/debug/predictive-risk (or equivalent in-process call).
 * @param dryRun  When true, plan is advisory only (execute=false). Default: true.
 * @param now     Current epoch ms (caller-supplied for determinism).
 *
 * Always returns a plan. The `execute` field reflects whether the plan would
 * actually run actions (requires AUTONOMOUS_RELIABILITY_ENABLED=true AND dryRun=false).
 *
 * DATA-18P Phase 2: execute is always false (no production execution in this phase).
 */
export function evaluateAutoRemediation(
  risk:   PredictiveRiskInput,
  dryRun: boolean = true,
  now:    number  = Date.now(),
): RemediationPlan {
  const evaluatedAt = new Date(now).toISOString();

  // Identify active RF IDs from factor names
  const activeRFIds = new Set<RiskFactorId>();
  for (const rf of risk.riskFactors) {
    const id = classifyFactor(rf.factor);
    if (id) activeRFIds.add(id);
  }

  // Identify match IDs by risk type
  const snapshotAtRiskIds  = risk.matchesAtRisk.filter(m => m.riskType === 'snapshot-expiry').map(m => m.matchId);
  const drAbsentIds        = risk.matchesAtRisk.filter(m => m.riskType === 'dr-absent').map(m => m.matchId);
  const espnEventIds       = risk.matchesAtRisk.filter(m => m.riskType === 'espn-event-expiry').map(m => m.matchId);
  const espnLookupIds      = risk.matchesAtRisk.filter(m => m.riskType === 'espn-lookup-absent').map(m => m.matchId);

  // Build action map (one entry per action type, merged matchIds)
  const actionMap = new Map<RemediationActionType, RemediationPlanAction>();

  const addAction = (
    type:          RemediationActionType,
    priority:      ActionPriority,
    matchIds:      number[],
    reason:        string,
    riskIfSkipped: number,
  ) => {
    const existing = actionMap.get(type);
    if (existing) {
      existing.matchIds    = [...new Set([...existing.matchIds, ...matchIds])];
      existing.priority    = maxPriority(existing.priority, priority);
      existing.riskIfSkipped = Math.max(existing.riskIfSkipped, riskIfSkipped);
    } else {
      actionMap.set(type, {
        action: type,
        priority,
        matchIds,
        reason,
        riskIfSkipped,
        confidence: probToConfidence(riskIfSkipped),
      });
    }
  };

  // Map each active RF to its action
  if (activeRFIds.has('RF-1') && snapshotAtRiskIds.length > 0) {
    addAction('PREWARM_SNAPSHOT', 'HIGH', snapshotAtRiskIds,
      `${snapshotAtRiskIds.length} FINISHED snapshot(s) expiring within 24 h — prewarm before eviction.`,
      RISK_ACTION_MAP['RF-1'].baseRisk);
  }
  if (activeRFIds.has('RF-2') && drAbsentIds.length > 0) {
    addAction('REBUILD_DR', 'MEDIUM', drAbsentIds,
      `${drAbsentIds.length} match(es) have no DR snapshot — downgrade guard disabled.`,
      RISK_ACTION_MAP['RF-2'].baseRisk);
  }
  if (activeRFIds.has('RF-3') && espnEventIds.length > 0) {
    addAction('REFRESH_ESPN_CACHE', 'MEDIUM', espnEventIds,
      `${espnEventIds.length} ESPN event cache(s) expiring within 24 h.`,
      RISK_ACTION_MAP['RF-3'].baseRisk);
  }
  if (activeRFIds.has('RF-4') && espnLookupIds.length > 0) {
    addAction('RESOLVE_ESPN_LOOKUP', 'MEDIUM', espnLookupIds,
      `${espnLookupIds.length} ESPN lookup ID(s) absent — enrichment blocked.`,
      RISK_ACTION_MAP['RF-4'].baseRisk);
  }
  if (risk.rateSafeMode.active) {
    addAction('SUPPRESS_REFRESH', 'CRITICAL', [],
      `Rate-safe mode active until ${risk.rateSafeMode.expiresAt ?? 'unknown'} — suppress all background refresh operations.`,
      RISK_ACTION_MAP['RF-5'].baseRisk);
  }
  if (activeRFIds.has('RF-6')) {
    addAction('TRIGGER_ORCHESTRATOR', 'HIGH', [],
      'FINISHED feed absent or stale — trigger WC orchestrator cron to reseed feeds and snapshots.',
      RISK_ACTION_MAP['RF-6'].baseRisk);
  }
  if (risk.repairFrequency.activeRepairLocks >= 2) {
    addAction('MONITOR_SELF_HEAL', 'MEDIUM', [],
      `${risk.repairFrequency.activeRepairLocks} active repair-lock(s) — self-heal in progress. Monitor outcome; intervene only if locks expire without recovery.`,
      RISK_ACTION_MAP['RF-7'].baseRisk);
  }
  if (activeRFIds.has('RF-8')) {
    addAction('ESCALATE_INCIDENT', 'HIGH', [],
      'Persistent degradation trajectory — 3+ consecutive non-GREEN health records. System not self-correcting.',
      RISK_ACTION_MAP['RF-8'].baseRisk);
  }

  // Apply compound escalations
  const escalationNotes: string[] = [];
  for (const esc of COMPOUND_ESCALATIONS) {
    const [a, b] = esc.factors;
    if (activeRFIds.has(a) && activeRFIds.has(b)) {
      escalationNotes.push(esc.note);
      // Escalate the primary action (first factor's action)
      const primaryAction = RISK_ACTION_MAP[a].action;
      const existing = actionMap.get(primaryAction);
      if (existing) {
        existing.priority      = maxPriority(existing.priority, esc.escalateTo);
        existing.riskIfSkipped = Math.max(existing.riskIfSkipped, esc.escalatedRisk);
        existing.confidence    = probToConfidence(existing.riskIfSkipped);
      }
    }
  }

  // Sort actions by priority (CRITICAL first)
  const actions = [...actionMap.values()].sort(
    (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
  );

  // Composite risk = max of all action riskIfSkipped values
  const compositeRisk = actions.length > 0
    ? Math.max(...actions.map(a => a.riskIfSkipped))
    : 0;

  // If no risk factors → NO_ACTION
  if (actions.length === 0) {
    actions.push({
      action:        'NO_ACTION',
      priority:      'NONE',
      matchIds:      [],
      reason:        'No active risk factors — system nominal.',
      riskIfSkipped: 0,
      confidence:    'high',
    });
  }

  // execute = false in DATA-18P Phase 2 (dry-run only, flag always off by default)
  const execute = AUTONOMOUS_RELIABILITY_ENABLED && !dryRun;

  return {
    featureEnabled:  AUTONOMOUS_RELIABILITY_ENABLED,
    execute,
    dryRun:          !execute,
    evaluatedAt,
    overallRisk:     risk.riskLevel,
    actions,
    escalations:     escalationNotes,
    compositeRisk,
    note: execute
      ? `AUTO-REMEDIATION ACTIVE — ${actions.length} action(s) executing.`
      : `DRY-RUN — ${actions.length} action(s) recommended. Set AUTONOMOUS_RELIABILITY_ENABLED=true to execute.`,
  };
}
