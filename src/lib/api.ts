import { Match, MatchDetail, HeadToHead, StandingTable, TeamDetail } from './types';
import { withCache, TTL } from './cache';
import { withKVCache, SWR } from './kv-cache';
import { recordAuditCall } from './api-audit';
import { getCachedLiveMatches, getCachedWCLiveMatches } from './live-cache';
import { providerManager } from './providers/manager';
import { recordDataSource } from './data-source-tracker';
import { getStaticGroupMatches } from '@/data/worldcup/loader';

const BASE_URL = 'https://api.football-data.org/v4';

// ---------------------------------------------------------------------------
// Error types (defined in errors.ts to avoid circular imports; re-exported
// here for backward compatibility so all existing `from '@/lib/api'` imports
// of NotFoundError / ApiUnavailableError continue to work unchanged).
// ---------------------------------------------------------------------------

export { NotFoundError, ApiUnavailableError } from './errors';
import { NotFoundError, ApiUnavailableError } from './errors';

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
  // Routes through providerManager — cache wraps the provider call.
  return withCache(
    `/matches?dateFrom=${today}&dateTo=${today}`,
    TTL.MATCH,
    () => providerManager.getTodayMatches(),
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
  // Static WC fixtures are the final fallback when provider + KV + DR all fail.
  return withCache(
    '/competitions/WC/matches',
    TTL.WC,
    () => withKVCache(
      '/competitions/WC/matches',
      SWR.WC,
      () => providerManager.getAllMatches('WC'),
    ),
  ).catch(() => {
    console.warn('[DATA_SOURCE] static | getWCKnockoutMatches fallback to bundled fixtures');
    recordDataSource('static');
    return { matches: getStaticGroupMatches() };
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
