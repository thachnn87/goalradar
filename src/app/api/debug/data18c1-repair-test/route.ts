/**
 * GET /api/debug/data18c1-repair-test
 *
 * DATA-18C.1 controlled rebuild test for exactly 3 poisoned snapshots.
 *
 * Actions:
 *   ?action=export&id=<matchId>        — read current snapshot, DR, KV detail (no side effects)
 *   ?action=rebuild-test&id=<matchId>  — delete primary snapshot, trigger rebuild, return diff
 *
 * Allowed match IDs: 537351, 537391, 537397 (the 3 test subjects from DATA-18C.1)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 * READ-ONLY for 'export'. One primary KV key deleted for 'rebuild-test'.
 * DR snapshot is NEVER touched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { getOrBuildMatchSnapshot }   from '@/lib/match-snapshot';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import type { MatchDetail }          from '@/lib/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Safety: only these 3 matches are permitted for the controlled test
// ---------------------------------------------------------------------------

const ALLOWED_IDS = new Set(['537351', '537391', '537397']);

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
// KV helpers
// ---------------------------------------------------------------------------

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

function ageHours(ts: number | undefined): number | null {
  if (!ts) return null;
  return Math.round((Date.now() - ts) / 360_000) / 10;
}

function snapshotSummary(s: MatchSnapshot | null, label: string) {
  if (!s) return { [label]: null };
  return {
    [label]: {
      status:        s.match.status,
      scoreHome:     s.match.score?.fullTime?.home ?? null,
      scoreAway:     s.match.score?.fullTime?.away ?? null,
      goals:         s.match.goals?.length ?? 0,
      goalScorers:   (s.match.goals ?? []).map(g => `${g.minute ?? '?'}' ${g.scorer?.name ?? '?'}`),
      cards:         s.match.bookings?.length ?? 0,
      subs:          s.match.substitutions?.length ?? 0,
      hasLineup:     !!(s.match.lineups?.home?.players?.length),
      generatedAt:   new Date(s.generatedAt).toISOString(),
      ageHours:      ageHours(s.generatedAt),
    },
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url    = new URL(req.url);
  const id     = url.searchParams.get('id') ?? '';
  const action = url.searchParams.get('action') ?? 'export';

  if (!ALLOWED_IDS.has(id)) {
    return NextResponse.json({
      error: `id must be one of: ${[...ALLOWED_IDS].join(', ')}`,
    }, { status: 400 });
  }

  if (action !== 'export' && action !== 'rebuild-test') {
    return NextResponse.json({
      error: 'action must be "export" or "rebuild-test"',
    }, { status: 400 });
  }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const t0 = Date.now();

  // ── Read pre-state ────────────────────────────────────────────────────────

  const [prePrimary, preDr, preDetail] = await Promise.all([
    kv.get<MatchSnapshot>(`goalradar:match:${id}`),
    kv.get<MatchSnapshot>(`goalradar:dr:match:${id}`),
    kv.get<KVEntry<MatchDetail>>(`goalradar:/matches/${id}`),
  ]);

  const preDetailSummary = preDetail ? {
    exists:    true,
    ageHours:  ageHours(preDetail.fetchedAt),
    freshUntil:preDetail.freshUntil,
    isFresh:   preDetail.freshUntil > Date.now(),
    status:    preDetail.data?.status ?? null,
    scoreHome: preDetail.data?.score?.fullTime?.home ?? null,
    scoreAway: preDetail.data?.score?.fullTime?.away ?? null,
    goals:     preDetail.data?.goals?.length ?? 0,
    hasGoalsData: (preDetail.data?.goals?.length ?? 0) > 0,
  } : { exists: false };

  if (action === 'export') {
    return NextResponse.json({
      matchId:      id,
      action:       'export',
      capturedAt:   new Date(t0).toISOString(),
      kvDetail:     preDetailSummary,
      ...snapshotSummary(prePrimary, 'primarySnapshot'),
      ...snapshotSummary(preDr, 'drSnapshot'),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // ── action === 'rebuild-test' ─────────────────────────────────────────────

  // Step 1: delete primary snapshot only — DR is untouched
  await kv.del(`goalradar:match:${id}`);
  console.log(`[DATA-18C.1] DELETED primary snapshot for match:${id}`);

  // Step 2: verify deletion
  const afterDelete = await kv.get<MatchSnapshot>(`goalradar:match:${id}`);
  if (afterDelete) {
    return NextResponse.json({
      error: 'Primary snapshot deletion failed — key still present',
      matchId: id,
    }, { status: 500 });
  }

  // Step 3: trigger rebuild via getOrBuildMatchSnapshot
  // This will: readKVSnapshot (miss) → buildSnapshot → readMatchDetailFromKV → (KV hit or provider)
  let rebuilt: MatchSnapshot;
  let rebuildError: string | null = null;
  const t1 = Date.now();

  try {
    rebuilt = await getOrBuildMatchSnapshot(id);
  } catch (err) {
    rebuildError = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      matchId:      id,
      action:       'rebuild-test',
      capturedAt:   new Date(t0).toISOString(),
      kvDetail:     preDetailSummary,
      before:       snapshotSummary(prePrimary, 'primarySnapshot'),
      rebuildError,
    }, { status: 500 });
  }

  const rebuildMs = Date.now() - t1;

  // Step 4: read what was written back to KV after rebuild
  const postPrimary = await kv.get<MatchSnapshot>(`goalradar:match:${id}`);
  const postDr      = await kv.get<MatchSnapshot>(`goalradar:dr:match:${id}`);

  // Step 5: determine enrichment source
  const enrichmentSource = determineEnrichmentSource(rebuilt, preDetail?.data ?? null);

  return NextResponse.json({
    matchId:          id,
    action:           'rebuild-test',
    capturedAt:       new Date(t0).toISOString(),
    rebuildMs,
    kvDetail:         preDetailSummary,
    enrichmentSource,
    before: {
      ...snapshotSummary(prePrimary, 'primarySnapshot'),
      ...snapshotSummary(preDr, 'drSnapshot'),
    },
    after: {
      ...snapshotSummary(rebuilt, 'rebuiltSnapshot'),
      ...snapshotSummary(postPrimary, 'primarySnapshot'),
      ...snapshotSummary(postDr, 'drSnapshot'),
    },
    verdict: {
      goalsRecovered:   (rebuilt.match.goals?.length ?? 0) > 0,
      cardsRecovered:   (rebuilt.match.bookings?.length ?? 0) > 0,
      subsRecovered:    (rebuilt.match.substitutions?.length ?? 0) > 0,
      lineupRecovered:  !!(rebuilt.match.lineups?.home?.players?.length),
      enrichmentSource,
      rebuildMs,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ---------------------------------------------------------------------------
// Determine where enriched data came from
// ---------------------------------------------------------------------------

function determineEnrichmentSource(
  rebuilt:     MatchSnapshot,
  preDetail:   MatchDetail | null,
): string {
  const newGoals = rebuilt.match.goals?.length ?? 0;

  if (newGoals === 0) {
    return 'none — no goals recovered';
  }

  // If pre-existing KV detail had goals → source is KV detail cache
  if ((preDetail?.goals?.length ?? 0) > 0) {
    return 'kv-detail-cache (FD match detail was cached with goals)';
  }

  // If KV detail was missing or had no goals, goals came from:
  //   a) fresh FD API call (/matches/{id})
  //   b) AF enrichment
  //   c) ESPN enrichment
  // We distinguish via goal scorer format — FD goals have team info,
  // AF goals may have different structure.
  // Heuristic: if goals are present AND kvDetail had no goals → provider was called.
  if (!preDetail || (preDetail.goals?.length ?? 0) === 0) {
    // Check if there are minute markers (FD includes them)
    const firstGoal = rebuilt.match.goals?.[0];
    if (firstGoal?.minute !== undefined && firstGoal?.minute !== null) {
      return 'fd-provider (FD /matches/{id} called live — returned goals with minute markers)';
    }
    return 'af-or-espn-enrichment (goals present without FD minute markers)';
  }

  return 'unknown';
}
