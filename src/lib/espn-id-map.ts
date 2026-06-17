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
import { findEspnMatch, getEspnMatchEvents, normaliseName } from './providers/espn';
import type { EspnMatchEvents }                             from './providers/espn';
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

export const ESPN_LOOKUP_TTL_SEC = 30 * 24 * 3600; // 30 days — positive: ESPN IDs don't change
export const ESPN_EVENT_TTL_SEC  = 30 * 24 * 3600; // 30 days — FINISHED events never change (DATA-16)

/**
 * DATA-15C — Negative-cache backoff schedule.
 *
 * A lookup miss is usually transient (match not yet on ESPN, an alias/date gap
 * later fixed in code). The previous design stored a bare '__NOT_FOUND__'
 * sentinel with the 30-day positive TTL, cementing false negatives for an
 * entire tournament (see DATA15B_NEGATIVE_CACHE_AUDIT.md).
 *
 * Instead we store a structured LookupMiss and gate re-resolution by an
 * escalating backoff window computed from the attempt count:
 *
 *   attempt 1 → 15 min    attempt 2 → 1 h    attempt 3 → 6 h    attempt 4+ → 24 h
 *
 * NOTE on TTL: the backoff is enforced as a *computed retry window*
 * (now ≥ lastAttemptAt + backoff), NOT as the KV record's own TTL. A literal
 * per-attempt KV TTL would delete the record on expiry, losing the attempt
 * counter — so backoff could never escalate past attempt 1 and a permanently
 * absent match would be re-queried every 15 min forever. The record therefore
 * persists with a 7-day ceiling TTL (long enough to carry the counter across
 * retries, short enough to self-clean a match nobody views for a week).
 */
export const ESPN_NEG_BACKOFF_SEC = [15 * 60, 60 * 60, 6 * 3600, 24 * 3600] as const;
export const ESPN_NEG_RECORD_TTL_SEC = 7 * 24 * 3600; // 7 days — ceiling that preserves attempt counter

/** Legacy bare sentinel value written before DATA-15C. Read-compat only. */
export const ESPN_LEGACY_SENTINEL = '__NOT_FOUND__';

/** Structured negative-cache record (replaces the bare '__NOT_FOUND__' string). */
export interface LookupMiss {
  status:        'NOT_FOUND';
  reason:        string;
  firstMissAt:   number; // epoch ms — enables true age
  lastAttemptAt: number; // epoch ms — drives the backoff window
  attempts:      number; // 1-based; selects the backoff interval
}

/**
 * Backoff window (seconds) before the next retry is permitted, for a miss that
 * has been attempted `attempts` times. Clamps to the last bucket for attempt 4+.
 */
export function espnNegBackoffSec(attempts: number): number {
  const idx = Math.min(Math.max(attempts, 1), ESPN_NEG_BACKOFF_SEC.length) - 1;
  return ESPN_NEG_BACKOFF_SEC[idx];
}

/** True when a stored miss is still inside its backoff window (suppress retry). */
export function espnMissSuppressed(miss: LookupMiss, now: number): boolean {
  return now < miss.lastAttemptAt + espnNegBackoffSec(miss.attempts) * 1000;
}

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
  lineups:       MatchDetail['lineups'];
  espnMatchId:   string;
  enrichedAt:    number; // epoch ms
}

// ---------------------------------------------------------------------------
// resolveEspnMatchId
// ---------------------------------------------------------------------------

/**
 * Return the ESPN event ID for a football-data.org match ID.
 *
 * Flow (DATA-15C):
 *   1. Read goalradar:espn:lookup:{fdMatchId}.
 *        • positive (ESPN ID string)  → return it.
 *        • structured LookupMiss still inside its backoff window → return null
 *          (suppress, no ESPN call).
 *        • structured LookupMiss past its backoff window, OR a legacy
 *          '__NOT_FOUND__' sentinel → fall through and re-attempt.
 *   2. Query ESPN scoreboard via findEspnMatch() (1 ESPN API call).
 *   3a. Hit  → store the bare ESPN ID (30-day positive TTL).
 *   3b. Miss → store/update a structured LookupMiss (attempts++, escalating
 *        backoff; 7-day record ceiling).
 *
 * Returns null if ESPN has no matching event or on any error.
 */
export async function resolveEspnMatchId(match: MatchDetail): Promise<string | null> {
  if (!KV_ENABLED) return null;

  const fdId      = String(match.id);
  const lookupKey = espnLookupKvKey(fdId);
  const now       = Date.now();

  try {
    // 1. Lookup KV cache. Value is one of:
    //    string  → positive ESPN ID, OR the legacy '__NOT_FOUND__' sentinel
    //    object  → structured LookupMiss (DATA-15C)
    //    null    → absent
    const cached = await kv.get<string | LookupMiss>(lookupKey);

    let priorMiss: LookupMiss | null = null;

    if (typeof cached === 'string') {
      if (cached !== ESPN_LEGACY_SENTINEL) {
        return cached; // positive hit — ESPN ID
      }
      // Legacy bare sentinel: age unknown and untrustworthy (written with the old
      // 30-day TTL). Treat as a stale miss and re-attempt now so it self-heals.
      priorMiss = { status: 'NOT_FOUND', reason: 'legacy-sentinel', firstMissAt: now, lastAttemptAt: 0, attempts: 1 };
    } else if (cached && typeof cached === 'object' && cached.status === 'NOT_FOUND') {
      if (espnMissSuppressed(cached, now)) {
        return null; // inside backoff window — suppress, no ESPN call
      }
      priorMiss = cached; // backoff elapsed — re-attempt
    }

    // 2. Query ESPN scoreboard
    const espnId = await findEspnMatch(
      match.homeTeam.name,
      match.awayTeam.name,
      match.utcDate,
    );

    if (espnId) {
      // 3a. Positive — bare ID string, 30-day TTL (backward compatible).
      kv.set(lookupKey, espnId, { ex: ESPN_LOOKUP_TTL_SEC }).catch((err) =>
        console.error(`[ESPN-ID-MAP] lookup-write failed match:${fdId}:`, err),
      );
      const healed = priorMiss ? ' (healed prior miss)' : '';
      console.log(`[ESPN-ID-MAP] resolved match:${fdId} → espnId:${espnId}${healed}`);
      return espnId;
    }

    // 3b. Miss — structured LookupMiss with escalating backoff.
    const miss: LookupMiss = {
      status:        'NOT_FOUND',
      reason:        'no-scoreboard-match',
      firstMissAt:   priorMiss ? priorMiss.firstMissAt : now,
      lastAttemptAt: now,
      attempts:      (priorMiss?.attempts ?? 0) + 1,
    };
    kv.set(lookupKey, miss, { ex: ESPN_NEG_RECORD_TTL_SEC }).catch((err) =>
      console.error(`[ESPN-ID-MAP] miss-write failed match:${fdId}:`, err),
    );
    console.warn(
      `[ESPN-ID-MAP] no espn match found for fd:${fdId}` +
      ` | attempt:${miss.attempts} | next-retry-in:${espnNegBackoffSec(miss.attempts)}s`,
    );
    return null;
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
      lineups:       raw.lineups ?? null,
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
  // ESPN team IDs differ from FD team IDs. Resolve each event's team back to
  // the FD team object so that MatchStatistics (which filters by team.id) works.
  const normHome = normaliseName(match.homeTeam.name);
  const normAway = normaliseName(match.awayTeam.name);

  function resolveTeam<T extends { name: string; shortName?: string }>(
    espnTeam: T | null | undefined,
  ): typeof match.homeTeam | T | null | undefined {
    if (!espnTeam) return espnTeam;
    const n = normaliseName(espnTeam.name);
    const ns = normaliseName(espnTeam.shortName ?? '');
    if (n === normHome || ns === normHome) return match.homeTeam;
    if (n === normAway || ns === normAway) return match.awayTeam;
    return espnTeam;
  }

  // Obj 6 (DATA-16): validate goal count against FD score; log a warning if mismatch.
  const ftH = match.score?.fullTime?.home ?? 0;
  const ftA = match.score?.fullTime?.away ?? 0;
  const scoreTotal = ftH + ftA;
  const goalCount  = events.goals?.length ?? 0;
  if (scoreTotal > 0 && goalCount !== scoreTotal) {
    console.warn(
      `[ESPN-ENRICH] STATS-MISMATCH match:${match.id}` +
      ` | fdScore=${ftH}-${ftA} (total=${scoreTotal})` +
      ` | espnGoals=${goalCount}` +
      ` | espnId=${events.espnMatchId}`,
    );
  }

  return {
    ...match,
    goals:         events.goals?.map((g) => ({ ...g, team: resolveTeam(g.team) ?? g.team })),
    bookings:      events.bookings?.map((b) => ({ ...b, team: resolveTeam(b.team) ?? b.team })),
    substitutions: events.substitutions?.map((s) => ({ ...s, team: resolveTeam(s.team) ?? s.team })),
    lineups:       events.lineups ?? null,
  };
}
