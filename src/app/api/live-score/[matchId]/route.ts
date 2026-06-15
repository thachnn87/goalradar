/**
 * GET /api/live-score/[matchId]
 *
 * LIVE-1 Phase 1: lightweight score endpoint for the match page client poller.
 * Source order:
 *   1. Live cache (goalradar:live:matches, 30s TTL) — covers IN_PLAY/PAUSED
 *   2. Match snapshot (KV-backed, provider only on cold start)
 *
 * Never bypasses existing rate limits — both sources respect the existing
 * caching hierarchy from live-cache.ts and match-snapshot.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLiveMatches } from '@/lib/api';
import { getOrBuildMatchSnapshot } from '@/lib/match-snapshot';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ matchId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { matchId } = await params;
  const numericId = parseInt(matchId, 10);

  if (isNaN(numericId)) {
    return NextResponse.json({ error: 'invalid matchId' }, { status: 400 });
  }

  // Step 1: live cache — fastest, covers all competitions in IN_PLAY/PAUSED
  try {
    const { matches } = await getLiveMatches();
    const liveMatch = matches.find((m) => m.id === numericId);
    if (liveMatch) {
      return NextResponse.json({
        matchId: liveMatch.id,
        status: liveMatch.status,
        score: liveMatch.score,
        lastUpdated: liveMatch.lastUpdated ?? null,
        source: 'live',
      });
    }
  } catch {
    // live cache miss/error — fall through to snapshot
  }

  // Step 2: snapshot (KV → provider as last resort)
  try {
    const snapshot = await getOrBuildMatchSnapshot(String(numericId));
    const { match } = snapshot;
    return NextResponse.json({
      matchId: match.id,
      status: match.status,
      score: match.score,
      lastUpdated: match.lastUpdated ?? null,
      source: 'snapshot',
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: 'match not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
