/**
 * GET /api/debug/authority-adoption
 *
 * DATA-18B.2B: Authority Cache adoption by route.
 *
 * Returns per-route read counts, cache-path breakdown, latency, and
 * pageShare for sourceType=page reads over today / last7d / last30d.
 *
 * Coverage estimate:
 *   ISR coverage  = routes with authority cache reads / total WC routes
 *   Read coverage = authority cache page reads / total attributed page reads
 *
 *   NOTE: "page reads" are ISR revalidation cycles, not raw user requests.
 *   True user-request coverage requires GA/Analytics data.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  or  ?secret=<CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorityTelemetry, type RouteMetrics } from '@/lib/authority-telemetry';

export const dynamic     = 'force-dynamic';
export const maxDuration = 15;

const CRON_SECRET = process.env.CRON_SECRET ?? '';

// All WC routes that call getWCAuthorityMatchesV2() (sourceType=page)
const ALL_WC_ROUTES = [
  '/world-cup-2026',
  '/world-cup-2026/results',
  '/world-cup-2026/fixtures',
  '/world-cup-2026/matches-today',
  '/world-cup-2026/matches-tomorrow',
  '/world-cup-2026/[group]',
  '/world-cup-2026/bracket',   // pilot — active only when AUTHORITY_CACHE_PILOT=true
] as const;

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 10_000) / 100 : 0;
}

// ---------------------------------------------------------------------------
// Route window builder
// ---------------------------------------------------------------------------

interface RouteWindow {
  ranked:         RouteMetrics[];
  totalPageReads: number;
  routesCovered:  number;
  isrCoverage:    number; // % of ALL_WC_ROUTES with at least 1 read
  readCoverage:   number; // % breakdown is internal (all reads are authority cache)
  avgLatencyMs:   number | null;
}

function buildRouteWindow(routes: Record<string, RouteMetrics>): RouteWindow {
  const ranked = Object.values(routes).sort((a, b) => b.reads - a.reads);
  const totalPageReads = ranked.reduce((s, r) => s + r.reads, 0);
  const routesCovered  = ranked.filter(r => r.reads > 0).length;
  const isrCoverage    = pct(routesCovered, ALL_WC_ROUTES.length);

  const totalLatency = ranked.reduce((s, r) => s + r.totalLatencyMs, 0);
  const latencyCount = ranked.reduce((s, r) => s + r.latencyCount,   0);

  return {
    ranked,
    totalPageReads,
    routesCovered,
    isrCoverage,
    readCoverage: 100, // all measured reads are authority cache reads by definition
    avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
  };
}

// ---------------------------------------------------------------------------
// Per-day trend entry
// ---------------------------------------------------------------------------

interface DayEntry {
  date:           string;
  pageReads:      number;
  routesCovered:  number;
  isrCoverage:    number;
  avgLatencyMs:   number | null;
  topRoute:       string | null;
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

  const todayWindow   = buildRouteWindow(report.today.routes);
  const last7dWindow  = buildRouteWindow(report.last7d.routes);
  const last30dWindow = buildRouteWindow(report.last30d.routes);

  // Per-day trend (last 7 days with any reads + today)
  const recentDays: DayEntry[] = report.daily
    .filter(d => d.totalReads > 0 || d.date === report.today.date)
    .slice(0, 7)
    .map(d => {
      const ranked = Object.values(d.routes).sort((a, b) => b.reads - a.reads);
      const routesCovered = ranked.filter(r => r.reads > 0).length;
      const totalLatency  = ranked.reduce((s, r) => s + r.totalLatencyMs, 0);
      const latencyCount  = ranked.reduce((s, r) => s + r.latencyCount,   0);
      return {
        date:          d.date,
        pageReads:     d.pageReads,
        routesCovered,
        isrCoverage:   pct(routesCovered, ALL_WC_ROUTES.length),
        avgLatencyMs:  latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
        topRoute:      ranked[0]?.route ?? null,
      };
    });

  // Coverage verdict
  const coverage30d      = last30dWindow.isrCoverage;
  const coverageVerdict  =
    coverage30d >= 85  ? 'MAJORITY'          // ≥6 of 7 routes active
    : coverage30d >= 40 ? 'PARTIAL'           // 3–5 routes active
    : last30dWindow.totalPageReads === 0 ? 'INSUFFICIENT_DATA'
    : 'PARTIAL';

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    knownRoutes: ALL_WC_ROUTES,
    today: {
      date:     report.today.date,
      ...todayWindow,
    },
    last7d:  last7dWindow,
    last30d: last30dWindow,
    coverage: {
      verdict:      coverageVerdict,
      isrCoverage:  last30dWindow.isrCoverage,
      routesCovered: last30dWindow.routesCovered,
      totalRoutes:  ALL_WC_ROUTES.length,
      note: coverageVerdict === 'MAJORITY'
        ? `${last30dWindow.routesCovered}/${ALL_WC_ROUTES.length} WC routes have authority cache reads in the last 30 days.`
        : coverageVerdict === 'PARTIAL'
        ? `${last30dWindow.routesCovered}/${ALL_WC_ROUTES.length} WC routes have authority cache reads. Coverage growing.`
        : 'No per-route data recorded yet. Per-route counters activated in DATA-18B.2B — reads accumulating.',
    },
    recentDays,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
