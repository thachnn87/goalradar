/**
 * GET /api/debug/reliability-governance
 *
 * DATA-18T Phase 5 — Governance Dashboard.
 *
 * For every active risk signal, evaluates the recommended action through
 * the full governance pipeline:
 *   1. Risk scoring (DATA-18S)
 *   2. Blast radius + business impact (DATA-18S)
 *   3. Benefit/cost analysis (DATA-18T Phase 2)
 *   4. Approval matrix (DATA-18T Phase 3)
 *   5. Execution readiness (DATA-18T Phase 4)
 *
 * Returns four buckets:
 *   recommended    — all evaluated actions with full governance verdicts
 *   autoApproved   — READY + flag sufficient (would execute if flag=true)
 *   requiresReview — REVIEW or approval > AUTO
 *   blocked        — BLOCKED (must not execute)
 *
 * Read-only. No KV writes. No cache mutations.
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse }    from 'next/server';
import { kv }                            from '@vercel/kv';
import type { Match }                    from '@/lib/types';
import { RATE_SAFE_KV_KEY }              from '@/lib/rate-safe';
import { AUTHORITY_KEY, AUTHORITY_DR_KEY, type AuthorityCacheEnvelope } from '@/lib/authority-cache';
import { readHealthRecords }             from '@/lib/health-archive';
import { readRepairRecords }             from '@/lib/repair-history';
import { scoreRiskSignal, classifyEvidenceQuality } from '@/lib/risk-priority';
import { estimateBlastRadius }           from '@/lib/blast-radius';
import { computeBusinessImpact }         from '@/lib/business-impact';
import { computeBenefitCost }            from '@/lib/action-value';
import { deriveApprovalLevel, deriveReadiness, buildGovernanceVerdict } from '@/lib/approval-matrix';
import { getGovernance, EXECUTION_RISK_RANK } from '@/lib/action-governance';
import { AUTONOMOUS_RELIABILITY_ENABLED } from '@/lib/auto-remediation';
import type { RiskFactorId, RemediationActionType } from '@/lib/auto-remediation';
import type { RiskSignal }               from '@/lib/risk-priority';
import type { RepairRecordV2 }           from '@/lib/action-effectiveness';
import type { GovernanceVerdict }        from '@/lib/approval-matrix';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

interface KVEntry<T> { data: T; fetchedAt: number; freshUntil: number }

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

function rfIdFromFactor(factor: string): RiskFactorId | null {
  if (factor.includes('rate-safe'))            return 'RF-5';
  if (factor.includes('snapshots-expiring'))   return 'RF-1';
  if (factor.includes('dr-snapshot'))          return 'RF-2';
  if (factor.includes('espn-events-expiring')) return 'RF-3';
  if (factor.includes('espn-lookup'))          return 'RF-4';
  if (factor.includes('feed'))                 return 'RF-6';
  if (factor.includes('repair'))               return 'RF-7';
  if (factor.includes('archive'))              return 'RF-8';
  return null;
}

const RF_ACTIONS: Partial<Record<RiskFactorId, RemediationActionType>> = {
  'RF-1': 'PREWARM_SNAPSHOT', 'RF-2': 'REBUILD_DR',
  'RF-3': 'REFRESH_ESPN_CACHE', 'RF-4': 'RESOLVE_ESPN_LOOKUP',
  'RF-5': 'SUPPRESS_REFRESH',  'RF-6': 'TRIGGER_ORCHESTRATOR',
  'RF-7': 'MONITOR_SELF_HEAL', 'RF-8': 'ESCALATE_INCIDENT',
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

  const now = Date.now();
  const FINISHED_FEED_KEY = 'goalradar:/competitions/WC/matches?status=FINISHED';

  // ── 1. Reads ───────────────────────────────────────────────────────────
  const [feedRes, rateSafeRes, authPrimRes, authDRRes, archive30dRes, repairs90dRes] =
    await Promise.allSettled([
      kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY),
      kv.get<{ expiresAt: number }>(RATE_SAFE_KV_KEY),
      kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY),
      kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY),
      readHealthRecords(now - 30 * 24 * 3_600_000, now),
      readRepairRecords(now - 90 * 24 * 3_600_000, now),
    ]);

  const feedEntry  = feedRes.status     === 'fulfilled' ? feedRes.value     : null;
  const rateSafe   = rateSafeRes.status === 'fulfilled' ? rateSafeRes.value : null;
  const authPrim   = authPrimRes.status === 'fulfilled' ? authPrimRes.value : null;
  const authDR     = authDRRes.status   === 'fulfilled' ? authDRRes.value   : null;
  const archive30d = archive30dRes.status === 'fulfilled' ? archive30dRes.value : [];
  const repairsRaw = repairs90dRes.status === 'fulfilled' ? repairs90dRes.value : [];

  const repairs: RepairRecordV2[] = repairsRaw.map(r => ({
    ...r,
    riskBefore:         (r as unknown as RepairRecordV2).riskBefore         ?? null,
    riskAfter:          (r as unknown as RepairRecordV2).riskAfter          ?? null,
    improvement:        (r as unknown as RepairRecordV2).improvement        ?? null,
    verificationPassed: (r as unknown as RepairRecordV2).verificationPassed ?? null,
    verificationChecks: (r as unknown as RepairRecordV2).verificationChecks ?? [],
  }));

  const finishedMatches = (feedEntry?.data?.matches ?? []).filter(m => m.status === 'FINISHED');
  const totalFinished   = finishedMatches.length;
  const finishedIds     = finishedMatches.map(m => m.id);

  // ── 2. Build active signals ────────────────────────────────────────────
  const signals: RiskSignal[] = [];

  function addSignal(
    factor: string, rfId: RiskFactorId, severity: 'GREEN' | 'YELLOW' | 'RED',
    matchCount: number, ttlSec: number | null,
  ) {
    const prod = repairs.filter(r => {
      const id = rfIdFromFactor(r.triggeredBy ?? '');
      return id === rfId && r.result !== 'dry-run';
    });
    const succ = prod.filter(r => r.result === 'success');
    signals.push({
      factor, rfId, severity, matchCount, ttlSec, activeRepairLocks: 0,
      historicalSuccessRate: prod.length > 0 ? Math.round(succ.length / prod.length * 100) : 0,
      productionSamples: prod.length,
    });
  }

  if (rateSafe) addSignal('rate-safe-mode', 'RF-5', 'RED', totalFinished, null);
  if (!feedEntry) addSignal('finished-feed-absent', 'RF-6', 'RED', totalFinished, null);
  if (!authDR?.version && !authPrim?.version) addSignal('authority-cache-absent', 'RF-2', 'YELLOW', 0, null);

  let activeRepairLocks = 0;
  if (finishedIds.length > 0) {
    const [snapTtls, repairTtls] = await Promise.all([
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:match:${id}`))),
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:repair-lock:${id}`))),
    ]);

    let snap4h = 0; let snap24h = 0; let minTtl: number | null = null;
    for (let i = 0; i < finishedIds.length; i++) {
      const _sT = snapTtls[i]; const _rT = repairTtls[i];
      const st = _sT.status === 'fulfilled' ? _sT.value : null;
      const rt = _rT.status === 'fulfilled' ? _rT.value : null;
      if (rt !== null && rt > 0) activeRepairLocks++;
      if (st !== null && st !== -1) {
        const ttl = st === -2 ? 0 : st;
        if (ttl <= 4 * 3600)       { snap4h++;  if (minTtl === null || ttl < minTtl) minTtl = ttl; }
        else if (ttl <= 24 * 3600) { snap24h++; if (minTtl === null || ttl < minTtl) minTtl = ttl; }
      }
    }
    if (snap4h > 0)  addSignal('snapshots-expiring-4h',  'RF-1', 'RED',    snap4h,  minTtl);
    else if (snap24h > 0) addSignal('snapshots-expiring-24h', 'RF-1', 'YELLOW', snap24h, minTtl);

    if (activeRepairLocks >= 2)
      addSignal('elevated-repair-frequency', 'RF-7',
        activeRepairLocks >= 5 ? 'RED' : 'YELLOW', activeRepairLocks, null);
  }

  const archive24h = archive30d.filter(r => r.ts >= now - 24 * 3_600_000);
  let trailing = 0;
  for (const rec of [...archive24h].reverse()) { if (rec.overall !== 'GREEN') trailing++; else break; }
  if (trailing >= 3)
    addSignal('archive-trajectory-yellow', 'RF-8', trailing >= 5 ? 'RED' : 'YELLOW', 0, null);

  // ── 3. Evaluate each signal through full governance pipeline ───────────
  const verdicts: GovernanceVerdict[] = [];

  for (const sig of signals) {
    const rf     = sig.rfId;
    const action = (rf ? RF_ACTIONS[rf] : null) ?? 'NO_ACTION';
    const gov    = getGovernance(action);

    // Score
    const score  = scoreRiskSignal(sig, now);

    // Blast + business
    const blast  = estimateBlastRadius(rf, sig.matchCount, totalFinished, sig.severity);
    const biz    = computeBusinessImpact(rf, blast.tier, sig.matchCount);

    // Evidence
    const prodRecs  = repairs.filter(r => rfIdFromFactor(r.triggeredBy ?? '') === rf && r.result !== 'dry-run');
    const verRecs   = prodRecs.filter(r => r.verificationPassed !== null);
    const evidence  = classifyEvidenceQuality(
      prodRecs.length,
      prodRecs.length > 0 ? 1.0 : 0,
      prodRecs.length > 0 ? verRecs.length / prodRecs.length : 0,
    );

    // Confidence
    const succRecs = prodRecs.filter(r => r.result === 'success');
    const confidence = prodRecs.length > 0
      ? Math.round(succRecs.length / prodRecs.length * 100) / 100
      : 0.50;

    // Benefit / cost
    const bc = computeBenefitCost({
      action,
      priorityScore:    score.total,
      businessTier:     biz.overall,
      blastTier:        blast.tier,
      riskTier:         score.tier,
      evidenceQuality:  evidence.evidenceQuality,
      actionConfidence: confidence,
      executionRisk:    gov.executionRisk,
      rollbackComplexity: gov.rollbackComplexity,
      matchesAffected:  sig.matchCount,
    });

    // Approval
    const approval = deriveApprovalLevel(
      action,
      biz.overall,
      blast.tier,
      gov.executionRisk,
      evidence.evidenceQuality,
      bc.netDecisionValue,
      AUTONOMOUS_RELIABILITY_ENABLED,
    );

    // Readiness
    const readiness = deriveReadiness(
      action,
      approval,
      evidence.evidenceQuality,
      evidence.productionCoverage,
      evidence.verificationCoverage,
      confidence,
      bc.netDecisionValue,
    );

    verdicts.push(buildGovernanceVerdict(action, approval, readiness, bc));

    void EXECUTION_RISK_RANK;
  }

  // Sort: BLOCKED first, then REQUIRES_REVIEW, then AUTO_APPROVED; within tier by priority score
  const tierOrder: Record<GovernanceVerdict['tier'], number> = {
    BLOCKED: 0, REQUIRES_REVIEW: 1, AUTO_APPROVED: 2,
  };
  verdicts.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

  const autoApproved   = verdicts.filter(v => v.tier === 'AUTO_APPROVED');
  const requiresReview = verdicts.filter(v => v.tier === 'REQUIRES_REVIEW');
  const blocked        = verdicts.filter(v => v.tier === 'BLOCKED');

  return NextResponse.json(
    {
      checkedAt:     new Date(now).toISOString(),
      schemaVersion: 'DATA-18T',
      featureEnabled: AUTONOMOUS_RELIABILITY_ENABLED,
      activeRiskCount: signals.length,

      summary: {
        total:         verdicts.length,
        autoApproved:  autoApproved.length,
        requiresReview: requiresReview.length,
        blocked:       blocked.length,
      },

      recommended:    verdicts,
      autoApproved,
      requiresReview,
      blocked,

      governancePolicy: {
        autoApproveGate:    'READY + featureEnabled=true + approval=AUTO',
        reviewGate:         'READY + approval=TEAM_LEAD|ADMIN',
        blockGate:          'BLOCKED or approval=EMERGENCY_ONLY or netDecisionValue<-0.20',
        flagNote:           AUTONOMOUS_RELIABILITY_ENABLED
          ? 'AUTONOMOUS_RELIABILITY_ENABLED=true — AUTO actions can execute'
          : 'AUTONOMOUS_RELIABILITY_ENABLED=false — all actions require human review',
      },

      note: verdicts.length === 0
        ? 'No active risks — no governance evaluation needed.'
        : `Evaluated ${verdicts.length} action(s): ` +
          `${autoApproved.length} AUTO_APPROVED, ` +
          `${requiresReview.length} REQUIRES_REVIEW, ` +
          `${blocked.length} BLOCKED.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
