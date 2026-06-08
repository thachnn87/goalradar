/**
 * src/lib/providers/football-data.ts
 *
 * FootballDataProvider — wraps api.football-data.org/v4.
 *
 * This is the PRIMARY provider. It implements MatchProvider directly
 * against the HTTP API without going through the cache tier, so the
 * ProviderManager can observe real failures (cache hits would hide them).
 *
 * Error handling mirrors api.ts: 3 retries, 10-s timeout, Retry-After
 * backoff on 429, immediate throw on 404/403.
 *
 * Throws:
 *   NotFoundError        — HTTP 404
 *   ApiUnavailableError  — 429, 403, 5xx, timeout, network error
 *     .reason: 'rate_limit' | 'disabled' | 'http' | 'timeout' | 'unknown'
 */

import type { Match, MatchDetail, StandingTable, HeadToHead, TeamDetail } from '@/lib/types';
import { NotFoundError, ApiUnavailableError } from '@/lib/errors';
import type { MatchProvider } from './types';

const BASE_URL   = 'https://api.football-data.org/v4';
const MAX_RETRIES = 3;
const TIMEOUT_MS  = 10_000;

// ---------------------------------------------------------------------------
// Raw HTTP fetch (no cache, no Next.js ISR — pure HTTP layer)
// ---------------------------------------------------------------------------

function parseRetryAfter(headers: Headers): number {
  const raw = headers.get('retry-after');
  if (!raw) return 0;
  const sec = parseInt(raw, 10);
  if (!isNaN(sec)) return Math.min(sec, 60);
  const date = Date.parse(raw);
  if (!isNaN(date)) return Math.min(Math.ceil((date - Date.now()) / 1000), 60);
  return 0;
}

async function fetchRaw<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.FOOTBALL_API_KEY ?? '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { 'X-Auth-Token': apiKey },
        signal:  controller.signal,
        // No next.revalidate — this is the raw provider layer.
        // Caching is handled by the caller (cache.ts / kv-cache.ts).
      });
      clearTimeout(timer);

      if (res.ok) return res.json() as Promise<T>;

      const body = await res.text().catch(() => '');

      if (res.status === 404) {
        console.warn(`[FD] 404 ${endpoint}`);
        throw new NotFoundError();
      }

      if (res.status === 429) {
        const backoff = (parseRetryAfter(res.headers) || attempt * 5) * 1_000;
        console.warn(`[FD] 429 ${endpoint} | attempt ${attempt}/${MAX_RETRIES} | backoff ${backoff}ms`);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw new ApiUnavailableError('rate_limit');
      }

      if (res.status === 403) {
        console.error(`[FD] 403 DISABLED ${endpoint}: ${body.slice(0, 120)}`);
        throw new ApiUnavailableError('disabled');
      }

      if (res.status >= 500) {
        console.error(`[FD] ${res.status} SERVER_ERROR ${endpoint} (attempt ${attempt}/${MAX_RETRIES})`);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, attempt * 1_000));
          continue;
        }
        throw new ApiUnavailableError('http');
      }

      console.error(`[FD] ${res.status} ${endpoint}: ${body.slice(0, 200)}`);
      throw new ApiUnavailableError('http');

    } catch (err) {
      clearTimeout(timer);

      if (err instanceof NotFoundError)    throw err;
      if (err instanceof ApiUnavailableError) {
        if (attempt >= MAX_RETRIES || err.reason === 'rate_limit' || err.reason === 'disabled') throw err;
        await new Promise((r) => setTimeout(r, attempt * 1_000));
        continue;
      }

      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      console.error(
        `[FD] ${isTimeout ? 'TIMEOUT' : 'NETWORK'} ${endpoint} (attempt ${attempt}/${MAX_RETRIES}): ${isTimeout ? '10s exceeded' : (err instanceof Error ? err.message : String(err))}`,
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
// Provider implementation
// ---------------------------------------------------------------------------

export class FootballDataProvider implements MatchProvider {
  readonly name = 'football-data' as const;

  getMatch(id: number): Promise<MatchDetail> {
    return fetchRaw(`/matches/${id}`);
  }

  getFixtures(competition: string): Promise<{ matches: Match[]; resultSet: { count: number } }> {
    return fetchRaw(`/competitions/${competition}/matches?status=SCHEDULED,TIMED`);
  }

  getResults(competition: string): Promise<{ matches: Match[] }> {
    const today = new Date().toISOString().split('T')[0];
    const from  = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
    return fetchRaw(`/competitions/${competition}/matches?dateFrom=${from}&dateTo=${today}`);
  }

  getStandings(competition: string): Promise<{
    standings:   StandingTable[];
    competition: { name: string; emblem: string };
  }> {
    return fetchRaw(`/competitions/${competition}/standings`);
  }

  getLiveMatches(): Promise<{ matches: Match[] }> {
    return fetchRaw('/matches?status=IN_PLAY,PAUSED');
  }

  getAllMatches(competition: string): Promise<{ matches: Match[] }> {
    return fetchRaw(`/competitions/${competition}/matches`);
  }

  getTodayMatches(): Promise<{ matches: Match[] }> {
    const today = new Date().toISOString().split('T')[0];
    return fetchRaw(`/matches?dateFrom=${today}&dateTo=${today}`);
  }

  getTeamMatches(id: string): Promise<{ matches: Match[] }> {
    return fetchRaw(`/teams/${id}/matches?status=FINISHED&limit=10`);
  }

  getTeam(id: string): Promise<TeamDetail> {
    return fetchRaw(`/teams/${id}`);
  }

  getHeadToHead(matchId: string): Promise<HeadToHead> {
    return fetchRaw(`/matches/${matchId}/head2head`);
  }
}
