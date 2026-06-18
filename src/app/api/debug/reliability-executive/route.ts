/**
 * GET /api/debug/reliability-executive
 *
 * DATA-18S Phase 6 — Reliability Executive Dashboard.
 *
 * Single endpoint that synthesises all DATA-18S intelligence layers into
 * an executive-level summary suitable for operational review:
 *
 *   topRisks          — top 3 active risks by composite priority score
 *   topDecisions      — top 3 recommended actions with rationale
 *   businessImpact    — aggregate business criticality across all active risks
 *   recommendedActions — ordered action list with confidence and evidence quality
 *   systemStatus      — overall health tier from worldcup-health + active risk count
 *   historicalContext — incident count, auto-resolution rate, avg recovery time
 *
 * Read-only. No writes. No cache mutations.
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse }   from 'next/server';
import { kv }                           from '@vercel/kv';
import type { Match }                   from '@/lib/types';
import { RATE_SAFE_KV_KEY }             from '@/lib/rate-safe';
import { AUTHORITY_KEY, AUTHORITY_DR_KEY, type AuthorityCacheEnvelope } from '@/lib/authority-cache';
import { readHealthRecords }            from '@/lib/health-archive';
import { readRepairRecords }            from '@/lib/repair-history';
import { scoreMultipleSignals, classifyEvidenceQuality } from '@/lib/risk-priority';
import { estimateBlastRadius, combineBlastRadii }        from '@/lib/blast-radius';
import { computeBusinessImpact }        from '@/lib/business-impact';
import { deriveAttribution }            from '@/lib/outcome-attribution';
import { AUTONOMOUS_RELIABILITY_ENABLED } from '@/lib/auto-remediation';
import type { RiskFactorId }            from '@/lib/auto-remediation';
import type { RiskSignal }              from '@/lib/risk-priority';
import type { BlastTier }               from '@/lib/blast-radius';
import type { BusinessTier }            from '@/lib/business-impact';
import type { RepairRecordV2 }          from '@/lib/action-effectiveness';

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

function overallTier(bizTier: BusinessTier, blastTier: BlastTier, priorityTotal: number): string {
  if (bizTier === 'CRITICAL' || blastTier === 'CRITICAL' || priorityTotal >= 75) return 'CRITICAL';
  if (bizTier === 'HIGH'     || blastTier === 'HIGH'     || priorityTotal >= 50) return 'HIGH';
  if (bizTier === 'MEDIUM'   || blastTier === 'MEDIUM'   || priorityTotal >= 25) return 'MEDIUM';
  return 'LOW';
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
  const FINISHED_FEED_KEY = 'goalradar:/competitions/WC/matches?status=FINISHED';

  // ── 1. Parallel reads ──────────────────────────────────────────────────
  const [feedRes, rateSafeRes, authPrimRes, authDRRes, archive30dRes, repairs90dRes] =
    await Promise.allSettled([
      kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY),
      kv.get<{ expiresAt: number }>(RATE_SAFE_KV_KEY),
      kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY),
      kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY),
      readHealthRecords(now - 30 * 24 * 3_600_000, now),
      readRepairRecords(now - 90 * 24 * 3_600_000, now),
    ]);

  const feedEntry  = feedRes.status     === 'fulfilled' ? feedRes.value      : null;
  const rateSafe   = rateSafeRes.status === 'fulfilled' ? rateSafeRes.value  : null;
  const authPrim   = authPrimRes.status === 'fulfilled' ? authPrimRes.value  : null;
  const authDR     = authDRRes.status   === 'fulfilled' ? authDRRes.value    : null;
  const archive30d = archive30dRes.status === 'fulfilled' ? archive30dRes.value  : [];
  const repairsRaw = repairs90dRes.status === 'fulfilled' ? repairs90dRes.value  : [];

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

  // ── 2. Build active risk signals (same logic as decision-ranking) ──────
  const signals: RiskSignal[] = [];
  let activeRepairLocks = 0;

  if (rateSafe) {
    signals.push({ factor: 'rate-safe-mode', rfId: 'RF-5', severity: 'RED',
      matchCount: totalFinished, ttlSec: null, activeRepairLocks: 0,
      historicalSuccessRate: 0, productionSamples: 0 });
  }
  if (!feedEntry) {
    signals.push({ factor: 'finished-feed-absent', rfId: 'RF-6', severity: 'RED',
      matchCount: totalFinished, ttlSec: null, activeRepairLocks: 0,
      historicalSuccessRate: 0, productionSamples: 0 });
  }
  if (!authDR?.version && !authPrim?.version) {
    signals.push({ factor: 'authority-cache-absent', rfId: 'RF-2', severity: 'YELLOW',
      matchCount: 0, ttlSec: null, activeRepairLocks: 0,
      historicalSuccessRate: 0, productionSamples: 0 });
  }

  if (finishedIds.length > 0) {
    const [snapTtls, repairTtls] = await Promise.all([
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:match:${id}`))),
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:repair-lock:${id}`))),
    ]);
    let snap4h = 0; let snap24h = 0; let minTtl: number | null = null;
    for (let i = 0; i < finishedIds.length; i++) {
      const _sT = snapTtls[i]; const _rT = repairTtls[i];
      const st = _sT.status === 'fulfilled' ? _sT.value  : null;
      const rt = _rT.status === 'fulfilled' ? _rT.value  : null;
      if (rt !== null && rt > 0) activeRepairLocks++;
      if (st !== null && st !== -1) {
        const ttl = st === -2 ? 0 : st;
        if (ttl <= 4 * 3600)       { snap4h++;  if (minTtl === null || ttl < minTtl) minTtl = ttl; }
        else if (ttl <= 24 * 3600) { snap24h++; if (minTtl === null || ttl < minTtl) minTtl = ttl; }
      }
    }
    if (snap4h > 0)
      signals.push({ factor: 'snapshots-expiring-4h',  rfId: 'RF-1', severity: 'RED',    matchCount: snap4h,  ttlSec: minTtl, activeRepairLocks: 0, historicalSuccessRate: 0, productionSamples: 0 });
    else if (snap24h > 0)
      signals.push({ factor: 'snapshots-expiring-24h', rfId: 'RF-1', severity: 'YELLOW', matchCount: snap24h, ttlSec: minTtl, activeRepairLocks: 0, historicalSuccessRate: 0, productionSamples: 0 });
    if (activeRepairLocks >= 2)
      signals.push({ factor: 'elevated-repair-frequency', rfId: 'RF-7',
        severity: activeRepairLocks >= 5 ? 'RED' : 'YELLOW',
        matchCount: activeRepairLocks, ttlSec: null, activeRepairLocks,
        historicalSuccessRate: 0, productionSamples: 0 });
  }

  const archive24h = archive30d.filter(r => r.ts >= now - 24 * 3_600_000);
  let trailing = 0;
  for (const rec of [...archive24h].reverse()) { if (rec.overall !== 'GREEN') trailing++; else break; }
  if (trailing >= 3)
    signals.push({ factor: 'archive-trajectory-yellow', rfId: 'RF-8',
      severity: trailing >= 5 ? 'RED' : 'YELLOW',
      matchCount: 0, ttlSec: null, activeRepairLocks: 0,
      historicalSuccessRate: 0, productionSamples: 0 });

  // ── 3. Score, blast, business ──────────────────────────────────────────
  const { scores, compoundTotal, compoundTier } = scoreMultipleSignals(signals, now);

  const enriched = scores.map(score => {
    const sig   = signals.find(s => s.factor === score.riskFactors[0]) ?? signals[0];
    const rf    = rfIdFromFactor(sig?.factor ?? '');
    const blast = estimateBlastRadius(rf, sig?.matchCount ?? 0, totalFinished, sig?.severity ?? 'YELLOW');
    const biz   = computeBusinessImpact(rf, blast.tier, sig?.matchCount ?? 0);
    const tier  = overallTier(biz.overall, blast.tier, score.total);
    const prodRecs = repairs.filter(r => {
      const id = rfIdFromFactor(r.triggeredBy ?? '');
      return id === rf && r.result !== 'dry-run';
    });
    const verRecs = prodRecs.filter(r => r.verificationPassed !== null);
    const evidence = classifyEvidenceQuality(
      prodRecs.length, prodRecs.length > 0 ? 1.0 : 0,
      prodRecs.length > 0 ? verRecs.length / prodRecs.length : 0,
    );
    return { score, sig, rf, blast, biz, tier, evidence };
  });

  const combinedBlast = combineBlastRadii(enriched.map(e => e.blast));

  // Aggregate business impact: max across active risks
  const aggBizScore = enriched.length > 0
    ? Math.max(...enriched.map(e => e.biz.score))
    : 0;
  const aggBizTier: BusinessTier =
    aggBizScore >= 75 ? 'CRITICAL' : aggBizScore >= 50 ? 'HIGH' :
    aggBizScore >= 25 ? 'MEDIUM' : 'LOW';

  // ── 4. Historical context ──────────────────────────────────────────────
  const attribution     = deriveAttribution(archive30d, repairs, now);
  const autoResRate     = attribution.totalIncidents > 0
    ? Math.round(
        (attribution.byOutcome.resolvedByRepair + attribution.byOutcome.resolvedBySelfHeal)
        / attribution.totalIncidents * 100,
      )
    : 100;

  // ── 5. Top risks, decisions, actions ──────────────────────────────────
  const topRisks = enriched.slice(0, 3).map((e, i) => ({
    rank:     i + 1,
    factor:   e.sig?.factor ?? e.score.riskFactors[0],
    tier:     e.tier,
    score:    e.score.total,
    headline: e.biz.headline,
  }));

  const topDecisions = enriched.slice(0, 3).map((e, i) => ({
    rank:              i + 1,
    action:            e.score.recommendedAction,
    priority:          e.score.actionPriority,
    reason:            e.score.urgency.reason,
    blastTier:         e.blast.tier,
    businessImpact:    e.biz.overall,
    evidenceQuality:   e.evidence.evidenceQuality,
  }));

  const recommendedActions = enriched.map((e, i) => ({
    rank:             i + 1,
    action:           e.score.recommendedAction,
    priorityScore:    e.score.total,
    actionPriority:   e.score.actionPriority,
    confidence:       e.evidence.productionCoverage > 0
      ? Math.min(0.99, 0.50 + e.evidence.productionCoverage * 0.49)
      : 0.50,
    evidenceQuality:  e.evidence.evidenceQuality,
    execute:          AUTONOMOUS_RELIABILITY_ENABLED,
  }));

  // ── 6. System status ───────────────────────────────────────────────────
  const lastRecord  = archive24h[archive24h.length - 1] ?? null;
  const systemVerdict = lastRecord?.overall ?? 'GREEN';
  const systemStatus = {
    verdict:         systemVerdict,
    activeRiskCount: signals.length,
    compoundScore:   compoundTotal,
    compoundTier,
    featureFlag:     AUTONOMOUS_RELIABILITY_ENABLED,
    totalFinished,
  };

  return NextResponse.json(
    {
      checkedAt:     new Date(now).toISOString(),
      schemaVersion: 'DATA-18S',
      systemStatus,
      topRisks,
      topDecisions,
      businessImpact: {
        overall:      aggBizTier,
        score:        aggBizScore,
        combinedBlast: { tier: combinedBlast.tier, matchesAffected: combinedBlast.matchesAffected },
        byRisk: enriched.map(e => ({
          factor:  e.sig?.factor ?? e.score.riskFactors[0],
          overall: e.biz.overall,
          score:   e.biz.score,
          headline: e.biz.headline,
        })),
      },
      recommendedActions,
      historicalContext: {
        incidentsLast30d:  attribution.totalIncidents,
        autoResolutionRate: autoResRate,
        avgDurationMs:     attribution.avgDurationMs,
        byOutcome:         attribution.byOutcome,
      },
      note: signals.length === 0
        ? 'System nominal — no active risks.'
        : `${signals.length} active risk(s). Compound score ${compoundTotal}/100 (${compoundTier}). ` +
          `Feature flag: AUTONOMOUS_RELIABILITY_ENABLED=${AUTONOMOUS_RELIABILITY_ENABLED}.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
