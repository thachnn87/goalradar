/**
 * GET /api/debug/data-sources
 *
 * Returns per-process data-source hit counters so operators can verify that
 * >90% of page requests are served from KV or Snapshot (goal of sprint RATE-4).
 *
 * Counters reset on cold start / process restart.
 *
 * Protected by ADMIN_SECRET (Bearer token).
 * Fails closed: if ADMIN_SECRET is not configured, all requests are denied.
 *
 * Usage:
 *   curl -s -H "Authorization: Bearer <ADMIN_SECRET>" \
 *        https://goalradar.org/api/debug/data-sources | jq
 *
 * Example response:
 *   {
 *     "kvHits": 142,
 *     "snapshotHits": 37,
 *     "footballDataHits": 8,
 *     "apiFootballHits": 0,
 *     "kvTotal": 179,
 *     "providerTotal": 8,
 *     "total": 187,
 *     "kvHitRatioPercent": 96,
 *     "goalMet": true,
 *     "generatedAt": "2026-06-09T10:30:00.000Z"
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataSourceStats }        from '@/lib/data-source-tracker';
import { getKVCacheStats }           from '@/lib/kv-cache';

export const dynamic = 'force-dynamic';

// ─── auth ────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false; // fail closed — no secret = no access

  const auth   = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return bearer === secret;
}

// ─── handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats   = getDataSourceStats();
  const kvStats = getKVCacheStats();

  return NextResponse.json({
    ...stats,
    // Also surface raw KV-layer breakdown (FRESH vs STALE vs MISS)
    kv: {
      freshHits:    kvStats.hits,
      staleHits:    kvStats.stale,
      misses:       kvStats.misses,
      disasters:    kvStats.disasters,
      hitRatioPercent: kvStats.hitRatio,
      kvEnabled:    kvStats.kvEnabled,
    },
    generatedAt: new Date().toISOString(),
  });
}
