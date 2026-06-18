/**
 * GET /api/debug/autonomous-reliability
 *
 * DATA-18P Phase 6 — Autonomous Reliability aggregate endpoint.
 *
 * Single endpoint that synthesises:
 *   - Current predictive risk (from DATA-18N risk engine)
 *   - Recommended remediation actions (from auto-remediation.ts)
 *   - Predicted SLO breaches (from slo-prediction.ts)
 *   - Open incidents with lifecycle state (from incident-lifecycle.ts)
 *   - Repair success rate (from repair-history.ts)
 *   - Feature flag state
 *
 * Returns:
 *   {
 *     featureEnabled,
 *     checkedAt,
 *     risk             { riskLevel, riskFactors[], matchesAtRisk[] }
 *     recommendedAction { action, priority, reason, confidence, execute }
 *     predictedBreaches { scoreAccuracy24h, authorityFreshness24h, enrichmentCoverage24h }
 *     openIncidents     [ IncidentLifecycle ]
 *     repairSuccessRate { successRatePct, total, last24h }
 *     dryRunPlan        { actions[], compositeRisk, escalations }
 *   }
 *
 * Read-only. No writes. No cache mutations.
 * Feature flag: AUTONOMOUS_RELIABILITY_ENABLED (default false — dry-run only).
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import type { Match }                from '@/lib/types';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import { RATE_SAFE_KV_KEY }          from '@/lib/rate-safe';
import { AUTHORITY_KEY, AUTHORITY_DR_KEY, type AuthorityCacheEnvelope } from '@/lib/authority-cache';
import { readHealthRecords }         from '@/lib/health-archive';
import { readRepairRecords, computeRepairTelemetry } from '@/lib/repair-history';
import { evaluateAutoRemediation, AUTONOMOUS_RELIABILITY_ENABLED, type PredictiveRiskInput } from '@/lib/auto-remediation';
import { deriveLifecycle, computeLifecycleStats }                        from '@/lib/incident-lifecycle';
import { predictSLOBreaches }        from '@/lib/slo-prediction';
import type { RepairRef }            from '@/lib/incident-lifecycle';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Constants (mirrors predictive-risk/route.ts)
// ---------------------------------------------------------------------------

const FINISHED_FEED_KEY = 'goalradar:/competitions/WC/matches?status=FINISHED';
const EXPIRY_RED_SEC    = 4  * 3_600;
const EXPIRY_YELLOW_SEC = 24 * 3_600;

interface KVEntry<T> { data: T; fetchedAt: number; freshUntil: number; }

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
// Internal risk scanner (inline — avoids loopback HTTP call)
// ---------------------------------------------------------------------------

type RiskSeverity = 'GREEN' | 'YELLOW' | 'RED';

function expirySeverity(ttlSec: number | null): RiskSeverity {
  if (ttlSec === null || ttlSec < 0) return 'RED';
  if (ttlSec <= EXPIRY_RED_SEC)      return 'RED';
  if (ttlSec <= EXPIRY_YELLOW_SEC)   return 'YELLOW';
  return 'GREEN';
}

function maxSev(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  const r = { GREEN: 0, YELLOW: 1, RED: 2 };
  return r[a] >= r[b] ? a : b;
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

  const now = Date.now();

  // ── 1. Parallel reads ──────────────────────────────────────────────────────
  const [feedRes, rateSafeRes, authPrimRes, authDRRes, archive30dRes, repairs30dRes] =
    await Promise.allSettled([
      kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY),
      kv.get<{ expiresAt: number }>(RATE_SAFE_KV_KEY),
      kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY),
      kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY),
      readHealthRecords(now - 30 * 24 * 3_600_000, now),
      readRepairRecords(now - 30 * 24 * 3_600_000, now),
    ]);

  const feedEntry    = feedRes.status      === 'fulfilled' ? feedRes.value      : null;
  const rateSafe     = rateSafeRes.status  === 'fulfilled' ? rateSafeRes.value  : null;
  const authPrim     = authPrimRes.status  === 'fulfilled' ? authPrimRes.value  : null;
  const authDR       = authDRRes.status    === 'fulfilled' ? authDRRes.value    : null;
  const archive30d   = archive30dRes.status  === 'fulfilled' ? archive30dRes.value  : [];
  const repairs30d   = repairs30dRes.status  === 'fulfilled' ? repairs30dRes.value  : [];

  // ── 2. Build inline risk input ─────────────────────────────────────────────
  const finishedMatches = (feedEntry?.data?.matches ?? []).filter(m => m.status === 'FINISHED');
  const finishedIds     = finishedMatches.map(m => m.id);

  const riskFactors: PredictiveRiskInput['riskFactors'] = [];
  const matchesAtRisk: PredictiveRiskInput['matchesAtRisk'] = [];

  const rateSafeActive = !!rateSafe;
  if (rateSafeActive) {
    riskFactors.push({ factor: 'rate-safe-mode', severity: 'RED', detail: 'Provider circuit-breaker active.' });
  }

  const authAbsent = !authPrim?.version && !authDR?.version;
  if (authAbsent) {
    riskFactors.push({ factor: 'authority-cache-absent', severity: 'YELLOW', detail: 'Authority cache KV key absent.' });
  }

  const feedAgeH = feedEntry
    ? Math.round((now - feedEntry.fetchedAt) / 3_600_000 * 10) / 10
    : null;
  if (feedAgeH === null) {
    riskFactors.push({ factor: 'finished-feed-absent', severity: 'RED', detail: 'FINISHED feed missing from KV.' });
  } else if (feedAgeH > 4) {
    riskFactors.push({ factor: 'finished-feed-stale', severity: 'YELLOW', detail: `Feed ${feedAgeH}h old.` });
  }

  // Per-match TTL scan
  let activeRepairLocks = 0;
  if (finishedIds.length > 0) {
    const [snapTtls, drTtls, evtTtls, lupTtls, repairTtls] = await Promise.all([
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:match:${id}`))),
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:dr:match:${id}`))),
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:espn:event:${id}`))),
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:espn:lookup:${id}`))),
      Promise.allSettled(finishedIds.map(id => kv.ttl(`goalradar:repair-lock:${id}`))),
    ]);

    let snap24h = 0; let snap4h = 0; let drAbsent = 0; let espnEvt24h = 0; let espnLup0 = 0;

    for (let i = 0; i < finishedIds.length; i++) {
      const id = finishedIds[i];
      const fm = finishedMatches[i];
      const home = fm.homeTeam?.shortName || fm.homeTeam?.name || '?';
      const away = fm.awayTeam?.shortName || fm.awayTeam?.name || '?';

      const _sT  = snapTtls[i];   const snapTtl  = _sT.status  === 'fulfilled' ? _sT.value  : null;
      const _dT  = drTtls[i];     const drTtl    = _dT.status  === 'fulfilled' ? _dT.value  : null;
      const _eT  = evtTtls[i];    const evtTtl   = _eT.status  === 'fulfilled' ? _eT.value  : null;
      const _lT  = lupTtls[i];    const lupTtl   = _lT.status  === 'fulfilled' ? _lT.value  : null;
      const _rT  = repairTtls[i]; const repairTtl= _rT.status  === 'fulfilled' ? _rT.value  : null;

      if (repairTtl !== null && repairTtl > 0) activeRepairLocks++;

      const snapSev = expirySeverity(snapTtl === -2 ? 0 : snapTtl);
      if (snapSev === 'RED')   { snap4h++;  matchesAtRisk.push({ matchId: id, riskType: 'snapshot-expiry', severity: 'RED',    expiresInSec: snapTtl }); }
      else if (snapSev === 'YELLOW') { snap24h++; matchesAtRisk.push({ matchId: id, riskType: 'snapshot-expiry', severity: 'YELLOW', expiresInSec: snapTtl }); }

      if (drTtl === -2 || drTtl === null) { drAbsent++; matchesAtRisk.push({ matchId: id, riskType: 'dr-absent', severity: 'YELLOW', expiresInSec: null }); }

      if (evtTtl !== null && evtTtl !== -2) {
        const ev = expirySeverity(evtTtl);
        if (ev !== 'GREEN') { espnEvt24h++; matchesAtRisk.push({ matchId: id, riskType: 'espn-event-expiry', severity: ev, expiresInSec: evtTtl }); }
      }
      if (lupTtl === -2 || lupTtl === null) { espnLup0++; matchesAtRisk.push({ matchId: id, riskType: 'espn-lookup-absent', severity: 'YELLOW', expiresInSec: null }); }

      void home; void away;
    }

    if (snap4h  > 0) riskFactors.push({ factor: 'snapshots-expiring-4h',  severity: 'RED',    detail: `${snap4h} snapshot(s) expire within 4h.` });
    else if (snap24h > 0) riskFactors.push({ factor: 'snapshots-expiring-24h', severity: 'YELLOW', detail: `${snap24h} snapshot(s) expire within 24h.` });
    if (drAbsent > 0)  riskFactors.push({ factor: 'dr-snapshots-absent',  severity: 'YELLOW', detail: `${drAbsent} DR snapshot(s) absent.` });
    if (espnEvt24h > 0) riskFactors.push({ factor: 'espn-events-expiring', severity: 'YELLOW', detail: `${espnEvt24h} ESPN event cache(s) expiring.` });
    if (espnLup0 > 0)  riskFactors.push({ factor: 'espn-lookup-absent',   severity: 'YELLOW', detail: `${espnLup0} ESPN lookup(s) absent.` });
    if (activeRepairLocks >= 2) riskFactors.push({ factor: 'elevated-repair-frequency', severity: activeRepairLocks >= 5 ? 'RED' : 'YELLOW', detail: `${activeRepairLocks} active repair-locks.` });
  }

  // Archive trajectory
  const archive24h = archive30d.filter(r => r.ts >= now - 24 * 3_600_000);
  let trailing = 0;
  for (const rec of [...archive24h].reverse()) {
    if (rec.overall !== 'GREEN') trailing++;
    else break;
  }
  if (trailing >= 3) riskFactors.push({ factor: 'archive-trajectory-yellow', severity: trailing >= 5 ? 'RED' : 'YELLOW', detail: `${trailing} consecutive non-GREEN records.` });

  let riskLevel: RiskSeverity = 'GREEN';
  for (const f of riskFactors) riskLevel = maxSev(riskLevel, f.severity);

  const riskInput: PredictiveRiskInput = {
    riskLevel,
    riskFactors,
    matchesAtRisk,
    rateSafeMode: { active: rateSafeActive, expiresAt: rateSafe?.expiresAt ? new Date(rateSafe.expiresAt).toISOString() : null },
    repairFrequency: { activeRepairLocks },
  };

  // ── 3. Evaluate remediation plan (always dry-run in DATA-18P) ──────────────
  const plan = evaluateAutoRemediation(riskInput, true, now);

  // ── 4. Predict SLO breaches ────────────────────────────────────────────────
  const sloBreaches = predictSLOBreaches(archive30d, now);

  // ── 5. Incident lifecycle ──────────────────────────────────────────────────
  const repairRefs: RepairRef[] = repairs30d.map(r => ({
    ts:       r.ts,
    matchId:  r.matchId,
    action:   r.action,
    result:   r.result === 'dry-run' ? 'skipped' : r.result,
  }));

  const lifecycle = deriveLifecycle(archive30d, repairRefs, now);
  const openIncidents  = lifecycle.filter(i => i.state !== 'RESOLVED');
  const lifecycleStats = computeLifecycleStats(lifecycle);

  // ── 6. Repair telemetry ────────────────────────────────────────────────────
  const repairs24h    = repairs30d.filter(r => r.ts >= now - 24 * 3_600_000);
  const repairStats   = computeRepairTelemetry(repairs30d);

  // ── 7. Recommended action (top-priority) ──────────────────────────────────
  const topAction = plan.actions[0];

  return NextResponse.json(
    {
      featureEnabled:  AUTONOMOUS_RELIABILITY_ENABLED,
      checkedAt:       new Date(now).toISOString(),
      risk: {
        riskLevel,
        riskFactorCount: riskFactors.length,
        matchesAtRisk:   matchesAtRisk.length,
        riskFactors,
      },
      recommendedAction: topAction
        ? {
            action:     topAction.action,
            priority:   topAction.priority,
            reason:     topAction.reason,
            matchIds:   topAction.matchIds,
            confidence: topAction.confidence,
            execute:    plan.execute,
          }
        : null,
      dryRunPlan: {
        actions:       plan.actions,
        compositeRisk: plan.compositeRisk,
        escalations:   plan.escalations,
        execute:       plan.execute,
        note:          plan.note,
      },
      predictedBreaches: {
        scoreAccuracy24h:      sloBreaches.scoreAccuracy24h,
        authorityFreshness24h: sloBreaches.authorityFreshness24h,
        enrichmentCoverage24h: sloBreaches.enrichmentCoverage24h,
        anyPredictedBreach:    sloBreaches.anyPredictedBreach,
      },
      openIncidents,
      incidentStats: lifecycleStats,
      repairSuccessRate: {
        successRatePct: repairStats.successRatePct,
        total30d:       repairStats.total,
        total24h:       repairs24h.length,
        avgDurationMs:  repairStats.avgDurationMs,
        byAction:       repairStats.byAction,
      },
      note: AUTONOMOUS_RELIABILITY_ENABLED
        ? 'AUTONOMOUS_RELIABILITY_ENABLED=true — evaluation active.'
        : 'AUTONOMOUS_RELIABILITY_ENABLED=false (default) — dry-run mode. No actions execute.',
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
