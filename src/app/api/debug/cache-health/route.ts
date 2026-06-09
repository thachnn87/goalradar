/**
 * GET /api/debug/cache-health
 *
 * Sprint PERF-3 Phase 8 — Cache coverage and seeding health.
 *
 * Returns aggregate KV freshness across all WC cache entries, the seeded
 * match-ID manifest written by prewarmWorldCup(), and a coverage percentage.
 *
 * Protected by ADMIN_SECRET (Bearer token).  Fails closed.
 *
 * Example response:
 *   {
 *     "fixturesSeeded":    true,
 *     "resultsSeeded":     true,
 *     "standingsSeeded":   true,
 *     "groupsSeeded":      true,
 *     "bracketSeeded":     true,
 *     "matchesSeeded":     104,
 *     "totalMatches":      104,
 *     "kvHitRate":         97,
 *     "cacheCoveragePercent": 100,
 *     "endpointSummary":   { "fresh": 5, "stale": 0, "missing": 0 },
 *     "generatedAt":       "2026-06-09T..."
 *   }
 *
 * Usage:
 *   curl -s -H "Authorization: Bearer <ADMIN_SECRET>" \
 *        https://goalradar.org/api/debug/cache-health | jq
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { getKVCacheStats }           from '@/lib/kv-cache';
import { SEEDED_IDS_KEY }            from '@/lib/prewarm/worldcup';

export const dynamic = 'force-dynamic';

// ─── auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth   = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return bearer === secret;
}

// ─── KV freshness helpers ─────────────────────────────────────────────────────

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

interface StandardKVEntry {
  data:       unknown;
  fetchedAt:  number;
  freshUntil: number;
}

type CacheState = 'fresh' | 'stale' | 'missing';

async function checkEntry(kvKey: string): Promise<CacheState> {
  if (!KV_ENABLED) return 'missing';
  try {
    const entry = await kv.get<StandardKVEntry>(kvKey);
    if (!entry) return 'missing';
    return Date.now() < entry.freshUntil ? 'fresh' : 'stale';
  } catch {
    return 'missing';
  }
}

// ─── handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kvStats = getKVCacheStats();

  // ── 1. Check standard WC endpoint keys ──────────────────────────────────
  const [
    fixturesState,
    resultsState,
    standingsState,
    allMatchesState,
  ] = await Promise.all([
    checkEntry('goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED'),
    checkEntry('goalradar:/competitions/WC/matches?status=FINISHED'),
    checkEntry('goalradar:/competitions/WC/standings'),
    checkEntry('goalradar:/competitions/WC/matches'),
  ]);

  const endpointStates = [fixturesState, resultsState, standingsState, allMatchesState];
  const freshCount   = endpointStates.filter((s) => s === 'fresh').length;
  const staleCount   = endpointStates.filter((s) => s === 'stale').length;
  const missingCount = endpointStates.filter((s) => s === 'missing').length;

  // ── 2. Read the seeded match-ID manifest ────────────────────────────────
  let seededIds: number[] = [];
  if (KV_ENABLED) {
    try {
      seededIds = (await kv.get<number[]>(SEEDED_IDS_KEY)) ?? [];
    } catch {
      // non-fatal
    }
  }

  // ── 3. Spot-check a sample of seeded match snapshots ────────────────────
  const SAMPLE_SIZE = Math.min(10, seededIds.length);
  const sample      = seededIds.slice(0, SAMPLE_SIZE);
  let sampleFresh   = 0;
  if (sample.length > 0) {
    const states = await Promise.all(
      sample.map((id) => checkEntry(`goalradar:match:${id}`)),
    );
    sampleFresh = states.filter((s) => s === 'fresh').length;
  }

  // ── 4. Coverage metrics ──────────────────────────────────────────────────
  const matchesSeeded      = seededIds.length;
  // Total WC matches: 104 (FIFA WC 2026 — 12 groups × 6 + 16 KO matches)
  const TOTAL_WC_MATCHES   = 104;
  const coveragePercent    = Math.round((matchesSeeded / TOTAL_WC_MATCHES) * 100);
  const snapshotSampleRate = SAMPLE_SIZE > 0
    ? Math.round((sampleFresh / SAMPLE_SIZE) * 100) : 0;

  return NextResponse.json({
    /** true when the fixtures endpoint KV key is fresh. */
    fixturesSeeded:   fixturesState  === 'fresh',
    /** true when the results endpoint KV key is fresh. */
    resultsSeeded:    resultsState   === 'fresh',
    /** true when the WC standings KV key is fresh. */
    standingsSeeded:  standingsState === 'fresh',
    /** true when group/standings data is fresh (same as standingsSeeded). */
    groupsSeeded:     standingsState === 'fresh',
    /** true when the bracket (all-matches) KV key is fresh. */
    bracketSeeded:    allMatchesState === 'fresh',

    /** Number of WC matches whose KV keys were written by the last prewarm run. */
    matchesSeeded,
    /** Expected total WC matches (104 for FIFA World Cup 2026). */
    totalMatches:     TOTAL_WC_MATCHES,

    /** In-process KV hit ratio (%) since last cold start. */
    kvHitRate:        kvStats.hitRatio,
    /** queueBypassedCount / total KV reads (provider queue bypassed). */
    queueBypassRate:  kvStats.total > 0
      ? Math.round((kvStats.queueBypassed / kvStats.total) * 100) : 0,

    /** matchesSeeded / totalMatches × 100 */
    cacheCoveragePercent: coveragePercent,

    /** Freshness of spot-checked snapshot entries (sample of 10). */
    snapshotSampleFreshPercent: snapshotSampleRate,

    /** Aggregate state of the 4 WC-level endpoint KV keys. */
    endpointSummary: {
      fresh:   freshCount,
      stale:   staleCount,
      missing: missingCount,
      total:   endpointStates.length,
    },

    kvEnabled:   KV_ENABLED,
    generatedAt: new Date().toISOString(),
  });
}
