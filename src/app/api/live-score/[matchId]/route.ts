/**
 * GET /api/live-score/[matchId]
 *
 * LIVE-1 Phase 1: lightweight score endpoint for the match page client poller.
 *
 * Source order:
 *   1. KV live cache direct (goalradar:live:matches) — bypasses L1, cross-instance consistent
 *   2. getLiveMatches() — fallback if KV expired; may trigger a fresh provider fetch
 *   3. Match snapshot (KV-backed, provider only on cold start)
 *
 * LIVE-1A fix: step 1 now reads KV directly via readKVLiveMatches(), bypassing the
 * in-process L1 cache. The L1 is per-instance and can lag up to 30s behind KV after
 * the KV is updated with a new goal — different Vercel instances can diverge. Reading
 * from KV directly guarantees this endpoint returns the same score as any other instance
 * that recently read from KV, eliminating the /live vs /match divergence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLiveMatches } from '@/lib/api';
import { readKVLiveMatches } from '@/lib/live-cache';
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

  // Step 1: KV live cache — bypasses in-process L1, cross-instance consistent.
  // goalradar:live:matches is the single authority for IN_PLAY/PAUSED scores.
  try {
    const kvMatches = await readKVLiveMatches();
    const liveMatch = kvMatches?.find((m) => m.id === numericId) ?? null;
    if (liveMatch) {
      return NextResponse.json({
        matchId: liveMatch.id,
        status: liveMatch.status,
        score: liveMatch.score,
        minute: liveMatch.minute ?? null,
        lastUpdated: liveMatch.lastUpdated ?? null,
        source: 'kv-live',
      });
    }
  } catch {
    // KV unavailable — fall through
  }

  // Step 2: getLiveMatches() — L1 fallback + provider fetch if KV expired.
  // Catches the case where KV TTL expired between orchestrator runs.
  try {
    const { matches } = await getLiveMatches();
    const liveMatch = matches.find((m) => m.id === numericId);
    if (liveMatch) {
      return NextResponse.json({
        matchId: liveMatch.id,
        status: liveMatch.status,
        score: liveMatch.score,
        minute: liveMatch.minute ?? null,
        lastUpdated: liveMatch.lastUpdated ?? null,
        source: 'live',
      });
    }
  } catch {
    // live cache error — fall through to snapshot
  }

  // Step 3: snapshot (KV → provider as last resort).
  // Covers FINISHED matches and the transition window from IN_PLAY → FINISHED.
  try {
    const snapshot = await getOrBuildMatchSnapshot(String(numericId));
    const { match } = snapshot;
    return NextResponse.json({
      matchId: match.id,
      status: match.status,
      score: match.score,
      minute: match.minute ?? null,
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
