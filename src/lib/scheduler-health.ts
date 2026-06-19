/**
 * Scheduler health computation — DATA-18OPS.2D.
 *
 * Single source of truth for all cron-job staleness logic.
 * Used by /api/debug/cron-status (upgraded) and /api/debug/scheduler-health.
 *
 * Staleness rules (factor = ageMinutes / expectedIntervalMinutes):
 *   GREEN  : factor <= 1.5  (within 1.5× expected interval — one missed cycle allowed)
 *   YELLOW : factor <= 2.0  (between 1.5× and 2.0× — degraded, investigate)
 *   RED    : factor >  2.0  (more than 2× expected interval — outage)
 *   UNKNOWN: no run record in KV
 */

import type { CronRunRecord } from '@/lib/cron-recorder';

// ---------------------------------------------------------------------------
// Job configuration
// ---------------------------------------------------------------------------

export type CriticalityLevel = 'critical' | 'important' | 'maintenance';

export interface SchedulerJobConfig {
  label:                   string;
  expectedIntervalMinutes: number;
  criticalityLevel:        CriticalityLevel;
  schedulerSource:         string;
  endpointPath:            string;
  implemented:             boolean;
}

/**
 * Canonical registry of all scheduled workloads.
 * Update this when adding a new cron job.
 */
export const SCHEDULER_JOB_CONFIGS: Record<string, SchedulerJobConfig> = {
  'orchestrator': {
    label:                   'Orchestrator',
    expectedIntervalMinutes: 30,
    criticalityLevel:        'critical',
    schedulerSource:         'UptimeRobot (30 min hard cadence) + GitHub Actions (*/15, ~2h effective backup)',
    endpointPath:            '/api/cron/orchestrator',
    implemented:             true,
  },
  'health-archive': {
    label:                   'Health Archive',
    expectedIntervalMinutes: 120,
    criticalityLevel:        'important',
    schedulerSource:         'GitHub Actions (*/15, ~2h effective)',
    endpointPath:            '/api/cron/health-archive',
    implemented:             true,
  },
  'repair-enrichment': {
    label:                   'Repair Enrichment',
    expectedIntervalMinutes: 1440,
    criticalityLevel:        'maintenance',
    schedulerSource:         'GitHub Actions (0 4 * * * UTC daily)',
    endpointPath:            '/api/cron/repair-enrichment',
    implemented:             true,
  },
  'drift-scan': {
    label:                   'Drift Scan',
    expectedIntervalMinutes: 1440,
    criticalityLevel:        'maintenance',
    schedulerSource:         'GitHub Actions (30 4 * * * UTC daily)',
    endpointPath:            '/api/cron/drift-scan',
    implemented:             true,
  },
  'health-check': {
    label:                   'Health Check',
    expectedIntervalMinutes: 60,
    criticalityLevel:        'important',
    schedulerSource:         'Not yet configured',
    endpointPath:            '/api/cron/health-check',
    implemented:             false,
  },
};

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

export const STALENESS_GREEN_FACTOR  = 1.5;  // factor <= 1.5  → GREEN
export const STALENESS_YELLOW_FACTOR = 2.0;  // factor <= 2.0  → YELLOW; > 2.0 → RED

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type SchedulerHealthState = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | 'UNIMPLEMENTED';

export interface SchedulerJobHealth {
  jobId:                   string;
  label:                   string;
  criticalityLevel:        CriticalityLevel;
  schedulerSource:         string;
  endpointPath:            string;
  implemented:             boolean;

  expectedIntervalMinutes: number;

  lastRunAt:               string | null;
  ageMinutes:              number | null;
  stalenessFactor:         number | null;

  health:                  SchedulerHealthState;
  stalenessReason:         string;

  nextExpectedRun:         string | null;
  outageStartedAt:         string | null;
  outageDurationMinutes:   number | null;

  durationMs:              number | null;
  triggerSource:           string | null;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

function healthFromFactor(factor: number | null): SchedulerHealthState {
  if (factor === null)                       return 'UNKNOWN';
  if (factor <= STALENESS_GREEN_FACTOR)      return 'GREEN';
  if (factor <= STALENESS_YELLOW_FACTOR)     return 'YELLOW';
  return 'RED';
}

function stalenessReason(
  health: SchedulerHealthState,
  ageMinutes: number | null,
  factor: number | null,
  cfg: SchedulerJobConfig,
): string {
  if (!cfg.implemented)     return 'Job not yet implemented.';
  if (health === 'UNKNOWN') return 'No run record found — job has never run or KV key has expired.';
  if (health === 'GREEN') {
    return `Last run ${ageMinutes!.toFixed(1)} min ago (${factor!.toFixed(2)}× interval). Within expected cadence.`;
  }
  if (health === 'YELLOW') {
    const overage = (ageMinutes! - cfg.expectedIntervalMinutes).toFixed(0);
    return `Overdue by ${overage} min (${factor!.toFixed(2)}× interval). Investigate scheduler.`;
  }
  // RED
  const overage = (ageMinutes! - cfg.expectedIntervalMinutes * 2).toFixed(0);
  return `Outage: ${ageMinutes!.toFixed(0)} min since last run (${factor!.toFixed(2)}× interval). Expected run >${cfg.expectedIntervalMinutes * 2} min ago. Immediate attention required.`;
}

export function computeJobHealth(
  jobId:  string,
  record: CronRunRecord | null,
  nowMs:  number,
): SchedulerJobHealth {
  const cfg = SCHEDULER_JOB_CONFIGS[jobId];
  if (!cfg) {
    // Unknown job — return minimal shape
    return {
      jobId, label: jobId, criticalityLevel: 'maintenance', schedulerSource: 'unknown',
      endpointPath: '', implemented: false, expectedIntervalMinutes: 0,
      lastRunAt: null, ageMinutes: null, stalenessFactor: null,
      health: 'UNKNOWN', stalenessReason: `Unknown jobId: ${jobId}`,
      nextExpectedRun: null, outageStartedAt: null, outageDurationMinutes: null,
      durationMs: null, triggerSource: null,
    };
  }

  if (!cfg.implemented) {
    return {
      jobId, label: cfg.label, criticalityLevel: cfg.criticalityLevel,
      schedulerSource: cfg.schedulerSource, endpointPath: cfg.endpointPath, implemented: false,
      expectedIntervalMinutes: cfg.expectedIntervalMinutes,
      lastRunAt: null, ageMinutes: null, stalenessFactor: null,
      health: 'UNIMPLEMENTED', stalenessReason: 'Job not yet implemented.',
      nextExpectedRun: null, outageStartedAt: null, outageDurationMinutes: null,
      durationMs: null, triggerSource: null,
    };
  }

  if (!record) {
    return {
      jobId, label: cfg.label, criticalityLevel: cfg.criticalityLevel,
      schedulerSource: cfg.schedulerSource, endpointPath: cfg.endpointPath, implemented: true,
      expectedIntervalMinutes: cfg.expectedIntervalMinutes,
      lastRunAt: null, ageMinutes: null, stalenessFactor: null,
      health: 'UNKNOWN', stalenessReason: 'No run record found — job has never run or KV key has expired.',
      nextExpectedRun: null, outageStartedAt: null, outageDurationMinutes: null,
      durationMs: null, triggerSource: null,
    };
  }

  const lastRunMs    = new Date(record.timestamp).getTime();
  const ageMs        = nowMs - lastRunMs;
  const ageMinutes   = ageMs / 60_000;
  const intervalMs   = cfg.expectedIntervalMinutes * 60_000;
  const factor       = ageMinutes / cfg.expectedIntervalMinutes;
  const health       = healthFromFactor(factor);

  const nextExpectedRunMs   = lastRunMs + intervalMs;
  const nextExpectedRun     = new Date(nextExpectedRunMs).toISOString();

  // Outage started when age exceeded 1 interval (expected run was missed)
  const outageStartedAtMs   = nextExpectedRunMs;
  const outageActive        = nowMs > outageStartedAtMs;
  const outageStartedAt     = outageActive ? new Date(outageStartedAtMs).toISOString() : null;
  const outageDurationMinutes = outageActive
    ? Math.round((nowMs - outageStartedAtMs) / 60_000)
    : null;

  return {
    jobId,
    label:                   cfg.label,
    criticalityLevel:        cfg.criticalityLevel,
    schedulerSource:         cfg.schedulerSource,
    endpointPath:            cfg.endpointPath,
    implemented:             true,
    expectedIntervalMinutes: cfg.expectedIntervalMinutes,
    lastRunAt:               record.timestamp,
    ageMinutes:              Math.round(ageMinutes * 10) / 10,
    stalenessFactor:         Math.round(factor * 100) / 100,
    health,
    stalenessReason:         stalenessReason(health, ageMinutes, factor, cfg),
    nextExpectedRun,
    outageStartedAt,
    outageDurationMinutes,
    durationMs:              record.durationMs,
    triggerSource:           record.triggerSource,
  };
}

// ---------------------------------------------------------------------------
// Overall health aggregation
// ---------------------------------------------------------------------------

const HEALTH_RANK: Record<SchedulerHealthState, number> = {
  RED:           4,
  UNKNOWN:       3,
  YELLOW:        2,
  GREEN:         1,
  UNIMPLEMENTED: 0,
};

export function worstHealth(states: SchedulerHealthState[]): SchedulerHealthState {
  return states.reduce<SchedulerHealthState>(
    (worst, s) => HEALTH_RANK[s] > HEALTH_RANK[worst] ? s : worst,
    'GREEN',
  );
}

/**
 * Priority score for ranking jobs — critical outages rank highest.
 */
export function jobPriority(job: SchedulerJobHealth): number {
  const critScore: Record<CriticalityLevel, number> = { critical: 100, important: 50, maintenance: 10 };
  return (HEALTH_RANK[job.health] * critScore[job.criticalityLevel]) +
         (job.stalenessFactor ?? 0);
}
