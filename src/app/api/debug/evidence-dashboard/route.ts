/**
 * GET /api/debug/evidence-dashboard
 *
 * DATA-18U.3 Phase 4 — Evidence Dashboard.
 *
 * Returns:
 *   summary               — aggregate totals across all actions
 *   actions[]             — full ActionEvidenceSummary per action
 *   trends[]              — confidence trend per action
 *   readinessDistribution — count per readiness tier
 *   trustDistribution     — count per trust tier
 *   topImprovingActions   — highest positive confidenceDelta
 *   topDecliningActions   — largest negative confidenceDelta
 *   highestConfidenceActions — top 3 by confidenceCurrent
 *   lowestConfidenceActions  — bottom 3 by confidenceCurrent
 *
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
    return { action, currentConfidence: recs.length > 0 ? succ / recs.length : 0.65, productionRecords: recs, verificationProfile: null };
  });
  const calibReport   = calibrateAllActions(calibInputs);
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

  // ── Aggregate summary ─────────────────────────────────────────────────────
  const totalExecutions    = evidenceSummaries.reduce((s, e) => s + e.totalExecutions,       0);
  const totalProduction    = evidenceSummaries.reduce((s, e) => s + e.productionExecutions,  0);
  const totalSuccess       = evidenceSummaries.reduce((s, e) => s + e.successfulExecutions,  0);
  const totalFailed        = evidenceSummaries.reduce((s, e) => s + e.failedExecutions,      0);
  const totalVerPassed     = evidenceSummaries.reduce((s, e) => s + e.verificationPassed,    0);
  const totalVerFailed     = evidenceSummaries.reduce((s, e) => s + e.verificationFailed,    0);

  const summary = {
    totalExecutions,
    totalProductionExecutions: totalProduction,
    totalSuccessful:           totalSuccess,
    totalFailed,
    totalVerificationPassed:   totalVerPassed,
    totalVerificationFailed:   totalVerFailed,
    overallSuccessRate:        totalProduction > 0 ? Math.round(totalSuccess / totalProduction * 1000) / 1000 : null,
    overallVerifyRate:         (totalVerPassed + totalVerFailed) > 0
      ? Math.round(totalVerPassed / (totalVerPassed + totalVerFailed) * 1000) / 1000
      : null,
    meanConfidence:            Math.round(
      evidenceSummaries.reduce((s, e) => s + e.confidenceCurrent, 0) / evidenceSummaries.length * 1000,
    ) / 1000,
  };

  // ── Distributions ─────────────────────────────────────────────────────────
  const readinessDistribution = {
    READY:         evidenceSummaries.filter(e => e.readiness === 'READY').length,
    LIMITED_READY: evidenceSummaries.filter(e => e.readiness === 'LIMITED_READY').length,
    NOT_READY:     evidenceSummaries.filter(e => e.readiness === 'NOT_READY').length,
  };
  const trustDistribution = {
    HIGH_TRUST:   evidenceSummaries.filter(e => e.trustLevel === 'HIGH_TRUST').length,
    MEDIUM_TRUST: evidenceSummaries.filter(e => e.trustLevel === 'MEDIUM_TRUST').length,
    LOW_TRUST:    evidenceSummaries.filter(e => e.trustLevel === 'LOW_TRUST').length,
  };

  // ── Trends ────────────────────────────────────────────────────────────────
  const trends = evidenceSummaries.map(e => ({
    action:               e.action,
    confidenceCurrent:    e.confidenceCurrent,
    confidenceDelta:      e.confidenceDelta,
    confidenceTrend:      e.confidenceTrend,
    calibrationDirection: e.calibrationDirection,
    productionExecutions: e.productionExecutions,
    evidenceStrength:     e.evidenceStrength,
  }));

  // ── Top/bottom lists ──────────────────────────────────────────────────────
  const sorted = [...evidenceSummaries].sort((a, b) => b.confidenceCurrent - a.confidenceCurrent);

  const topImprovingActions = [...evidenceSummaries]
    .sort((a, b) => b.confidenceDelta - a.confidenceDelta)
    .slice(0, 3)
    .map(e => ({ action: e.action, delta: e.confidenceDelta, confidence: e.confidenceCurrent }));

  const topDecliningActions = [...evidenceSummaries]
    .sort((a, b) => a.confidenceDelta - b.confidenceDelta)
    .slice(0, 3)
    .map(e => ({ action: e.action, delta: e.confidenceDelta, confidence: e.confidenceCurrent }));

  const highestConfidenceActions = sorted.slice(0, 3)
    .map(e => ({ action: e.action, confidence: e.confidenceCurrent, trustLevel: e.trustLevel }));

  const lowestConfidenceActions = [...sorted].reverse().slice(0, 3)
    .map(e => ({ action: e.action, confidence: e.confidenceCurrent, trustLevel: e.trustLevel }));

  return NextResponse.json(
    {
      checkedAt:    new Date(now).toISOString(),
      schemaVersion: 'DATA-18U.3',

      summary,
      actions:      evidenceSummaries,
      trends,
      readinessDistribution,
      trustDistribution,

      topImprovingActions,
      topDecliningActions,
      highestConfidenceActions,
      lowestConfidenceActions,

      calibrationSummary: {
        increasing: calibReport.increasing,
        decreasing: calibReport.decreasing,
        stable:     calibReport.stable,
        largestIncrease: calibReport.largestIncrease
          ? { action: calibReport.largestIncrease.action, adjustment: calibReport.largestIncrease.adjustment }
          : null,
        largestDecrease: calibReport.largestDecrease
          ? { action: calibReport.largestDecrease.action, adjustment: calibReport.largestDecrease.adjustment }
          : null,
      },

      driftSummary: {
        positive: driftReport.positiveActions,
        negative: driftReport.negativeActions,
        flat:     driftReport.flatActions,
      },
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
