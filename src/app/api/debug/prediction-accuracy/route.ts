/**
 * GET /api/debug/prediction-accuracy
 *
 * DATA-18U.2 Phase 5 — Prediction Accuracy Dashboard.
 *
 * Returns the full accuracy picture for GoalRadar's outcome prediction system:
 *   overallAccuracy    — composite score + calibration + drift summary
 *   bestPredictions    — highest-accuracy actions
 *   worstPredictions   — lowest-accuracy / most over-confident actions
 *   actionAccuracy     — per-action breakdown across 24h/7d/30d
 *   trustDistribution  — HIGH/MEDIUM/LOW trust counts
 *   calibrationHistory — last N confidence calibration events
 *   driftSummary       — positive/negative/flat per action
 *
 * Views: ?window=24h | 7d | 30d (default: 7d)
 *
 * Read-only except confidence-history archive writes triggered by calibration.
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse }           from 'next/server';
import { readRepairRecords }                   from '@/lib/repair-history';
import { getConfidenceHistory }                from '@/lib/confidence-history';
import { calibrateAllActions }                 from '@/lib/confidence-calibration';
import { detectAllDrift }                      from '@/lib/prediction-drift';
import { classifyAllTrust }                    from '@/lib/trust-framework';
import { getGovernance }                       from '@/lib/action-governance';
import type { RemediationActionType }          from '@/lib/auto-remediation';
import type { RepairRecordV2 }                 from '@/lib/action-effectiveness';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

// All action types
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

const WINDOWS: Record<string, number> = {
  '24h': 24 * 3_600_000,
  '7d':   7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
};

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

  const now       = Date.now();
  const windowStr = new URL(req.url).searchParams.get('window') ?? '7d';
  const windowMs  = WINDOWS[windowStr] ?? WINDOWS['7d'];
  const sinceMs   = now - windowMs;

  // ── 1. Reads ────────────────────────────────────────────────────────────
  const [repairsRaw90, confHistory30, repairsRaw30] = await Promise.all([
    readRepairRecords(now - 90 * 24 * 3_600_000, now),
    getConfidenceHistory(now - 30 * 24 * 3_600_000, now),
    readRepairRecords(sinceMs, now),
  ]);

  const toV2 = (r: typeof repairsRaw90[0]): RepairRecordV2 => ({
    ...r,
    riskBefore:         (r as unknown as RepairRecordV2).riskBefore         ?? null,
    riskAfter:          (r as unknown as RepairRecordV2).riskAfter          ?? null,
    improvement:        (r as unknown as RepairRecordV2).improvement        ?? null,
    verificationPassed: (r as unknown as RepairRecordV2).verificationPassed ?? null,
    verificationChecks: (r as unknown as RepairRecordV2).verificationChecks ?? [],
  });

  const repairs90 = repairsRaw90.map(toV2);
  const repairs30 = repairsRaw30.map(toV2);
  const prodRec90 = repairs90.filter(r => r.result !== 'dry-run');
  const prodRec30 = repairs30.filter(r => r.result !== 'dry-run');

  // ── 2. Per-action production record buckets ──────────────────────────────
  function prodForAction(records: RepairRecordV2[], action: RemediationActionType) {
    return records.filter(r => r.action === action);
  }

  // ── 3. Calibration (90d history gives most stable signal) ───────────────
  const calibInputs = ALL_ACTIONS.map(action => {
    const prod = prodForAction(prodRec90, action);
    // Current confidence: empirical from 90d prod, fallback 0.65
    const succ = prod.filter(r => r.result === 'success').length;
    const currentConfidence = prod.length > 0 ? succ / prod.length : 0.65;
    return { action, currentConfidence, productionRecords: prod, verificationProfile: null };
  });
  const calibReport = calibrateAllActions(calibInputs);

  // Build confidence map: action → calibrated newConfidence
  const confidenceMap = new Map<RemediationActionType, number>(
    calibReport.calibrations.map(c => [c.action, c.newConfidence]),
  );

  // Build direction map
  const directionMap = new Map(
    calibReport.calibrations.map(c => [c.action, c.direction]),
  );

  // ── 4. Drift detection ──────────────────────────────────────────────────
  const driftInputs = ALL_ACTIONS.map(action => ({
    action,
    records: confHistory30.filter(r => r.action === action),
  }));
  const driftReport = detectAllDrift(driftInputs, now);

  const driftMap = new Map(
    driftReport.signals.map(s => [s.action, s.drift] as const),
  );

  // ── 5. Trust classification ─────────────────────────────────────────────
  const trustInputs = ALL_ACTIONS.map(action => {
    const gov = getGovernance(action);
    return {
      action,
      confidence:                 confidenceMap.get(action) ?? 0.65,
      productionRecords:          prodForAction(prodRec90, action),
      productionCoverageRequired: gov.productionCoverageRequired,
      calibrationDirection:       directionMap.get(action) ?? 'STABLE' as const,
      driftDirection:             driftMap.get(action) ?? null,
    };
  });
  const trustReport = classifyAllTrust(trustInputs);

  // ── 6. Per-action accuracy summary (for window) ─────────────────────────
  const actionAccuracy = ALL_ACTIONS.map(action => {
    const prod    = prodForAction(prodRec30, action);
    const n       = prod.length;
    const succ    = prod.filter(r => r.result === 'success').length;
    const verRecs = prod.filter(r => r.verificationPassed !== null);
    const vpr     = verRecs.length > 0
      ? verRecs.filter(r => r.verificationPassed).length / verRecs.length
      : null;

    const conf   = confidenceMap.get(action) ?? 0.65;
    const trust  = trustReport.classifications.find(c => c.action === action);
    const drift  = driftReport.signals.find(s => s.action === action);
    const calib  = calibReport.calibrations.find(c => c.action === action);

    return {
      action,
      window:               windowStr,
      sampleCount:          n,
      successRate:          n > 0 ? Math.round(succ / n * 1000) / 1000 : null,
      verificationPassRate: vpr !== null ? Math.round(vpr * 1000) / 1000 : null,
      calibratedConfidence: conf,
      calibrationDirection: calib?.direction ?? 'STABLE',
      calibrationAdjustment: calib?.adjustment ?? 0,
      driftDirection:       drift?.drift ?? null,
      confidenceTrend:      drift?.confidenceTrend ?? null,
      trustLevel:           trust?.trustLevel ?? 'LOW_TRUST',
      automationReadiness:  trust?.automationReadiness ?? 'NOT_READY',
    };
  });

  // Best = highest calibrated confidence with ≥ 1 sample
  const withSamples    = actionAccuracy.filter(a => (a.sampleCount ?? 0) > 0);
  const bestPredictions  = [...withSamples]
    .sort((a, b) => b.calibratedConfidence - a.calibratedConfidence)
    .slice(0, 3);
  const worstPredictions = [...withSamples]
    .sort((a, b) => a.calibratedConfidence - b.calibratedConfidence)
    .slice(0, 3);

  // ── 7. Trust distribution ────────────────────────────────────────────────
  const trustDistribution = {
    HIGH_TRUST:   trustReport.highTrustActions.length,
    MEDIUM_TRUST: trustReport.mediumTrustActions.length,
    LOW_TRUST:    trustReport.lowTrustActions.length,
    READY:        trustReport.readyActions.length,
    LIMITED_READY: trustReport.limitedReadyActions.length,
    NOT_READY:    trustReport.notReadyActions.length,
  };

  // ── 8. Overall accuracy score ────────────────────────────────────────────
  const allConf  = calibReport.calibrations.map(c => c.newConfidence);
  const meanConf = allConf.length > 0
    ? allConf.reduce((s, v) => s + v, 0) / allConf.length
    : 0;

  const positiveCount = driftReport.positiveActions.length;
  const negativeCount = driftReport.negativeActions.length;
  const driftHealth   = driftReport.signals.length > 0
    ? (positiveCount - negativeCount) / driftReport.signals.length
    : 0;

  const overallAccuracy = {
    meanCalibratedConfidence: Math.round(meanConf * 1000) / 1000,
    driftHealthScore:         Math.round(driftHealth * 100),   // −100..+100
    highTrustCount:           trustReport.highTrustActions.length,
    readyForAutomation:       trustReport.readyActions.length,
    window:                   windowStr,
    note: trustReport.readyActions.length === 0
      ? 'No actions currently meet HIGH_TRUST + production evidence gate for automation'
      : `${trustReport.readyActions.length} action(s) meet automation candidacy criteria`,
  };

  // Calibration history (last 20 events)
  const calibrationHistory = [...confHistory30]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20)
    .map(r => ({
      ts:               new Date(r.ts).toISOString(),
      action:           r.action,
      oldConfidence:    r.oldConfidence,
      adjustment:       r.adjustment,
      newConfidence:    r.newConfidence,
      direction:        r.adjustment > 0.002 ? 'INCREASE' : r.adjustment < -0.002 ? 'DECREASE' : 'STABLE',
      calibrationSource: r.calibrationSource,
      reason:           r.reason,
    }));

  // Drift summary
  const driftSummary = {
    positiveActions:  driftReport.positiveActions,
    negativeActions:  driftReport.negativeActions,
    flatActions:      driftReport.flatActions,
    topImproving:     driftReport.topImproving,
    topDegrading:     driftReport.topDegrading,
    signals:          driftReport.signals.map(s => ({
      action:           s.action,
      drift:            s.drift,
      currentAccuracy:  s.currentAccuracy,
      previousAccuracy: s.previousAccuracy,
      delta:            s.delta,
      confidenceTrend:  s.confidenceTrend,
      recommendation:   s.recommendation,
    })),
  };

  return NextResponse.json(
    {
      checkedAt:     new Date(now).toISOString(),
      schemaVersion: 'DATA-18U.2',
      window:        windowStr,

      overallAccuracy,
      bestPredictions,
      worstPredictions,
      actionAccuracy,
      trustDistribution,
      calibrationHistory,
      driftSummary,

      trustReport: {
        highTrustActions:    trustReport.highTrustActions,
        mediumTrustActions:  trustReport.mediumTrustActions,
        lowTrustActions:     trustReport.lowTrustActions,
        readyActions:        trustReport.readyActions,
        limitedReadyActions: trustReport.limitedReadyActions,
        notReadyActions:     trustReport.notReadyActions,
        details:             trustReport.classifications.map(c => ({
          action:               c.action,
          trustLevel:           c.trustLevel,
          automationReadiness:  c.automationReadiness,
          confidence:           c.confidence,
          productionCoverage:   c.productionCoverage,
          verificationPassRate: c.verificationPassRate,
          productionSamples:    c.productionSamples,
          hasProductionEvidence: c.hasProductionEvidence,
          calibrationDirection: c.calibrationDirection,
          driftDirection:       c.driftDirection,
          reasons:              c.reasons,
          gapsToHighTrust:      c.gapsToHighTrust,
        })),
      },

      note: `DATA-18U.2 Prediction Accuracy Dashboard. ` +
            `${calibReport.calibrations.length} actions calibrated, ` +
            `${driftReport.signals.length} with drift history.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
