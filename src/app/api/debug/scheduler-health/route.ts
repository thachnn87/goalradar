/**
 * GET /api/debug/scheduler-health
 *
 * DATA-18OPS.2D — Scheduler readiness dashboard.
 *
 * Returns job health ranked by priority (criticality × staleness),
 * identifies the most critical degraded job, the oldest job by age,
 * active outages with duration, and an overall scheduler health score.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 */

import { NextRequest, NextResponse }    from 'next/server';
import { kv }                           from '@vercel/kv';
import { readCronRun }                  from '@/lib/cron-recorder';
import { PREWARM_RECORD_KEY }           from '@/lib/refresh';
import {
  SCHEDULER_JOB_CONFIGS,
  computeJobHealth,
  worstHealth,
  jobPriority,
  type SchedulerJobHealth,
  type SchedulerHealthState,
} from '@/lib/scheduler-health';
import type { CronRunRecord, CronTriggerSource } from '@/lib/cron-recorder';

export const dynamic     = 'force-dynamic';
export const maxDuration = 15;

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
// Orchestrator fallback (same as cron-status)
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
      job: 'orchestrator', timestamp: prewarm.timestamp, durationMs: prewarm.elapsedMs,
      status: 'ok', triggerSource,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Health score
// ---------------------------------------------------------------------------

function healthScore(jobs: SchedulerJobHealth[]): number {
  const implemented = jobs.filter(j => j.implemented);
  if (implemented.length === 0) return 100;

  const stateScore: Record<SchedulerHealthState, number> = {
    GREEN:         100,
    YELLOW:         60,
    RED:             0,
    UNKNOWN:        20,
    UNIMPLEMENTED: 100,
  };

  const weights: Record<string, number> = { critical: 3, important: 2, maintenance: 1 };
  let totalWeight = 0;
  let weightedScore = 0;
  for (const j of implemented) {
    const w = weights[j.criticalityLevel] ?? 1;
    totalWeight += w;
    weightedScore += stateScore[j.health] * w;
  }
  return Math.round(weightedScore / totalWeight);
}

function healthScoreVerdict(score: number): 'SCHEDULER_READY' | 'SCHEDULER_DEGRADED' | 'SCHEDULER_NOT_READY' {
  if (score >= 80) return 'SCHEDULER_READY';
  if (score >= 50) return 'SCHEDULER_DEGRADED';
  return 'SCHEDULER_NOT_READY';
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const nowMs     = Date.now();

  // Fetch all records in parallel
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

  // Compute health for all jobs
  const allJobs: SchedulerJobHealth[] = Object.keys(SCHEDULER_JOB_CONFIGS).map(jobId =>
    computeJobHealth(jobId, records[jobId] ?? null, nowMs),
  );

  // Sort by priority: critical RED first, then critical YELLOW, etc.
  const ranked = [...allJobs].sort((a, b) => jobPriority(b) - jobPriority(a));

  // Derived analytics
  const implementedJobs  = allJobs.filter(j => j.implemented);
  const overall          = worstHealth(implementedJobs.map(j => j.health));
  const score            = healthScore(allJobs);
  const verdict          = healthScoreVerdict(score);

  const activeOutages    = implementedJobs.filter(j => j.outageStartedAt !== null);
  const mostCriticalBad  = ranked.find(j => j.health === 'RED' || j.health === 'UNKNOWN' || j.health === 'YELLOW') ?? null;

  const oldestJob = implementedJobs
    .filter(j => j.ageMinutes !== null)
    .sort((a, b) => (b.ageMinutes ?? 0) - (a.ageMinutes ?? 0))[0] ?? null;

  // Summary counts
  const counts: Record<SchedulerHealthState, number> = {
    GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0, UNIMPLEMENTED: 0,
  };
  for (const j of allJobs) counts[j.health]++;

  return NextResponse.json(
    {
      checkedAt,
      overallHealth:  overall,
      healthScore:    score,
      verdict,

      summary: {
        total:         allJobs.length,
        implemented:   implementedJobs.length,
        ...counts,
        activeOutages: activeOutages.length,
      },

      mostCriticalIssue: mostCriticalBad ? {
        jobId:                 mostCriticalBad.jobId,
        label:                 mostCriticalBad.label,
        health:                mostCriticalBad.health,
        criticalityLevel:      mostCriticalBad.criticalityLevel,
        stalenessFactor:       mostCriticalBad.stalenessFactor,
        ageMinutes:            mostCriticalBad.ageMinutes,
        outageDurationMinutes: mostCriticalBad.outageDurationMinutes,
        stalenessReason:       mostCriticalBad.stalenessReason,
      } : null,

      oldestJob: oldestJob ? {
        jobId:      oldestJob.jobId,
        label:      oldestJob.label,
        ageMinutes: oldestJob.ageMinutes,
        health:     oldestJob.health,
        lastRunAt:  oldestJob.lastRunAt,
      } : null,

      activeOutages: activeOutages.map(j => ({
        jobId:                 j.jobId,
        label:                 j.label,
        criticalityLevel:      j.criticalityLevel,
        health:                j.health,
        outageStartedAt:       j.outageStartedAt,
        outageDurationMinutes: j.outageDurationMinutes,
        stalenessFactor:       j.stalenessFactor,
        stalenessReason:       j.stalenessReason,
      })),

      jobs: ranked,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
