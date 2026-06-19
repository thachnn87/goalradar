/**
 * GET /api/debug/cron-status
 *
 * DATA-18OPS.2D — Returns last-run status for every cron job.
 *
 * Upgraded from DATA-18OPS.2C to use scheduler-health.ts for staleness
 * derivation (replaces hardcoded per-job thresholds).
 *
 * Staleness rules (from scheduler-health.ts):
 *   GREEN  : ageMinutes <= expectedIntervalMinutes × 1.5
 *   YELLOW : ageMinutes <= expectedIntervalMinutes × 2.0
 *   RED    : ageMinutes >  expectedIntervalMinutes × 2.0
 *   UNKNOWN: no run record in KV
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 */

import { NextRequest, NextResponse }         from 'next/server';
import { kv }                                from '@vercel/kv';
import { readCronRun }                       from '@/lib/cron-recorder';
import { PREWARM_RECORD_KEY }                from '@/lib/refresh';
import {
  SCHEDULER_JOB_CONFIGS,
  computeJobHealth,
  worstHealth,
  type SchedulerHealthState,
} from '@/lib/scheduler-health';
import type { CronRunRecord, CronTriggerSource } from '@/lib/cron-recorder';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

// ---------------------------------------------------------------------------
// Orchestrator fallback to prewarm record
// ---------------------------------------------------------------------------

interface PrewarmFallback {
  timestamp:   string;
  elapsedMs:   number;
  triggeredBy: 'header' | 'queryparam' | 'unknown';
}

async function readOrchestratorRecord(): Promise<CronRunRecord | null> {
  const standard = await readCronRun('orchestrator');
  if (standard) return standard;

  try {
    const prewarm = await kv.get<PrewarmFallback>(PREWARM_RECORD_KEY);
    if (!prewarm) return null;
    const triggerSource: CronTriggerSource =
      prewarm.triggeredBy === 'header'     ? 'github-actions'
      : prewarm.triggeredBy === 'queryparam' ? 'queryparam'
      : 'unknown';
    return {
      job:           'orchestrator',
      timestamp:     prewarm.timestamp,
      durationMs:    prewarm.elapsedMs,
      status:        'ok',
      triggerSource,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const nowMs     = Date.now();

  const [orcRecord, archRecord, repairRecord, driftRecord] = await Promise.all([
    readOrchestratorRecord(),
    readCronRun('health-archive'),
    readCronRun('repair-enrichment'),
    readCronRun('drift-scan'),
  ]);

  const records: Record<string, CronRunRecord | null> = {
    'orchestrator':      orcRecord,
    'health-archive':    archRecord,
    'repair-enrichment': repairRecord,
    'drift-scan':        driftRecord,
    'health-check':      null,
  };

  const jobs = Object.keys(SCHEDULER_JOB_CONFIGS).map(jobId => {
    const jh = computeJobHealth(jobId, records[jobId] ?? null, nowMs);

    // Backward-compat shape (matches old response + new fields)
    return {
      job:           jh.jobId,
      label:         jh.label,
      // Map internal states to the legacy GREEN/YELLOW/RED/UNIMPLEMENTED strings
      status:        (jh.health === 'UNKNOWN' ? 'RED' : jh.health) as SchedulerHealthState,
      lastRun:       jh.lastRunAt,
      lastSuccess:   records[jobId]?.status === 'ok' ? jh.lastRunAt : null,
      ageMinutes:    jh.ageMinutes,
      durationMs:    jh.durationMs,
      triggerSource: jh.triggerSource,
      // New scheduler-health fields
      expectedIntervalMinutes: jh.expectedIntervalMinutes,
      stalenessFactor:         jh.stalenessFactor,
      health:                  jh.health,
      stalenessReason:         jh.stalenessReason,
      nextExpectedRun:         jh.nextExpectedRun,
      outageStartedAt:         jh.outageStartedAt,
      outageDurationMinutes:   jh.outageDurationMinutes,
      schedulerSource:         jh.schedulerSource,
      criticalityLevel:        jh.criticalityLevel,
      ...(jh.health === 'UNIMPLEMENTED' ? { note: 'Route not yet implemented' } : {}),
    };
  });

  const implementedJobs = jobs.filter(j => j.health !== 'UNIMPLEMENTED');
  const overallHealth = worstHealth(
    implementedJobs.map(j => j.health),
  );

  // Legacy fields for backward compat
  const redJobs    = implementedJobs.filter(j => j.status === 'RED').map(j => j.job);
  const yellowJobs = implementedJobs.filter(j => j.status === 'YELLOW').map(j => j.job);

  return NextResponse.json(
    {
      checkedAt,
      overall:       overallHealth,   // upgraded: now uses scheduler-health staleness factor
      overallHealth,                  // alias — consistent with scheduler-health endpoint
      redJobs,
      yellowJobs,
      jobs,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
