/**
 * GET /api/debug/performance
 *
 * Per-process match page latency and cache metrics — the primary observability
 * endpoint for sprint PERF-1 (match page click latency).
 *
 * Goal: clicking any match page should render in <500 ms even if football-data
 * is rate-limited.  The score hero renders from getMatchDetail (KV SWR 60s/120s).
 * H2H and WC group sections stream in via Suspense after the snapshot resolves.
 *
 * Counters reset on cold start / process restart.
 *
 * Protected by ADMIN_SECRET (Bearer token).  Fails closed.
 *
 * Usage:
 *   curl -s -H "Authorization: Bearer <ADMIN_SECRET>" \
 *        https://goalradar.org/api/debug/performance | jq
 *
 * Example response:
 *   {
 *     "match": { "renders": 47, "avgMatchLatency": 12, "p95MatchLatency": 38,
 *                "kvHits": 41, "l1Hits": 4, "footballDataHits": 2, "cacheHitRate": 96,
 *                "goalMet": true, "retryCount": 0 },
 *     "rateLimiter": { "queueDepth": 0, "totalWaits": 2, "requestsLastMinute": 1 },
 *     "kv": { "hitRatioPercent": 94, "freshHits": 130, "staleHits": 20, "misses": 9 },
 *     "dataSources": { "kvHitRatioPercent": 96, "footballDataHits": 8, "goalMet": true },
 *     "generatedAt": "2026-06-09T..."
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMatchPerfStats }         from '@/lib/match-perf-tracker';
import { getKVCacheStats }           from '@/lib/kv-cache';
import { getDataSourceStats }        from '@/lib/data-source-tracker';
import { footballDataLimiter }       from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

// ─── auth ────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth   = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return bearer === secret;
}

// ─── handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const matchStats   = getMatchPerfStats();
  const kvStats      = getKVCacheStats();
  const dsStats      = getDataSourceStats();
  const rlSnapshot   = footballDataLimiter.getSnapshot();

  return NextResponse.json({
    /** Match page render performance (score-hero fast path via getMatchDetail). */
    match: {
      renders:           matchStats.renders,
      avgMatchLatency:   matchStats.avgMatchLatency,
      p95MatchLatency:   matchStats.p95MatchLatency,
      l1Hits:            matchStats.l1Hits,
      kvHits:            matchStats.kvHits,
      footballDataHits:  matchStats.footballDataHits,
      apiFootballHits:   matchStats.apiFootballHits,
      cacheHitRate:      matchStats.cacheHitRate,
      providerHitRate:   matchStats.providerHitRate,
      /** true when ≥90% of renders served from L1/KV (not provider). */
      goalMet:           matchStats.goalMet,
      retryCount:        matchStats.retryCount,
      recentLatencies:   matchStats.recentLatencies,
    },

    /** football-data.org rate-limiter state. */
    rateLimiter: {
      queueDepth:          rlSnapshot.queuedRequests,
      totalWaits:          rlSnapshot.totalWaits,
      requestsLastMinute:  rlSnapshot.requestsLastMinute,
      intervalMs:          rlSnapshot.intervalMs,
      lastRequestAt:       rlSnapshot.lastRequestAt,
    },

    /** L2 Vercel KV SWR cache (all endpoints, not just match). */
    kv: {
      freshHits:        kvStats.hits,
      staleHits:        kvStats.stale,
      misses:           kvStats.misses,
      disasters:        kvStats.disasters,
      hitRatioPercent:  kvStats.hitRatio,
      kvEnabled:        kvStats.kvEnabled,
    },

    /** Cross-tier data source attribution (from RATE-4 tracker). */
    dataSources: {
      kvHits:             dsStats.kvHits,
      snapshotHits:       dsStats.snapshotHits,
      footballDataHits:   dsStats.footballDataHits,
      apiFootballHits:    dsStats.apiFootballHits,
      kvTotal:            dsStats.kvTotal,
      providerTotal:      dsStats.providerTotal,
      kvHitRatioPercent:  dsStats.kvHitRatioPercent,
      goalMet:            dsStats.goalMet,
    },

    generatedAt: new Date().toISOString(),
  });
}
