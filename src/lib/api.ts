import { Match, MatchDetail, HeadToHead, StandingTable, TeamDetail } from './types';
import { withCache, TTL } from './cache';

const BASE_URL = 'https://api.football-data.org/v4';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

// Thrown when the resource genuinely does not exist (HTTP 404).
export class NotFoundError extends Error {
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
  }
}

// Thrown for every other failure — never contains internal details.
export class ApiUnavailableError extends Error {
  constructor() {
    super('Data temporarily unavailable');
    this.name = 'ApiUnavailableError';
  }
}

// ---------------------------------------------------------------------------
// HTTP layer — handles auth, retry, timeout, and Next.js ISR
// ---------------------------------------------------------------------------

/**
 * Performs the actual HTTP request to football-data.org.
 * Called by fetchAPI only on a cache miss.
 *
 * Two layers of caching:
 *   1. In-memory (cache.ts) — sub-millisecond repeated reads, request dedup.
 *   2. Next.js fetch cache (next: { revalidate }) — CDN / ISR fallback.
 */
async function fetchFromAPI<T>(endpoint: string, revalidate: number): Promise<T> {
  const retries = 2; // one initial + one retry

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY ?? '' },
        next:    { revalidate }, // Next.js ISR / CDN cache
        signal:  controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(
          `[Football API] HTTP ${res.status} on ${endpoint} (attempt ${attempt}/${retries}):`,
          body.slice(0, 200)
        );
        if (res.status === 404) throw new NotFoundError();
        throw new ApiUnavailableError();
      }

      return res.json() as Promise<T>;

    } catch (err) {
      clearTimeout(timeoutId);

      // NotFoundError is definitive — propagate immediately, no retry.
      if (err instanceof NotFoundError) throw err;

      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      console.error(
        `[Football API] Attempt ${attempt}/${retries} failed on ${endpoint}:`,
        isTimeout ? 'timeout (10 s)' : (err instanceof Error ? err.message : String(err))
      );

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      throw new ApiUnavailableError();
    }
  }

  throw new ApiUnavailableError(); // TypeScript exhaustiveness
}

// ---------------------------------------------------------------------------
// Cached fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Entry point for all API calls.
 * Routes through the in-memory cache (cache.ts) and falls through to
 * fetchFromAPI on a miss.
 *
 * The `cacheTtl` controls the in-memory TTL (use TTL.* constants).
 * The `revalidate` param controls Next.js ISR — defaults to cacheTtl so
 * both caches expire in sync.
 */
function fetchAPI<T>(
  endpoint:  string,
  cacheTtl:  number,
  revalidate = cacheTtl,
): Promise<T> {
  return withCache<T>(
    endpoint,
    cacheTtl,
    () => fetchFromAPI<T>(endpoint, revalidate)
  );
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export function getTodayMatches(): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  return fetchAPI(
    `/matches?dateFrom=${today}&dateTo=${today}`,
    TTL.MATCH  // 60 s — today's fixtures must stay fresh
  );
}

export function getLiveMatches(): Promise<{ matches: Match[] }> {
  return fetchAPI('/matches?status=IN_PLAY,PAUSED', TTL.LIVE); // 30 s
}

export function getUpcomingMatches(
  competition: string
): Promise<{ matches: Match[]; resultSet: { count: number } }> {
  return fetchAPI(
    `/competitions/${competition}/matches?status=SCHEDULED,TIMED`,
    TTL.FIXTURES  // 600 s
  );
}

export function getRecentMatches(
  competition: string
): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  const from  = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  return fetchAPI(
    `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${today}`,
    TTL.FIXTURES  // 600 s
  );
}

export function getStandings(competition: string): Promise<{
  standings:   StandingTable[];
  competition: { name: string; emblem: string };
}> {
  return fetchAPI(
    `/competitions/${competition}/standings`,
    TTL.STANDINGS  // 1800 s
  );
}

export function getMatchDetail(id: string): Promise<MatchDetail> {
  return fetchAPI(`/matches/${id}`, TTL.MATCH); // 60 s
}

export function getTeam(id: string): Promise<TeamDetail> {
  return fetchAPI(`/teams/${id}`, TTL.STANDINGS); // 1800 s
}

export function getTeamMatches(id: string): Promise<{ matches: Match[] }> {
  return fetchAPI(
    `/teams/${id}/matches?status=FINISHED&limit=10`,
    TTL.FIXTURES  // 600 s
  );
}

export function getHeadToHead(id: string): Promise<HeadToHead> {
  return fetchAPI(`/matches/${id}/head2head`, TTL.MATCH); // 60 s
}

export function getWCLiveMatches(): Promise<{ matches: Match[] }> {
  return fetchAPI(
    '/competitions/WC/matches?status=IN_PLAY,PAUSED',
    TTL.LIVE  // 30 s
  );
}

export function getWCKnockoutMatches(): Promise<{ matches: Match[] }> {
  // All WC matches — WCBracket filters to knockout stages in JS.
  return fetchAPI('/competitions/WC/matches', TTL.MATCH); // 60 s
}

export function getWCResults(): Promise<{ matches: Match[] }> {
  return fetchAPI(
    '/competitions/WC/matches?status=FINISHED',
    TTL.MATCH  // 60 s — results can update during/after matches
  );
}
