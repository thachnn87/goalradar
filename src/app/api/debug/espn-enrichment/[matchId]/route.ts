/**
 * GET /api/debug/espn-enrichment/[matchId]
 *
 * DATA-13: Inspect ESPN enrichment state for a football-data.org match ID.
 *
 * Returns a full diagnostic payload — useful for verifying enrichment
 * without waiting for a page load or snapshot rebuild.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 *
 * Example:
 *   curl "https://goalradar.org/api/debug/espn-enrichment/537391?secret=$CRON_SECRET"
 *
 * Response fields:
 *   fdMatchId          — football-data.org match ID (string)
 *   espnMatchId        — ESPN event ID from KV lookup (null = not resolved yet)
 *   enrichmentEnabled  — ESPN_ENRICHMENT_ENABLED flag value
 *   kvEnabled          — whether KV is configured
 *   lookupHit          — true if espnMatchId came from KV cache
 *   lookupAgeSeconds   — seconds since lookup was cached (null if miss)
 *   eventCacheHit      — true if events came from KV cache
 *   eventCacheAgeSeconds — seconds since events were cached (null if miss)
 *   goalsCount         — number of goals in event cache (0 if miss)
 *   cardsCount         — number of bookings in event cache (0 if miss)
 *   substitutionsCount — number of substitutions in event cache (0 if miss)
 *   snapshotStatus     — match status from KV snapshot (null if no snapshot)
 *   snapshotGoalsCount — goals in the built snapshot (0 if miss or unenriched)
 *   enrichmentApplied  — true when snapshot has events from ESPN
 *   source             — 'kv-cache' | 'espn-fresh' | 'lookup-miss' |
 *                        'not-enabled' | 'not-finished' | 'no-snapshot'
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import {
  ESPN_ENRICHMENT_ENABLED,
  espnLookupKvKey,
  espnEventKvKey,
  type CachedEspnEvents,
} from '@/lib/espn-id-map';
import type { MatchSnapshot } from '@/lib/match-snapshot';

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
// KV helpers
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

type RouteParams = { params: Promise<{ matchId: string }> };

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { matchId } = await params;
  const now          = Date.now();

  const lookupKey    = espnLookupKvKey(matchId);
  const eventKey     = espnEventKvKey(matchId);
  const snapshotKey  = `goalradar:match:${matchId}`;

  // ── Parallel KV reads ──────────────────────────────────────────────────────
  let lookupRaw: unknown  = undefined;
  let events:   CachedEspnEvents | null = null;
  let snapshot: MatchSnapshot | null    = null;
  let lookupAgeSeconds: number | null   = null;
  let eventCacheAgeSeconds: number | null = null;

  try {
    [lookupRaw, events, snapshot] = await Promise.all([
      kv.get(lookupKey),
      kv.get<CachedEspnEvents>(eventKey),
      kv.get<MatchSnapshot>(snapshotKey),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: 'KV read failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // lookupRaw: null = key absent (kv.get miss), '__NOT_FOUND__' = explicit miss stored, string = ESPN ID
  const lookupHit   = lookupRaw !== null;
  const espnMatchId = (typeof lookupRaw === 'string' && lookupRaw !== '__NOT_FOUND__' ? lookupRaw : null);

  // KV doesn't expose write time; use enrichedAt in the event payload as a proxy
  if (events?.enrichedAt) {
    eventCacheAgeSeconds = Math.round((now - events.enrichedAt) / 1000);
  }

  // Snapshot age
  const snapshotMatch = snapshot?.match ?? null;
  const snapshotGoalsCount = snapshotMatch?.goals?.length ?? 0;

  // ── Source determination ────────────────────────────────────────────────────
  type Source = 'not-enabled' | 'not-finished' | 'no-snapshot' | 'lookup-miss' |
                'kv-cache' | 'espn-fresh';

  let source: Source;
  if (!ESPN_ENRICHMENT_ENABLED) {
    source = 'not-enabled';
  } else if (snapshotMatch && snapshotMatch.status !== 'FINISHED') {
    source = 'not-finished';
  } else if (!snapshotMatch) {
    source = 'no-snapshot';
  } else if (!espnMatchId) {
    source = 'lookup-miss';
  } else if (events) {
    source = 'kv-cache';
  } else {
    source = 'espn-fresh'; // would be fetched on next snapshot build
  }

  return NextResponse.json({
    fdMatchId:             matchId,
    espnMatchId,
    enrichmentEnabled:     ESPN_ENRICHMENT_ENABLED,
    kvEnabled:             KV_ENABLED,
    lookupHit,
    lookupAgeSeconds,
    eventCacheHit:         events !== null,
    eventCacheAgeSeconds,
    goalsCount:            events?.goals?.length         ?? 0,
    cardsCount:            events?.bookings?.length      ?? 0,
    substitutionsCount:    events?.substitutions?.length ?? 0,
    snapshotStatus:        snapshotMatch?.status         ?? null,
    snapshotGoalsCount,
    enrichmentApplied:     snapshotGoalsCount > 0,
    source,
    checkedAt:             new Date(now).toISOString(),
  });
}
