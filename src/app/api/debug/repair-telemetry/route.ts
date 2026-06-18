/**
 * GET /api/debug/repair-telemetry
 *
 * DATA-18P Phase 4 — Repair history telemetry.
 *
 * Reads the repair-history archive and returns aggregated statistics.
 * Read-only — no writes, no mutations.
 *
 * Returns:
 *   {
 *     windows: { 24h, 7d, 30d, 90d }  — per-window aggregate stats
 *     topRepairedMatches               — top 5 most-repaired matchIds
 *     recentRepairs                    — last 10 repair records
 *     archiveSize                      — total records in archive
 *   }
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import {
  readRepairRecords,
  computeRepairTelemetry,
  REPAIR_HISTORY_KEY,
} from '@/lib/repair-history';

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now = Date.now();

  // Read all windows in parallel
  const [records90d, archiveSizeRaw] = await Promise.all([
    readRepairRecords(now - 90 * 24 * 3_600_000, now),
    kv.zcard(REPAIR_HISTORY_KEY).catch(() => 0),
  ]);

  const records30d = records90d.filter(r => r.ts >= now - 30 * 24 * 3_600_000);
  const records7d  = records90d.filter(r => r.ts >= now -  7 * 24 * 3_600_000);
  const records24h = records90d.filter(r => r.ts >= now -  1 * 24 * 3_600_000);

  const recentRepairs = [...records90d]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10)
    .map(r => ({
      recordedAt:  r.recordedAt,
      matchId:     r.matchId,
      action:      r.action,
      result:      r.result,
      durationMs:  r.durationMs,
      triggeredBy: r.triggeredBy,
      reason:      r.reason.slice(0, 100),
    }));

  const stats90d = computeRepairTelemetry(records90d);

  return NextResponse.json(
    {
      checkedAt:   new Date(now).toISOString(),
      archiveSize: archiveSizeRaw,
      windows: {
        '24h': computeRepairTelemetry(records24h),
        '7d':  computeRepairTelemetry(records7d),
        '30d': computeRepairTelemetry(records30d),
        '90d': stats90d,
      },
      topRepairedMatches: stats90d.topMatchIds,
      recentRepairs,
      note: records90d.length === 0
        ? 'No repair records yet. Archive populates when AUTONOMOUS_RELIABILITY_ENABLED=true and repairs execute.'
        : `${records90d.length} repair record(s) in 90-day archive.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
