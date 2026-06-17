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
  ESPN_LOOKUP_TTL_SEC,
  ESPN_LEGACY_SENTINEL,
  espnLookupKvKey,
  espnEventKvKey,
  espnNegBackoffSec,
  type CachedEspnEvents,
  type LookupMiss,
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
  let lookupRaw: string | LookupMiss | null = null;
  let events:   CachedEspnEvents | null = null;
  let snapshot: MatchSnapshot | null    = null;
  let lookupTtlRemaining: number | null = null;
  let lookupAgeSeconds: number | null   = null;
  let eventCacheAgeSeconds: number | null = null;

  try {
    [lookupRaw, events, snapshot, lookupTtlRemaining] = await Promise.all([
      kv.get<string | LookupMiss>(lookupKey),
      kv.get<CachedEspnEvents>(eventKey),
      kv.get<MatchSnapshot>(snapshotKey),
      kv.ttl(lookupKey), // seconds remaining; -2 absent, -1 no-expiry
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: 'KV read failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // Classify the lookup value (DATA-15C):
  //   string (≠ legacy sentinel) → positive ESPN ID
  //   string (= legacy sentinel) → pre-DATA-15C bare miss
  //   object  { status:'NOT_FOUND' } → structured LookupMiss
  //   null    → absent
  const lookupHit  = lookupRaw !== null;
  const isLegacyMiss = lookupRaw === ESPN_LEGACY_SENTINEL;
  const miss: LookupMiss | null =
    (lookupRaw && typeof lookupRaw === 'object' && lookupRaw.status === 'NOT_FOUND') ? lookupRaw : null;
  const espnMatchId =
    (typeof lookupRaw === 'string' && !isLegacyMiss) ? lookupRaw : null;

  // Negative-cache diagnostics
  const lookupReason   = miss?.reason ?? (isLegacyMiss ? 'legacy-sentinel' : null);
  const lookupAttempts = miss?.attempts ?? (isLegacyMiss ? 1 : null);
  const nextRetryInSec = miss ? Math.max(0,
    Math.round((miss.lastAttemptAt + espnNegBackoffSec(miss.attempts) * 1000 - now) / 1000),
  ) : null;

  // Real age: structured miss carries firstMissAt; a positive ID is dated from
  // its remaining TTL against the known 30-day positive TTL.
  if (miss?.firstMissAt) {
    lookupAgeSeconds = Math.round((now - miss.firstMissAt) / 1000);
  } else if (espnMatchId && typeof lookupTtlRemaining === 'number' && lookupTtlRemaining > 0) {
    lookupAgeSeconds = Math.max(0, ESPN_LOOKUP_TTL_SEC - lookupTtlRemaining);
  }

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
  } else if (events !== null) {
    // Event cache is the authoritative signal — check it before the lookup key.
    // The lookup KV key may be null (stale from pre-DATA-13C buggy code) even
    // when events ARE cached and enrichment IS applied.
    source = 'kv-cache';
  } else if (!espnMatchId) {
    source = 'lookup-miss';
  } else {
    source = 'espn-fresh'; // ESPN ID known but events not yet cached
  }

  return NextResponse.json({
    fdMatchId:             matchId,
    espnMatchId,
    enrichmentEnabled:     ESPN_ENRICHMENT_ENABLED,
    kvEnabled:             KV_ENABLED,
    lookupHit,
    lookupAgeSeconds,
    lookupTtlRemaining,
    lookupReason,
    lookupAttempts,
    nextRetryInSec,
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
