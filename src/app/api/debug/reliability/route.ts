/**
 * GET /api/debug/reliability
 *
 * DATA-18H Phase 4 — Single reliability verdict.
 *
 * Aggregates:
 *   - health archive          (30-day record set)
 *   - incident history        (derived RED/YELLOW incidents)
 *   - SLO compliance          (24h / 7d / 30d)
 *   - live worldcup-health    (current aggregate verdict)
 *   - live authority-drift    (current score/state drift)
 *   - live feed-integrity     (current feed cross-validation)
 *
 * Verdict logic:
 *   RED    — current worldcup-health RED, OR an open RED incident,
 *            OR 24h Score-Accuracy SLO breached.
 *   YELLOW — current YELLOW, OR open YELLOW incident, OR any 7d SLO breached.
 *   GREEN  — all live checks GREEN and all 24h/7d SLOs met.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 */

import { NextRequest, NextResponse } from 'next/server';
import { readHealthRecords }         from '@/lib/health-archive';
import { deriveIncidents }           from '@/lib/incident';
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

type V = 'GREEN' | 'YELLOW' | 'RED' | 'ERROR';

function normVerdict(raw: unknown): V {
  if (raw === 'GREEN'  || raw === 'PASS') return 'GREEN';
  if (raw === 'YELLOW' || raw === 'WARN') return 'YELLOW';
  if (raw === 'RED'    || raw === 'FAIL') return 'RED';
  return 'ERROR';
}

async function liveVerdict(baseUrl: string, path: string, secret: string): Promise<V> {
  try {
    const res = await fetch(`${baseUrl}${path}?secret=${encodeURIComponent(secret)}`, {
      headers: { 'Cache-Control': 'no-store' },
      signal:  AbortSignal.timeout(25_000),
    });
    if (!res.ok) return 'ERROR';
    const d = await res.json() as Record<string, unknown>;
    return normVerdict(d.verdict);
  } catch {
    return 'ERROR';
  }
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
  const secret    = process.env.CRON_SECRET ?? '';
  const reqUrl    = new URL(req.url);
  const baseUrl   = `${reqUrl.protocol}//${reqUrl.host}`;

  // ── Live checks + archive in parallel ─────────────────────────────────────
  const [health, drift, feed, records] = await Promise.all([
    liveVerdict(baseUrl, '/api/debug/worldcup-health', secret),
    liveVerdict(baseUrl, '/api/debug/authority-drift',  secret),
    liveVerdict(baseUrl, '/api/debug/feed-integrity',   secret),
    readHealthRecords(now - 30 * DAY, now),
  ]);

  const incidents   = deriveIncidents(records, now);
  const openRed     = incidents.find(i => i.open && i.severity === 'RED')    ?? null;
  const openYellow  = incidents.find(i => i.open && i.severity === 'YELLOW') ?? null;

  const slo24 = computeSLO(records.filter(r => r.ts >= now - 1 * DAY));
  const slo7  = computeSLO(records.filter(r => r.ts >= now - 7 * DAY));
  const slo30 = computeSLO(records);

  // ── Verdict ───────────────────────────────────────────────────────────────
  const reasons: string[] = [];

  const isRed =
    health === 'RED' || health === 'ERROR' || drift === 'RED' || feed === 'RED' ||
    !!openRed || !slo24.scoreAccuracy.met;
  if (health === 'RED' || health === 'ERROR') reasons.push(`worldcup-health=${health}`);
  if (drift === 'RED')                         reasons.push('authority-drift=RED');
  if (feed === 'RED')                          reasons.push('feed-integrity=RED');
  if (openRed)                                 reasons.push(`open RED incident ${openRed.id} (${openRed.durationMin}min)`);
  if (!slo24.scoreAccuracy.met)                reasons.push(`24h Score-Accuracy ${slo24.scoreAccuracy.compliancePct}% < 99.99%`);

  const isYellow =
    health === 'YELLOW' || drift === 'YELLOW' || feed === 'YELLOW' ||
    !!openYellow || !slo7.scoreAccuracy.met || !slo7.freshness.met || !slo7.enrichment.met;
  if (!isRed) {
    if (health === 'YELLOW' || drift === 'YELLOW' || feed === 'YELLOW')
      reasons.push('a live subsystem is YELLOW');
    if (openYellow)            reasons.push(`open YELLOW incident ${openYellow.id}`);
    if (!slo7.freshness.met)   reasons.push(`7d Freshness ${slo7.freshness.compliancePct}% < 99%`);
    if (!slo7.enrichment.met)  reasons.push(`7d Enrichment ${slo7.enrichment.compliancePct}% < 95%`);
    if (!slo7.scoreAccuracy.met) reasons.push(`7d Score-Accuracy ${slo7.scoreAccuracy.compliancePct}% < 99.99%`);
  }

  const verdict: 'GREEN' | 'YELLOW' | 'RED' = isRed ? 'RED' : isYellow ? 'YELLOW' : 'GREEN';

  return NextResponse.json(
    {
      checkedAt,
      verdict,
      reasons: reasons.length ? reasons : ['all live checks GREEN; all 24h/7d SLOs met'],
      live: { worldcupHealth: health, authorityDrift: drift, feedIntegrity: feed },
      archive: {
        size:           records.length,
        oldestAt:       records[0]?.capturedAt ?? null,
        newestAt:       records[records.length - 1]?.capturedAt ?? null,
        openRedIncident:    openRed,
        openYellowIncident: openYellow,
        incidentCount30d:   incidents.length,
      },
      slo: { '24h': slo24, '7d': slo7, '30d': slo30 },
      note: records.length === 0
        ? 'No archive yet — verdict reflects live checks only. Wire /api/cron/health-archive for historical evidence.'
        : `Reliability verdict ${verdict} over ${records.length} archived snapshots.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
