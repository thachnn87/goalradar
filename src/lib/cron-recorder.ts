/**
 * Shared cron execution recorder.
 *
 * Every cron job calls recordCronRun() at completion. This writes a
 * standardised CronRunRecord to KV at:
 *   goalradar:cron:{job}:last-run
 *
 * The /api/debug/cron-status endpoint reads these keys to show GREEN/YELLOW/RED
 * for each job without relying on console logs or per-job custom state.
 *
 * TTL: 10 days — ensures the 7-day staleness window is always covered even
 * for daily jobs (repair-enrichment, drift-scan).
 */

import { kv } from '@vercel/kv';
import type { NextRequest } from 'next/server';

export type CronTriggerSource =
  | 'github-actions'  // Authorization: Bearer header (GitHub Actions pattern)
  | 'vercel-native'   // x-vercel-cron: 1 header (Vercel native cron)
  | 'queryparam'      // ?secret= query param (UptimeRobot / EasyCron pattern)
  | 'unknown';

export type CronRunStatus = 'ok' | 'error';

export interface CronRunRecord {
  job:           string;
  timestamp:     string;         // ISO 8601 completion timestamp
  durationMs:    number;
  status:        CronRunStatus;
  triggerSource: CronTriggerSource;
}

const RECORD_TTL_SEC = 10 * 24 * 3_600; // 864 000 s — 10 days

/**
 * Infer who triggered this request from request headers / URL.
 * Call once at the top of the cron handler after the auth check.
 */
export function detectTriggerSource(req: NextRequest): CronTriggerSource {
  if (req.headers.get('x-vercel-cron') === '1')         return 'vercel-native';
  if ((req.headers.get('authorization') ?? '').startsWith('Bearer ')) return 'github-actions';
  if (new URL(req.url).searchParams.has('secret'))       return 'queryparam';
  return 'unknown';
}

/**
 * Write the run record for a completed cron job.
 * Should be awaited before the route returns its Response so the artifact
 * is durably stored. Never throws — logs on KV failure.
 */
export async function recordCronRun(
  job:           string,
  durationMs:    number,
  status:        CronRunStatus,
  triggerSource: CronTriggerSource,
): Promise<void> {
  const record: CronRunRecord = {
    job,
    timestamp: new Date().toISOString(),
    durationMs,
    status,
    triggerSource,
  };
  try {
    await kv.set(`goalradar:cron:${job}:last-run`, record, { ex: RECORD_TTL_SEC });
  } catch (err) {
    console.error(
      `[CronRecorder] KV write failed for job=${job}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Read the last run record for a job. Returns null on miss or KV unavailable. */
export async function readCronRun(job: string): Promise<CronRunRecord | null> {
  try {
    return await kv.get<CronRunRecord>(`goalradar:cron:${job}:last-run`);
  } catch {
    return null;
  }
}
