/**
 * GET /api/debug/authority-slo
 *
 * DATA-18C.3 Phase 4 — Authority Cache SLO compliance dashboard.
 *
 * Evaluates three SLOs for 24h, 7d, and 30d windows:
 *
 *   Availability    >= 99.9%   (reads served from primary or DR, no cold rebuild)
 *   Cold Rebuild    <=  1.0%   (fraction of reads requiring cold rebuild)
 *   DR Usage        <= 20.0%   (fraction of reads falling through to DR)
 *
 * Per-SLO verdict: PASS | WARN | FAIL
 * Overall verdict: PASS (all PASS) | WARN (any WARN, no FAIL) | FAIL (any FAIL)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorityTelemetry }     from '@/lib/authority-telemetry';
import type { DailyMetrics }         from '@/lib/authority-telemetry';

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// SLO targets
// ---------------------------------------------------------------------------

const SLO = {
  availability:    { target: 99.9, unit: '%',  direction: '>=' as const },
  coldRebuildRate: { target:  1.0, unit: '%',  direction: '<=' as const },
  drUsageRate:     { target: 20.0, unit: '%',  direction: '<=' as const },
} as const;

type SloName = keyof typeof SLO;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

type SloVerdict = 'PASS' | 'WARN' | 'FAIL' | 'NO_DATA';

interface SloResult {
  slo:        SloName;
  target:     number;
  actual:     number | null;
  direction:  '>=' | '<=';
  unit:       string;
  verdict:    SloVerdict;
  window:     string;
  note:       string;
}

function evalSlo(
  slo:     SloName,
  metrics: DailyMetrics,
  window:  string,
): SloResult {
  const def = SLO[slo];

  const actual: number | null =
    slo === 'availability'    ? metrics.availability
    : slo === 'coldRebuildRate' ? metrics.coldRebuildRatio
    : metrics.drHitRatio;

  if (metrics.totalReads === 0) {
    return {
      slo, target: def.target, actual: null,
      direction: def.direction, unit: def.unit,
      verdict: 'NO_DATA', window,
      note: `No reads recorded in ${window} window.`,
    };
  }

  const passes =
    def.direction === '>=' ? actual! >= def.target
                           : actual! <= def.target;

  // WARN zone: 10% slack from target before FAIL
  const warnThreshold =
    def.direction === '>=' ? def.target * 0.90
                           : def.target * 1.10;

  const warn =
    def.direction === '>=' ? actual! >= warnThreshold && !passes
                           : actual! <= warnThreshold && !passes;

  const verdict: SloVerdict = passes ? 'PASS' : warn ? 'WARN' : 'FAIL';

  const note =
    verdict === 'PASS'
      ? `${actual!.toFixed(2)}${def.unit} ${def.direction === '>=' ? '≥' : '≤'} ${def.target}${def.unit} target.`
      : verdict === 'WARN'
      ? `${actual!.toFixed(2)}${def.unit} near threshold (target: ${def.target}${def.unit}).`
      : `${actual!.toFixed(2)}${def.unit} breaches ${def.target}${def.unit} target.`;

  return { slo, target: def.target, actual: actual!, direction: def.direction, unit: def.unit, verdict, window, note };
}

function overallVerdict(results: SloResult[]): 'PASS' | 'WARN' | 'FAIL' {
  const verdicts = results.map(r => r.verdict);
  if (verdicts.includes('FAIL'))    return 'FAIL';
  if (verdicts.includes('WARN'))    return 'WARN';
  if (verdicts.every(v => v === 'PASS')) return 'PASS';
  return 'WARN'; // mixed NO_DATA + PASS
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

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

  // Evaluate all SLOs × all windows
  const sloNames: SloName[] = ['availability', 'coldRebuildRate', 'drUsageRate'];

  const results24h = sloNames.map(s => evalSlo(s, today,   '24h'));
  const results7d  = sloNames.map(s => evalSlo(s, last7d,  '7d'));
  const results30d = sloNames.map(s => evalSlo(s, last30d, '30d'));

  const allResults = [...results24h, ...results7d, ...results30d];

  const overall24h = overallVerdict(results24h);
  const overall7d  = overallVerdict(results7d);
  const overall30d = overallVerdict(results30d);
  const overall    = overallVerdict(allResults);

  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      overall,
      sloTargets: {
        availability:    `>= ${SLO.availability.target}%`,
        coldRebuildRate: `<= ${SLO.coldRebuildRate.target}%`,
        drUsageRate:     `<= ${SLO.drUsageRate.target}%`,
      },
      windows: {
        '24h': {
          verdict:  overall24h,
          readings: today.totalReads,
          results:  results24h,
        },
        '7d': {
          verdict:  overall7d,
          readings: last7d.totalReads,
          results:  results7d,
        },
        '30d': {
          verdict:  overall30d,
          readings: last30d.totalReads,
          results:  results30d,
        },
      },
      summary: {
        totalReads30d:    last30d.totalReads,
        availability30d:  last30d.availability,
        coldRebuild30d:   last30d.coldRebuildRatio,
        drUsage30d:       last30d.drHitRatio,
        primaryHit30d:    last30d.primaryHitRatio,
        avgLatencyMs30d:  last30d.avgLatencyMs,
      },
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
