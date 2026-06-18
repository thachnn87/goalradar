/**
 * GET /api/debug/enrichment-health
 *
 * DATA-16 Objective 3: scan all finished WC 2026 matches for unenriched snapshots.
 *
 * For each match where score > 0 and goals.length === 0, reports:
 *   matchId, score, goalsCount, snapshotAge, enrichmentStatus
 *
 * Match list is read dynamically from the FINISHED feed KV key so this endpoint
 * stays current as the tournament progresses without manual ID list updates.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 *
 * Example:
 *   curl "https://goalradar.org/api/debug/enrichment-health?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import type { Match }                from '@/lib/types';

export const dynamic = 'force-dynamic';

const FINISHED_FEED_KEY = '/competitions/WC/matches?status=FINISHED';

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

  // ── 1. Read finished match IDs from KV feed (dynamic — no hardcoded list) ──
  const feedEntry = await kv.get<KVEntry<{ matches: Match[] }>>(`goalradar:${FINISHED_FEED_KEY}`);

  if (!feedEntry) {
    return NextResponse.json({
      error:    'FINISHED feed not in KV',
      kvKey:    `goalradar:${FINISHED_FEED_KEY}`,
      hint:     'Run the WC orchestrator cron to populate the feed',
    }, { status: 503 });
  }

  // Filter to actual FINISHED matches only (feed may contain TIMED anomalies)
  const finishedMatches = (feedEntry.data?.matches ?? []).filter(
    (m) => m.status === 'FINISHED',
  );

  const feedAgeHours = Math.round((now - feedEntry.fetchedAt) / 3_600_000 * 10) / 10;
  const finishedIds  = finishedMatches.map((m) => m.id);

  // ── 2. Batch-read all snapshots in parallel ──────────────────────────────────
  const snapshots = await Promise.allSettled(
    finishedIds.map((id) => kv.get<MatchSnapshot>(`goalradar:match:${id}`)),
  );

  const results: MatchHealth[] = [];

  for (let i = 0; i < finishedIds.length; i++) {
    const id  = finishedIds[i];
    const res = snapshots[i];

    if (res.status === 'rejected' || !res.value) {
      const feedMatch = finishedMatches[i];
      results.push({
        matchId:          id,
        home:             feedMatch.homeTeam?.shortName || feedMatch.homeTeam?.name || '?',
        away:             feedMatch.awayTeam?.shortName || feedMatch.awayTeam?.name || '?',
        score:            '?',
        scoreTotal:       0,
        goalsCount:       0,
        snapshotAgeHours: null,
        hasLineups:       false,
        status:           'no-snapshot',
      });
      continue;
    }

    const snap  = res.value;
    const match = snap.match;
    const ftH   = match.score?.fullTime?.home ?? 0;
    const ftA   = match.score?.fullTime?.away ?? 0;
    const total = ftH + ftA;
    const goals = match.goals?.length ?? 0;
    const ageHrs = Math.round((now - snap.generatedAt) / 3_600_000 * 10) / 10;

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

  const verdict =
    unenriched.length > 0 ? 'RED'
    : noSnapshot.length > 0 ? 'YELLOW'
    : 'GREEN';

  return NextResponse.json({
    checkedAt:      new Date(now).toISOString(),
    feedAgeHours,
    verdict,
    total:          finishedIds.length,
    ok:             ok.length,
    unenriched:     unenriched.length,
    noSnapshot:     noSnapshot.length,
    matches:        results,
    degradedIds:    [...unenriched, ...noSnapshot].map((r) => r.matchId),
  });
}
