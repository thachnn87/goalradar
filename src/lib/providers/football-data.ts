/**
 * src/lib/providers/football-data.ts
 *
 * FootballDataProvider — wraps api.football-data.org/v4.
 *
 * This is the PRIMARY provider. It implements MatchProvider directly
 * against the HTTP API without going through the cache tier, so the
 * ProviderManager can observe real failures (cache hits would hide them).
 *
 * Rate limiting
 * ─────────────
 * Every HTTP attempt is gated through footballDataLimiter.acquire(), which
 * enforces at most 1 request per 7 seconds (≈8.5 req/min). This keeps us
 * well below the free-plan cap of 10 req/min and prevents the burst patterns
 * that caused the manual account suspension.
 *
 * Retry policy (conservative — avoids hammering a limited API)
 * ─────────────────────────────────────────────────────────────
 *   403  → throw immediately, NEVER retry (account/key-level block)
 *   429  → wait EXACTLY the Retry-After duration (default 60 s), then
 *           ONE retry through the rate limiter; throw rate_limit on 2nd 429
 *   5xx  → ONE retry after 1 s through the rate limiter
 *   timeout / network → ONE retry after 1 s through the rate limiter
 *   404  → throw NotFoundError immediately, never retry
 *
 * Throws:
 *   NotFoundError        — HTTP 404
 *   ApiUnavailableError  — all other non-200 responses + network/timeout
 *     .reason: 'rate_limit' | 'disabled' | 'http' | 'timeout' | 'unknown'
 */

import type { Match, MatchDetail, StandingTable, HeadToHead, TeamDetail } from '@/lib/types';
import { NotFoundError, ApiUnavailableError } from '@/lib/errors';
import { footballDataLimiter } from '@/lib/rate-limiter';
import { recordRetry } from '@/lib/match-perf-tracker';
import { enableRateSafeMode } from '@/lib/rate-safe';
import type { MatchProvider } from './types';

const BASE_URL    = 'https://api.football-data.org/v4';
const MAX_ATTEMPTS = 2;   // 1 initial + max 1 retry
const TIMEOUT_MS   = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Returns the Retry-After value in **milliseconds**. Defaults to 60 000. */
function parseRetryAfterMs(headers: Headers): number {
  const raw = headers.get('retry-after');
  if (!raw) return 60_000;
  const sec = parseInt(raw, 10);
  if (!isNaN(sec) && sec > 0) return sec * 1_000;
  const date = Date.parse(raw);
  if (!isNaN(date)) return Math.max(1_000, date - Date.now());
  return 60_000;
}

// ---------------------------------------------------------------------------
// Raw HTTP fetch — rate-limited, single retry, strict error taxonomy
// ---------------------------------------------------------------------------

async function fetchRaw<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.FOOTBALL_API_KEY ?? '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // ── Gate through the global rate limiter before every HTTP attempt ──────
    await footballDataLimiter.acquire();

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let   res!: Response;

    // ── Network layer (timeout + connection errors) ─────────────────────────
    try {
      res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { 'X-Auth-Token': apiKey },
        signal:  controller.signal,
        // No next.revalidate — raw provider layer; caching handled by callers.
      });
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      console.error(
        `[FD] ${isTimeout ? 'TIMEOUT' : 'NETWORK'} ${endpoint}` +
        ` (attempt ${attempt}/${MAX_ATTEMPTS}):` +
        ` ${isTimeout ? `${TIMEOUT_MS / 1_000}s exceeded` : (err instanceof Error ? err.message : String(err))}`,
      );
      if (attempt < MAX_ATTEMPTS) { await sleep(1_000); continue; }
      throw new ApiUnavailableError(isTimeout ? 'timeout' : 'unknown');
    }
    clearTimeout(timer);

    // ── HTTP success ────────────────────────────────────────────────────────
    if (res.ok) return res.json() as Promise<T>;

    const body = await res.text().catch(() => '');

    // ── 404 — resource does not exist; never retry ──────────────────────────
    if (res.status === 404) {
      console.warn(`[FD] 404 ${endpoint}`);
      throw new NotFoundError();
    }

    // ── 403 — account disabled or API key invalid; NEVER retry ──────────────
    if (res.status === 403) {
      console.error(
        `[PROVIDER_DISABLED] football-data | endpoint=${endpoint}` +
        ` | ${body.slice(0, 160)}`,
      );
      // Activate rate-safe mode: suspend all background refresh for 1 h.
      enableRateSafeMode('disabled', 3_600_000);
      throw new ApiUnavailableError('disabled');
    }

    // ── 429 — rate limited; respect Retry-After exactly ─────────────────────
    if (res.status === 429) {
      const waitMs = parseRetryAfterMs(res.headers);
      console.warn(
        `[RETRY_AFTER] football-data | endpoint=${endpoint}` +
        ` | waitMs=${waitMs} | attempt=${attempt}/${MAX_ATTEMPTS}`,
      );
      // Activate rate-safe mode: suspend all background refresh for the
      // Retry-After window so the orchestrator stops hammering the API.
      enableRateSafeMode('rate_limit', waitMs);
      recordRetry();
      if (attempt < MAX_ATTEMPTS) { await sleep(waitMs); continue; }
      throw new ApiUnavailableError('rate_limit');
    }

    // ── 5xx — server error; one retry ───────────────────────────────────────
    if (res.status >= 500) {
      console.error(
        `[FD] ${res.status} SERVER_ERROR ${endpoint}` +
        ` (attempt ${attempt}/${MAX_ATTEMPTS}): ${body.slice(0, 200)}`,
      );
      if (attempt < MAX_ATTEMPTS) { await sleep(1_000); continue; }
      throw new ApiUnavailableError('http');
    }

    // ── Other 4xx (400, 401, …) — never retry ───────────────────────────────
    console.error(`[FD] ${res.status} ${endpoint}: ${body.slice(0, 200)}`);
    throw new ApiUnavailableError('http');
  }

  // Should never reach here — every loop branch returns, throws, or continues.
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
