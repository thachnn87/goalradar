/**
 * src/lib/providers/types.ts
 *
 * Shared interface and state types for the multi-provider architecture.
 *
 * All providers implement MatchProvider and return the same normalised
 * types used throughout the application (from src/lib/types.ts).
 * The abstraction layer sits between the cache tier and the HTTP tier:
 *
 *   Page → withCache/withKV → ProviderManager → FootballDataProvider
 *                                              ↘ ApiFootballProvider (failover)
 */

import type { Match, MatchDetail, StandingTable } from '@/lib/types';

// ---------------------------------------------------------------------------
// Core provider interface
// ---------------------------------------------------------------------------

export interface MatchProvider {
  /** Unique identifier used in logs, failover events and debug output. */
  readonly name: ProviderName;

  /** Fetch a single match with full detail (goals, bookings, subs, referees). */
  getMatch(id: number): Promise<MatchDetail>;

  /** Upcoming scheduled/timed fixtures for a competition (by code). */
  getFixtures(competition: string): Promise<{ matches: Match[]; resultSet: { count: number } }>;

  /** Recent completed matches for a competition (last 30 days). */
  getResults(competition: string): Promise<{ matches: Match[] }>;

  /** Group standings for a competition. */
  getStandings(competition: string): Promise<{
    standings:   StandingTable[];
    competition: { name: string; emblem: string };
  }>;

  /** All currently live (IN_PLAY/PAUSED) matches across all competitions. */
  getLiveMatches(): Promise<{ matches: Match[] }>;
}

// ---------------------------------------------------------------------------
// Provider names
// ---------------------------------------------------------------------------

export type ProviderName = 'football-data' | 'api-football';

// ---------------------------------------------------------------------------
// Failover event — one entry per automatic provider switch
// ---------------------------------------------------------------------------

export interface FailoverEvent {
  /** Provider that failed. */
  fromProvider: ProviderName;
  /** Provider that handled the request after the failover. */
  toProvider:   ProviderName;
  /** Stringified reason (ApiUnavailableError.reason or 'unknown'). */
  reason:       string;
  /** Method/endpoint that triggered the failover. */
  endpoint:     string;
  /** Unix epoch ms when the failover occurred. */
  timestamp:    number;
}

// ---------------------------------------------------------------------------
// Per-provider health snapshot (used by the debug endpoint)
// ---------------------------------------------------------------------------

export interface ProviderHealth {
  name:              ProviderName;
  requestCount:      number;
  errorCount:        number;
  consecutiveErrors: number;
  lastError:         string | null;
  lastErrorAt:       number | null;
  /** true when consecutiveErrors === 0 */
  healthy:           boolean;
}

// ---------------------------------------------------------------------------
// Debug response shape  (/api/debug/providers)
// ---------------------------------------------------------------------------

export interface ProvidersDebugResponse {
  activeProvider:         ProviderName;
  /** true when FOOTBALL_API_KEY env var is set and non-empty. */
  footballDataConfigured: boolean;
  /** true when API_FOOTBALL_KEY env var is set and non-empty. */
  apiFootballConfigured:  boolean;
  primary:                ProviderHealth;
  secondary:              ProviderHealth;
  lastFailover:           FailoverEvent | null;
  failoverCount:          number;
  recentFailovers:        FailoverEvent[];
  generatedAt:            string; // ISO
}
