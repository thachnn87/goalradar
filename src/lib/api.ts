import { Match, MatchDetail, HeadToHead, StandingTable, TeamDetail } from './types';
import { withCache, TTL } from './cache';
import { withKVCache, SWR, readKVOnly } from './kv-cache';
import { recordAuditCall } from './api-audit';
import { getCachedLiveMatches, getCachedWCLiveMatches } from './live-cache';
import { providerManager } from './providers/manager';
import { recordDataSource } from './data-source-tracker';

const BASE_URL = 'https://api.football-data.org/v4';

// ---------------------------------------------------------------------------
// Error types (defined in errors.ts to avoid circular imports; re-exported
// here for backward compatibility so all existing `from '@/lib/api'` imports
// of NotFoundError / ApiUnavailableError continue to work unchanged).
// ---------------------------------------------------------------------------

export { NotFoundError, ApiUnavailableError } from './errors';
import { NotFoundError, ApiUnavailableError } from './errors';
// DATA-2: snapshot-authoritative state overlay (forward-only transitions)
import { overlayMatchStates, STATE_RANK } from './match-state-overlay';

// ---------------------------------------------------------------------------
// HTTP layer  (retry + timeout + 429 back-off + Next.js ISR)
// ---------------------------------------------------------------------------

/** Parse the `Retry-After` response header.
 *  Returns seconds to wait, capped at 60 s so we never block a response
 *  for more than a minute.  Returns 0 if the header is absent or invalid. */
function parseRetryAfter(headers: Headers): number {
  const raw = headers.get('retry-after');
  if (!raw) return 0;
  // Numeric form: "Retry-After: 30"
  const seconds = parseInt(raw, 10);
  if (!isNaN(seconds)) return Math.min(seconds, 60);
  // HTTP-date form: "Retry-After: Wed, 21 Oct 2015 07:28:00 GMT"
  const date = Date.parse(raw);
  if (!isNaN(date)) return Math.min(Math.ceil((date - Date.now()) / 1000), 60);
  return 0;
}

async function fetchFromAPI<T>(endpoint: string, revalidate: number): Promise<T> {
  // NOTE: fetchFromAPI is legacy dead-code — all public api.ts functions now
  // route through providerManager → FootballDataProvider (which uses its own
  // rate-limited fetchRaw). Kept here for backward compatibility only.
  // Retry policy mirrors football-data.ts: 403 never retried, 5xx/timeout max
  // 1 retry, 429 waits exact Retry-After then 1 retry.
  const MAX_ATTEMPTS = 2; // 1 initial + max 1 retry

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller  = new AbortController();
    const timeoutId   = setTimeout(() => controller.abort(), 10_000);
    const _fetchStart = Date.now();
    let   res!: Response;

    try {
      res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY ?? '' },
        next:    { revalidate },
        signal:  controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      console.error(
        `[API] ${isTimeout ? 'TIMEOUT' : 'FETCH_ERROR'} ${endpoint}` +
        ` (attempt ${attempt}/${MAX_ATTEMPTS}): ${isTimeout ? '10s exceeded' : (err instanceof Error ? err.message : String(err))}`,
      );
      if (attempt < MAX_ATTEMPTS) { await new Promise((r) => setTimeout(r, 1_000)); continue; }
      throw new ApiUnavailableError(isTimeout ? 'timeout' : 'unknown');
    }
    clearTimeout(timeoutId);

    if (res.ok) {
      recordAuditCall({ endpoint, source: 'network', durationMs: Date.now() - _fetchStart });
      return res.json() as Promise<T>;
    }

    const body = await res.text().catch(() => '');

    if (res.status === 404) {
      console.warn(`[API] 404 ${endpoint}`);
      throw new NotFoundError();
    }

    // 403 — account/key disabled; NEVER retry.
    if (res.status === 403) {
      console.error(`[PROVIDER_DISABLED] api.ts | endpoint=${endpoint} | ${body.slice(0, 120)}`);
      throw new ApiUnavailableError('disabled');
    }

    // 429 — respect Retry-After exactly; one retry only.
    if (res.status === 429) {
      const retryAfterSec = parseRetryAfter(res.headers);
      const waitMs        = retryAfterSec > 0 ? retryAfterSec * 1_000 : 60_000;
      console.warn(
        `[RETRY_AFTER] api.ts | endpoint=${endpoint} | waitMs=${waitMs}` +
        ` | attempt=${attempt}/${MAX_ATTEMPTS}`,
      );
      if (attempt < MAX_ATTEMPTS) { await new Promise((r) => setTimeout(r, waitMs)); continue; }
      throw new ApiUnavailableError('rate_limit');
    }

    // 5xx — one retry after 1 s.
    if (res.status >= 500) {
      console.error(`[API] ${res.status} SERVER_ERROR ${endpoint} (attempt ${attempt}/${MAX_ATTEMPTS}): ${body.slice(0, 200)}`);
      if (attempt < MAX_ATTEMPTS) { await new Promise((r) => setTimeout(r, 1_000)); continue; }
      throw new ApiUnavailableError('http');
    }

    // Other 4xx — never retry.
    console.error(`[API] ${res.status} ${endpoint}: ${body.slice(0, 200)}`);
    throw new ApiUnavailableError('http');
  }

  throw new ApiUnavailableError();
}

// ---------------------------------------------------------------------------
// Cache routing helpers
//
// Three-tier caching strategy:
//   L1 (in-memory, cache.ts)   — sub-ms, per-process, stale-on-error fallback.
//   L2 (Vercel KV, kv-cache.ts) — ~10 ms Redis, cross-instance SWR,
//                                  disaster-recovery key (7-day TTL).
//   L3 (Next.js fetch cache)   — CDN / ISR, via `next: { revalidate }`.
//
// fetchWithKV  — L1 → L2 (KV/SWR) → L3/network
//   Used for: fixtures, standings, match details, WC structural data.
//
// fetchDirect  — L1 → L3/network (no KV — data too volatile for KV overhead)
//   Used for: today's matches.
//             (live matches route through live-cache.ts: L1 → L2/KV → API)
// ---------------------------------------------------------------------------

function fetchWithKV<T>(
  endpoint: string,
  memTtl:   number,
  swr:      { fresh: number; stale: number },
): Promise<T> {
  return withCache<T>(
    endpoint,
    memTtl,
    () => withKVCache<T>(
      endpoint,
      swr,
      () => fetchFromAPI<T>(endpoint, swr.fresh),
    ),
  );
}

function fetchDirect<T>(endpoint: string, memTtl: number): Promise<T> {
  return withCache<T>(
    endpoint,
    memTtl,
    () => fetchFromAPI<T>(endpoint, memTtl),
  );
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

// ── NOT cached in KV (too volatile for KV overhead) ─────────────────────────

export function getTodayMatches(): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  const key   = `/matches?dateFrom=${today}&dateTo=${today}`;
  // L1 → L2 KV (SWR) → provider.  KV layer added in PERF-4.5 so page-safe
  // variant (getTodayMatchesCached) can read from KV without calling provider.
  return withCache(
    key,
    TTL.MATCH,
    () => withKVCache(
      key,
      SWR.MATCH,
      () => providerManager.getTodayMatches(),
    ),
  );
}

export function getLiveMatches(): Promise<{ matches: Match[] }> {
  // Routes through providerManager → failover to api-football on FD outage.
  return getCachedLiveMatches(
    () => providerManager.getLiveMatches(),
  );
}

export function getWCLiveMatches(): Promise<{ matches: Match[] }> {
  // Shares the same KV key (goalradar:live:matches) as getLiveMatches().
  // The WC-only filter is applied in live-cache.ts after reading from cache —
  // no separate API call or KV key is needed.
  return getCachedWCLiveMatches(
    () => providerManager.getLiveMatches(),
  );
}

// ── KV-cached: Fixtures (15 min) ─────────────────────────────────────────────

export function getUpcomingMatches(
  competition: string,
): Promise<{ matches: Match[]; resultSet: { count: number } }> {
  // Routes through providerManager — cache wraps the provider call.
  return withCache(
    `/competitions/${competition}/matches?status=SCHEDULED,TIMED`,
    TTL.FIXTURES,
    () => withKVCache(
      `/competitions/${competition}/matches?status=SCHEDULED,TIMED`,
      SWR.FIXTURES,
      () => providerManager.getFixtures(competition),
    ),
  );
}

export function getRecentMatches(
  competition: string,
): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  const from  = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const cacheKey = `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${today}`;
  return withCache(
    cacheKey,
    TTL.FIXTURES,
    () => withKVCache(
      cacheKey,
      SWR.FIXTURES,
      () => providerManager.getResults(competition),
    ),
  );
}

export function getTeamMatches(id: string): Promise<{ matches: Match[] }> {
  return withCache(
    `/teams/${id}/matches?status=FINISHED&limit=10`,
    TTL.FIXTURES,
    () => withKVCache(
      `/teams/${id}/matches?status=FINISHED&limit=10`,
      SWR.FIXTURES,
      () => providerManager.getTeamMatches(id),
    ),
  );
}

export function getWCResults(): Promise<{ matches: Match[] }> {
  // Finished WC matches — routes through providerManager for failover.
  return withCache(
    '/competitions/WC/matches?status=FINISHED',
    TTL.FIXTURES,
    () => withKVCache(
      '/competitions/WC/matches?status=FINISHED',
      SWR.FIXTURES,
      () => providerManager.getResults('WC'),
    ),
  );
}

// ── KV-cached: WC structural data (6 hours) ──────────────────────────────────

export function getWCKnockoutMatches(): Promise<{ matches: Match[] }> {
  // All 104 WC matches — routes through providerManager for failover.
  return withCache(
    '/competitions/WC/matches',
    TTL.WC,
    () => withKVCache(
      '/competitions/WC/matches',
      SWR.WC,
      () => providerManager.getAllMatches('WC'),
    ),
  ).catch(() => {
    console.warn('[DATA_SOURCE] empty | getWCKnockoutMatches — provider + KV failed, returning empty');
    return { matches: [] };
  });
}

// ── KV-cached: Standings (1 hour) ────────────────────────────────────────────

export function getStandings(competition: string): Promise<{
  standings:   StandingTable[];
  competition: { name: string; emblem: string };
}> {
  // Routes through providerManager — cache wraps the provider call.
  return withCache(
    `/competitions/${competition}/standings`,
    TTL.STANDINGS,
    () => withKVCache(
      `/competitions/${competition}/standings`,
      SWR.STANDINGS,
      () => providerManager.getStandings(competition),
    ),
  );
}

export function getTeam(id: string): Promise<TeamDetail> {
  return withCache(
    `/teams/${id}`,
    TTL.STANDINGS,
    () => withKVCache(
      `/teams/${id}`,
      SWR.STANDINGS,
      () => providerManager.getTeam(id),
    ),
  );
}

// ── KV-cached: Match details (1 min) ─────────────────────────────────────────

export function getMatchDetail(id: string): Promise<MatchDetail> {
  // Routes through providerManager — cache wraps the provider call.
  return withCache(
    `/matches/${id}`,
    TTL.MATCH,
    () => withKVCache(
      `/matches/${id}`,
      SWR.MATCH,
      () => providerManager.getMatch(parseInt(id, 10)),
    ),
  );
}

export function getHeadToHead(id: string): Promise<HeadToHead> {
  return withCache(
    `/matches/${id}/head2head`,
    TTL.MATCH,
    () => withKVCache(
      `/matches/${id}/head2head`,
      SWR.MATCH,
      () => providerManager.getHeadToHead(id),
    ),
  );
}

// ============================================================================
// Page-safe API functions — PERF-4.5
//
// These variants NEVER call providerManager.  They read from:
//   1. L1 in-memory (withCache, same TTL as the live counterpart)
//   2. L2 KV read-only (readKVOnly — no SWR trigger, no bg-revalidation)
//   3. Static WC bundled data (last resort for WC endpoints)
//
// Provider calls are the exclusive responsibility of the cron orchestrator.
// All page renders must use these functions for the browsed endpoints.
// ============================================================================

/**
 * Page-safe upcoming matches.
 * Falls back to bundled static WC fixtures for WC; empty array for leagues.
 */
export async function getUpcomingMatchesCached(
  competition: string,
): Promise<{ matches: Match[]; resultSet: { count: number } }> {
  const key = `/competitions/${competition}/matches?status=SCHEDULED,TIMED`;
  try {
    // DATA-2: overlay runs OUTSIDE withCache so snapshot freshness is never
    // pinned to the L1 TTL — every consumer (pages, snapshot builds, sitemap)
    // gets snapshot-authoritative state on every call. KV mget only.
    const data = await withCache(key, TTL.FIXTURES, async () => {
      const data = await readKVOnly<{ matches: Match[]; resultSet: { count: number } }>(key);
      if (data) return data;
      return { matches: [], resultSet: { count: 0 } };
    });
    return { ...data, matches: await overlayMatchStates(data.matches) };
  } catch {
    return { matches: [], resultSet: { count: 0 } };
  }
}

/**
 * Page-safe recent matches.
 * Falls back to bundled static WC matches filtered to FINISHED for WC.
 */
export async function getRecentMatchesCached(
  competition: string,
): Promise<{ matches: Match[] }> {
  const today    = new Date().toISOString().split('T')[0];
  const from     = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const key      = `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${today}`;
  try {
    const data = await withCache(key, TTL.FIXTURES, async () => {
      const inner = await readKVOnly<{ matches: Match[] }>(key);
      if (inner) return inner;
      return { matches: [] };
    });
    // DATA-2: snapshot-authoritative state (fresher live scores on this list)
    return { matches: await overlayMatchStates(data.matches) };
  } catch {
    return { matches: [] };
  }
}

/**
 * Page-safe WC finished results.
 * Falls back to static WC FINISHED matches.
 */
export async function getWCResultsCached(): Promise<{ matches: Match[] }> {
  const key = '/competitions/WC/matches?status=FINISHED';
  try {
    const data = await withCache(key, TTL.FIXTURES, async () => {
      const inner = await readKVOnly<{ matches: Match[] }>(key);
      if (inner) return inner;
      return { matches: [] };
    });
    // DATA-2: snapshot-authoritative state
    return { matches: await overlayMatchStates(data.matches) };
  } catch {
    return { matches: [] };
  }
}

/**
 * Page-safe standings.
 * Falls back to bundled static WC group tables for WC; empty for leagues.
 */
export async function getStandingsCached(competition: string): Promise<{
  standings:   StandingTable[];
  competition: { name: string; emblem: string };
}> {
  const key = `/competitions/${competition}/standings`;
  const wcMeta = { name: 'FIFA World Cup 2026', emblem: '' };
  const empty  = { standings: [] as StandingTable[], competition: { name: '', emblem: '' } };
  try {
    return await withCache(key, TTL.STANDINGS, async () => {
      const data = await readKVOnly<{ standings: StandingTable[]; competition: { name: string; emblem: string } }>(key);
      if (data) return data;
      if (competition === 'WC') {
        return { standings: [], competition: wcMeta };
      }
      return empty;
    });
  } catch {
    if (competition === 'WC') {
      return { standings: [], competition: wcMeta };
    }
    return empty;
  }
}

/**
 * Page-safe all WC matches (bracket / knockout).
 * Falls back to bundled static fixtures.
 */
export async function getWCKnockoutMatchesCached(): Promise<{ matches: Match[] }> {
  const key = '/competitions/WC/matches';
  try {
    const data = await withCache(key, TTL.WC, async () => {
      const inner = await readKVOnly<{ matches: Match[] }>(key);
      if (inner) return inner;
      return { matches: [] };
    });
    // DATA-2: snapshot-authoritative state — critical here, the bulk WC list
    // has a 6 h L1 TTL and would otherwise lag every transition.
    return { matches: await overlayMatchStates(data.matches) };
  } catch {
    return { matches: [] };
  }
}

/**
 * Page-safe live WC matches.
 * Live data routes through live-cache.ts which is already KV-backed (30s TTL).
 * This is an alias that makes the page-safe intent explicit.
 */
export async function getWCLiveMatchesCached(): Promise<{ matches: Match[] }> {
  // live-cache.ts already reads from KV and only calls the provider when KV misses.
  // It uses the same pattern as readKVOnly but with a 30s TTL.
  // DATA-2: overlay drops the stale-live window — a match that has since
  // FINISHED (per its snapshot) is filtered out of the live list.
  const data = await getWCLiveMatches();
  const merged = await overlayMatchStates(data.matches);
  return { matches: merged.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED') };
}

/**
 * Page-safe live matches (all competitions).
 * Same as getWCLiveMatchesCached but for all competitions.
 */
export function getLiveMatchesCached(): Promise<{ matches: Match[] }> {
  return getLiveMatches();
}

/**
 * Page-safe today's matches.
 *
 * getTodayMatches() previously had no KV layer (fetchDirect).  This variant
 * adds KV read-only access so the provider is never called from a page render.
 * Falls back to empty (all-competition "today" has no static dataset).
 */
export async function getTodayMatchesCached(): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  const key   = `/matches?dateFrom=${today}&dateTo=${today}`;
  try {
    const data = await withCache(key, TTL.MATCH, async () => {
      const inner = await readKVOnly<{ matches: Match[] }>(key);
      if (inner) return inner;
      // No static fallback for cross-competition today view — return empty
      // (cron will populate this on next run via refreshEndpoint)
      console.warn('[API] getTodayMatchesCached: KV miss, returning empty');
      return { matches: [] };
    });
    // DATA-2: snapshot-authoritative state
    return { matches: await overlayMatchStates(data.matches) };
  } catch {
    return { matches: [] };
  }
}

// ---------------------------------------------------------------------------
// DATA-17: Canonical match type
// ---------------------------------------------------------------------------

/**
 * A Match that has passed through the full authority stack:
 *   Live cache (30s) → per-match snapshot (ESPN-enriched, 7d) → FD bulk feeds
 * Named alias makes the intent explicit at call sites and in return types.
 */
export type CanonicalMatch = Match;

/**
 * Single authoritative WC match list — DATA-4 unified authority.
 *
 * Problem: `getUpcomingMatchesCached` reads only the SCHEDULED/TIMED KV feed.
 * When a match finishes, it stays in that feed until the cron refreshes it.
 * `overlayMatchStates` bridges the gap via per-match snapshots, but snapshots
 * can expire (60 s TIMED TTL) or be absent — leaving the stale SCHEDULED entry
 * visible on fixtures/hub/schedule pages even when the results feed is correct.
 *
 * Fix: merge the upcoming (SCHEDULED/TIMED) feed with the recent (FINISHED)
 * feed using the forward-only STATE_RANK rule — FINISHED always beats
 * SCHEDULED/TIMED for the same match ID. Per-match snapshot overlay is then
 * applied on top for live-score freshness.
 *
 * This means FINISHED detection no longer depends on a per-match snapshot
 * existing in KV; it relies on the bulk results feed which the cron maintains
 * independently and which is correct within one 15-min cron cycle.
 *
 * Constraints: no new KV writes, no provider calls, no new caches, no ISR change.
 */
export async function getWCAuthorityMatchesCached(): Promise<{ matches: Match[] }> {
  // DATA-16D: use getWCResultsCached() (stable key: /competitions/WC/matches?status=FINISHED)
  // instead of getRecentMatchesCached('WC') (date-scoped key that rotates daily at midnight UTC
  // and has no DR fallback, causing "No results" windows between cron runs).
  const [upcomingResult, recentResult, liveResult] = await Promise.allSettled([
    getUpcomingMatchesCached('WC'),
    getWCResultsCached(),
    getWCLiveMatches(),
  ]);

  const upcoming = upcomingResult.status === 'fulfilled' ? upcomingResult.value.matches : [];
  const recent   = recentResult.status  === 'fulfilled' ? recentResult.value.matches   : [];
  const live     = liveResult.status    === 'fulfilled' ? liveResult.value.matches     : [];

  // Merge by ID — forward-only: higher STATE_RANK wins.
  // upcoming feed carries all 104 WC fixtures (SCHEDULED/TIMED).
  // recent feed carries the last 30 days; FINISHED entries supersede stale SCHEDULED ones.
  // live feed carries IN_PLAY/PAUSED (rank 2 > SCHEDULED rank 0) — fills the gap where the
  // recent feed hasn't been refreshed since kickoff (up to the 30-min skip-guard window).
  const byId = new Map<number, Match>();
  for (const m of upcoming) byId.set(m.id, m);
  for (const m of recent) {
    const existing = byId.get(m.id);
    if (!existing || (STATE_RANK[m.status] ?? 0) >= (STATE_RANK[existing.status] ?? 0)) {
      byId.set(m.id, m);
    }
  }
  for (const m of live) {
    const existing = byId.get(m.id);
    if (!existing || (STATE_RANK[m.status] ?? 0) >= (STATE_RANK[existing.status] ?? 0)) {
      byId.set(m.id, m);
    }
  }

  // Snapshot overlay runs last — advances IN_PLAY scores and catches any
  // FINISHED transitions the bulk feeds haven't propagated yet.
  return { matches: await overlayMatchStates([...byId.values()]) };
}

/**
 * DATA-17: Single World Cup authority entry point.
 *
 * Public alias of getWCAuthorityMatchesCached() with explicit CanonicalMatch
 * return type. All WC pages must call this function — never the separate
 * getUpcomingMatchesCached / getRecentMatchesCached / getWCResultsCached calls.
 *
 * Merge priority (higher STATE_RANK wins):
 *   1. Live cache       (IN_PLAY/PAUSED, 30 s TTL)
 *   2. WC results feed  (FINISHED, 12 h TTL, stable key)
 *   3. WC upcoming feed (SCHEDULED/TIMED, 30 min TTL)
 *   4. Snapshot overlay (per-match ESPN-enriched snapshots, 7 d TTL for FINISHED)
 *
 * Returns all 104 WC matches in their authoritative state. Pages split them
 * into display buckets using classifyMatchState(m, today).
 */
export async function getWCAuthorityMatches(): Promise<{ matches: CanonicalMatch[] }> {
  return getWCAuthorityMatchesCached();
}

/**
 * Page-safe match detail — reads from KV without SWR trigger.
 * Used inside buildSnapshot fallback path only.
 */
export async function getMatchDetailCached(id: string): Promise<MatchDetail | null> {
  const key  = `/matches/${id}`;
  try {
    return await withCache(key, TTL.MATCH, async () => {
      const data = await readKVOnly<MatchDetail>(key);
      if (data) return data;
      throw new Error(`[CACHE] match ${id} not in KV`);
    });
  } catch {
    return null;
  }
}

/**
 * Page-safe head-to-head — reads from KV without SWR trigger.
 * Returns null on KV miss (callers must handle null H2H gracefully).
 */
export async function getHeadToHeadCached(id: string): Promise<HeadToHead | null> {
  const key = `/matches/${id}/head2head`;
  try {
    return await withCache(key, TTL.MATCH, async () => {
      const data = await readKVOnly<HeadToHead>(key);
      return data ?? null;
    });
  } catch {
    return null;
  }
}

/**
 * Page-safe team match history (recent form).
 * Returns empty on KV miss — no static fallback for team-specific data.
 * The cron orchestrator pre-warms team matches for WC squads via snapshot builds.
 */
export async function getTeamMatchesCached(id: string): Promise<{ matches: Match[] }> {
  const key = `/teams/${id}/matches?status=FINISHED&limit=10`;
  try {
    return await withCache(key, TTL.FIXTURES, async () => {
      const data = await readKVOnly<{ matches: Match[] }>(key);
      if (data) return data;
      console.warn(`[API] getTeamMatchesCached: KV miss for team ${id}, returning empty`);
      return { matches: [] };
    });
  } catch {
    return { matches: [] };
  }
}

/**
 * Page-safe team detail.
 * Returns null on KV miss — callers must handle null gracefully.
 */
export async function getTeamCached(id: string): Promise<TeamDetail | null> {
  const key = `/teams/${id}`;
  try {
    return await withCache(key, TTL.STANDINGS, async () => {
      const data = await readKVOnly<TeamDetail>(key);
      return data ?? null;
    });
  } catch {
    return null;
  }
}
