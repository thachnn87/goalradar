/**
 * af-id-map.ts
 *
 * DATA-11B: Cross-ID mapping between football-data.org match IDs and
 * api-football fixture IDs for WC 2026.
 *
 * Two providers use completely different internal IDs for the same match.
 * The deterministic key (homeTeam + awayTeam + kickoffUTC) is unique within
 * a single WC tournament — confirmed zero collisions in a 20-match sample
 * (DATA11A_HYBRID_FEASIBILITY.md §4).
 *
 * KV keys:
 *   goalradar:af:lookup:WC:2026   — normalised-key → af-fixture-id  (24h TTL)
 *   goalradar:af:events:{fd-id}   — cached AF event payload          (7-day TTL)
 *
 * Feature flag:
 *   ENABLE_AF_ENRICHMENT=true     — must be explicitly set; defaults OFF
 */

import { kv }                  from '@vercel/kv';
import { ApiFootballProvider } from './providers/api-football';
import type { Match, MatchDetail } from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

const AF_KEY_CONFIGURED =
  typeof process.env.API_FOOTBALL_KEY === 'string' &&
  process.env.API_FOOTBALL_KEY.trim() !== '';

/**
 * Feature flag: set ENABLE_AF_ENRICHMENT=true to enable post-match event
 * enrichment. Requires API_FOOTBALL_KEY and KV to be configured.
 * Defaults OFF — must be explicitly opted in.
 */
export const AF_ENRICHMENT_ENABLED =
  process.env.ENABLE_AF_ENRICHMENT === 'true' && AF_KEY_CONFIGURED && KV_ENABLED;

// ---------------------------------------------------------------------------
// KV key constants
// ---------------------------------------------------------------------------

export const AF_LOOKUP_KV_KEY  = 'goalradar:af:lookup:WC:2026';
export const AF_LOOKUP_TTL_SEC = 24 * 3600;       // 24 h — refresh daily
export const AF_EVENTS_TTL_SEC = 7 * 24 * 3600;   // 7 days — FINISHED events never change

export function afEventsKvKey(fdMatchId: string | number): string {
  return `goalradar:af:events:${fdMatchId}`;
}

// ---------------------------------------------------------------------------
// Team name aliases
// ---------------------------------------------------------------------------

/**
 * Maps known variant spellings to a single canonical token.
 * Both football-data.org variants and api-football variants are listed so
 * both sides normalise to the same string before building the mapping key.
 */
const CANONICAL_ALIASES: Record<string, string> = {
  // football-data.org names → canonical
  'czechia':            'czech republic',
  'bosnia-herzegovina': 'bosnia',
  'cape verde islands': 'cape verde',
  // Defensive: api-football variants that diverge from football-data.org
  'korea republic':     'south korea',
  "cote d'ivoire":      'ivory coast',
};

// ---------------------------------------------------------------------------
// buildMappingKey
// ---------------------------------------------------------------------------

/**
 * Build the deterministic cross-provider mapping key for a match.
 *
 * Format: "{homeTeam}|{awayTeam}|{YYYY-MM-DDTHH:MMZ}"
 *
 * All team names are lowercased, diacritics stripped, and canonical aliases
 * applied so that football-data.org "Czechia" and api-football "Czech Republic"
 * both resolve to the same key.
 */
export function buildMappingKey(
  match: Pick<Match, 'homeTeam' | 'awayTeam' | 'utcDate'>,
): string {
  const home = normaliseTeamName(match.homeTeam.name);
  const away = normaliseTeamName(match.awayTeam.name);
  const ts   = match.utcDate.slice(0, 16) + 'Z'; // truncate to YYYY-MM-DDTHH:MMZ
  return `${home}|${away}|${ts}`;
}

function normaliseTeamName(name: string): string {
  const stripped = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip diacritics (Curaçao, Côte d'Ivoire, etc.)
  return CANONICAL_ALIASES[stripped] ?? stripped;
}

// ---------------------------------------------------------------------------
// resolveAfFixtureId
// ---------------------------------------------------------------------------

/**
 * Return the api-football fixture ID for a football-data.org match.
 *
 * Reads goalradar:af:lookup:WC:2026 from KV.
 * Returns null if the table is absent or the match is not in it.
 * Never throws — all errors return null.
 */
export async function resolveAfFixtureId(
  match: Pick<Match, 'homeTeam' | 'awayTeam' | 'utcDate'>,
): Promise<number | null> {
  if (!KV_ENABLED) return null;

  try {
    const table = await kv.get<Record<string, number>>(AF_LOOKUP_KV_KEY);
    if (!table) {
      console.warn('[AF-ID-MAP] lookup table absent — run refreshAfLookupTable()');
      return null;
    }

    const key = buildMappingKey(match);
    const afId = table[key];

    if (afId !== undefined) return afId;

    console.warn(`[AF-ID-MAP] no entry for key="${key}" — alias missing or table stale`);
    return null;
  } catch (err) {
    console.error('[AF-ID-MAP] KV read error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// refreshAfLookupTable
// ---------------------------------------------------------------------------

export interface LookupTableResult {
  count:      number;
  key:        string;
  collisions: string[];
}

/**
 * Fetch all WC 2026 fixtures from api-football and rebuild the lookup table.
 *
 * Costs exactly 1 api-football API call (GET /fixtures?league=1&season=2026).
 * Writes goalradar:af:lookup:WC:2026 with 24h TTL.
 *
 * Throws if KV or api-football is not configured.
 */
export async function refreshAfLookupTable(): Promise<LookupTableResult> {
  if (!KV_ENABLED)       throw new Error('KV not configured — set KV_REST_API_URL + KV_REST_API_TOKEN');
  if (!AF_KEY_CONFIGURED) throw new Error('API_FOOTBALL_KEY not configured');

  const provider = new ApiFootballProvider();
  const { matches } = await provider.getAllMatches('WC');

  const table: Record<string, number> = {};
  const collisions: string[] = [];

  for (const m of matches) {
    const key = buildMappingKey(m);
    if (key in table) {
      collisions.push(`key="${key}" af_ids=${table[key]} vs ${m.id}`);
    }
    // m.id is the api-football fixture ID: normaliseMatch sets id = item.fixture.id
    table[key] = m.id;
  }

  await kv.set(AF_LOOKUP_KV_KEY, table, { ex: AF_LOOKUP_TTL_SEC });

  console.log(
    `[AF-ID-MAP] table refreshed | count=${matches.length}` +
    ` | collisions=${collisions.length} | ttl=${AF_LOOKUP_TTL_SEC}s`,
  );
  if (collisions.length > 0) console.warn('[AF-ID-MAP] collisions:', collisions);

  return { count: matches.length, key: AF_LOOKUP_KV_KEY, collisions };
}

// ---------------------------------------------------------------------------
// Cached event payload schema
// ---------------------------------------------------------------------------

export interface CachedAFEvents {
  goals:         MatchDetail['goals'];
  bookings:      MatchDetail['bookings'];
  substitutions: MatchDetail['substitutions'];
  venue:         string | null;
  afFixtureId:   number;
  enrichedAt:    number; // epoch ms
}

// ---------------------------------------------------------------------------
// enrichMatchWithAFEvents
// ---------------------------------------------------------------------------

/**
 * Enrich a FINISHED match with event data from api-football.
 *
 * Flow:
 *   1. Check goalradar:af:events:{fd-id} KV cache — return immediately on hit
 *   2. Resolve api-football fixture ID from lookup table
 *   3. Call ApiFootballProvider.getMatch(afId) — costs 2 api-football requests
 *   4. Write result to goalradar:af:events:{fd-id} (7-day TTL, fire-and-forget)
 *   5. Return enriched MatchDetail
 *
 * Best-effort: any failure returns the original match unchanged.
 */
export async function enrichMatchWithAFEvents(match: MatchDetail): Promise<MatchDetail> {
  const fdId      = String(match.id);
  const eventsKey = afEventsKvKey(fdId);

  try {
    // 1. Events KV cache
    const cached = await kv.get<CachedAFEvents>(eventsKey);
    if (cached) {
      console.log(
        `[AF-ENRICH] kv-hit match:${fdId} | goals:${cached.goals.length}` +
        ` | bookings:${cached.bookings.length} | subs:${cached.substitutions.length}`,
      );
      return applyEvents(match, cached);
    }

    // 2. Resolve AF fixture ID
    const afId = await resolveAfFixtureId(match);
    if (afId === null) {
      console.warn(`[AF-ENRICH] lookup-miss match:${fdId} — skipping enrichment`);
      return match;
    }

    // 3. Fetch from api-football (2 calls: base + events)
    const provider = new ApiFootballProvider();
    const afDetail = await provider.getMatch(afId);

    const events: CachedAFEvents = {
      goals:         afDetail.goals,
      bookings:      afDetail.bookings,
      substitutions: afDetail.substitutions,
      venue:         afDetail.venue,
      afFixtureId:   afId,
      enrichedAt:    Date.now(),
    };

    // 4. Cache events — fire-and-forget, 7-day TTL
    kv.set(eventsKey, events, { ex: AF_EVENTS_TTL_SEC }).catch((err) =>
      console.error(`[AF-ENRICH] cache-write failed match:${fdId}:`, err),
    );

    console.log(
      `[AF-ENRICH] fresh match:${fdId} | afId:${afId}` +
      ` | goals:${events.goals.length} bookings:${events.bookings.length}` +
      ` | subs:${events.substitutions.length}`,
    );

    return applyEvents(match, events);
  } catch (err) {
    console.error(
      `[AF-ENRICH] failed match:${fdId}:`,
      err instanceof Error ? err.message : err,
    );
    return match; // best-effort fallback to unenriched
  }
}

function applyEvents(match: MatchDetail, events: CachedAFEvents): MatchDetail {
  return {
    ...match,
    goals:         events.goals,
    bookings:      events.bookings,
    substitutions: events.substitutions,
    venue:         match.venue ?? events.venue,
  };
}
