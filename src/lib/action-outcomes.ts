/**
 * action-outcomes.ts — DATA-18U Phase 1
 *
 * Success Criteria Registry.
 *
 * Maps every RemediationActionType to:
 *   ExpectedSubsystemChanges — which subsystems change and how
 *   ExpectedRecoveryTime     — realistic time to full recovery
 *   SuccessConditions        — machine-verifiable pass/fail gates
 *
 * This registry is the ground truth for outcome prediction (Phase 2),
 * post-repair verification (DATA-18Q), and future execution gating.
 *
 * Pure constants — no I/O. Additive — modifies no existing file.
 */

import type { RemediationActionType, RiskFactorId } from './auto-remediation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A subsystem affected by an action and how it changes. */
export interface SubsystemChange {
  /** Which subsystem is affected. */
  subsystem:
    | 'snapshot-cache'
    | 'dr-cache'
    | 'espn-events'
    | 'espn-lookup'
    | 'rate-limiter'
    | 'feed-orchestrator'
    | 'repair-locks'
    | 'health-archive'
    | 'incident-log'
    | 'enrichment-pipeline';
  /** Direction of change. */
  changeType: 'WRITE' | 'DELETE' | 'REFRESH' | 'OBSERVE' | 'SIGNAL';
  /** What the subsystem looks like after the action succeeds. */
  expectedState: string;
  /** Is this change reversible? */
  reversible: boolean;
}

/**
 * How long recovery takes in a healthy environment with no concurrent failures.
 * P50 = expected case, P95 = worst plausible case.
 */
export interface RecoveryTimeProfile {
  /** Median recovery time in seconds. */
  p50Seconds: number;
  /** 95th-percentile recovery time in seconds. */
  p95Seconds: number;
  /** Plain English: what determines the recovery time. */
  bottleneck: string;
}

/** A single machine-verifiable success condition. */
export interface SuccessCondition {
  /** Short unique key identifying this condition. */
  key: string;
  /**
   * What health metric or KV state to check.
   *   kv-present  — KV key must exist and not be expired
   *   kv-absent   — KV key must not exist (or TTL = −2)
   *   metric-gte  — health-archive metric ≥ threshold
   *   metric-eq   — health-archive metric equals value
   *   no-drift    — authority-drift check returns no RED matches
   *   enrichment  — enrichment coverage ≥ threshold
   */
  check: 'kv-present' | 'kv-absent' | 'metric-gte' | 'metric-eq' | 'no-drift' | 'enrichment';
  /** Value or threshold for the check. */
  target: string | number;
  /** How many seconds after execution to wait before checking. */
  pollAfterSeconds: number;
  /** Is failing this condition a hard failure (true) or advisory (false)? */
  required: boolean;
  /** Human-readable description. */
  description: string;
}

/** Full outcome specification for a single action. */
export interface ActionOutcomeSpec {
  action: RemediationActionType;
  /** Which risk factors this action primarily addresses. */
  addressesRiskFactors: RiskFactorId[];
  /** Subsystems changed by this action. */
  subsystemChanges: SubsystemChange[];
  /** Recovery time profile. */
  recoveryTime: RecoveryTimeProfile;
  /** Ordered list of success conditions to verify. */
  successConditions: SuccessCondition[];
  /** What a successful execution looks like in one sentence. */
  successNarrative: string;
  /** What partial success or a lingering failure looks like. */
  partialSuccessIndicators: string[];
  /** Side effects to watch for. */
  knownSideEffects: string[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ACTION_OUTCOME_REGISTRY: Record<RemediationActionType, ActionOutcomeSpec> = {

  PREWARM_SNAPSHOT: {
    action: 'PREWARM_SNAPSHOT',
    addressesRiskFactors: ['RF-1'],
    subsystemChanges: [
      {
        subsystem:     'snapshot-cache',
        changeType:    'WRITE',
        expectedState: 'All FINISHED match snapshots present with TTL reset to 900s',
        reversible:    true,
      },
      {
        subsystem:     'enrichment-pipeline',
        changeType:    'REFRESH',
        expectedState: 'Enrichment pass triggered; unenriched=0 within 5 minutes',
        reversible:    true,
      },
    ],
    recoveryTime: {
      p50Seconds: 120,
      p95Seconds: 300,
      bottleneck: 'Enrichment pipeline re-run across all FINISHED matches',
    },
    successConditions: [
      {
        key:              'snapshot-ttl-reset',
        check:            'kv-present',
        target:           'goalradar:match:{id}',
        pollAfterSeconds: 30,
        required:         true,
        description:      'goalradar:match:{id} present with TTL > 600s for all target matches',
      },
      {
        key:              'enrichment-full',
        check:            'enrichment',
        target:           0.99,
        pollAfterSeconds: 300,
        required:         true,
        description:      'Enrichment coverage ≥ 99% across all FINISHED matches',
      },
    ],
    successNarrative:
      'All expiring FINISHED match snapshots rebuilt in KV; enrichment pipeline confirms zero unenriched matches.',
    partialSuccessIndicators: [
      'Some match IDs prewarm successfully but a subset still show low TTL',
      'Enrichment coverage improves from < 80% to > 95% but not 100%',
    ],
    knownSideEffects: [
      'Repair locks acquired per match during prewarm; concurrent repairs may queue',
      'Provider API calls increase proportionally with match count',
    ],
  },

  REBUILD_DR: {
    action: 'REBUILD_DR',
    addressesRiskFactors: ['RF-2'],
    subsystemChanges: [
      {
        subsystem:     'dr-cache',
        changeType:    'WRITE',
        expectedState: 'goalradar:dr:match:{id} present for all FINISHED matches',
        reversible:    true,
      },
    ],
    recoveryTime: {
      p50Seconds: 60,
      p95Seconds: 180,
      bottleneck: 'KV write throughput across all FINISHED match DR keys',
    },
    successConditions: [
      {
        key:              'dr-keys-present',
        check:            'kv-present',
        target:           'goalradar:dr:match:{id}',
        pollAfterSeconds: 30,
        required:         true,
        description:      'goalradar:dr:match:{id} present for all target matches',
      },
      {
        key:              'no-authority-drift',
        check:            'no-drift',
        target:           'RED',
        pollAfterSeconds: 120,
        required:         false,
        description:      'Authority-drift check reports no new RED matches introduced by DR rebuild',
      },
    ],
    successNarrative:
      'DR cache fully populated from primary snapshots; authority-freshness endpoint reports source=dr present for all matches.',
    partialSuccessIndicators: [
      'DR keys written for > 90% of matches but a subset fail due to missing primary',
      'Authority-freshness reports improved but still shows some stale DR entries',
    ],
    knownSideEffects: [
      'If primary snapshot is already degraded, DR inherits that degraded state',
    ],
  },

  REFRESH_ESPN_CACHE: {
    action: 'REFRESH_ESPN_CACHE',
    addressesRiskFactors: ['RF-3'],
    subsystemChanges: [
      {
        subsystem:     'espn-events',
        changeType:    'REFRESH',
        expectedState: 'goalradar:espn:event:{id} refreshed with current TTL',
        reversible:    true,
      },
      {
        subsystem:     'enrichment-pipeline',
        changeType:    'REFRESH',
        expectedState: 'Enrichment re-run with fresh ESPN data; score accuracy improves',
        reversible:    true,
      },
    ],
    recoveryTime: {
      p50Seconds: 90,
      p95Seconds: 240,
      bottleneck: 'ESPN API response time + enrichment pipeline re-run',
    },
    successConditions: [
      {
        key:              'espn-events-refreshed',
        check:            'kv-present',
        target:           'goalradar:espn:event:{id}',
        pollAfterSeconds: 30,
        required:         true,
        description:      'goalradar:espn:event:{id} present with updated fetchedAt timestamp',
      },
      {
        key:              'enrichment-recovered',
        check:            'enrichment',
        target:           0.95,
        pollAfterSeconds: 240,
        required:         true,
        description:      'Enrichment coverage ≥ 95% after ESPN data refresh',
      },
    ],
    successNarrative:
      'ESPN event cache refreshed; enrichment pipeline re-run with fresh data confirms ≥ 95% coverage.',
    partialSuccessIndicators: [
      'ESPN API returns partial results — some events refreshed but others hit rate limits',
      'Enrichment improves but top-line coverage remains below 95% due to upstream data gaps',
    ],
    knownSideEffects: [
      'High ESPN API call volume may trigger rate-safe mode if concurrent with other fetches',
    ],
  },

  RESOLVE_ESPN_LOOKUP: {
    action: 'RESOLVE_ESPN_LOOKUP',
    addressesRiskFactors: ['RF-4'],
    subsystemChanges: [
      {
        subsystem:     'espn-lookup',
        changeType:    'WRITE',
        expectedState: 'goalradar:espn:lookup:{id} populated for all target unresolved matches',
        reversible:    true,
      },
      {
        subsystem:     'enrichment-pipeline',
        changeType:    'REFRESH',
        expectedState: 'Matches previously missing ESPN enrichment now have full event data',
        reversible:    true,
      },
    ],
    recoveryTime: {
      p50Seconds: 180,
      p95Seconds: 480,
      bottleneck: 'ESPN scoreboard lookup API + mapping resolution per match',
    },
    successConditions: [
      {
        key:              'lookup-present',
        check:            'kv-present',
        target:           'goalradar:espn:lookup:{id}',
        pollAfterSeconds: 60,
        required:         true,
        description:      'goalradar:espn:lookup:{id} present for all previously absent matches',
      },
      {
        key:              'enrichment-recovered',
        check:            'enrichment',
        target:           0.95,
        pollAfterSeconds: 480,
        required:         false,
        description:      'Enrichment coverage ≥ 95% — advisory (some matches may have no ESPN mapping)',
      },
    ],
    successNarrative:
      'ESPN lookup IDs resolved for missing matches; enrichment pipeline confirms recovered coverage.',
    partialSuccessIndicators: [
      'Lookup resolution partially succeeds — ESPN has no mapping for some GoalRadar match IDs',
      'Lookup present but ESPN event fetch returns no enrichment data (content gap, not technical failure)',
    ],
    knownSideEffects: [
      'Incorrect lookup mapping may associate wrong ESPN event to a GoalRadar match',
      'Lookup API rate limits are stricter than event fetch — may need retry backoff',
    ],
  },

  SUPPRESS_REFRESH: {
    action: 'SUPPRESS_REFRESH',
    addressesRiskFactors: ['RF-5'],
    subsystemChanges: [
      {
        subsystem:     'rate-limiter',
        changeType:    'OBSERVE',
        expectedState: 'rate-safe active flag remains until natural expiry; no new refreshes triggered',
        reversible:    true,
      },
      {
        subsystem:     'repair-locks',
        changeType:    'OBSERVE',
        expectedState: 'Active repair locks allowed to drain; no new locks acquired',
        reversible:    true,
      },
    ],
    recoveryTime: {
      p50Seconds: 900,
      p95Seconds: 1800,
      bottleneck: 'Rate-safe key natural TTL expiry (typically 15–30 minutes)',
    },
    successConditions: [
      {
        key:              'rate-safe-expires',
        check:            'kv-absent',
        target:           'goalradar:rate-safe:active',
        pollAfterSeconds: 900,
        required:         true,
        description:      'Rate-safe flag absent from KV (natural expiry or manual removal)',
      },
      {
        key:              'enrichment-resumes',
        check:            'enrichment',
        target:           0.90,
        pollAfterSeconds: 1800,
        required:         false,
        description:      'Enrichment coverage ≥ 90% after rate-safe expires and refresh resumes',
      },
    ],
    successNarrative:
      'Rate-safe mode observed; system waits for natural expiry without triggering additional refreshes; normal refresh cycle resumes.',
    partialSuccessIndicators: [
      'Rate-safe expires but enrichment does not fully recover — provider API still degraded',
      'Rate-safe expires but repeat rate-limiting occurs within next refresh cycle',
    ],
    knownSideEffects: [
      'Match scores and enrichment data go stale globally until rate-safe expires',
      'Self-heal is impeded during suppress window — repair locks may time out unresolved',
    ],
  },

  TRIGGER_ORCHESTRATOR: {
    action: 'TRIGGER_ORCHESTRATOR',
    addressesRiskFactors: ['RF-6'],
    subsystemChanges: [
      {
        subsystem:     'feed-orchestrator',
        changeType:    'REFRESH',
        expectedState: 'FINISHED feed re-seeded from provider; all match snapshots rebuilt',
        reversible:    true,
      },
      {
        subsystem:     'snapshot-cache',
        changeType:    'WRITE',
        expectedState: 'goalradar:match:{id} rebuilt for all FINISHED matches',
        reversible:    true,
      },
      {
        subsystem:     'enrichment-pipeline',
        changeType:    'REFRESH',
        expectedState: 'Full enrichment pipeline re-run after feed reseed',
        reversible:    true,
      },
    ],
    recoveryTime: {
      p50Seconds: 300,
      p95Seconds: 600,
      bottleneck: 'Full orchestrator pipeline: feed fetch → snapshot rebuild → enrichment re-run',
    },
    successConditions: [
      {
        key:              'feed-present',
        check:            'kv-present',
        target:           'goalradar:/competitions/WC/matches?status=FINISHED',
        pollAfterSeconds: 60,
        required:         true,
        description:      'FINISHED feed key present in KV with non-empty matches array',
      },
      {
        key:              'enrichment-full',
        check:            'enrichment',
        target:           0.95,
        pollAfterSeconds: 600,
        required:         true,
        description:      'Enrichment coverage ≥ 95% after orchestrator completes',
      },
      {
        key:              'no-authority-drift',
        check:            'no-drift',
        target:           'RED',
        pollAfterSeconds: 300,
        required:         false,
        description:      'No new authority-drift RED matches after feed reseed',
      },
    ],
    successNarrative:
      'Orchestrator triggered; FINISHED feed re-seeded, all snapshots rebuilt, enrichment pipeline confirms ≥ 95% coverage.',
    partialSuccessIndicators: [
      'Feed re-seeded but enrichment only recovers to 70–90% — ESPN data gaps',
      'Orchestrator completes but some snapshot writes fail under concurrent load',
    ],
    knownSideEffects: [
      'Monitoring dashboards may show transient RED during the 2–5 minute rebuild window',
      'Double-trigger within a short window wastes rate-limit budget',
    ],
  },

  MONITOR_SELF_HEAL: {
    action: 'MONITOR_SELF_HEAL',
    addressesRiskFactors: ['RF-7'],
    subsystemChanges: [
      {
        subsystem:     'repair-locks',
        changeType:    'OBSERVE',
        expectedState: 'Active repair locks drain naturally; no new locks acquired by monitoring',
        reversible:    true,
      },
      {
        subsystem:     'health-archive',
        changeType:    'OBSERVE',
        expectedState: 'Health archive accumulates GREEN records as self-heal completes',
        reversible:    true,
      },
    ],
    recoveryTime: {
      p50Seconds: 600,
      p95Seconds: 1800,
      bottleneck: 'Self-heal lock TTL drain (per-match locks expire after 5–10 minutes each)',
    },
    successConditions: [
      {
        key:              'repair-locks-drained',
        check:            'kv-absent',
        target:           'goalradar:repair-lock:{id}',
        pollAfterSeconds: 300,
        required:         false,
        description:      'All repair-lock keys absent (locks expired, self-heal complete)',
      },
      {
        key:              'health-green',
        check:            'metric-eq',
        target:           'GREEN',
        pollAfterSeconds: 1800,
        required:         false,
        description:      'Health archive overall status = GREEN after monitoring window',
      },
    ],
    successNarrative:
      'Self-heal observed to completion; repair locks drain without intervention; health archive transitions to GREEN.',
    partialSuccessIndicators: [
      'Most locks drain but 1–2 matches remain stuck — may need targeted PREWARM_SNAPSHOT',
      'Health improves from RED to YELLOW but does not fully reach GREEN',
    ],
    knownSideEffects: [
      'Observation only — no side effects. Escalate to PREWARM_SNAPSHOT if self-heal stalls.',
    ],
  },

  ESCALATE_INCIDENT: {
    action: 'ESCALATE_INCIDENT',
    addressesRiskFactors: ['RF-8'],
    subsystemChanges: [
      {
        subsystem:     'incident-log',
        changeType:    'SIGNAL',
        expectedState: 'Incident record created; on-call notified; remediation plan initiated',
        reversible:    false,
      },
    ],
    recoveryTime: {
      p50Seconds: 1800,
      p95Seconds: 7200,
      bottleneck: 'Human operator response time + manual remediation',
    },
    successConditions: [
      {
        key:              'incident-acknowledged',
        check:            'metric-eq',
        target:           'ACKNOWLEDGED',
        pollAfterSeconds: 1800,
        required:         false,
        description:      'Incident acknowledged by on-call operator within 30 minutes',
      },
      {
        key:              'trajectory-recovers',
        check:            'metric-gte',
        target:           0.95,
        pollAfterSeconds: 7200,
        required:         false,
        description:      'Archive trajectory returns to GREEN after human remediation',
      },
    ],
    successNarrative:
      'Incident escalated to on-call; operator acknowledges and initiates manual remediation; archive trajectory recovers to GREEN.',
    partialSuccessIndicators: [
      'Incident acknowledged but manual remediation takes > 2 hours',
      'Operator resolves some degraded matches but root cause recurs within 24 hours',
    ],
    knownSideEffects: [
      'Alert fatigue risk if escalated too frequently on low-severity archive trajectory events',
    ],
  },

  NO_ACTION: {
    action: 'NO_ACTION',
    addressesRiskFactors: [],
    subsystemChanges: [],
    recoveryTime: {
      p50Seconds: 0,
      p95Seconds: 0,
      bottleneck: 'No action taken',
    },
    successConditions: [
      {
        key:              'system-stable',
        check:            'metric-eq',
        target:           'GREEN',
        pollAfterSeconds: 300,
        required:         false,
        description:      'Health archive remains GREEN — no intervention needed',
      },
    ],
    successNarrative:
      'System is healthy; no intervention required. Continued monitoring confirms stable state.',
    partialSuccessIndicators: [],
    knownSideEffects: [],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up the outcome spec for an action. */
export function getOutcomeSpec(action: RemediationActionType): ActionOutcomeSpec {
  return ACTION_OUTCOME_REGISTRY[action];
}

/** All actions that address a specific risk factor. */
export function actionsForRiskFactor(rfId: RiskFactorId): RemediationActionType[] {
  return (Object.values(ACTION_OUTCOME_REGISTRY) as ActionOutcomeSpec[])
    .filter(s => s.addressesRiskFactors.includes(rfId))
    .map(s => s.action);
}

/** P50 recovery time in minutes (rounded). */
export function recoveryMinutesP50(action: RemediationActionType): number {
  return Math.round(ACTION_OUTCOME_REGISTRY[action].recoveryTime.p50Seconds / 60);
}

/** P95 recovery time in minutes (rounded). */
export function recoveryMinutesP95(action: RemediationActionType): number {
  return Math.round(ACTION_OUTCOME_REGISTRY[action].recoveryTime.p95Seconds / 60);
}
