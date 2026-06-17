/**
 * GET /api/debug/slo-compliance
 *
 * DATA-18H Phase 3 — SLO compliance over 24h / 7d / 30d windows.
 *
 * Reduces the health archive into compliance percentages for the three SLOs
 * defined in DATA18G_SLO.md.
 *
 * Returns:
 *   { checkedAt, archiveSize, windows: { '24h', '7d', '30d' } }
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 * Read-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readHealthRecords }         from '@/lib/health-archive';
import { computeSLO }                from '@/lib/slo-compliance';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;

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

  const now       = Date.now();
  const checkedAt = new Date(now).toISOString();

  const all = await readHealthRecords(now - 30 * DAY, now);

  const w24 = all.filter(r => r.ts >= now - 1 * DAY);
  const w7  = all.filter(r => r.ts >= now - 7 * DAY);
  const w30 = all;

  return NextResponse.json(
    {
      checkedAt,
      archiveSize: all.length,
      windows: {
        '24h': computeSLO(w24),
        '7d':  computeSLO(w7),
        '30d': computeSLO(w30),
      },
      note: all.length === 0
        ? 'Health archive empty — wire /api/cron/health-archive to begin recording. Compliance defaults to 100% with zero observations.'
        : `Compliance computed over ${all.length} archived snapshots.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
