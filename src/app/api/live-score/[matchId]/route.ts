/**
 * GET /api/live-score/[matchId]
 *
 * ONE DERIVATION: resolveEffectiveScore() is called here (API layer), not in the UI.
 * MatchLiveZone receives effectiveScore directly — it never touches score.fullTime.
 *
 * Source order:
 *   1. KV live cache direct (goalradar:live:matches) — bypasses L1, cross-instance consistent
 *   2. getLiveMatches() — fallback if KV expired; may trigger a fresh provider fetch
 *   3. Match snapshot (KV-backed, provider only on cold start)
 *
 * Response shape:
 *   { matchId, status, minute, effectiveScore, isReliableScore, version, lastUpdated, source }
 *
 * isReliableScore = true when score.fullTime is provider-confirmed (not derived from goals[]).
 * version = Unix-seconds derived from lastUpdated (same formula as server-rendered matchVersion).
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Match } from '@/lib/types';
import { getLiveMatches } from '@/lib/api';
import { readKVLiveMatches } from '@/lib/live-cache';
import { getOrBuildMatchSnapshot } from '@/lib/match-snapshot';
import { resolveEffectiveScore, versionFromTimestamp } from '@/lib/match-runtime-state';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ matchId: string }> };

function buildResponse(match: Match, source: string) {
  const effectiveScore  = resolveEffectiveScore(match);
  const isReliableScore = match.score?.fullTime?.home != null && match.score?.fullTime?.away != null;
  const version         = versionFromTimestamp(match.lastUpdated);
  return {
    matchId:        match.id,
    status:         match.status,
    minute:         match.minute ?? null,
    effectiveScore,
    isReliableScore,
    version,
    lastUpdated:    match.lastUpdated ?? null,
    source,
  };
}

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
      return NextResponse.json(buildResponse(liveMatch, 'kv-live'));
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
      return NextResponse.json(buildResponse(liveMatch, 'live'));
    }
  } catch {
    // live cache error — fall through to snapshot
  }

  // Step 3: snapshot (KV → provider as last resort).
  // Covers FINISHED matches and the transition window from IN_PLAY → FINISHED.
  try {
    const snapshot = await getOrBuildMatchSnapshot(String(numericId));
    return NextResponse.json(buildResponse(snapshot.match, 'snapshot'));
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: 'match not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
