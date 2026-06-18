/**
 * GET /api/debug/early-warning
 *
 * DATA-18N Phase 5 — Early Warning System.
 *
 * Synthesises:
 *   - predictive-risk signals (TTL expiry, rate-safe, repair locks)
 *   - health archive trend (24h / 7d / 30d)
 *   - SLO trajectory (enrichment rate, freshness rate)
 *   - incident history (open incidents, recent closures)
 *
 * Answers: "What is most likely to fail next?" with a confidence score.
 *
 * Read-only — no writes, no mutations, no enrichment.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import type { Match }                from '@/lib/types';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import { RATE_SAFE_KV_KEY }          from '@/lib/rate-safe';
import { readHealthRecords }         from '@/lib/health-archive';
import { deriveIncidents }           from '@/lib/incident';
import { computeSLO }                from '@/lib/slo-compliance';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FINISHED_FEED_KEY = 'goalradar:/competitions/WC/matches?status=FINISHED';
const SNAPSHOT_TTL_SEC  = 7 * 24 * 3_600;

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

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
// Warning types
// ---------------------------------------------------------------------------

type WarningSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface EarlyWarning {
  id:             string;
  component:      string;  // 'enrichment' | 'snapshot' | 'feed' | 'authority' | 'espn'
  riskType:       string;
  probability:    number;  // 0..1 — estimated P(failure within 24 h)
  timeToFailureH: number | null;  // estimated hours to failure; null = unknown
  confidence:     'low' | 'medium' | 'high';
  severity:       WarningSeverity;
  detail:         string;
  recommendation: string;
}

type TrendDirection = 'improving' | 'stable' | 'degrading' | 'insufficient-data';

interface TrendWindow {
  records:   number;
  redCount:  number;
  yellowCount: number;
  greenCount:  number;
  pctHealthy: number;
  enrichmentAvgUnenriched: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function probToConfidence(p: number): 'low' | 'medium' | 'high' {
  if (p >= 0.7) return 'high';
  if (p >= 0.4) return 'medium';
  return 'low';
}

function probToSeverity(p: number, leadTimeH: number | null): WarningSeverity {
  const urgent = leadTimeH !== null && leadTimeH <= 4;
  if (p >= 0.8 || (p >= 0.6 && urgent)) return 'CRITICAL';
  if (p >= 0.5 || (p >= 0.35 && urgent)) return 'HIGH';
  if (p >= 0.25) return 'MEDIUM';
  return 'LOW';
}

function trendDirection(windows: TrendWindow[]): TrendDirection {
  if (windows.length < 2) return 'insufficient-data';
  const first = windows[0].pctHealthy;
  const last  = windows[windows.length - 1].pctHealthy;
  const delta = last - first;
  if (delta > 5)  return 'improving';
  if (delta < -5) return 'degrading';
  return 'stable';
}

function windowStats(records: { overall: string; enrichment: { unenriched: number | null } }[]): TrendWindow {
  const n = records.length;
  if (n === 0) return { records: 0, redCount: 0, yellowCount: 0, greenCount: 0, pctHealthy: 100, enrichmentAvgUnenriched: null };

  const redCount    = records.filter(r => r.overall === 'RED').length;
  const yellowCount = records.filter(r => r.overall === 'YELLOW').length;
  const greenCount  = records.filter(r => r.overall === 'GREEN').length;
  const pctHealthy  = Math.round((greenCount / n) * 100);
  const unenrichedVals = records.map(r => r.enrichment.unenriched).filter(v => v !== null) as number[];
  const enrichmentAvgUnenriched = unenrichedVals.length > 0
    ? Math.round(unenrichedVals.reduce((a, b) => a + b, 0) / unenrichedVals.length * 10) / 10
    : null;

  return { records: n, redCount, yellowCount, greenCount, pctHealthy, enrichmentAvgUnenriched };
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
  const warnings: EarlyWarning[] = [];

  // ── 1. Parallel: read all inputs ─────────────────────────────────────────
  const [feedRes, rateSafeRes, archive30dRes] = await Promise.allSettled([
    kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY),
    kv.get<{ expiresAt: number }>(RATE_SAFE_KV_KEY),
    readHealthRecords(now - 30 * 24 * 3_600_000, now),
  ]);

  const feedEntry     = feedRes.status     === 'fulfilled' ? feedRes.value     : null;
  const rateSafeState = rateSafeRes.status === 'fulfilled' ? rateSafeRes.value : null;
  const archive30d    = archive30dRes.status === 'fulfilled' ? archive30dRes.value : [];

  const archive7d  = archive30d.filter(r => r.ts >= now - 7  * 24 * 3_600_000);
  const archive24h = archive30d.filter(r => r.ts >= now - 24 * 3_600_000);

  // ── 2. Trend windows ──────────────────────────────────────────────────────
  const trend30d = windowStats(archive30d);
  const trend7d  = windowStats(archive7d);
  const trend24h = windowStats(archive24h);

  const trendDirs: TrendDirection = trendDirection([trend30d, trend7d, trend24h]);

  // ── 3. Incident history ───────────────────────────────────────────────────
  const incidents30d = deriveIncidents(archive30d, now);
  const openIncidents  = incidents30d.filter(i => i.open);
  const redIncidents7d = incidents30d.filter(i => !i.open && i.severity === 'RED' && i.startedAt >= new Date(now - 7 * 24 * 3_600_000).toISOString());

  // ── 4. SLO trajectory ─────────────────────────────────────────────────────
  const slo30d = computeSLO(archive30d);
  const slo7d  = computeSLO(archive7d);

  const enrichSloFalling = slo30d.enrichment.compliancePct > slo7d.enrichment.compliancePct + 1;
  const freshSloFalling  = slo30d.freshness.compliancePct  > slo7d.freshness.compliancePct  + 1;

  // ── 5. Snapshot TTL analysis ───────────────────────────────────────────────
  const finishedMatches = (feedEntry?.data?.matches ?? []).filter(m => m.status === 'FINISHED');
  const finishedIds     = finishedMatches.map(m => m.id);

  let snapshotCount        = 0;
  let soonestExpiryH: number | null = null;

  if (finishedIds.length > 0) {
    const snapKeys = finishedIds.map(id => `goalradar:match:${id}`);
    const snapTtls = await Promise.allSettled(snapKeys.map(k => kv.ttl(k)));

    for (let i = 0; i < finishedIds.length; i++) {
      const _r  = snapTtls[i];
      const ttl = _r.status === 'fulfilled' ? _r.value : null;
      if (ttl !== null && ttl > 0 && ttl <= 24 * 3_600) {
        snapshotCount++;
        const h = Math.round(ttl / 3600 * 10) / 10;
        if (soonestExpiryH === null || h < soonestExpiryH) soonestExpiryH = h;
      }
    }
  }

  // ── 6. Rate-safe mode ─────────────────────────────────────────────────────
  const rateSafeActive = !!rateSafeState;
  if (rateSafeActive) {
    const expInH = rateSafeState?.expiresAt
      ? Math.round((rateSafeState.expiresAt - now) / 3_600_000 * 10) / 10
      : null;
    warnings.push({
      id:             'rate-safe-active',
      component:      'snapshot',
      riskType:       'provider-circuit-breaker',
      probability:    0.92,
      timeToFailureH: soonestExpiryH,
      confidence:     'high',
      severity:       'CRITICAL',
      detail:         `Rate-safe mode active — all provider refresh operations blocked. Expires in ${expInH ?? '?'}h. Snapshots expiring during this window will rebuild unenriched.`,
      recommendation: 'Wait for rate-safe to expire. If stuck: check football-data.org status, then manually clear `goalradar:rate-safe:active` from KV.',
    });
  }

  // ── 7. Snapshot expiry warning ────────────────────────────────────────────
  if (snapshotCount > 0) {
    const prob = rateSafeActive ? 0.85 : 0.20;
    warnings.push({
      id:             'snapshots-expiring',
      component:      'snapshot',
      riskType:       'ttl-expiry',
      probability:    prob,
      timeToFailureH: soonestExpiryH,
      confidence:     rateSafeActive ? 'high' : 'low',
      severity:       probToSeverity(prob, soonestExpiryH),
      detail:         `${snapshotCount} FINISHED snapshot(s) expire within 24 h (soonest: ${soonestExpiryH ?? '?'}h). On expiry: cold rebuild runs; if ESPN unavailable → goals=0.`,
      recommendation: 'Trigger prewarm orchestrator cron to reseed expiring snapshots. Check ESPN event caches are warm.',
    });
  }

  // ── 8. Open incident warning ──────────────────────────────────────────────
  if (openIncidents.length > 0) {
    const worst = openIncidents.find(i => i.severity === 'RED') ?? openIncidents[0];
    const durationH = Math.round(worst.durationMin / 60 * 10) / 10;
    warnings.push({
      id:             'open-incident',
      component:      'system',
      riskType:       'ongoing-incident',
      probability:    0.95,
      timeToFailureH: 0,
      confidence:     'high',
      severity:       worst.severity === 'RED' ? 'CRITICAL' : 'HIGH',
      detail:         `Open ${worst.severity} incident (${durationH}h duration): ${worst.rootCause}`,
      recommendation: worst.severity === 'RED'
        ? 'Immediate action required. Check enrichment-health, authority-drift, and integrity-audit.'
        : 'Monitor. Review incident-history endpoint for root cause.',
    });
  }

  // ── 9. SLO trajectory warnings ────────────────────────────────────────────
  if (enrichSloFalling && slo7d.enrichment.compliancePct < 97) {
    const gap = Math.round((slo30d.enrichment.compliancePct - slo7d.enrichment.compliancePct) * 10) / 10;
    warnings.push({
      id:             'enrichment-slo-falling',
      component:      'enrichment',
      riskType:       'slo-trajectory',
      probability:    0.45,
      timeToFailureH: null,
      confidence:     'medium',
      severity:       'HIGH',
      detail:         `Enrichment SLO falling: 30d=${slo30d.enrichment.compliancePct}% → 7d=${slo7d.enrichment.compliancePct}% (−${gap}pp). Target=95%.`,
      recommendation: 'Review enrichment-health for any unenriched matches. Check ESPN event cache ages.',
    });
  }

  if (freshSloFalling && slo7d.freshness.compliancePct < 97) {
    const gap = Math.round((slo30d.freshness.compliancePct - slo7d.freshness.compliancePct) * 10) / 10;
    warnings.push({
      id:             'freshness-slo-falling',
      component:      'authority',
      riskType:       'slo-trajectory',
      probability:    0.35,
      timeToFailureH: null,
      confidence:     'medium',
      severity:       'MEDIUM',
      detail:         `Freshness SLO falling: 30d=${slo30d.freshness.compliancePct}% → 7d=${slo7d.freshness.compliancePct}% (−${gap}pp). Target=99%.`,
      recommendation: 'Check orchestrator cron schedule. Authority cache should be warmed every 15 min.',
    });
  }

  // ── 10. Archive trajectory warning ───────────────────────────────────────
  // Count trailing non-GREEN from the most recent records
  let trailing = 0;
  for (const rec of [...archive24h].reverse()) {
    if (rec.overall !== 'GREEN') trailing++;
    else break;
  }

  if (trailing >= 3) {
    const prob = Math.min(0.9, 0.4 + trailing * 0.1);
    warnings.push({
      id:             'archive-trailing-degradation',
      component:      'system',
      riskType:       'trajectory',
      probability:    prob,
      timeToFailureH: null,
      confidence:     probToConfidence(prob),
      severity:       probToSeverity(prob, null),
      detail:         `${trailing} consecutive non-GREEN health records (24 h window) — persistent degradation not self-correcting.`,
      recommendation: 'Run worldcup-health and check which subsystems are non-GREEN. Likely requires manual orchestrator trigger.',
    });
  }

  // ── 11. Recent RED incident recurrence risk ────────────────────────────────
  if (redIncidents7d.length >= 2) {
    warnings.push({
      id:             'recurrent-red-incidents',
      component:      'system',
      riskType:       'recurrence',
      probability:    0.55,
      timeToFailureH: null,
      confidence:     'medium',
      severity:       'HIGH',
      detail:         `${redIncidents7d.length} resolved RED incidents in the last 7 days — recurring degradation pattern. Root causes: ${[...new Set(redIncidents7d.map(i => i.rootCause))].join('; ')}.`,
      recommendation: 'Root cause not fully resolved. Review incident-history for common root causes and address systemic issue.',
    });
  }

  // ── 12. Sort warnings by probability desc ────────────────────────────────
  warnings.sort((a, b) => b.probability - a.probability);

  const topWarning = warnings[0] ?? null;

  // ── 13. Overall early-warning level ─────────────────────────────────────
  const sevRank = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  const worstSev: WarningSeverity = warnings.reduce(
    (acc, w) => sevRank[w.severity] > sevRank[acc] ? w.severity : acc,
    'LOW' as WarningSeverity,
  );

  return NextResponse.json(
    {
      checkedAt:    new Date(now).toISOString(),
      overallLevel: worstSev,
      topRisk: topWarning ? {
        component:      topWarning.component,
        riskType:       topWarning.riskType,
        probability:    topWarning.probability,
        timeToFailureH: topWarning.timeToFailureH,
        confidence:     topWarning.confidence,
        recommendation: topWarning.recommendation,
      } : null,
      allWarnings: warnings,
      trend: {
        direction:        trendDirs,
        windows: {
          '24h': trend24h,
          '7d':  trend7d,
          '30d': trend30d,
        },
      },
      slo: {
        '30d': {
          enrichmentPct:  slo30d.enrichment.compliancePct,
          freshnessPct:   slo30d.freshness.compliancePct,
          scoreAccuracyPct: slo30d.scoreAccuracy.compliancePct,
          allMet:         slo30d.allMet,
        },
        '7d': {
          enrichmentPct:  slo7d.enrichment.compliancePct,
          freshnessPct:   slo7d.freshness.compliancePct,
          scoreAccuracyPct: slo7d.scoreAccuracy.compliancePct,
          allMet:         slo7d.allMet,
        },
      },
      incidents: {
        open:              openIncidents.length,
        resolvedRed7d:     redIncidents7d.length,
        totalArchived30d:  incidents30d.length,
      },
      note: warnings.length === 0
        ? 'No early warning signals detected. System on nominal trajectory.'
        : `${warnings.length} warning(s) active. Top risk: ${topWarning?.component ?? '?'} / ${topWarning?.riskType ?? '?'} (P=${topWarning?.probability ?? 0}).`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
