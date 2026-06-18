/**
 * GET /api/debug/authority-telemetry
 *
 * DATA-18C.3 Phase 3 — Authority cache read-path telemetry dashboard.
 *
 * Returns accumulated hit/miss counters, ratios, and latency averages
 * for today, last 7 days, and last 30 days.
 *
 * Verdict:
 *   GREEN  — cold rebuild ratio = 0% and total reads recorded
 *   YELLOW — no telemetry yet (first day after activation) or < 5% cold rebuilds
 *   RED    — cold rebuild ratio >= 5% or availability < 95%
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse }   from 'next/server';
import { getAuthorityTelemetry }       from '@/lib/authority-telemetry';

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

  const report = await getAuthorityTelemetry();
  const { today, last7d, last30d } = report;

  // ── Verdict ──────────────────────────────────────────────────────────────
  // Use last30d as the primary signal; fall back to today if no 30d data.
  const ref = last30d.totalReads > 0 ? last30d : today;

  const verdict: 'GREEN' | 'YELLOW' | 'RED' =
    ref.totalReads === 0                ? 'YELLOW' // no data yet
    : ref.coldRebuildRatio >= 5        ? 'RED'
    : ref.availability < 95            ? 'RED'
    : ref.coldRebuildRatio > 0         ? 'YELLOW'
    : 'GREEN';

  const note =
    ref.totalReads === 0
      ? 'No telemetry recorded yet — authority cache activated but no readAuthorityCache() calls observed.'
      : verdict === 'GREEN'
      ? `Clean: ${ref.primaryHitRatio}% primary hits, ${ref.drHitRatio}% DR hits, 0% cold rebuilds.`
      : verdict === 'YELLOW'
      ? `${ref.coldRebuildRatio}% cold rebuild rate — review DR coverage and orchestrator cadence.`
      : `Cold rebuild rate ${ref.coldRebuildRatio}% exceeds threshold — investigate cache availability.`;

  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      verdict,
      note,
      today: {
        date:             today.date,
        totalReads:       today.totalReads,
        primaryHits:      today.primaryHits,
        drHits:           today.drHits,
        coldRebuilds:     today.coldRebuilds,
        primaryHitRatio:  today.primaryHitRatio,
        drHitRatio:       today.drHitRatio,
        coldRebuildRatio: today.coldRebuildRatio,
        availability:     today.availability,
        avgLatencyMs:     today.avgLatencyMs,
        lastPrimaryHitAt:  today.lastPrimaryHitAt,
        lastDrHitAt:       today.lastDrHitAt,
        lastColdRebuildAt: today.lastColdRebuildAt,
      },
      last7d: {
        totalReads:       last7d.totalReads,
        primaryHits:      last7d.primaryHits,
        drHits:           last7d.drHits,
        coldRebuilds:     last7d.coldRebuilds,
        primaryHitRatio:  last7d.primaryHitRatio,
        drHitRatio:       last7d.drHitRatio,
        coldRebuildRatio: last7d.coldRebuildRatio,
        availability:     last7d.availability,
        avgLatencyMs:     last7d.avgLatencyMs,
        lastPrimaryHitAt:  last7d.lastPrimaryHitAt,
        lastDrHitAt:       last7d.lastDrHitAt,
        lastColdRebuildAt: last7d.lastColdRebuildAt,
      },
      last30d: {
        totalReads:       last30d.totalReads,
        primaryHits:      last30d.primaryHits,
        drHits:           last30d.drHits,
        coldRebuilds:     last30d.coldRebuilds,
        primaryHitRatio:  last30d.primaryHitRatio,
        drHitRatio:       last30d.drHitRatio,
        coldRebuildRatio: last30d.coldRebuildRatio,
        availability:     last30d.availability,
        avgLatencyMs:     last30d.avgLatencyMs,
        lastPrimaryHitAt:  last30d.lastPrimaryHitAt,
        lastDrHitAt:       last30d.lastDrHitAt,
        lastColdRebuildAt: last30d.lastColdRebuildAt,
      },
      // Last 7 daily entries (newest first) for trend visibility
      recentDays: report.daily.slice(0, 7).map(d => ({
        date:             d.date,
        totalReads:       d.totalReads,
        primaryHits:      d.primaryHits,
        drHits:           d.drHits,
        coldRebuilds:     d.coldRebuilds,
        primaryHitRatio:  d.primaryHitRatio,
        drHitRatio:       d.drHitRatio,
        coldRebuildRatio: d.coldRebuildRatio,
        availability:     d.availability,
        avgLatencyMs:     d.avgLatencyMs,
      })),
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
