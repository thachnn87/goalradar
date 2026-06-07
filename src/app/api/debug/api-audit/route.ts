/**
 * GET /api/debug/api-audit
 *
 * Sprint API-1 — Returns a JSON audit report of recent football-data.org API
 * calls recorded by the in-memory audit tracer.
 *
 * Query params:
 *   ?window=<seconds>   — look-back window (default 60, max 3600)
 *   ?format=table       — return a compact text table instead of full JSON
 *
 * ⚠️  DEVELOPMENT / STAGING ONLY.
 * Disabled in production unless DEBUG_API_AUDIT=true is set in environment.
 *
 * Example responses
 * ─────────────────
 *   curl http://localhost:3000/api/debug/api-audit | jq .
 *   curl http://localhost:3000/api/debug/api-audit?window=10&format=table
 *
 * To trigger real data, open a page first then call this endpoint.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { generateReport } from '@/lib/api-audit';

/** Only allow in development or when explicitly opted-in. */
function isAllowed(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.DEBUG_API_AUDIT === 'true') return true;
  return false;
}

export const dynamic  = 'force-dynamic'; // never cache this route
export const revalidate = 0;

export function GET(req: NextRequest) {
  if (!isAllowed()) {
    return NextResponse.json(
      { error: 'API audit is disabled in production. Set DEBUG_API_AUDIT=true to enable.' },
      { status: 403 },
    );
  }

  // Parse window query param
  const rawWindow = req.nextUrl.searchParams.get('window');
  const windowMs  = Math.min(
    Math.max(parseInt(rawWindow ?? '60', 10), 1) * 1_000,
    3_600_000,
  );

  const report = generateReport(windowMs);

  // Plain-text table format
  const format = req.nextUrl.searchParams.get('format');
  if (format === 'table') {
    const lines: string[] = [
      `API Audit Report — last ${windowMs / 1000}s`,
      `Generated: ${report.generatedAt}`,
      '',
      `Summary`,
      `  Total calls      : ${report.totalCalls}`,
      `  Network calls    : ${report.networkCalls}`,
      `  Cache hits       : ${report.cacheHits}`,
      `  Unique endpoints : ${report.uniqueEndpoints}`,
      `  Hit ratio        : ${report.hitRatioPct}%`,
      '',
    ];

    if (report.duplicates.length > 0) {
      lines.push('⚠️  Duplicate endpoints (called > 1x):');
      for (const d of report.duplicates) {
        lines.push(
          `  ${d.calls}x  [${d.networkHits} network, ${d.hits} hit]  ${d.endpoint}  avg ${d.avgMs}ms`,
        );
      }
      lines.push('');
    } else {
      lines.push('✅  No duplicate endpoints in this window.');
      lines.push('');
    }

    if (report.nPlusOnePatterns.length > 0) {
      lines.push('🔴 N+1 patterns detected:');
      for (const p of report.nPlusOnePatterns) {
        lines.push(`  ${p}`);
      }
      lines.push('');
    } else {
      lines.push('✅  No N+1 patterns detected.');
      lines.push('');
    }

    // Per-page breakdown — group calls by 3-second windows
    lines.push('Endpoint breakdown (most-called first):');
    lines.push(
      '  Calls  Net  Hits  AvgMs  Endpoint',
    );
    lines.push(
      '  ─────  ───  ────  ─────  ────────',
    );
    for (const e of report.endpoints) {
      const dupe = e.isDuplicate ? ' ⚠️' : '';
      lines.push(
        `  ${String(e.calls).padEnd(5)}  ${String(e.networkHits).padEnd(3)}  ${String(e.hits).padEnd(4)}  ${String(e.avgMs).padEnd(5)}  ${e.endpoint}${dupe}`,
      );
    }

    return new NextResponse(lines.join('\n'), {
      status:  200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Default: full JSON report
  return NextResponse.json(report, {
    headers: {
      // Prevent any upstream cache from serving stale audit data
      'Cache-Control': 'no-store, no-cache',
    },
  });
}
