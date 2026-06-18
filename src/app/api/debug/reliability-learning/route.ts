/**
 * GET /api/debug/reliability-learning
 *
 * DATA-18Q Phase 5 — Reliability Learning endpoint.
 *
 * Reads the repair history archive, computes per-action effectiveness analytics,
 * and returns a learning summary that informs future confidence adjustments.
 *
 * Returns:
 *   {
 *     topActions              — top 3 actions by adaptive confidence
 *     weakActions             — bottom 3 actions by confidence (need review)
 *     confidenceRanking       — all actions ranked by confidence
 *     historicalEffectiveness — full per-action breakdown
 *     schemaVersion           — '18Q' (identifies DATA-18Q extended fields)
 *   }
 *
 * Read-only. No writes. No cache mutations.
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { readRepairRecords }         from '@/lib/repair-history';
import { computeEffectiveness }      from '@/lib/action-effectiveness';
import type { RepairRecordV2 }       from '@/lib/action-effectiveness';

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

  const now    = Date.now();
  const window = Number(new URL(req.url).searchParams.get('days') ?? '90');
  const sinceMs = now - Math.min(Math.max(window, 1), 90) * 24 * 3_600_000;

  // Read repair history (BASE RepairRecord; cast as V2 — extra fields are undefined)
  const baseRecords = await readRepairRecords(sinceMs, now);

  // Cast to RepairRecordV2 — Phase 1 fields will be null/undefined for pre-18Q records
  const records: RepairRecordV2[] = baseRecords.map(r => ({
    ...r,
    riskBefore:         (r as unknown as RepairRecordV2).riskBefore         ?? null,
    riskAfter:          (r as unknown as RepairRecordV2).riskAfter          ?? null,
    improvement:        (r as unknown as RepairRecordV2).improvement        ?? null,
    verificationPassed: (r as unknown as RepairRecordV2).verificationPassed ?? null,
    verificationChecks: (r as unknown as RepairRecordV2).verificationChecks ?? [],
  }));

  const report = computeEffectiveness(records, now);

  // Additional summary stats
  const withV2Data = records.filter(r => r.riskBefore !== null).length;
  const v2Coverage = records.length > 0
    ? Math.round(withV2Data / records.length * 100)
    : 0;

  return NextResponse.json(
    {
      checkedAt:    new Date(now).toISOString(),
      windowDays:   window,
      schemaVersion: 'DATA-18Q',

      topActions:    report.topActions,
      weakActions:   report.weakActions,

      confidenceRanking:       report.confidenceRanking,
      historicalEffectiveness: report.byAction,

      summary: {
        totalRecords:  report.totalRecords,
        actionsCovered: report.actionCount,
        v2Coverage:    `${v2Coverage}% records have risk-before/after data`,
      },

      note: records.length === 0
        ? 'No repair records yet. Archive populates when AUTONOMOUS_RELIABILITY_ENABLED=true.'
        : `${records.length} record(s) over last ${window} days. Confidence scores will improve as sample sizes grow.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
