import { Match, MatchDetail, HeadToHead, StandingTable, TeamDetail } from './types';
import { withCache, TTL } from './cache';
import { withKVCache, SWR } from './kv-cache';

const BASE_URL = 'https://api.football-data.org/v4';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class NotFoundError extends Error {
  constructor() { super('Not found'); this.name = 'NotFoundError'; }
}

export class ApiUnavailableError extends Error {
  constructor() { super('Data temporarily unavailable'); this.name = 'ApiUnavailableError'; }
}

// ---------------------------------------------------------------------------
// HTTP layer  (retry + timeout + Next.js ISR)
// ---------------------------------------------------------------------------

async function fetchFromAPI<T>(endpoint: string, revalidate: number): Promise<T> {
  const retries = 2;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY ?? '' },
        next:    { revalidate },
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
      if (err instanceof NotFoundError) throw err;

      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      console.error(
        `[Football API] Attempt ${attempt}/${retries} failed on ${endpoint}:`,
        isTimeout ? 'timeout (10 s)' : (err instanceof Error ? err.message : String(err))
      );

      if (attempt < retries) { await new Promise((r) => setTimeout(r, 1_000)); continue; }
      throw new ApiUnavailableError();
    }
  }

  throw new ApiUnavailableError();
}

// ---------------------------------------------------------------------------
// Cache routing helpers
//
// Three-tier caching strategy:
//   L1 (in-memory, cache.ts)  — sub-ms, per-process.
//   L2 (Vercel KV, kv-cache.ts) — ~10 ms Redis, cross-instance SWR.
//   L3 (Next.js fetch cache)  — CDN / ISR, via `next: { revalidate }`.
//
// fetchWithKV  — L1 → L2 (KV/SWR) → L3/network
//   Used for: fixtures, standings, match details, head-to-head.
//
// fetchDirect  — L1 → L3/network (no KV — data too volatile for KV overhead)
//   Used for: live matches, today's matches.
// ---------------------------------------------------------------------------

/**
 * L1 in-memory → L2 KV SWR → L3 network.
 * The in-memory layer deduplicates concurrent requests and avoids the ~10 ms
 * KV round-trip on repeated hot reads within the same process.
 */
function fetchWithKV<T>(
  endpoint: string,
  memTtl:  number,
  swr:     { fresh: number; stale: number },
): Promise<T> {
  return withCache<T>(
    endpoint,
    memTtl,
    () => withKVCache<T>(
      endpoint,
      swr,
      () => fetchFromAPI<T>(endpoint, swr.fresh)
    )
  );
}

/**
 * L1 in-memory → L3 network.  No KV — used for live/real-time data where
 * KV latency and staleness would be counterproductive.
 */
function fetchDirect<T>(
  endpoint: string,
  memTtl:  number,
): Promise<T> {
  return withCache<T>(
    endpoint,
    memTtl,
    () => fetchFromAPI<T>(endpoint, memTtl)
  );
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

// ── NOT cached in KV (too volatile) ─────────────────────────────────────────

export function getTodayMatches(): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  return fetchDirect(`/matches?dateFrom=${today}&dateTo=${today}`, TTL.MATCH);
}

export function getLiveMatches(): Promise<{ matches: Match[] }> {
  return fetchDirect('/matches?status=IN_PLAY,PAUSED', TTL.LIVE);
}

export function getWCLiveMatches(): Promise<{ matches: Match[] }> {
  return fetchDirect('/competitions/WC/matches?status=IN_PLAY,PAUSED', TTL.LIVE);
}

// ── KV-cached: Fixtures ──────────────────────────────────────────────────────

export function getUpcomingMatches(
  competition: string
): Promise<{ matches: Match[]; resultSet: { count: number } }> {
  return fetchWithKV(
    `/competitions/${competition}/matches?status=SCHEDULED,TIMED`,
    TTL.FIXTURES,
    SWR.FIXTURES
  );
}

export function getRecentMatches(
  competition: string
): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  const from  = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  return fetchWithKV(
    `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${today}`,
    TTL.FIXTURES,
    SWR.FIXTURES
  );
}

export function getTeamMatches(id: string): Promise<{ matches: Match[] }> {
  return fetchWithKV(
    `/teams/${id}/matches?status=FINISHED&limit=10`,
    TTL.FIXTURES,
    SWR.FIXTURES
  );
}

export function getWCKnockoutMatches(): Promise<{ matches: Match[] }> {
  return fetchWithKV('/competitions/WC/matches', TTL.MATCH, SWR.MATCH);
}

export function getWCResults(): Promise<{ matches: Match[] }> {
  return fetchWithKV(
    '/competitions/WC/matches?status=FINISHED',
    TTL.MATCH,
    SWR.MATCH
  );
}

// ── KV-cached: Standings ─────────────────────────────────────────────────────

export function getStandings(competition: string): Promise<{
  standings:   StandingTable[];
  competition: { name: string; emblem: string };
}> {
  return fetchWithKV(
    `/competitions/${competition}/standings`,
    TTL.STANDINGS,
    SWR.STANDINGS
  );
}

export function getTeam(id: string): Promise<TeamDetail> {
  return fetchWithKV(`/teams/${id}`, TTL.STANDINGS, SWR.STANDINGS);
}

// ── KV-cached: Match details ──────────────────────────────────────────────────

export function getMatchDetail(id: string): Promise<MatchDetail> {
  return fetchWithKV(`/matches/${id}`, TTL.MATCH, SWR.MATCH);
}

export function getHeadToHead(id: string): Promise<HeadToHead> {
  return fetchWithKV(`/matches/${id}/head2head`, TTL.MATCH, SWR.MATCH);
}
