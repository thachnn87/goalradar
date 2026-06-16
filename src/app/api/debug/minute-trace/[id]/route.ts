/**
 * GET /api/debug/minute-trace/[id]
 *
 * DATA-10D: Traces the Match.minute field through every layer of the live
 * data pipeline for a single match, identifying exactly where minute becomes
 * null.
 *
 * Layers traced:
 *   1. providerLiveMatch   — Direct provider call (football-data.org or failover).
 *                            Bypasses L1 in-memory cache and KV.
 *                            Costs 1 API call (rate-limited at 7s interval).
 *   2. kvLiveMatch         — Raw KV read of goalradar:live:matches.
 *                            What the orchestrator last wrote; no L1 involved.
 *   3. liveScoreResponse   — Replicates /api/live-score/[id] logic (Steps 1-3):
 *                              Step 1: KV direct
 *                              Step 2: getLiveMatches() (L1 → KV → provider)
 *                              Step 3: match snapshot
 *   4. snapshotMatch       — goalradar:match:{id} KV entry (what the page's
 *                            initialMinute prop would read from).
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 *
 * Example:
 *   curl "https://goalradar.org/api/debug/minute-trace/537364?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                         from '@vercel/kv';
import { FootballDataProvider }       from '@/lib/providers/football-data';
import { readKVLiveMatches }          from '@/lib/live-cache';
import { getLiveMatches }             from '@/lib/api';
import { getOrBuildMatchSnapshot }    from '@/lib/match-snapshot';
import { NotFoundError }              from '@/lib/errors';
import type { MatchSnapshot }         from '@/lib/match-snapshot';
import type { Match }                 from '@/lib/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minuteLayer(match: Match | null | undefined, source: string) {
  if (!match) return { source, found: false, status: null, minute: null, score: null };
  return {
    source,
    found:  true,
    status: match.status,
    minute: match.minute ?? null,
    score: {
      home: match.score?.fullTime?.home ?? null,
      away: match.score?.fullTime?.away ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: rawId } = await params;
  const matchId = /^\d+$/.test(rawId) ? rawId : (/^(\d+)/.exec(rawId)?.[1] ?? null);
  if (!matchId) {
    return NextResponse.json({ error: `Invalid match id: ${rawId}` }, { status: 400 });
  }

  const numId = parseInt(matchId, 10);
  const now   = Date.now();

  // ── Layer 1: Direct provider call ─────────────────────────────────────────
  // Calls football-data.org (or failover) bypassing L1 + KV.
  // Rate-limited via footballDataLimiter (7s interval).
  // minute is present as an extra runtime field on each match object.
  let providerLiveMatch = null;
  let providerError: string | null = null;
  let providerSource = 'unknown';

  try {
    const provider = new FootballDataProvider();
    const { matches } = await provider.getLiveMatches();
    providerSource = 'football-data (direct)';
    const found = matches.find((m) => m.id === numId) ?? null;
    providerLiveMatch = minuteLayer(found, providerSource);
    providerLiveMatch.found = found !== null;
  } catch (err) {
    providerError = err instanceof Error ? err.message : String(err);
    providerLiveMatch = { source: providerSource, found: false, error: providerError,
                          status: null, minute: null, score: null };
  }

  // ── Layer 2: KV direct (goalradar:live:matches) ────────────────────────────
  // Reads the orchestrator-written KV entry directly, bypassing in-process L1.
  let kvLiveMatch = null;
  let kvAgeSeconds: number | null = null;
  let kvError: string | null = null;

  try {
    // readKVLiveMatches() reads the raw KV entry and checks TTL.
    // We also need fetchedAt, so read the raw entry separately.
    interface KVLiveEntry { matches: Match[]; fetchedAt: number }
    const kvEntry = await kv.get<KVLiveEntry>('goalradar:live:matches');

    if (kvEntry) {
      kvAgeSeconds = Math.round((now - kvEntry.fetchedAt) / 1000);
      const found = kvEntry.matches.find((m) => m.id === numId) ?? null;
      kvLiveMatch = minuteLayer(found, 'kv-live-direct');
      kvLiveMatch.found = found !== null;
    } else {
      kvLiveMatch = { source: 'kv-live-direct', found: false,
                      status: 'KV_EMPTY', minute: null, score: null };
    }
  } catch (err) {
    kvError = err instanceof Error ? err.message : String(err);
    kvLiveMatch = { source: 'kv-live-direct', found: false, error: kvError,
                    status: null, minute: null, score: null };
  }

  // ── Layer 3: /api/live-score replication (Steps 1 → 2 → 3) ───────────────
  // Reproduces the exact source-selection logic from
  // src/app/api/live-score/[matchId]/route.ts without an HTTP round-trip.
  let liveScoreStep: 'step1-kv' | 'step2-live' | 'step3-snapshot' | 'not-found' = 'not-found';
  let liveScoreResponse = null;

  // Step 1: KV direct (via readKVLiveMatches — respects TTL unlike raw kv.get)
  try {
    const kvMatches = await readKVLiveMatches();
    const liveMatch = kvMatches?.find((m) => m.id === numId) ?? null;
    if (liveMatch) {
      liveScoreStep = 'step1-kv';
      liveScoreResponse = minuteLayer(liveMatch, 'step1-kv');
    }
  } catch { /* fall through */ }

  // Step 2: getLiveMatches() — L1 → KV → provider
  if (!liveScoreResponse) {
    try {
      const { matches } = await getLiveMatches();
      const liveMatch = matches.find((m) => m.id === numId) ?? null;
      if (liveMatch) {
        liveScoreStep = 'step2-live';
        liveScoreResponse = minuteLayer(liveMatch, 'step2-live');
      }
    } catch { /* fall through */ }
  }

  // Step 3: snapshot
  if (!liveScoreResponse) {
    try {
      const snapshot = await getOrBuildMatchSnapshot(matchId);
      const match = snapshot.match;
      liveScoreStep = 'step3-snapshot';
      liveScoreResponse = minuteLayer(match, 'step3-snapshot');
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        liveScoreResponse = { source: 'step3-snapshot', found: false,
                              error: err instanceof Error ? err.message : String(err),
                              status: null, minute: null, score: null };
      }
    }
  }

  if (!liveScoreResponse) {
    liveScoreResponse = { source: 'not-found', found: false,
                          status: null, minute: null, score: null };
  }

  // ── Layer 4: Snapshot KV entry (goalradar:match:{id}) ─────────────────────
  // What the match page would read as initialMinute on first render.
  let snapshotMatch = null;
  let snapshotAgeSeconds: number | null = null;
  let snapshotError: string | null = null;

  try {
    const snap = await kv.get<MatchSnapshot>(`goalradar:match:${matchId}`);
    if (snap) {
      snapshotAgeSeconds = Math.round((now - snap.generatedAt) / 1000);
      snapshotMatch = minuteLayer(snap.match, 'snapshot-kv');
    } else {
      snapshotMatch = { source: 'snapshot-kv', found: false,
                        status: 'SNAPSHOT_MISSING', minute: null, score: null };
    }
  } catch (err) {
    snapshotError = err instanceof Error ? err.message : String(err);
    snapshotMatch = { source: 'snapshot-kv', found: false, error: snapshotError,
                      status: null, minute: null, score: null };
  }

  // ── Diagnosis ──────────────────────────────────────────────────────────────
  const p = providerLiveMatch?.minute;
  const k = kvLiveMatch?.minute;
  const l = liveScoreResponse?.minute;
  const s = snapshotMatch?.minute;

  let decision: string;
  let firstNullLayer: string;

  if (p === null && providerLiveMatch?.found === false) {
    // Match not live at all
    decision = 'MATCH_NOT_LIVE';
    firstNullLayer = 'n/a — match is not IN_PLAY/PAUSED at provider';
  } else if (p !== null && k === null) {
    decision = 'KV_LOSS';
    firstNullLayer = 'kvLiveMatch — minute present at provider but null after KV write/read';
  } else if (p !== null && k !== null && l === null) {
    decision = 'API_LOSS';
    firstNullLayer = `liveScoreResponse (${liveScoreStep}) — minute present in KV but null after /api/live-score`;
  } else if (p !== null && k !== null && l !== null && s === null) {
    decision = 'SNAPSHOT_LOSS';
    firstNullLayer = 'snapshotMatch — minute present in live-score path but null in snapshot';
  } else if (p !== null && k !== null && l !== null && s !== null) {
    decision = 'NO_LOSS';
    firstNullLayer = 'none — minute flows through all layers';
  } else if (p === null && providerLiveMatch?.found === true) {
    decision = 'PROVIDER_LOSS';
    firstNullLayer = 'providerLiveMatch — provider returned match with null minute';
  } else {
    decision = 'INDETERMINATE';
    firstNullLayer = 'could not determine — check individual layers';
  }

  return NextResponse.json({
    matchId,
    checkedAt:     new Date(now).toISOString(),

    // ── Layer 1: Direct provider ─────────────────────────────────────────────
    providerLiveMatch,
    providerError,

    // ── Layer 2: KV goalradar:live:matches ───────────────────────────────────
    kvLiveMatch,
    kvAgeSeconds,
    kvError,

    // ── Layer 3: /api/live-score replication ─────────────────────────────────
    liveScoreResponse,
    liveScoreStep,  // which of the 3 steps served the response

    // ── Layer 4: goalradar:match:{id} snapshot ───────────────────────────────
    snapshotMatch,
    snapshotAgeSeconds,
    snapshotError,

    // ── Minute values at each layer (fast comparison) ─────────────────────────
    minuteTrace: {
      provider:     p ?? null,
      kv:           k ?? null,
      liveScore:    l ?? null,
      snapshot:     s ?? null,
    },

    // ── Decision ─────────────────────────────────────────────────────────────
    decision,
    firstNullLayer,
  });
}
