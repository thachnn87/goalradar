/**
 * GET /api/debug/cron-status
 *
 * DATA-18OPS.2C — Returns last-run status for every cron job.
 *
 * Reads KV keys written by recordCronRun() in each cron route:
 *   goalradar:cron:{job}:last-run
 *
 * For the orchestrator, falls back to goalradar:prewarm:last-run (written by
 * savePrewarmRecord in refresh.ts) if the standard recorder key is absent —
 * so the orchestrator shows correctly before its first post-2C-deploy run.
 *
 * Status thresholds (per job class):
 *   Orchestrator (30-min UptimeRobot hard cadence; GitHub Actions backup ~2h):
 *     GREEN  : last run ≤ 60 min  (2× the 30-min UptimeRobot cadence)
 *     YELLOW : 60–120 min         (missed ≥2 UptimeRobot cycles)
 *     RED    : > 120 min or never
 *
 *   Health-Archive (GitHub Actions ~2h effective cadence):
 *     GREEN  : last run ≤ 4h ago
 *     YELLOW : 4–8h ago
 *     RED    : > 8h ago or never
 *
 *   Repair-Enrichment / Drift-Scan (daily jobs):
 *     GREEN  : last run ≤ 36h ago
 *     YELLOW : 36–72h ago
 *     RED    : > 72h ago or never
 *
 *   Health-Check (not yet implemented):
 *     Always UNIMPLEMENTED until the route exists.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { readCronRun }               from '@/lib/cron-recorder';
import type { CronRunRecord, CronRunStatus, CronTriggerSource } from '@/lib/cron-recorder';
import { PREWARM_RECORD_KEY }        from '@/lib/refresh';

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
// Job configuration
// ---------------------------------------------------------------------------

type JobStatus = 'GREEN' | 'YELLOW' | 'RED' | 'UNIMPLEMENTED';

interface JobConfig {
  label:       string;
  greenMaxMin: number;   // GREEN  if ageMinutes ≤ greenMaxMin
  yellowMaxMin: number;  // YELLOW if > greenMaxMin and ≤ yellowMaxMin; RED otherwise
  implemented: boolean;  // false → status is always UNIMPLEMENTED
}

const JOB_CONFIGS: Record<string, JobConfig> = {
  'orchestrator':      { label: 'Orchestrator',      greenMaxMin: 60,   yellowMaxMin: 120,  implemented: true  },
  'health-archive':    { label: 'Health Archive',    greenMaxMin: 240,  yellowMaxMin: 480,  implemented: true  },
  'repair-enrichment': { label: 'Repair Enrichment', greenMaxMin: 2160, yellowMaxMin: 4320, implemented: true  },
  'drift-scan':        { label: 'Drift Scan',        greenMaxMin: 2160, yellowMaxMin: 4320, implemented: true  },
  'health-check':      { label: 'Health Check',      greenMaxMin: 60,   yellowMaxMin: 240,  implemented: false },
};

// ---------------------------------------------------------------------------
// Per-job status derivation
// ---------------------------------------------------------------------------

interface JobStatusResult {
  job:           string;
  label:         string;
  status:        JobStatus;
  lastRun:       string | null;
  lastSuccess:   string | null;
  ageMinutes:    number | null;
  durationMs:    number | null;
  triggerSource: CronTriggerSource | null;
  note?:         string;
}

function deriveStatus(config: JobConfig, record: CronRunRecord | null, nowMs: number): JobStatus {
  if (!config.implemented) return 'UNIMPLEMENTED';
  if (!record)             return 'RED';
  const ageMin = (nowMs - new Date(record.timestamp).getTime()) / 60_000;
  if (ageMin <= config.greenMaxMin)  return 'GREEN';
  if (ageMin <= config.yellowMaxMin) return 'YELLOW';
  return 'RED';
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
  // Prefer the standard recorder key (written after DATA-18OPS.2C deploy)
  const standard = await readCronRun('orchestrator');
  if (standard) return standard;

  // Fall back to the legacy prewarm record (always present if orchestrator has run)
  try {
    const prewarm = await kv.get<PrewarmFallback>(PREWARM_RECORD_KEY);
    if (!prewarm) return null;
    const triggerSource: CronTriggerSource =
      prewarm.triggeredBy === 'header'    ? 'github-actions'
      : prewarm.triggeredBy === 'queryparam' ? 'queryparam'
      : 'unknown';
    return {
      job:           'orchestrator',
      timestamp:     prewarm.timestamp,
      durationMs:    prewarm.elapsedMs,
      status:        'ok' as CronRunStatus,
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

  // Read all job records in parallel
  const [orcRecord, archRecord, repairRecord, driftRecord] = await Promise.all([
    readOrchestratorRecord(),
    readCronRun('health-archive'),
    readCronRun('repair-enrichment'),
    readCronRun('drift-scan'),
    // health-check route does not exist yet — its record will always be null
  ]);

  const jobRecords: Record<string, CronRunRecord | null> = {
    'orchestrator':      orcRecord,
    'health-archive':    archRecord,
    'repair-enrichment': repairRecord,
    'drift-scan':        driftRecord,
    'health-check':      null,
  };

  const jobs: JobStatusResult[] = Object.entries(JOB_CONFIGS).map(([jobId, config]) => {
    const record = jobRecords[jobId] ?? null;
    const status = deriveStatus(config, record, nowMs);
    const ageMin = record
      ? Math.round((nowMs - new Date(record.timestamp).getTime()) / 60_000)
      : null;

    const result: JobStatusResult = {
      job:           jobId,
      label:         config.label,
      status,
      lastRun:       record?.timestamp     ?? null,
      lastSuccess:   record?.status === 'ok' ? record.timestamp : null,
      ageMinutes:    ageMin,
      durationMs:    record?.durationMs    ?? null,
      triggerSource: record?.triggerSource ?? null,
    };

    if (!config.implemented) result.note = 'Route not yet implemented';
    if (jobId === 'orchestrator' && !orcRecord?.job?.includes('orchestrator')) {
      // Record came from prewarm fallback — note it
      result.note = 'Status from legacy prewarm record; will use standard recorder after next run';
    }
    return result;
  });

  // Aggregate verdict
  const implementedJobs = jobs.filter(j => j.status !== 'UNIMPLEMENTED');
  const overallStatus: JobStatus =
    implementedJobs.some(j => j.status === 'RED')    ? 'RED'
    : implementedJobs.some(j => j.status === 'YELLOW') ? 'YELLOW'
    : 'GREEN';

  const redJobs    = jobs.filter(j => j.status === 'RED').map(j => j.job);
  const yellowJobs = jobs.filter(j => j.status === 'YELLOW').map(j => j.job);

  return NextResponse.json(
    {
      checkedAt,
      overall: overallStatus,
      redJobs,
      yellowJobs,
      jobs,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
