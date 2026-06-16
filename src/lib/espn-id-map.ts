/**
 * espn-id-map.ts — KV caching + enrichment orchestration for ESPN events.
 *
 * DATA-13: Mirrors af-id-map.ts structure but uses per-match KV keys
 * (one entry per match) instead of a single shared lookup table.
 * ESPN is free (no plan restrictions), so no refresh endpoint is needed.
 *
 * KV keys:
 *   goalradar:espn:lookup:{fdMatchId}  — ESPN event ID  (30-day TTL)
 *   goalradar:espn:event:{fdMatchId}   — cached events  (12-hour TTL)
 *
 * Feature flag:
 *   ENABLE_ESPN_ENRICHMENT=false  — set to explicitly disable; defaults ON
 *   when KV is available (ESPN is free, no plan restrictions).
 */

import { kv }                                  from '@vercel/kv';
import { findEspnMatch, getEspnMatchEvents }   from './providers/espn';
import type { EspnMatchEvents }                from './providers/espn';
import type { MatchDetail }                    from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

/**
 * ESPN enrichment is enabled by default when KV is available.
 * Set ENABLE_ESPN_ENRICHMENT=false to explicitly disable.
 * Unlike AF enrichment, no paid plan is required.
 */
export const ESPN_ENRICHMENT_ENABLED =
  process.env.ENABLE_ESPN_ENRICHMENT !== 'false' && KV_ENABLED;

// ---------------------------------------------------------------------------
// KV key helpers + TTL constants
// ---------------------------------------------------------------------------

export const ESPN_LOOKUP_TTL_SEC = 30 * 24 * 3600; // 30 days — ESPN IDs don't change
export const ESPN_EVENT_TTL_SEC  = 12 * 3600;       // 12 hours — events are final after match

export function espnLookupKvKey(fdMatchId: string | number): string {
  return `goalradar:espn:lookup:${fdMatchId}`;
}

export function espnEventKvKey(fdMatchId: string | number): string {
  return `goalradar:espn:event:${fdMatchId}`;
}

// ---------------------------------------------------------------------------
// Cached event payload schema
// ---------------------------------------------------------------------------

export interface CachedEspnEvents {
  goals:         MatchDetail['goals'];
  bookings:      MatchDetail['bookings'];
  substitutions: MatchDetail['substitutions'];
  espnMatchId:   string;
  enrichedAt:    number; // epoch ms
}

// ---------------------------------------------------------------------------
// resolveEspnMatchId
// ---------------------------------------------------------------------------

/**
 * Return the ESPN event ID for a football-data.org match ID.
 *
 * Flow:
 *   1. Check goalradar:espn:lookup:{fdMatchId} — return immediately on hit
 *   2. Query ESPN scoreboard via findEspnMatch() (1 ESPN API call)
 *   3. Store result (30-day TTL, even if null to suppress repeat misses)
 *
 * Returns null if ESPN has no matching event or on any error.
 */
export async function resolveEspnMatchId(match: MatchDetail): Promise<string | null> {
  if (!KV_ENABLED) return null;

  const fdId     = String(match.id);
  const lookupKey = espnLookupKvKey(fdId);

  try {
    // 1. Lookup KV cache
    // kv.get() returns null for missing keys (not undefined), so we use a
    // sentinel string '__NOT_FOUND__' to distinguish an explicit miss from absent.
    const cached = await kv.get<string>(lookupKey);
    if (cached !== null) {
      // '__NOT_FOUND__' stored explicitly = previous miss, avoid repeat scoreboard call
      return cached === '__NOT_FOUND__' ? null : cached;
    }

    // 2. Query ESPN scoreboard
    const espnId = await findEspnMatch(
      match.homeTeam.name,
      match.awayTeam.name,
      match.utcDate,
    );

    // 3. Store result (sentinel '__NOT_FOUND__' for misses to suppress repeat scoreboard calls)
    kv.set(lookupKey, espnId ?? '__NOT_FOUND__', { ex: ESPN_LOOKUP_TTL_SEC }).catch((err) =>
      console.error(`[ESPN-ID-MAP] lookup-write failed match:${fdId}:`, err),
    );

    if (espnId) {
      console.log(`[ESPN-ID-MAP] resolved match:${fdId} → espnId:${espnId}`);
    } else {
      console.warn(`[ESPN-ID-MAP] no espn match found for fd:${fdId}`);
    }

    return espnId;
  } catch (err) {
    console.error(
      `[ESPN-ID-MAP] resolve failed match:${fdId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// enrichMatchWithEspnEvents
// ---------------------------------------------------------------------------

/**
 * Enrich a FINISHED WC match with event data from ESPN.
 *
 * Flow:
 *   1. Check goalradar:espn:event:{fdMatchId} — apply cached events on hit
 *   2. Resolve ESPN event ID (KV lookup → ESPN scoreboard if needed)
 *   3. Fetch events via getEspnMatchEvents() (1 ESPN API call)
 *   4. Cache result at goalradar:espn:event:{fdMatchId} (12h TTL, fire-and-forget)
 *   5. Apply events to match and return
 *
 * Best-effort: any failure returns the original match unchanged.
 * Never called for IN_PLAY / PAUSED matches.
 */
export async function enrichMatchWithEspnEvents(match: MatchDetail): Promise<MatchDetail> {
  const fdId     = String(match.id);
  const eventKey = espnEventKvKey(fdId);

  try {
    // 1. Event KV cache
    const cached = await kv.get<CachedEspnEvents>(eventKey);
    if (cached) {
      console.log(
        `[ESPN-ENRICH] kv-hit match:${fdId}` +
        ` | goals:${cached.goals.length}` +
        ` | bookings:${cached.bookings.length}` +
        ` | subs:${cached.substitutions.length}`,
      );
      return applyEspnEvents(match, cached);
    }

    // 2. Resolve ESPN event ID
    const espnId = await resolveEspnMatchId(match);
    if (!espnId) {
      console.warn(`[ESPN-ENRICH] lookup-miss match:${fdId} — no ESPN event ID`);
      return match;
    }

    // 3. Fetch events from ESPN (1 API call)
    const raw: EspnMatchEvents | null = await getEspnMatchEvents(espnId);
    if (!raw) {
      console.warn(`[ESPN-ENRICH] summary-miss match:${fdId} espnId:${espnId}`);
      return match;
    }

    const events: CachedEspnEvents = {
      goals:         raw.goals,
      bookings:      raw.bookings,
      substitutions: raw.substitutions,
      espnMatchId:   espnId,
      enrichedAt:    Date.now(),
    };

    // 4. Cache events — fire-and-forget, 12-hour TTL
    kv.set(eventKey, events, { ex: ESPN_EVENT_TTL_SEC }).catch((err) =>
      console.error(`[ESPN-ENRICH] event-write failed match:${fdId}:`, err),
    );

    console.log(
      `[ESPN-ENRICH] fresh match:${fdId} espnId:${espnId}` +
      ` | goals:${events.goals.length}` +
      ` | bookings:${events.bookings.length}` +
      ` | subs:${events.substitutions.length}`,
    );

    return applyEspnEvents(match, events);
  } catch (err) {
    console.error(
      `[ESPN-ENRICH] failed match:${fdId}:`,
      err instanceof Error ? err.message : err,
    );
    return match; // best-effort fallback to unenriched
  }
}

function applyEspnEvents(match: MatchDetail, events: CachedEspnEvents): MatchDetail {
  return {
    ...match,
    goals:         events.goals,
    bookings:      events.bookings,
    substitutions: events.substitutions,
  };
}
