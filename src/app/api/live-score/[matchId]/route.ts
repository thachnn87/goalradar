/**
 * GET /api/live-score/[matchId]
 *
 * DATA-18WC.RUNTIME UNIFICATION — ONE DERIVATION
 *
 * This route is a serializer only — it does NOT resolve or derive any fields.
 * Score derivation happens exclusively in deriveRuntimeState() (match-runtime-state.ts).
 *
 * To call deriveRuntimeState() with a live Match (not a full MatchSnapshot), we
 * construct a minimal MatchSnapshot wrapper. This is the ONLY approved way to get
 * effectiveScore + isReliableScore outside the match detail page.
 *
 * Source order:
 *   1. KV live cache direct (goalradar:live:matches) — bypasses L1, cross-instance consistent
 *   2. getLiveMatches() — fallback if KV expired; may trigger a fresh provider fetch
 *   3. Match snapshot (KV-backed, provider only on cold start)
 *
 * Response: { matchId, status, minute, effectiveScore, isReliableScore, version, lastUpdated, source }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Match, MatchDetail } from '@/lib/types';
import type { MatchSnapshot } from '@/lib/match-snapshot';
import { getLiveMatches } from '@/lib/api';
import { readKVLiveMatches } from '@/lib/live-cache';
import { getOrBuildMatchSnapshot } from '@/lib/match-snapshot';
import { deriveRuntimeState } from '@/lib/match-runtime-state';
import { NotFoundError } from '@/lib/errors';
import { generateTraceId, generateCorrelationId, runWithTrace, isTracingEnabled } from '@/lib/tracing';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ matchId: string }> };

/** Wrap a lightweight Match in a minimal MatchSnapshot so deriveRuntimeState() can run. */
function minimalSnapshot(match: Match): MatchSnapshot {
  return {
    match:          match as MatchDetail,  // goals/bookings/subs absent — goals[] fallback is skipped for live Match
    headToHead:     null,
    standings:      null,
    wcGroupMatches: [],
    wcAllMatches:   [],
    generatedAt:    match.lastUpdated ? new Date(match.lastUpdated).getTime() : 0,
  };
}

/** Serialize the fields the client needs from a MatchRuntimeState. */
function buildResponse(match: Match, source: string) {
  const { effectiveScore, isReliableScore, version } = deriveRuntimeState(minimalSnapshot(match));
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

  // LIVE-21 Phase 1: wrap request in trace context
  const shouldTrace = isTracingEnabled();
  const traceId = shouldTrace ? generateTraceId() : 'untraced';
  const utcDate = new Date().toISOString();
  const correlationId = generateCorrelationId(numericId, utcDate);

  return runWithTrace(traceId, correlationId, async () => {
    // Step 1: KV live cache — bypasses in-process L1, cross-instance consistent.
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
    // deriveRuntimeState() runs on the full MatchSnapshot here — goals[] fallback is available.
    try {
      const snapshot = await getOrBuildMatchSnapshot(String(numericId));
      const { effectiveScore, isReliableScore, version, match } = deriveRuntimeState(snapshot);
      return NextResponse.json({
        matchId:        match.id,
        status:         match.status,
        minute:         match.minute ?? null,
        effectiveScore,
        isReliableScore,
        version,
        lastUpdated:    match.lastUpdated ?? null,
        source:         'snapshot',
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: 'match not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    }
  });
}
