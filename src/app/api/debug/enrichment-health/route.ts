/**
 * GET /api/debug/enrichment-health
 *
 * DATA-16 Objective 3: scan all finished WC 2026 matches for unenriched snapshots.
 *
 * For each match where score > 0 and goals.length === 0, reports:
 *   matchId, score, goalsCount, snapshotAge, enrichmentStatus
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 *
 * Example:
 *   curl "https://goalradar.org/api/debug/enrichment-health?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import type { MatchSnapshot }        from '@/lib/match-snapshot';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

// All finished WC 2026 match IDs — updated as the tournament progresses.
const WC_FINISHED_IDS = [
  537327, 537328, 537333, 537334, 537339, 537340, 537345, 537346,
  537351, 537352, 537357, 537358, 537363, 537364, 537369, 537370,
  537391, 537392, 537397, 537398,
];

interface MatchHealth {
  matchId:          number;
  home:             string;
  away:             string;
  score:            string;
  scoreTotal:       number;
  goalsCount:       number;
  snapshotAgeHours: number | null;
  hasLineups:       boolean;
  status:           'ok' | 'unenriched' | 'no-snapshot';
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

  const now = Date.now();

  // Batch-read all snapshots in parallel
  const snapshots = await Promise.allSettled(
    WC_FINISHED_IDS.map((id) => kv.get<MatchSnapshot>(`goalradar:match:${id}`)),
  );

  const results: MatchHealth[] = [];

  for (let i = 0; i < WC_FINISHED_IDS.length; i++) {
    const id  = WC_FINISHED_IDS[i];
    const res = snapshots[i];

    if (res.status === 'rejected' || !res.value) {
      results.push({
        matchId:          id,
        home:             '?',
        away:             '?',
        score:            '?',
        scoreTotal:       0,
        goalsCount:       0,
        snapshotAgeHours: null,
        hasLineups:       false,
        status:           'no-snapshot',
      });
      continue;
    }

    const snap    = res.value;
    const match   = snap.match;
    const ftH     = match.score?.fullTime?.home ?? 0;
    const ftA     = match.score?.fullTime?.away ?? 0;
    const total   = ftH + ftA;
    const goals   = match.goals?.length ?? 0;
    const ageHrs  = Math.round((now - snap.generatedAt) / 3_600_000 * 10) / 10;

    results.push({
      matchId:          id,
      home:             match.homeTeam?.shortName || match.homeTeam?.name || '?',
      away:             match.awayTeam?.shortName || match.awayTeam?.name || '?',
      score:            `${ftH}–${ftA}`,
      scoreTotal:       total,
      goalsCount:       goals,
      snapshotAgeHours: ageHrs,
      hasLineups:       !!match.lineups,
      status:           (total > 0 && goals === 0) ? 'unenriched' : 'ok',
    });
  }

  const unenriched = results.filter((r) => r.status === 'unenriched');
  const noSnapshot = results.filter((r) => r.status === 'no-snapshot');
  const ok         = results.filter((r) => r.status === 'ok');

  return NextResponse.json({
    checkedAt:      new Date(now).toISOString(),
    total:          WC_FINISHED_IDS.length,
    ok:             ok.length,
    unenriched:     unenriched.length,
    noSnapshot:     noSnapshot.length,
    matches:        results,
    // Convenience: list only the degraded IDs for the repair-enrichment cron
    degradedIds:    [...unenriched, ...noSnapshot].map((r) => r.matchId),
  });
}
