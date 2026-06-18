/**
 * GET /api/debug/decision-ranking
 *
 * DATA-18S Phase 3 — Priority-ordered risk decisions.
 *
 * Reads active risk signals from KV, scores each one using the Risk Scoring
 * Engine (risk-priority.ts), estimates blast radius and business impact, and
 * returns the full list ordered highest → lowest composite priority score.
 *
 * Each decision entry includes:
 *   - CompositePriorityScore (Probability × Impact × Urgency × Confidence)
 *   - BlastRadiusResult
 *   - BusinessCriticality
 *   - EvidenceProfile
 *   - Recommended action with reasoning
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
import { scoreRiskSignal, classifyEvidenceQuality, scoreMultipleSignals } from '@/lib/risk-priority';
import { estimateBlastRadius, combineBlastRadii }                         from '@/lib/blast-radius';
import { computeBusinessImpact }        from '@/lib/business-impact';
import type { RiskFactorId }            from '@/lib/auto-remediation';
import type { RiskSignal }              from '@/lib/risk-priority';
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

// Map factor name → RF-ID
function rfId(factor: string): RiskFactorId | null {
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

  // ── 1. Parallel KV reads ───────────────────────────────────────────────
  const FINISHED_FEED_KEY = 'goalradar:/competitions/WC/matches?status=FINISHED';

  const [feedRes, rateSafeRes, authPrimRes, authDRRes, archive30dRes, repairs90dRes] =
    await Promise.allSettled([
      kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY),
      kv.get<{ expiresAt: number }>(RATE_SAFE_KV_KEY),
      kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY),
      kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY),
      readHealthRecords(now - 30 * 24 * 3_600_000, now),
      readRepairRecords(now - 90 * 24 * 3_600_000, now),
    ]);

  const feedEntry  = feedRes.status      === 'fulfilled' ? feedRes.value      : null;
  const rateSafe   = rateSafeRes.status  === 'fulfilled' ? rateSafeRes.value  : null;
  const authPrim   = authPrimRes.status  === 'fulfilled' ? authPrimRes.value  : null;
  const authDR     = authDRRes.status    === 'fulfilled' ? authDRRes.value    : null;
  const archive30d = archive30dRes.status  === 'fulfilled' ? archive30dRes.value  : [];
  const repairsRaw = repairs90dRes.status  === 'fulfilled' ? repairs90dRes.value  : [];

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

  // ── 2. Build risk signals ──────────────────────────────────────────────
  const activeSignals: RiskSignal[] = [];

  // Per-action repair history helpers
  function repairStats(rfLabel: string) {
    const matching = repairs.filter(r => r.triggeredBy && r.triggeredBy.includes(rfLabel.replace('RF-', 'RF-')));
    const prod     = matching.filter(r => r.result !== 'dry-run');
    const succ     = prod.filter(r => r.result === 'success');
    return {
      samples:     prod.length,
      successRate: prod.length > 0 ? Math.round(succ.length / prod.length * 100) : 0,
    };
  }

  // RF-5: rate-safe
  if (rateSafe) {
    const rs5 = repairStats('RF-5');
    activeSignals.push({
      factor: 'rate-safe-mode', rfId: 'RF-5', severity: 'RED',
      matchCount: totalFinished, ttlSec: null,
      activeRepairLocks: 0,
      historicalSuccessRate: rs5.successRate,
      productionSamples: rs5.samples,
    });
  }

  // RF-6: feed absent
  if (!feedEntry) {
    const rs6 = repairStats('RF-6');
    activeSignals.push({
      factor: 'finished-feed-absent', rfId: 'RF-6', severity: 'RED',
      matchCount: totalFinished, ttlSec: null,
      activeRepairLocks: 0,
      historicalSuccessRate: rs6.successRate,
      productionSamples: rs6.samples,
    });
  }

  // RF-2: auth DR absent
  const drAbsent = !authDR?.version && !authPrim?.version;
  if (drAbsent) {
    const rs2 = repairStats('RF-2');
    activeSignals.push({
      factor: 'authority-cache-absent', rfId: 'RF-2', severity: 'YELLOW',
      matchCount: 0, ttlSec: null,
      activeRepairLocks: 0,
      historicalSuccessRate: rs2.successRate,
      productionSamples: rs2.samples,
    });
  }

  // Per-match TTL scan (if feed present)
  let activeRepairLocks = 0;
  if (finishedIds.length > 0) {
    const [snapTtls, drTtls, repairTtls] = await Promise.all([
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:match:${id}`))),
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:dr:match:${id}`))),
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:repair-lock:${id}`))),
    ]);

    let snap4h = 0; let snap24h = 0; let drAbsentCount = 0;
    let minSnapTtl: number | null = null;

    for (let i = 0; i < finishedIds.length; i++) {
      const _sT = snapTtls[i];
      const _dT = drTtls[i];
      const _rT = repairTtls[i];
      const snapTtl   = _sT.status === 'fulfilled' ? _sT.value  : null;
      const drTtl     = _dT.status === 'fulfilled' ? _dT.value  : null;
      const repairTtl = _rT.status === 'fulfilled' ? _rT.value  : null;

      if (repairTtl !== null && repairTtl > 0) activeRepairLocks++;

      if (snapTtl !== null && snapTtl !== -1) {
        const ttl = snapTtl === -2 ? 0 : snapTtl;
        if (ttl <= 4 * 3600)  { snap4h++;  if (minSnapTtl === null || ttl < minSnapTtl) minSnapTtl = ttl; }
        else if (ttl <= 24 * 3600) { snap24h++; if (minSnapTtl === null || ttl < minSnapTtl) minSnapTtl = ttl; }
      }

      if (drTtl === -2 || drTtl === null) drAbsentCount++;
    }

    const rs1 = repairStats('RF-1');
    if (snap4h > 0) {
      activeSignals.push({
        factor: 'snapshots-expiring-4h', rfId: 'RF-1', severity: 'RED',
        matchCount: snap4h, ttlSec: minSnapTtl,
        activeRepairLocks: 0,
        historicalSuccessRate: rs1.successRate,
        productionSamples: rs1.samples,
      });
    } else if (snap24h > 0) {
      activeSignals.push({
        factor: 'snapshots-expiring-24h', rfId: 'RF-1', severity: 'YELLOW',
        matchCount: snap24h, ttlSec: minSnapTtl,
        activeRepairLocks: 0,
        historicalSuccessRate: rs1.successRate,
        productionSamples: rs1.samples,
      });
    }

    const rs2dr = repairStats('RF-2');
    if (drAbsentCount > 0 && !drAbsent) {
      activeSignals.push({
        factor: 'dr-snapshots-absent', rfId: 'RF-2', severity: 'YELLOW',
        matchCount: drAbsentCount, ttlSec: null,
        activeRepairLocks: 0,
        historicalSuccessRate: rs2dr.successRate,
        productionSamples: rs2dr.samples,
      });
    }

    const rs7 = repairStats('RF-7');
    if (activeRepairLocks >= 2) {
      activeSignals.push({
        factor: 'elevated-repair-frequency', rfId: 'RF-7',
        severity: activeRepairLocks >= 5 ? 'RED' : 'YELLOW',
        matchCount: activeRepairLocks, ttlSec: null,
        activeRepairLocks,
        historicalSuccessRate: rs7.successRate,
        productionSamples: rs7.samples,
      });
    }
  }

  // RF-8: archive trajectory
  const archive24h  = archive30d.filter(r => r.ts >= now - 24 * 3_600_000);
  let trailing = 0;
  for (const rec of [...archive24h].reverse()) {
    if (rec.overall !== 'GREEN') trailing++;
    else break;
  }
  if (trailing >= 3) {
    const rs8 = repairStats('RF-8');
    activeSignals.push({
      factor: 'archive-trajectory-yellow', rfId: 'RF-8',
      severity: trailing >= 5 ? 'RED' : 'YELLOW',
      matchCount: 0, ttlSec: null,
      activeRepairLocks: 0,
      historicalSuccessRate: rs8.successRate,
      productionSamples: rs8.samples,
    });
  }

  // ── 3. Score each signal ───────────────────────────────────────────────
  const { scores, compoundTotal, compoundTier } = scoreMultipleSignals(activeSignals, now);

  // ── 4. Build decision entries ──────────────────────────────────────────
  const decisions = scores.map((score, idx) => {
    const signal = activeSignals.find(s => s.factor === score.riskFactors[0]) ?? activeSignals[idx];
    const rf     = signal?.rfId ?? null;

    const blast  = estimateBlastRadius(rf, signal?.matchCount ?? 0, totalFinished, signal?.severity ?? 'YELLOW');
    const biz    = computeBusinessImpact(rf, blast.tier, signal?.matchCount ?? 0);

    const prodRepairs = repairs.filter(r => {
      const id = rfId(r.triggeredBy ?? '');
      return id === rf && r.result !== 'dry-run';
    });
    const verifiedRepairs = prodRepairs.filter(r => r.verificationPassed !== null);
    const evidence = classifyEvidenceQuality(
      prodRepairs.length,
      prodRepairs.length > 0 ? 1.0 : 0,
      prodRepairs.length > 0 ? verifiedRepairs.length / prodRepairs.length : 0,
    );

    return {
      rank:              idx + 1,
      factor:            signal?.factor ?? score.riskFactors[0],
      rfId:              rf,
      priorityScore:     score,
      blastRadius:       blast,
      businessImpact:    biz,
      evidence,
      reasoning: [
        `Priority ${score.total}/100 (${score.tier}): ` +
          `P=${Math.round(score.probability.score*100)}% × Impact=${score.impact.tier} × Urgency=${score.urgency.tier}`,
        blast.summary,
        biz.headline,
        `Evidence: ${evidence.evidenceQuality} (${evidence.qualityReason})`,
      ],
    };
  });

  // ── 5. Combined blast radius ───────────────────────────────────────────
  const combinedBlast = combineBlastRadii(decisions.map(d => d.blastRadius));

  return NextResponse.json(
    {
      checkedAt:      new Date(now).toISOString(),
      schemaVersion:  'DATA-18S',
      activeRiskCount: activeSignals.length,
      compoundScore:  { total: compoundTotal, tier: compoundTier },
      combinedBlastRadius: combinedBlast,
      decisions,
      note: activeSignals.length === 0
        ? 'No active risk factors — system nominal.'
        : `${activeSignals.length} active risk(s). Top priority: ${decisions[0]?.factor ?? 'none'} (${decisions[0]?.priorityScore.total ?? 0}/100).`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
