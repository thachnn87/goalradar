/**
 * GET /api/cron/health-archive
 *
 * DATA-18H Phase 1 — Persist a World Cup health snapshot.
 *
 * Fetches the four monitoring subsystems in parallel, builds a flat
 * HealthArchiveRecord, and appends it to the 30-day archive ZSET.
 *
 * Schedule: every 15 min (recommended), wired in Vercel dashboard:
 *   Path:     /api/cron/health-archive
 *   Schedule: every 15 minutes  (or hourly for lighter retention)
 *
 * Subsystems captured:
 *   authority-drift, feed-integrity, authority-freshness, enrichment-health
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 *
 * Monitoring only — no authority/snapshot/enrichment writes.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  appendHealthRecord,
  type HealthArchiveRecord,
  type SubsystemVerdict,
  type Verdict,
} from '@/lib/health-archive';
import { recordCronRun, detectTriggerSource } from '@/lib/cron-recorder';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

function normVerdict(raw: unknown): SubsystemVerdict {
  if (raw === 'GREEN'  || raw === 'PASS') return 'GREEN';
  if (raw === 'YELLOW' || raw === 'WARN') return 'YELLOW';
  if (raw === 'RED'    || raw === 'FAIL') return 'RED';
  return 'ERROR';
}

async function fetchJson(
  baseUrl: string,
  path:    string,
  secret:  string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${baseUrl}${path}?secret=${encodeURIComponent(secret)}`, {
      headers: { 'Cache-Control': 'no-store' },
      signal:  AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace('%', ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const _start       = Date.now();
  const triggerSource = detectTriggerSource(req);

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    await recordCronRun('health-archive', Date.now() - _start, 'error', triggerSource);
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now        = Date.now();
  const capturedAt = new Date(now).toISOString();
  const secret     = process.env.CRON_SECRET ?? '';
  const reqUrl     = new URL(req.url);
  const baseUrl    = `${reqUrl.protocol}//${reqUrl.host}`;

  const [driftRaw, feedRaw, freshRaw, enrichRaw] = await Promise.all([
    fetchJson(baseUrl, '/api/debug/authority-drift',    secret),
    fetchJson(baseUrl, '/api/debug/feed-integrity',     secret),
    fetchJson(baseUrl, '/api/debug/authority-freshness', secret),
    fetchJson(baseUrl, '/api/debug/enrichment-health',  secret),
  ]);

  const drift = {
    verdict: driftRaw ? normVerdict(driftRaw.verdict) : ('ERROR' as SubsystemVerdict),
    total:   num(driftRaw?.total)  ?? 0,
    green:   num(driftRaw?.green)  ?? 0,
    yellow:  num(driftRaw?.yellow) ?? 0,
    red:     num(driftRaw?.red)    ?? 0,
  };

  const feed = {
    verdict:     feedRaw ? normVerdict(feedRaw.verdict) : ('ERROR' as SubsystemVerdict),
    redCount:    num(feedRaw?.redCount)    ?? 0,
    yellowCount: num(feedRaw?.yellowCount) ?? 0,
  };

  const freshness = {
    verdict: freshRaw ? normVerdict(freshRaw.verdict) : ('ERROR' as SubsystemVerdict),
    source:  typeof freshRaw?.source === 'string' ? freshRaw.source as string : 'unknown',
    ageSec:  num(freshRaw?.ageSec),
    stale:   freshRaw?.stale === true,
  };

  // enrichment-health reports rate as a percent string or number; normalise to 0..1
  let enrichRate: number | null = num(enrichRaw?.enrichmentRate);
  if (enrichRate !== null && enrichRate > 1) enrichRate = enrichRate / 100;

  const enrichment = {
    verdict:       enrichRaw ? normVerdict(enrichRaw.verdict ?? enrichRaw.gate) : ('ERROR' as SubsystemVerdict),
    totalFinished: num(enrichRaw?.totalFinished),
    unenriched:    num(enrichRaw?.unenrichedCount),
    rate:          enrichRate,
  };

  // Aggregate verdict
  const verdicts: SubsystemVerdict[] = [drift.verdict, feed.verdict, freshness.verdict, enrichment.verdict];
  const overall: Verdict =
    verdicts.includes('RED') || verdicts.includes('ERROR') ? 'RED'
    : verdicts.includes('YELLOW')                          ? 'YELLOW'
    : 'GREEN';

  const record: HealthArchiveRecord = {
    ts: now,
    capturedAt,
    overall,
    worldcupHealth: overall,
    drift,
    feed,
    freshness,
    enrichment,
  };

  const { pruned } = await appendHealthRecord(record);

  console.log(
    `[HealthArchive] captured overall=${overall} drift=${drift.verdict}(r${drift.red}) ` +
    `feed=${feed.verdict} fresh=${freshness.verdict}(${freshness.source}) ` +
    `enrich=${enrichment.verdict} pruned=${pruned}`,
  );

  await recordCronRun('health-archive', Date.now() - _start, 'ok', triggerSource);

  return NextResponse.json(
    { capturedAt, overall, record, pruned },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
