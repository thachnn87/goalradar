/**
 * GET /api/debug/hybrid-enrichment/[matchId]
 *
 * DATA-11B: Inspect the api-football enrichment state for a single match.
 *
 * Reports:
 *   - Whether the AF lookup table is present and contains the match
 *   - Whether the events KV cache has been populated
 *   - Counts of goals, bookings, substitutions from the current snapshot
 *   - Source: kv-cache | api-football-fresh | lookup-miss | not-enabled
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development.
 *
 * Example:
 *   curl "https://goalradar.org/api/debug/hybrid-enrichment/537358?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                         from '@vercel/kv';
import {
  AF_ENRICHMENT_ENABLED,
  AF_LOOKUP_KV_KEY,
  buildMappingKey,
  afEventsKvKey,
  resolveAfFixtureId,
  type CachedAFEvents,
} from '@/lib/af-id-map';
import { getOrBuildMatchSnapshot } from '@/lib/match-snapshot';

export const dynamic = 'force-dynamic';

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

const AF_KEY_CONFIGURED =
  typeof process.env.API_FOOTBALL_KEY === 'string' &&
  process.env.API_FOOTBALL_KEY.trim() !== '';

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

type Params = { params: Promise<{ matchId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { matchId: rawId } = await params;
  const matchId = /^\d+$/.test(rawId) ? rawId : null;
  if (!matchId) {
    return NextResponse.json({ error: `Invalid matchId: ${rawId}` }, { status: 400 });
  }

  const now = Date.now();

  // ── Lookup table ────────────────────────────────────────────────────────────
  let lookupTablePresent = false;
  let lookupTableEntries = 0;
  let lookupTableAgeSeconds: number | null = null;
  let afFixtureId: number | null = null;
  let mappingKey: string | null = null;
  let snapshotGoalsCount = 0;
  let snapshotBookingsCount = 0;
  let snapshotSubsCount = 0;
  let snapshotStatus: string | null = null;

  // Snapshot — fetch current state (no provider call if KV hit)
  try {
    const snapshot = await getOrBuildMatchSnapshot(matchId);
    const match = snapshot.match;
    snapshotStatus       = match.status;
    snapshotGoalsCount   = match.goals?.length ?? 0;
    snapshotBookingsCount = match.bookings?.length ?? 0;
    snapshotSubsCount    = match.substitutions?.length ?? 0;

    // Build mapping key from the snapshot's match data
    mappingKey = buildMappingKey(match);

    // Resolve AF fixture ID
    if (KV_ENABLED) {
      afFixtureId = await resolveAfFixtureId(match);
    }
  } catch {
    // Match not found or snapshot build failed
  }

  // Lookup table metadata
  if (KV_ENABLED) {
    try {
      interface LookupEntry { fetchedAt?: number; [key: string]: unknown }
      // kv.get returns the table object directly (no fetchedAt wrapper)
      const rawTable = await kv.get<Record<string, number>>(AF_LOOKUP_KV_KEY);
      if (rawTable) {
        lookupTablePresent = true;
        lookupTableEntries = Object.keys(rawTable).length;
      }
    } catch { /* KV unavailable */ }
  }

  // ── Events KV cache ─────────────────────────────────────────────────────────
  let eventsCachePresent = false;
  let eventsCacheAgeSeconds: number | null = null;
  let eventsGoalsCount = 0;
  let eventsBookingsCount = 0;
  let eventsSubsCount = 0;
  let eventsAfFixtureId: number | null = null;
  let source: 'kv-cache' | 'api-football-fresh' | 'lookup-miss' | 'not-enabled' | 'not-finished' = 'not-enabled';

  if (KV_ENABLED && snapshotStatus === 'FINISHED') {
    try {
      const cached = await kv.get<CachedAFEvents>(afEventsKvKey(matchId));
      if (cached) {
        eventsCachePresent   = true;
        eventsCacheAgeSeconds = Math.round((now - cached.enrichedAt) / 1000);
        eventsGoalsCount     = cached.goals.length;
        eventsBookingsCount  = cached.bookings.length;
        eventsSubsCount      = cached.substitutions.length;
        eventsAfFixtureId    = cached.afFixtureId;
        source = 'kv-cache';
      } else if (!lookupTablePresent || afFixtureId === null) {
        source = 'lookup-miss';
      } else if (AF_ENRICHMENT_ENABLED) {
        source = 'api-football-fresh'; // would be fetched fresh on next snapshot miss
      } else {
        source = 'not-enabled';
      }
    } catch { /* KV unavailable */ }
  } else if (snapshotStatus !== 'FINISHED') {
    source = 'not-finished';
  }

  const enrichmentApplied = snapshotGoalsCount > 0 && eventsCachePresent;

  return NextResponse.json({
    fdMatchId:   matchId,
    checkedAt:   new Date(now).toISOString(),

    // Feature flag + config
    enrichmentEnabled:      AF_ENRICHMENT_ENABLED,
    apiFootballKeySet:      AF_KEY_CONFIGURED,
    kvEnabled:              KV_ENABLED,

    // Lookup table
    lookupTablePresent,
    lookupTableEntries,
    lookupTableAgeSeconds,
    mappingKey,

    // AF fixture ID resolution
    afFixtureId: afFixtureId ?? eventsAfFixtureId,

    // Events KV cache
    eventsCachePresent,
    eventsCacheAgeSeconds,

    // Snapshot state
    snapshotStatus,
    snapshotGoalsCount,
    snapshotBookingsCount,
    snapshotSubsCount,

    // Events cache state
    eventsGoalsCount,
    eventsBookingsCount,
    eventsSubsCount,

    // Summary
    enrichmentApplied,
    source,
  });
}
