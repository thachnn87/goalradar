/**
 * DATA-18D.2 Phase 5 — Simulation Test
 *
 * Deletes primary snapshot + DR snapshot + AF events cache for target matches,
 * then rebuilds via getOrBuildMatchSnapshot() and verifies enrichment is applied.
 *
 * Usage:
 *   GET /api/debug/data18d2-simulation?secret=<CRON_SECRET>
 *   GET /api/debug/data18d2-simulation?secret=<CRON_SECRET>&matchId=537351
 *   GET /api/debug/data18d2-simulation?secret=<CRON_SECRET>&dryRun=true
 *
 * Default targets: 537351, 537391, 537392, 537397 (highest-value benchmark matches)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { getOrBuildMatchSnapshot }   from '@/lib/match-snapshot';
import { afEventsKvKey }             from '@/lib/af-id-map';

export const maxDuration = 300;

const DEFAULT_MATCH_IDS = [537351, 537391, 537392, 537397];

function snapshotKvKey(matchId: number): string {
  return `goalradar:match:${matchId}`;
}
function snapshotDRKey(matchId: number): string {
  return `goalradar:dr:match:${matchId}`;
}

interface SimResult {
  matchId:     number;
  status:      'pass' | 'fail' | 'skip';
  score:       string;
  goalsBefore: number | null;
  goalsAfter:  number;
  cardsBefore: number | null;
  cardsAfter:  number;
  subsBefore:  number | null;
  subsAfter:   number;
  lineupBefore: boolean | null;
  lineupAfter:  boolean;
  enrichedAfter: boolean;
  rebuildMs:   number;
  deletedKeys: string[];
  notes:       string[];
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dryRun  = req.nextUrl.searchParams.get('dryRun') === 'true';
  const idParam = req.nextUrl.searchParams.get('matchId');
  const matchIds = idParam
    ? [parseInt(idParam, 10)]
    : DEFAULT_MATCH_IDS;

  const results: SimResult[] = [];

  for (const matchId of matchIds) {
    const notes: string[] = [];
    const deletedKeys: string[] = [];

    // 1. Capture pre-state
    const [primaryBefore, drBefore] = await Promise.all([
      kv.get<{ match: { score?: { fullTime?: { home?: number; away?: number } }; goals?: unknown[]; bookings?: unknown[]; substitutions?: unknown[]; lineups?: { home?: { players?: unknown[] }; away?: { players?: unknown[] } } } }>(snapshotKvKey(matchId)).catch(() => null),
      kv.get<{ match: { goals?: unknown[] } }>(snapshotDRKey(matchId)).catch(() => null),
    ]);

    const score = primaryBefore
      ? `${primaryBefore.match.score?.fullTime?.home ?? '?'}-${primaryBefore.match.score?.fullTime?.away ?? '?'}`
      : 'unknown';
    const goalsBefore = primaryBefore ? (primaryBefore.match.goals?.length ?? 0) : null;
    const cardsBefore = primaryBefore ? (primaryBefore.match.bookings?.length ?? 0) : null;
    const subsBefore  = primaryBefore ? (primaryBefore.match.substitutions?.length ?? 0) : null;
    const lineupBefore = primaryBefore
      ? (primaryBefore.match.lineups?.home?.players?.length ?? 0) > 0
      : null;

    if (!primaryBefore) {
      notes.push('primary snapshot was already missing before simulation');
    }
    if (!drBefore) {
      notes.push('DR snapshot was already missing before simulation');
    }
    if (drBefore && (drBefore.match.goals?.length ?? 0) === 0 && primaryBefore) {
      const ftH = primaryBefore.match.score?.fullTime?.home ?? 0;
      const ftA = primaryBefore.match.score?.fullTime?.away ?? 0;
      if (ftH + ftA > 0) {
        notes.push('DR was already poisoned (score>0 but goals=0) before simulation');
      }
    }

    if (dryRun) {
      results.push({
        matchId,
        status:       'skip',
        score,
        goalsBefore,
        goalsAfter:   goalsBefore ?? 0,
        cardsBefore,
        cardsAfter:   cardsBefore ?? 0,
        subsBefore,
        subsAfter:    subsBefore ?? 0,
        lineupBefore,
        lineupAfter:  lineupBefore ?? false,
        enrichedAfter: false,
        rebuildMs:    0,
        deletedKeys:  [],
        notes:        ['dry-run — no keys deleted', ...notes],
      });
      continue;
    }

    // 2. Delete primary + DR + AF events cache
    const primaryKey = snapshotKvKey(matchId);
    const drKey      = snapshotDRKey(matchId);
    const afKey      = afEventsKvKey(matchId);

    await Promise.all([
      kv.del(primaryKey).then(() => deletedKeys.push(primaryKey)).catch(() => notes.push(`del ${primaryKey} failed`)),
      kv.del(drKey).then(() => deletedKeys.push(drKey)).catch(() => notes.push(`del ${drKey} failed`)),
      kv.del(afKey).then(() => deletedKeys.push(afKey)).catch(() => notes.push(`del ${afKey} failed`)),
    ]);

    // 3. Rebuild via full path (triggers enrichMatchWithAFEvents from scratch)
    const t0 = Date.now();
    let snap: Awaited<ReturnType<typeof getOrBuildMatchSnapshot>> | null = null;
    try {
      snap = await getOrBuildMatchSnapshot(String(matchId));
    } catch (err) {
      notes.push(`rebuild error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const rebuildMs = Date.now() - t0;

    // 4. Assess result
    const goalsAfter  = snap ? (snap.match.goals?.length ?? 0) : 0;
    const cardsAfter  = snap ? (snap.match.bookings?.length ?? 0) : 0;
    const subsAfter   = snap ? (snap.match.substitutions?.length ?? 0) : 0;
    const lineupAfter = snap
      ? (snap.match.lineups?.home?.players?.length ?? 0) > 0
      : false;
    const enrichedAfter = snap ? (snap.match as { enrichmentApplied?: boolean }).enrichmentApplied === true : false;

    const ftH = snap?.match.score?.fullTime?.home ?? 0;
    const ftA = snap?.match.score?.fullTime?.away ?? 0;
    const scored = ftH + ftA > 0;

    const pass = scored
      ? goalsAfter > 0 && lineupAfter
      : true; // 0-0 match doesn't need goal events

    if (scored && goalsAfter === 0) notes.push('FAIL: goals still 0 after rebuild — AF enrichment may be unavailable');
    if (scored && !lineupAfter)     notes.push('WARN: lineup still missing after rebuild');

    results.push({
      matchId,
      status:       pass ? 'pass' : 'fail',
      score,
      goalsBefore,
      goalsAfter,
      cardsBefore,
      cardsAfter,
      subsBefore,
      subsAfter,
      lineupBefore,
      lineupAfter,
      enrichedAfter,
      rebuildMs,
      deletedKeys,
      notes,
    });
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;

  return NextResponse.json({
    verdict:   failed === 0 && !dryRun ? 'PASS' : dryRun ? 'DRY_RUN' : 'FAIL',
    passed,
    failed,
    total:     matchIds.length,
    dryRun,
    results,
  });
}
