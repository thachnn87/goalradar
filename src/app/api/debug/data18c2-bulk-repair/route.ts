/**
 * GET /api/debug/data18c2-bulk-repair
 *
 * DATA-18C.2 repair endpoint — Phases 1 and 2.
 *
 * Actions:
 *   ?action=test&id=<matchId>   — Phase 1: test single match rebuild (any poisoned ID)
 *   ?action=bulk-export         — Phase 2 pre-state: read all 18 without modification
 *   ?action=bulk-repair         — Phase 2: delete primary+DR, rebuild all 18 poisoned matches
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { getOrBuildMatchSnapshot }   from '@/lib/match-snapshot';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import type { MatchDetail }          from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// All 18 poisoned match IDs from DATA-18C.0 (537369=0-0 ok, 537398=healthy excluded)
// ---------------------------------------------------------------------------

const POISONED_IDS = [
  537327, 537328, 537333, 537334, 537339, 537340, 537345, 537346,
  537351, 537352, 537357, 537358, 537363, 537364, 537370,
  537391, 537392, 537397,
] as const;

const POISONED_SET = new Set(POISONED_IDS.map(String));

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
// Helpers
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

function snapSummary(s: MatchSnapshot | null) {
  if (!s) return null;
  return {
    status:      s.match.status,
    scoreHome:   s.match.score?.fullTime?.home ?? null,
    scoreAway:   s.match.score?.fullTime?.away ?? null,
    goals:       s.match.goals?.length ?? 0,
    cards:       s.match.bookings?.length ?? 0,
    subs:        s.match.substitutions?.length ?? 0,
    hasLineup:   !!(s.match.lineups?.home?.players?.length),
    generatedAt: new Date(s.generatedAt).toISOString(),
    ageHours:    ageHours(s.generatedAt),
  };
}

function kvDetailSummary(e: KVEntry<MatchDetail> | null) {
  if (!e) return { exists: false };
  return {
    exists:       true,
    ageHours:     ageHours(e.fetchedAt),
    isFresh:      e.freshUntil > Date.now(),
    status:       e.data?.status ?? null,
    scoreHome:    e.data?.score?.fullTime?.home ?? null,
    scoreAway:    e.data?.score?.fullTime?.away ?? null,
    goals:        e.data?.goals?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url    = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'bulk-export';
  const id     = url.searchParams.get('id') ?? '';

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  // ── action=test ─────────────────────────────────────────────────────────────
  if (action === 'test') {
    if (!POISONED_SET.has(id)) {
      return NextResponse.json({
        error: `id must be one of the 18 poisoned match IDs`,
        poisonedIds: [...POISONED_IDS],
      }, { status: 400 });
    }
    return runSingleTest(id);
  }

  // ── action=bulk-export ───────────────────────────────────────────────────────
  if (action === 'bulk-export') {
    return runBulkExport();
  }

  // ── action=bulk-repair ──────────────────────────────────────────────────────
  if (action === 'bulk-repair') {
    return runBulkRepair();
  }

  return NextResponse.json({
    error: 'action must be "test", "bulk-export", or "bulk-repair"',
  }, { status: 400 });
}

// ---------------------------------------------------------------------------
// Single match test (Phase 1 expansion)
// ---------------------------------------------------------------------------

async function runSingleTest(id: string): Promise<NextResponse> {
  const t0 = Date.now();

  const [prePrimary, preDr, preDetail] = await Promise.all([
    kv.get<MatchSnapshot>(`goalradar:match:${id}`),
    kv.get<MatchSnapshot>(`goalradar:dr:match:${id}`),
    kv.get<KVEntry<MatchDetail>>(`goalradar:/matches/${id}`),
  ]);

  // Delete primary (DR untouched)
  await kv.del(`goalradar:match:${id}`);

  // Verify deletion
  const afterDelete = await kv.get<MatchSnapshot>(`goalradar:match:${id}`);
  if (afterDelete) {
    return NextResponse.json({ error: 'Primary deletion failed', matchId: id }, { status: 500 });
  }

  // Rebuild
  let rebuilt: MatchSnapshot;
  const t1 = Date.now();
  try {
    rebuilt = await getOrBuildMatchSnapshot(id);
  } catch (err) {
    return NextResponse.json({
      matchId: id,
      error:   err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }

  return NextResponse.json({
    matchId:    id,
    action:     'test',
    capturedAt: new Date(t0).toISOString(),
    rebuildMs:  Date.now() - t1,
    kvDetail:   kvDetailSummary(preDetail),
    before: {
      primary: snapSummary(prePrimary),
      dr:      snapSummary(preDr),
    },
    after: {
      rebuilt: snapSummary(rebuilt),
    },
    verdict: {
      goalsRecovered:  (rebuilt.match.goals?.length ?? 0) > 0,
      subsRecovered:   (rebuilt.match.substitutions?.length ?? 0) > 0,
      lineupRecovered: !!(rebuilt.match.lineups?.home?.players?.length),
      cardsRecovered:  (rebuilt.match.bookings?.length ?? 0) > 0,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ---------------------------------------------------------------------------
// Bulk export (Phase 2 pre-state, no side effects)
// ---------------------------------------------------------------------------

async function runBulkExport(): Promise<NextResponse> {
  const capturedAt = new Date().toISOString();

  const results = await Promise.all(
    POISONED_IDS.map(async (numId) => {
      const id = String(numId);
      const [primary, dr] = await Promise.all([
        kv.get<MatchSnapshot>(`goalradar:match:${id}`),
        kv.get<MatchSnapshot>(`goalradar:dr:match:${id}`),
      ]);
      return {
        matchId:  numId,
        primary:  snapSummary(primary),
        dr:       snapSummary(dr),
      };
    }),
  );

  const stillPoisoned = results.filter(
    r => r.primary !== null &&
         (r.primary.scoreHome ?? 0) + (r.primary.scoreAway ?? 0) > 0 &&
         r.primary.goals === 0,
  );

  return NextResponse.json({
    capturedAt,
    total:         POISONED_IDS.length,
    stillPoisoned: stillPoisoned.length,
    alreadyRepaired: POISONED_IDS.length - stillPoisoned.length,
    matches:       results,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ---------------------------------------------------------------------------
// Bulk repair (Phase 2 — delete primary+DR, rebuild all 18)
// ---------------------------------------------------------------------------

interface RepairResult {
  matchId:       number;
  status:        'repaired' | 'failed' | 'skipped';
  goalsAfter:    number;
  cardsAfter:    number;
  subsAfter:     number;
  lineupAfter:   boolean;
  rebuildMs:     number;
  error?:        string;
}

async function runBulkRepair(): Promise<NextResponse> {
  const t0         = Date.now();
  const capturedAt = new Date(t0).toISOString();
  const results: RepairResult[] = [];

  // Process in batches of 3 to avoid overwhelming AF enrichment API
  for (let i = 0; i < POISONED_IDS.length; i += 3) {
    const batch = POISONED_IDS.slice(i, i + 3);

    const batchResults = await Promise.all(
      batch.map(async (numId): Promise<RepairResult> => {
        const id = String(numId);
        const t1 = Date.now();

        try {
          // Delete both primary AND DR for clean state
          await Promise.all([
            kv.del(`goalradar:match:${id}`),
            kv.del(`goalradar:dr:match:${id}`),
          ]);

          // Rebuild from FD detail + AF enrichment
          const rebuilt = await getOrBuildMatchSnapshot(id);
          const goals   = rebuilt.match.goals?.length ?? 0;

          return {
            matchId:     numId,
            status:      goals > 0 ? 'repaired' : 'failed',
            goalsAfter:  goals,
            cardsAfter:  rebuilt.match.bookings?.length ?? 0,
            subsAfter:   rebuilt.match.substitutions?.length ?? 0,
            lineupAfter: !!(rebuilt.match.lineups?.home?.players?.length),
            rebuildMs:   Date.now() - t1,
          };
        } catch (err) {
          return {
            matchId:   numId,
            status:    'failed',
            goalsAfter:  0,
            cardsAfter:  0,
            subsAfter:   0,
            lineupAfter: false,
            rebuildMs:  Date.now() - t1,
            error:     err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );

    results.push(...batchResults);
  }

  const repaired  = results.filter(r => r.status === 'repaired');
  const failed    = results.filter(r => r.status === 'failed');

  return NextResponse.json({
    capturedAt,
    totalMs:    Date.now() - t0,
    total:      POISONED_IDS.length,
    repaired:   repaired.length,
    failed:     failed.length,
    verdict:    failed.length === 0 ? 'ALL_REPAIRED' : 'PARTIAL',
    results,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
