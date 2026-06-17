/**
 * GET /api/debug/incident-history
 *
 * DATA-18H Phase 2 — Incident history derived from the health archive.
 *
 * Reads the 30-day health archive and derives incidents (contiguous runs of
 * RED/YELLOW health), then summarises them over 24h / 7d / 30d windows.
 *
 * Returns:
 *   { checkedAt, windows: { '24h', '7d', '30d' },
 *     lastRedIncident, lastYellowIncident, archiveSize }
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 * Read-only — derives from archive, never writes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readHealthRecords }         from '@/lib/health-archive';
import { deriveIncidents, type Incident } from '@/lib/incident';

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

interface WindowSummary {
  incidents:     number;
  red:           number;
  yellow:        number;
  totalRedMin:   number;
  totalYellowMin: number;
  list:          Incident[];
}

function summarise(incidents: Incident[], sinceMs: number): WindowSummary {
  const inWin = incidents.filter(i => new Date(i.startedAt).getTime() >= sinceMs);
  const red    = inWin.filter(i => i.severity === 'RED');
  const yellow = inWin.filter(i => i.severity === 'YELLOW');
  return {
    incidents:      inWin.length,
    red:            red.length,
    yellow:         yellow.length,
    totalRedMin:    red.reduce((s, i) => s + i.durationMin, 0),
    totalYellowMin: yellow.reduce((s, i) => s + i.durationMin, 0),
    list:           inWin,
  };
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

  const records   = await readHealthRecords(now - 30 * DAY, now);
  const incidents = deriveIncidents(records, now);

  const incidents24h = summarise(incidents, now - 1 * DAY);
  const incidents7d  = summarise(incidents, now - 7 * DAY);
  const incidents30d = summarise(incidents, now - 30 * DAY);

  const reds    = incidents.filter(i => i.severity === 'RED');
  const yellows = incidents.filter(i => i.severity === 'YELLOW');

  const lastRedIncident =
    reds.length ? reds.reduce((a, b) =>
      new Date(a.startedAt).getTime() > new Date(b.startedAt).getTime() ? a : b) : null;
  const lastYellowIncident =
    yellows.length ? yellows.reduce((a, b) =>
      new Date(a.startedAt).getTime() > new Date(b.startedAt).getTime() ? a : b) : null;

  return NextResponse.json(
    {
      checkedAt,
      archiveSize:  records.length,
      incidents24h,
      incidents7d,
      incidents30d,
      lastRedIncident,
      lastYellowIncident,
      note: records.length === 0
        ? 'Health archive empty — wire /api/cron/health-archive to begin recording.'
        : `${incidents.length} incident(s) across ${records.length} archived snapshots.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
