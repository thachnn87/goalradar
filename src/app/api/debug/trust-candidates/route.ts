/**
 * GET /api/debug/trust-candidates
 *
 * DATA-18U.3 Phase 3 — Ready Candidate Ranking.
 *
 * Returns all actions ranked by promotionScore (0–100), with:
 *   nearestReadyAction        — highest-scoring action
 *   candidates[]              — full PromotionAssessment per action
 *   ranking[]                 — compact leaderboard view
 *
 * Ranking fields per action:
 *   action, promotionScore, trustLevel, readiness,
 *   remainingExecutionsNeeded, estimatedDaysToReady, blockingFactors[]
 *
 * Sorted descending by promotionScore.
 * Read-only. No KV writes.
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse }       from 'next/server';
import { readRepairRecords }               from '@/lib/repair-history';
import { getConfidenceHistory }            from '@/lib/confidence-history';
import { calibrateAllActions }             from '@/lib/confidence-calibration';
import { detectAllDrift }                  from '@/lib/prediction-drift';
import { classifyAllTrust }               from '@/lib/trust-framework';
import { collectAllEvidence }             from '@/lib/evidence-collector';
import { assessAllPromotions }            from '@/lib/trust-promotion';
import { getGovernance }                  from '@/lib/action-governance';
import type { RemediationActionType }      from '@/lib/auto-remediation';
import type { RepairRecordV2 }             from '@/lib/action-effectiveness';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

const ALL_ACTIONS: RemediationActionType[] = [
  'PREWARM_SNAPSHOT', 'REBUILD_DR', 'REFRESH_ESPN_CACHE', 'RESOLVE_ESPN_LOOKUP',
  'SUPPRESS_REFRESH', 'TRIGGER_ORCHESTRATOR', 'MONITOR_SELF_HEAL',
  'ESCALATE_INCIDENT', 'NO_ACTION',
];

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

  const now = Date.now();

  const [repairsRaw, confHistory] = await Promise.all([
    readRepairRecords(now - 90 * 24 * 3_600_000, now),
    getConfidenceHistory(now - 90 * 24 * 3_600_000, now),
  ]);

  const toV2 = (r: typeof repairsRaw[0]): RepairRecordV2 => ({
    ...r,
    riskBefore:         (r as unknown as RepairRecordV2).riskBefore         ?? null,
    riskAfter:          (r as unknown as RepairRecordV2).riskAfter          ?? null,
    improvement:        (r as unknown as RepairRecordV2).improvement        ?? null,
    verificationPassed: (r as unknown as RepairRecordV2).verificationPassed ?? null,
    verificationChecks: (r as unknown as RepairRecordV2).verificationChecks ?? [],
  });
  const repairs = repairsRaw.map(toV2);
  const prod90  = repairs.filter(r => r.result !== 'dry-run');

  // Calibration
  const calibInputs = ALL_ACTIONS.map(action => {
    const recs = prod90.filter(r => r.action === action);
    const succ = recs.filter(r => r.result === 'success').length;
    const currentConfidence = recs.length > 0 ? succ / recs.length : 0.65;
    return { action, currentConfidence, productionRecords: recs, verificationProfile: null };
  });
  const calibReport = calibrateAllActions(calibInputs);

  const confidenceMap = new Map(calibReport.calibrations.map(c => [c.action, c.newConfidence]));
  const directionMap  = new Map(calibReport.calibrations.map(c => [c.action, c.direction]));

  // Drift
  const driftReport = detectAllDrift(
    ALL_ACTIONS.map(a => ({ action: a, records: confHistory.filter(r => r.action === a) })),
    now,
  );
  const driftMap = new Map(driftReport.signals.map(s => [s.action, s.drift] as const));

  // Trust
  const trustReport = classifyAllTrust(ALL_ACTIONS.map(action => ({
    action,
    confidence:                 confidenceMap.get(action) ?? 0.65,
    productionRecords:          prod90.filter(r => r.action === action),
    productionCoverageRequired: getGovernance(action).productionCoverageRequired,
    calibrationDirection:       directionMap.get(action) ?? 'STABLE' as const,
    driftDirection:             driftMap.get(action) ?? null,
  })));
  const trustMap = new Map(trustReport.classifications.map(c => [c.action, { trustLevel: c.trustLevel, readiness: c.automationReadiness }]));

  // Evidence
  const evidenceSummaries = collectAllEvidence({
    allRepairRecords:     repairs,
    allConfidenceRecords: confHistory,
    confidenceMap,
    directionMap,
    driftMap,
    trustMap,
    actions: ALL_ACTIONS,
  });

  // Promotion
  const promotionReport = assessAllPromotions(evidenceSummaries);

  // Compact ranking
  const ranking = promotionReport.assessments.map(a => ({
    action:                    a.action,
    promotionScore:            a.promotionScore,
    trustLevel:                evidenceSummaries.find(s => s.action === a.action)?.trustLevel ?? 'LOW_TRUST',
    readiness:                 a.currentReadiness,
    remainingExecutionsNeeded: a.remainingExecutionsNeeded,
    estimatedDaysToReady:      a.estimatedDaysToReady,
    blockingFactors:           a.promotionBlockers.map(b => b.description),
    topOpportunity:            a.promotionOpportunities[0]?.action ?? null,
    dimensionScores:           a.dimensionScores,
  }));

  return NextResponse.json(
    {
      checkedAt:          new Date(now).toISOString(),
      schemaVersion:      'DATA-18U.3',
      nearestReadyAction: promotionReport.nearestReadyAction,
      readyCandidates:    promotionReport.readyCandidates,
      limitedReady:       promotionReport.limitedReadyCandidates,
      candidates:         promotionReport.assessments,
      ranking,
      note: promotionReport.readyCandidates.length > 0
        ? `${promotionReport.readyCandidates.length} action(s) READY for automation candidacy.`
        : `No READY actions yet. Nearest: ${promotionReport.nearestReadyAction ?? 'N/A'} ` +
          `(score ${promotionReport.assessments[0]?.promotionScore ?? 0}/100).`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
