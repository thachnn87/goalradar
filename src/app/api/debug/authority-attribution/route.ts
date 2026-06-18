/**
 * DATA-18C.6: Authority Cache Read Attribution
 *
 * Returns per-sourceType breakdown of readAuthorityCache() calls so that
 * production page traffic can be distinguished from debug/benchmark calls.
 *
 * Schema per window (today / last7d / last30d):
 *   bySourceType  — reads grouped by page / debug / benchmark / unknown
 *   byCachePath   — reads grouped by primary / dr / cold
 *   productionReadRatio  — % of reads attributed to production pages
 *   debugReadRatio       — % of reads attributed to debug endpoints
 *   organicTrafficConfidence — derived readiness signal
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  or  ?secret=<CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorityTelemetry, type DailyMetrics } from '@/lib/authority-telemetry';

export const dynamic     = 'force-dynamic';
export const maxDuration = 15;

const CRON_SECRET = process.env.CRON_SECRET ?? '';

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 10_000) / 100 : 0;
}

// ---------------------------------------------------------------------------
// Organic traffic confidence
// ---------------------------------------------------------------------------

/**
 * How confident are we that real production traffic is flowing through the
 * authority cache?
 *
 * HIGH   — page reads are the majority across multiple days
 * MEDIUM — page reads are present but minority, OR majority on only 1 day
 * LOW    — page reads absent or < 5% of total; too few days of data
 */
function organicConfidence(
  window: DailyMetrics,
  daysWithPageReads: number,
): 'high' | 'medium' | 'low' {
  if (window.totalReads === 0) return 'low';
  const pageRatio = pct(window.pageReads, window.totalReads);
  if (pageRatio >= 50 && daysWithPageReads >= 3) return 'high';
  if (pageRatio >= 20 || daysWithPageReads >= 2) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Per-window attribution summary
// ---------------------------------------------------------------------------

interface AttributionWindow {
  totalReads:         number;
  bySourceType: {
    page:      { reads: number; ratio: number; lastReadAt: string | null; lastSource: string | null };
    debug:     { reads: number; ratio: number; lastReadAt: string | null; lastSource: string | null };
    benchmark: { reads: number; ratio: number; lastReadAt: string | null };
    unknown:   { reads: number; ratio: number };
  };
  byCachePath: {
    primary: { reads: number; ratio: number };
    dr:      { reads: number; ratio: number };
    cold:    { reads: number; ratio: number };
  };
  productionReadRatio: number;
  debugReadRatio:      number;
  benchmarkReadRatio:  number;
  unknownReadRatio:    number;
}

function buildWindow(m: DailyMetrics): AttributionWindow {
  const t = m.totalReads;
  return {
    totalReads: t,
    bySourceType: {
      page:      { reads: m.pageReads,      ratio: pct(m.pageReads, t),      lastReadAt: m.lastPageReadAt,      lastSource: m.lastPageReadSource },
      debug:     { reads: m.debugReads,     ratio: pct(m.debugReads, t),     lastReadAt: m.lastDebugReadAt,     lastSource: m.lastDebugReadSource },
      benchmark: { reads: m.benchmarkReads, ratio: pct(m.benchmarkReads, t), lastReadAt: m.lastBenchmarkReadAt },
      unknown:   { reads: m.unknownReads,   ratio: pct(m.unknownReads, t) },
    },
    byCachePath: {
      primary: { reads: m.primaryHits,  ratio: pct(m.primaryHits, t) },
      dr:      { reads: m.drHits,       ratio: pct(m.drHits, t) },
      cold:    { reads: m.coldRebuilds, ratio: pct(m.coldRebuilds, t) },
    },
    productionReadRatio: pct(m.pageReads, t),
    debugReadRatio:      pct(m.debugReads, t),
    benchmarkReadRatio:  pct(m.benchmarkReads, t),
    unknownReadRatio:    pct(m.unknownReads, t),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') ??
                 req.nextUrl.searchParams.get('secret') ?? '';
  if (!secret || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let report;
  try {
    report = await getAuthorityTelemetry();
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to read telemetry', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const daysWithPageReads = report.daily.filter(d => d.pageReads > 0).length;
  const daysWithAnyReads  = report.daily.filter(d => d.totalReads > 0).length;

  const todayWindow   = buildWindow(report.today);
  const last7dWindow  = buildWindow(report.last7d);
  const last30dWindow = buildWindow(report.last30d);

  const confidence30d = organicConfidence(report.last30d, daysWithPageReads);

  // ── Readiness metrics (Phase 4) ───────────────────────────────────────────
  const readiness = {
    productionReadRatio:     last30dWindow.productionReadRatio,
    debugReadRatio:          last30dWindow.debugReadRatio,
    benchmarkReadRatio:      last30dWindow.benchmarkReadRatio,
    unknownReadRatio:        last30dWindow.unknownReadRatio,
    organicTrafficConfidence: confidence30d,
    daysWithPageReads,
    daysWithAnyReads,
    confidence: {
      level:  confidence30d,
      reason: confidence30d === 'high'
        ? `Page reads are the majority (${last30dWindow.productionReadRatio}%) across ${daysWithPageReads} days.`
        : confidence30d === 'medium'
        ? `Page reads present (${last30dWindow.productionReadRatio}%) but not dominant, or limited to ${daysWithPageReads} day(s).`
        : last30dWindow.totalReads === 0
        ? 'No reads recorded yet — attribution deployed but no readAuthorityCache() calls observed.'
        : report.last30d.unknownReads === report.last30d.totalReads
        ? `All ${report.last30d.totalReads} reads are unattributed (unknown sourceType). Attribution may not be deployed yet.`
        : `Page reads are ${last30dWindow.productionReadRatio}% of total. Need >50% across 3+ days for HIGH confidence.`,
    },
  };

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    today:   { date: report.today.date,   ...todayWindow },
    last7d:  { date: 'last7d',            ...last7dWindow },
    last30d: { date: 'last30d',           ...last30dWindow },
    readiness,
    recentDays: report.daily
      .filter(d => d.totalReads > 0 || d.date === report.today.date)
      .slice(0, 7)
      .map(d => ({
        date:            d.date,
        totalReads:      d.totalReads,
        pageReads:       d.pageReads,
        debugReads:      d.debugReads,
        benchmarkReads:  d.benchmarkReads,
        unknownReads:    d.unknownReads,
        productionRatio: pct(d.pageReads, d.totalReads),
      })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
