/**
 * src/lib/providers/manager.ts
 *
 * ProviderManager — single-entry-point for all data fetches.
 *
 * Failover behaviour
 * ──────────────────
 * 1. Every call is routed to FootballDataProvider (primary).
 * 2. If the primary throws ApiUnavailableError (403 / 429 / 5xx / timeout),
 *    the call is transparently retried on ApiFootballProvider (secondary).
 * 3. Every failover is logged:
 *      [FAILOVER] football-data -> api-football | reason: … | endpoint: …
 * 4. Failover events are stored in-memory (last 50) and exposed via
 *    getHealth() for the /api/debug/providers endpoint.
 *
 * NotFoundError is NOT a failover trigger — a 404 on football-data.org
 * means the resource genuinely does not exist, not a provider outage.
 *
 * Usage
 * ─────
 * import { providerManager } from '@/lib/providers/manager';
 *
 * // In a page or API route (wraps in your usual cache layers first):
 * const data = await providerManager.getFixtures('WC');
 *
 * Wiring: api.ts delegates getMatchDetail, getUpcomingMatches, getRecentMatches,
 * getStandings, getLiveMatches, and getWCLiveMatches to this manager.
 * Cache layers (withCache / withKVCache / getCachedLiveMatches) remain in api.ts.
 */

import { FootballDataProvider } from './football-data';
import { ApiFootballProvider }  from './api-football';
import { ApiUnavailableError }  from '@/lib/errors';
import type {
  MatchProvider,
  ProviderName,
  FailoverEvent,
  ProviderHealth,
  ProvidersDebugResponse,
} from './types';

// ---------------------------------------------------------------------------
// Config checks (read once at module load time)
// ---------------------------------------------------------------------------

const FD_KEY_CONFIGURED = typeof process.env.FOOTBALL_API_KEY === 'string' &&
                          process.env.FOOTBALL_API_KEY.trim() !== '';

const AF_KEY_CONFIGURED = typeof process.env.API_FOOTBALL_KEY === 'string' &&
                          process.env.API_FOOTBALL_KEY.trim() !== '';

// Startup log — emitted once when the module is first imported.
console.log(
  `[PROVIDER] football-data: ${FD_KEY_CONFIGURED ? 'enabled (FOOTBALL_API_KEY set)' : 'DISABLED — FOOTBALL_API_KEY missing'}`,
);
console.log(
  `[PROVIDER] api-football: ${AF_KEY_CONFIGURED ? 'enabled (API_FOOTBALL_KEY set)' : 'disabled — API_FOOTBALL_KEY not set (failover unavailable)'}`,
);

// ---------------------------------------------------------------------------
// Provider singletons
// ---------------------------------------------------------------------------

const PRIMARY:   MatchProvider = new FootballDataProvider();
const SECONDARY: MatchProvider = new ApiFootballProvider();

// ---------------------------------------------------------------------------
// In-process state (resets on cold start / process restart)
// ---------------------------------------------------------------------------

interface ProviderStats {
  requestCount:      number;
  errorCount:        number;
  consecutiveErrors: number;
  lastError:         string | null;
  lastErrorAt:       number | null;
}

const stats: Record<ProviderName, ProviderStats> = {
  'football-data': { requestCount: 0, errorCount: 0, consecutiveErrors: 0, lastError: null, lastErrorAt: null },
  'api-football':  { requestCount: 0, errorCount: 0, consecutiveErrors: 0, lastError: null, lastErrorAt: null },
};

const failoverLog: FailoverEvent[] = [];
const MAX_LOG_SIZE = 50;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function recordError(provider: ProviderName, err: unknown): void {
  const s   = stats[provider];
  const msg = err instanceof Error ? `${(err as ApiUnavailableError).reason ?? ''}: ${err.message}` : String(err);
  s.errorCount++;
  s.consecutiveErrors++;
  s.lastError   = msg;
  s.lastErrorAt = Date.now();
}

function recordSuccess(provider: ProviderName): void {
  stats[provider].consecutiveErrors = 0;
}

function pushFailoverEvent(event: FailoverEvent): void {
  failoverLog.push(event);
  if (failoverLog.length > MAX_LOG_SIZE) failoverLog.shift();
}

/**
 * Only ApiUnavailableError triggers a failover.
 * NotFoundError (404) is a business-logic error — the resource doesn't
 * exist on the primary provider and is unlikely to exist on the secondary.
 */
function isFailoverTrigger(err: unknown): err is ApiUnavailableError {
  return err instanceof ApiUnavailableError;
}

// ---------------------------------------------------------------------------
// Core withFailover wrapper
// ---------------------------------------------------------------------------

async function withFailover<T>(
  endpoint: string,
  primaryFn:   () => Promise<T>,
  secondaryFn: () => Promise<T>,
): Promise<T> {
  // ── 1. Try primary ────────────────────────────────────────────────────────
  stats['football-data'].requestCount++;
  console.log(`[PROVIDER_CALL] provider=football-data | endpoint=${endpoint}`);
  try {
    const result = await primaryFn();
    recordSuccess('football-data');
    return result;
  } catch (primaryErr) {
    recordError('football-data', primaryErr);

    if (!isFailoverTrigger(primaryErr)) {
      // Non-failover error (e.g. NotFoundError) — propagate immediately.
      throw primaryErr;
    }

    // ── 2. Log failover ───────────────────────────────────────────────────
    const reason = primaryErr.reason ?? 'unknown';
    const event: FailoverEvent = {
      fromProvider: 'football-data',
      toProvider:   'api-football',
      reason,
      endpoint,
      timestamp:    Date.now(),
    };
    pushFailoverEvent(event);

    console.log(
      `[FAILOVER] football-data -> api-football | reason: ${reason} | endpoint: ${endpoint} | ts: ${new Date(event.timestamp).toISOString()}`,
    );

    // ── 3. Try secondary ──────────────────────────────────────────────────
    stats['api-football'].requestCount++;
    console.log(`[PROVIDER_CALL] provider=api-football | endpoint=${endpoint}`);
    try {
      const result = await secondaryFn();
      recordSuccess('api-football');
      return result;
    } catch (secondaryErr) {
      recordError('api-football', secondaryErr);

      console.error(
        `[FAILOVER] api-football also failed | endpoint: ${endpoint} | err: ${secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr)}`,
      );

      // Both providers failed — throw the secondary error as the final result.
      throw secondaryErr;
    }
  }
}

// ---------------------------------------------------------------------------
// Public provider manager
// ---------------------------------------------------------------------------

export const providerManager = {

  // ── Data methods ─────────────────────────────────────────────────────────

  getMatch(id: number) {
    return withFailover(
      `getMatch(${id})`,
      () => PRIMARY.getMatch(id),
      () => SECONDARY.getMatch(id),
    );
  },

  getFixtures(competition: string) {
    return withFailover(
      `getFixtures(${competition})`,
      () => PRIMARY.getFixtures(competition),
      () => SECONDARY.getFixtures(competition),
    );
  },

  getResults(competition: string) {
    return withFailover(
      `getResults(${competition})`,
      () => PRIMARY.getResults(competition),
      () => SECONDARY.getResults(competition),
    );
  },

  getStandings(competition: string) {
    return withFailover(
      `getStandings(${competition})`,
      () => PRIMARY.getStandings(competition),
      () => SECONDARY.getStandings(competition),
    );
  },

  getLiveMatches() {
    return withFailover(
      'getLiveMatches()',
      () => PRIMARY.getLiveMatches(),
      () => SECONDARY.getLiveMatches(),
    );
  },

  // ── Observability ────────────────────────────────────────────────────────

  /**
   * Returns a snapshot of provider health and the last N failover events.
   * Used by /api/debug/providers.
   */
  getDebugSnapshot(): ProvidersDebugResponse {
    function buildHealth(name: ProviderName): ProviderHealth {
      const s = stats[name];
      return {
        name,
        requestCount:      s.requestCount,
        errorCount:        s.errorCount,
        consecutiveErrors: s.consecutiveErrors,
        lastError:         s.lastError,
        lastErrorAt:       s.lastErrorAt,
        healthy:           s.consecutiveErrors === 0,
      };
    }

    const recentFailovers = failoverLog.slice(-10);
    const lastFailover    = failoverLog[failoverLog.length - 1] ?? null;

    // "active provider" is whichever one is currently not in error state.
    // If primary is healthy → football-data. Otherwise → api-football.
    const activeProvider: ProviderName =
      stats['football-data'].consecutiveErrors === 0 ? 'football-data' : 'api-football';

    return {
      activeProvider,
      footballDataConfigured: FD_KEY_CONFIGURED,
      apiFootballConfigured:  AF_KEY_CONFIGURED,
      primary:                buildHealth('football-data'),
      secondary:              buildHealth('api-football'),
      lastFailover,
      failoverCount:          failoverLog.length,
      recentFailovers,
      generatedAt:            new Date().toISOString(),
    };
  },

  /** Exposed for testing — resets in-process state. */
  _resetState(): void {
    for (const name of ['football-data', 'api-football'] as ProviderName[]) {
      stats[name] = { requestCount: 0, errorCount: 0, consecutiveErrors: 0, lastError: null, lastErrorAt: null };
    }
    failoverLog.length = 0;
  },
};
