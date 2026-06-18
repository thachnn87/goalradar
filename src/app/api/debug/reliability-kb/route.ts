/**
 * GET /api/debug/reliability-kb
 *
 * DATA-18R Phase 4 — Reliability Knowledge Base.
 *
 * Synthesises outcome attribution, champion/challenger analysis, and action
 * effectiveness into a single knowledge base response.
 *
 * Returns:
 *   {
 *     topFailureModes       — most frequent risk factors + their best action
 *     bestActions           — globally ranked actions by production confidence
 *     historicalPatterns    — outcome attribution breakdown
 *     resolvedIncidents     — last N attributed incidents
 *     recommendationRanking — per-risk-factor action ranking (Phase 5)
 *   }
 *
 * Read-only. No writes. No cache mutations.
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse }     from 'next/server';
import { readRepairRecords }              from '@/lib/repair-history';
import { readHealthRecords }              from '@/lib/health-archive';
import { computeEffectiveness }           from '@/lib/action-effectiveness';
import { deriveAttribution }              from '@/lib/outcome-attribution';
import { computeChampionChallenger }      from '@/lib/champion-challenger';
import type { RepairRecordV2 }            from '@/lib/action-effectiveness';

export const dynamic     = 'force-dynamic';
export const maxDuration = 45;

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

  const now     = Date.now();
  const days    = Number(new URL(req.url).searchParams.get('days') ?? '30');
  const sinceMs = now - Math.min(Math.max(days, 1), 90) * 24 * 3_600_000;

  // Parallel reads
  const [baseRepairs, archiveRecords] = await Promise.all([
    readRepairRecords(sinceMs, now),
    readHealthRecords(sinceMs, now),
  ]);

  // Upcast to RepairRecordV2 (Phase 1 fields optional)
  const repairs: RepairRecordV2[] = baseRepairs.map(r => ({
    ...r,
    riskBefore:         (r as unknown as RepairRecordV2).riskBefore         ?? null,
    riskAfter:          (r as unknown as RepairRecordV2).riskAfter          ?? null,
    improvement:        (r as unknown as RepairRecordV2).improvement        ?? null,
    verificationPassed: (r as unknown as RepairRecordV2).verificationPassed ?? null,
    verificationChecks: (r as unknown as RepairRecordV2).verificationChecks ?? [],
  }));

  // Compute all layers
  const effectiveness    = computeEffectiveness(repairs, now);
  const attribution      = deriveAttribution(archiveRecords, repairs, now);
  const ccReport         = computeChampionChallenger(repairs, now);

  // ── Top failure modes ──────────────────────────────────────────────────
  // Derive from attribution: count affected subsystems across all incidents
  const subsystemFreq: Record<string, number> = {};
  for (const inc of attribution.incidents) {
    for (const sub of inc.affectedSubsystems) {
      subsystemFreq[sub] = (subsystemFreq[sub] ?? 0) + 1;
    }
  }
  const topFailureModes = Object.entries(subsystemFreq)
    .sort(([, a], [, b]) => b - a)
    .map(([subsystem, count]) => {
      // Find the best action for this subsystem from champion-challenger
      const rfMatch = ccReport.byRiskFactor.find(rf =>
        subsystem.includes(rf.riskFactor) || rf.riskFactor.includes(subsystem.replace('-health', '')),
      );
      return {
        subsystem,
        incidentCount: count,
        bestAction:    rfMatch?.champion.action ?? null,
        bestConfidence: rfMatch?.champion.productionConfidence ?? null,
      };
    });

  // ── Resolved incidents (most recent 20) ──────────────────────────────
  const resolvedIncidents = [...attribution.incidents]
    .filter(i => i.outcome !== 'unresolved')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 20);

  // ── Historical patterns ───────────────────────────────────────────────
  const historicalPatterns = {
    totalIncidents:     attribution.totalIncidents,
    resolved:           attribution.resolved,
    unresolved:         attribution.unresolved,
    byOutcome:          attribution.byOutcome,
    avgDurationMs:      attribution.avgDurationMs,
    avgRepairToCloseMs: attribution.avgRepairToCloseMs,
    autoResolutionRate: attribution.totalIncidents > 0
      ? Math.round(
          (attribution.byOutcome.resolvedByRepair + attribution.byOutcome.resolvedBySelfHeal)
          / attribution.totalIncidents * 100,
        )
      : 100,
  };

  return NextResponse.json(
    {
      checkedAt:    new Date(now).toISOString(),
      windowDays:   days,
      schemaVersion: 'DATA-18R',

      topFailureModes,

      bestActions: ccReport.globalRanking,

      historicalPatterns,

      resolvedIncidents,

      // Phase 5: per-risk-factor recommendation ranking
      recommendationRanking: ccReport.byRiskFactor.map(rf => ({
        riskFactor:   rf.riskFactor,
        ranking:      rf.ranking,
        champion:     rf.champion,
        challengers:  rf.challengers,
        sampleTotal:  rf.sampleTotal,
      })),

      // Learning metadata
      learning: {
        totalRepairRecords:  repairs.length,
        actionsCovered:      effectiveness.actionCount,
        withV2Data:          repairs.filter(r => r.riskBefore !== null).length,
        productionRecords:   repairs.filter(r => r.result !== 'dry-run').length,
        verifiedRecords:     repairs.filter(r => r.verificationPassed !== null).length,
      },

      note: repairs.length === 0
        ? 'No repair records. Knowledge base will populate as AUTONOMOUS_RELIABILITY_ENABLED=true runs repairs.'
        : `KB built from ${repairs.length} repair record(s) and ${archiveRecords.length} health archive record(s).`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
