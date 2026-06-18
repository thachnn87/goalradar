/**
 * GET /api/debug/evidence-readiness
 *
 * DATA-18U.4 Phase 4 — Evidence Readiness.
 *
 * Returns:
 *   readyActions       — actions with automationReadiness=READY
 *   nearReadyActions   — progressPercent ≥ 50 but not yet READY
 *   blockedActions     — progressPercent < 50
 *   progress[]         — full EvidenceProgress per action (sorted desc)
 *   eta[]              — compact ETA table
 *   closestToReady     — the single action nearest to READY right now
 *   evolution          — simulated snapshots at 1/3/5/10/20 executions
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse }       from 'next/server';
import { readRepairRecords }               from '@/lib/repair-history';
import { getConfidenceHistory }            from '@/lib/confidence-history';
import { calibrateAllActions }             from '@/lib/confidence-calibration';
import { detectAllDrift }                  from '@/lib/prediction-drift';
import { classifyAllTrust }               from '@/lib/trust-framework';
import { collectAllEvidence }             from '@/lib/evidence-collector';
import { computeAllProgress }             from '@/lib/evidence-progress';
import { computeAllBaselines }            from '@/lib/production-baseline';
import { simulateAllEvolutions }          from '@/lib/trust-evolution';
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

  // ── Calibration ──────────────────────────────────────────────────────────
  const calibInputs = ALL_ACTIONS.map(action => {
    const recs = prod90.filter(r => r.action === action);
    const succ = recs.filter(r => r.result === 'success').length;
    return { action, currentConfidence: recs.length > 0 ? succ / recs.length : 0.65, productionRecords: recs, verificationProfile: null };
  });
  const calibReport   = calibrateAllActions(calibInputs);
  const confidenceMap = new Map(calibReport.calibrations.map(c => [c.action, c.newConfidence]));
  const directionMap  = new Map(calibReport.calibrations.map(c => [c.action, c.direction]));

  // ── Drift ────────────────────────────────────────────────────────────────
  const driftReport = detectAllDrift(
    ALL_ACTIONS.map(a => ({ action: a, records: confHistory.filter(r => r.action === a) })),
    now,
  );
  const driftMap = new Map(driftReport.signals.map(s => [s.action, s.drift] as const));

  // ── Trust ────────────────────────────────────────────────────────────────
  const trustReport = classifyAllTrust(ALL_ACTIONS.map(action => ({
    action,
    confidence:                 confidenceMap.get(action) ?? 0.65,
    productionRecords:          prod90.filter(r => r.action === action),
    productionCoverageRequired: getGovernance(action).productionCoverageRequired,
    calibrationDirection:       directionMap.get(action) ?? 'STABLE' as const,
    driftDirection:             driftMap.get(action) ?? null,
  })));
  const trustMap = new Map(trustReport.classifications.map(c => [c.action, { trustLevel: c.trustLevel, readiness: c.automationReadiness }]));

  // ── Evidence ─────────────────────────────────────────────────────────────
  const evidenceSummaries = collectAllEvidence({
    allRepairRecords: repairs, allConfidenceRecords: confHistory,
    confidenceMap, directionMap, driftMap, trustMap, actions: ALL_ACTIONS,
  });

  // ── Progress ─────────────────────────────────────────────────────────────
  const progressList = computeAllProgress(evidenceSummaries);

  // ── Baselines ────────────────────────────────────────────────────────────
  const baselineReport = computeAllBaselines(ALL_ACTIONS.map(action => {
    const trust = trustMap.get(action) ?? { trustLevel: 'LOW_TRUST' as const, readiness: 'NOT_READY' as const };
    return {
      action,
      productionRecords:    prod90.filter(r => r.action === action),
      confidence:           confidenceMap.get(action) ?? 0.65,
      trustLevel:           trust.trustLevel,
      readiness:            trust.readiness,
      calibrationDirection: directionMap.get(action) ?? 'STABLE' as const,
      driftDirection:       driftMap.get(action) ?? null,
    };
  }));

  // ── Evolution simulation ─────────────────────────────────────────────────
  const evolution = simulateAllEvolutions(ALL_ACTIONS.filter(a => a !== 'NO_ACTION'));

  // ── Categorise ───────────────────────────────────────────────────────────
  const readyActions     = progressList.filter(p => p.currentReadiness === 'READY').map(p => p.action);
  const nearReadyActions = progressList.filter(p => p.progressPercent >= 50 && p.currentReadiness !== 'READY').map(p => p.action);
  const blockedActions   = progressList.filter(p => p.progressPercent < 50).map(p => p.action);
  const closestToReady   = progressList.find(p => p.currentReadiness !== 'READY')?.action ?? readyActions[0] ?? null;

  // ── ETA table ────────────────────────────────────────────────────────────
  const eta = progressList.map(p => ({
    action:              p.action,
    progressPercent:     p.progressPercent,
    readiness:           p.currentReadiness,
    etaDaysConservative: p.etaDaysConservative,
    etaDaysOptimistic:   p.etaDaysOptimistic,
    remainingExecutions: p.remainingExecutions,
    progressNote:        p.progressNote,
  }));

  return NextResponse.json(
    {
      checkedAt:      new Date(now).toISOString(),
      schemaVersion:  'DATA-18U.4',
      closestToReady,
      readyActions,
      nearReadyActions,
      blockedActions,
      progress:       progressList,
      eta,
      baselines:      baselineReport.baselines,
      evolution:      evolution.simulations,
      evolutionSummary: {
        fastestToReady: evolution.fastestToReady,
        highestAt10:    evolution.highestAt10,
        checkpoints:    [1, 3, 5, 10, 20],
      },
      note: readyActions.length > 0
        ? `${readyActions.length} action(s) READY.`
        : `No READY actions. Closest: ${closestToReady ?? 'N/A'}. ` +
          `Top progress: ${progressList[0]?.progressPercent ?? 0}%.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
