/**
 * GET /api/debug/data18d-stability
 *
 * DATA-18D Phase 4 — 24-hour stability audit endpoint.
 *
 * Collects:
 *   - Authority cache telemetry (hits, DR hits, cold rebuilds)
 *   - Enrichment health (unenriched count)
 *   - Authority cache KV state (primary + DR presence, age, ttlTier)
 *   - authority-compare gate verdict (4 benchmarks)
 *
 * Run this endpoint at:
 *   T+0h  (canary activation)
 *   T+6h
 *   T+12h
 *   T+18h
 *   T+24h (final audit)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/data18d-stability?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import type { Match }                from '@/lib/types';
import type { AuthorityCacheEnvelope } from '@/lib/authority-cache';

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

const AUTHORITY_KEY    = 'goalradar:wc:authority:v1';
const AUTHORITY_DR_KEY = 'goalradar:dr:wc:authority:v1';
const FINISHED_FEED_KEY = 'goalradar:/competitions/WC/matches?status=FINISHED';

const BENCHMARK_IDS = [537397, 537392, 537391, 537351] as const;

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now         = Date.now();
  const checkedAt   = new Date(now).toISOString();

  // ── 1. Authority cache telemetry ──────────────────────────────────────────
  let telemetry: Record<string, number> | null = null;
  try {
    const { getAuthorityTelemetry } = await import('@/lib/authority-cache');
    telemetry = getAuthorityTelemetry();
  } catch { /* non-fatal */ }

  // ── 2. Authority cache KV state ───────────────────────────────────────────
  const [primaryRaw, drRaw] = await Promise.allSettled([
    kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY),
    kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY),
  ]);

  const primary = primaryRaw.status === 'fulfilled' ? primaryRaw.value : null;
  const dr      = drRaw.status      === 'fulfilled' ? drRaw.value      : null;

  const primaryAgeMs  = primary ? now - new Date(primary.builtAt).getTime() : null;
  const drAgeMs       = dr      ? now - new Date(dr.builtAt).getTime()       : null;

  const cacheState = {
    primaryPresent:  primary !== null,
    primaryBuiltAt:  primary?.builtAt ?? null,
    primaryAgeMin:   primaryAgeMs !== null ? Math.round(primaryAgeMs / 60_000) : null,
    primaryMatchCount: primary?.matchCount ?? null,
    primaryLiveCount:  primary?.liveCount  ?? null,
    primaryTtlTier:    primary?.ttlTier    ?? null,
    drPresent:       dr !== null,
    drBuiltAt:       dr?.builtAt ?? null,
    drAgeHours:      drAgeMs !== null ? Math.round(drAgeMs / 3_600_000 * 10) / 10 : null,
  };

  // ── 3. Benchmark snapshot health (4 matches) ──────────────────────────────
  const snapshots = await Promise.allSettled(
    BENCHMARK_IDS.map((id) => kv.get<MatchSnapshot>(`goalradar:match:${id}`)),
  );

  const benchmarks = BENCHMARK_IDS.map((id, i) => {
    const res  = snapshots[i];
    const snap = res.status === 'fulfilled' ? res.value : null;
    if (!snap) return { matchId: id, present: false, goals: null, poisoned: null };
    const h     = snap.match.score?.fullTime?.home ?? 0;
    const a     = snap.match.score?.fullTime?.away ?? 0;
    const goals = snap.match.goals?.length ?? 0;
    return {
      matchId:  id,
      present:  true,
      goals,
      score:    `${h}–${a}`,
      poisoned: (h + a > 0 && goals === 0),
      ageHours: Math.round((now - snap.generatedAt) / 3_600_000 * 10) / 10,
    };
  });

  const poisonedCount = benchmarks.filter((b) => b.poisoned === true).length;

  // ── 4. Enrichment health (from FINISHED feed) ─────────────────────────────
  let enrichmentSummary: { total: number; ok: number; unenriched: number; noSnapshot: number } | null = null;
  try {
    const feedEntry = await kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY);
    if (feedEntry) {
      const finished  = (feedEntry.data?.matches ?? []).filter((m) => m.status === 'FINISHED');
      const snaps     = await Promise.allSettled(
        finished.map((m) => kv.get<MatchSnapshot>(`goalradar:match:${m.id}`)),
      );
      let ok = 0, unenriched = 0, noSnapshot = 0;
      for (let i = 0; i < finished.length; i++) {
        const res  = snaps[i];
        const snap = res.status === 'fulfilled' ? res.value : null;
        if (!snap) { noSnapshot++; continue; }
        const h = snap.match.score?.fullTime?.home ?? 0;
        const a = snap.match.score?.fullTime?.away ?? 0;
        const g = snap.match.goals?.length ?? 0;
        if (h + a > 0 && g === 0) unenriched++;
        else ok++;
      }
      enrichmentSummary = { total: finished.length, ok, unenriched, noSnapshot };
    }
  } catch { /* non-fatal */ }

  // ── 5. Gate verdict ────────────────────────────────────────────────────────
  const cacheHitRate = telemetry && (telemetry.hits + telemetry.drHits + telemetry.coldRebuilds) > 0
    ? Math.round(
        (telemetry.hits / (telemetry.hits + telemetry.drHits + telemetry.coldRebuilds)) * 1000,
      ) / 10
    : null;

  const gate: 'GREEN' | 'YELLOW' | 'RED' =
    poisonedCount > 0 ? 'RED'
    : enrichmentSummary && enrichmentSummary.unenriched > 0 ? 'RED'
    : !cacheState.primaryPresent ? 'YELLOW'
    : 'GREEN';

  return NextResponse.json({
    checkedAt,
    canaryEnabled:   process.env.AUTHORITY_RESULTS_ONLY === 'true',
    gate,
    telemetry,
    cacheHitRate,
    cacheState,
    benchmarkSnapshots: benchmarks,
    poisonedCount,
    enrichmentHealth: enrichmentSummary,
    notes: {
      cacheHitRateTarget: '> 90%',
      poisonedTarget:     '= 0',
      unenrichedTarget:   '= 0',
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
