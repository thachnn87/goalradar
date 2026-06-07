import { Match, MatchDetail, HeadToHead, StandingTable, TeamDetail } from './types';
import { withCache, TTL } from './cache';
import { withKVCache, SWR } from './kv-cache';
import { recordAuditCall } from './api-audit';

const BASE_URL = 'https://api.football-data.org/v4';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class NotFoundError extends Error {
  constructor() { super('Not found'); this.name = 'NotFoundError'; }
}

export class ApiUnavailableError extends Error {
  constructor(public readonly reason: 'http' | 'timeout' | 'rate_limit' | 'unknown' = 'unknown') {
    super('Data temporarily unavailable');
    this.name = 'ApiUnavailableError';
  }
}

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
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller  = new AbortController();
    const timeoutId   = setTimeout(() => controller.abort(), 10_000);
    const _fetchStart = Date.now(); // API-1 network timing

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY ?? '' },
        next:    { revalidate },
        signal:  controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        // ── API-1 instrumentation — actual network call ──
        recordAuditCall({
          endpoint,
          source:     'network',
          durationMs: Date.now() - _fetchStart,
        });
        return res.json() as Promise<T>;
      }

      // ── Error responses ────────────────────────────────────────────────
      const body = await res.text().catch(() => '');

      if (res.status === 404) {
        console.warn(`[API] 404 ${endpoint}`);
        throw new NotFoundError();
      }

      if (res.status === 429) {
        // Rate-limited. Back off according to Retry-After before retrying.
        const backoff = (parseRetryAfter(res.headers) || (attempt * 5)) * 1_000;
        console.warn(
          `[API] 429 RATE_LIMIT ${endpoint} | attempt ${attempt}/${MAX_RETRIES} | backoff ${backoff}ms | ${body.slice(0, 120)}`,
        );
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw new ApiUnavailableError('rate_limit');
      }

      if (res.status >= 500) {
        console.error(
          `[API] ${res.status} SERVER_ERROR ${endpoint} (attempt ${attempt}/${MAX_RETRIES}): ${body.slice(0, 200)}`,
        );
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, attempt * 1_000));
          continue;
        }
        throw new ApiUnavailableError('http');
      }

      // 4xx other than 404/429
      console.error(`[API] ${res.status} ${endpoint}: ${body.slice(0, 200)}`);
      throw new ApiUnavailableError('http');

    } catch (err) {
      clearTimeout(timeoutId);

      // Re-throw typed errors immediately — no further retries.
      if (err instanceof NotFoundError) throw err;
      if (err instanceof ApiUnavailableError) {
        // Only re-throw on final attempt or non-retryable reasons.
        if (attempt >= MAX_RETRIES || err.reason === 'rate_limit') throw err;
        await new Promise((r) => setTimeout(r, attempt * 1_000));
        continue;
      }

      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      console.error(
        `[API] ${isTimeout ? 'TIMEOUT' : 'FETCH_ERROR'} ${endpoint} (attempt ${attempt}/${MAX_RETRIES}): ${isTimeout ? '10s exceeded' : (err instanceof Error ? err.message : String(err))}`,
      );
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 1_000));
        continue;
      }
      throw new ApiUnavailableError(isTimeout ? 'timeout' : 'unknown');
    }
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
//   Used for: live matches, today's matches.
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
  return fetchDirect(`/matches?dateFrom=${today}&dateTo=${today}`, TTL.MATCH);
}

export function getLiveMatches(): Promise<{ matches: Match[] }> {
  return fetchDirect('/matches?status=IN_PLAY,PAUSED', TTL.LIVE);
}

export function getWCLiveMatches(): Promise<{ matches: Match[] }> {
  return fetchDirect('/competitions/WC/matches?status=IN_PLAY,PAUSED', TTL.LIVE);
}

// ── KV-cached: Fixtures (15 min) ─────────────────────────────────────────────

export function getUpcomingMatches(
  competition: string,
): Promise<{ matches: Match[]; resultSet: { count: number } }> {
  return fetchWithKV(
    `/competitions/${competition}/matches?status=SCHEDULED,TIMED`,
    TTL.FIXTURES,
    SWR.FIXTURES,
  );
}

export function getRecentMatches(
  competition: string,
): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  const from  = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  return fetchWithKV(
    `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${today}`,
    TTL.FIXTURES,
    SWR.FIXTURES,
  );
}

export function getTeamMatches(id: string): Promise<{ matches: Match[] }> {
  return fetchWithKV(
    `/teams/${id}/matches?status=FINISHED&limit=10`,
    TTL.FIXTURES,
    SWR.FIXTURES,
  );
}

export function getWCResults(): Promise<{ matches: Match[] }> {
  // Finished WC matches — changes 2-3 times a day during group stage.
  // 15-min cache is sufficient and avoids hammering the API.
  return fetchWithKV(
    '/competitions/WC/matches?status=FINISHED',
    TTL.FIXTURES,
    SWR.FIXTURES,
  );
}

// ── KV-cached: WC structural data (6 hours) ──────────────────────────────────

export function getWCKnockoutMatches(): Promise<{ matches: Match[] }> {
  // Returns all 104 WC matches.  Knockout results change at most a few times
  // per day — 6-hour cache eliminates ~99 % of these expensive API calls.
  return fetchWithKV('/competitions/WC/matches', TTL.WC, SWR.WC);
}

// ── KV-cached: Standings (1 hour) ────────────────────────────────────────────

export function getStandings(competition: string): Promise<{
  standings:   StandingTable[];
  competition: { name: string; emblem: string };
}> {
  return fetchWithKV(
    `/competitions/${competition}/standings`,
    TTL.STANDINGS,
    SWR.STANDINGS,
  );
}

export function getTeam(id: string): Promise<TeamDetail> {
  return fetchWithKV(`/teams/${id}`, TTL.STANDINGS, SWR.STANDINGS);
}

// ── KV-cached: Match details (1 min) ─────────────────────────────────────────

export function getMatchDetail(id: string): Promise<MatchDetail> {
  return fetchWithKV(`/matches/${id}`, TTL.MATCH, SWR.MATCH);
}

export function getHeadToHead(id: string): Promise<HeadToHead> {
  return fetchWithKV(`/matches/${id}/head2head`, TTL.MATCH, SWR.MATCH);
}
