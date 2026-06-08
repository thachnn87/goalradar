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

  /** All matches for a competition across all statuses (used for bracket/knockout). */
  getAllMatches(competition: string): Promise<{ matches: Match[] }>;

  /** Today's matches across all competitions. */
  getTodayMatches(): Promise<{ matches: Match[] }>;

  /** Last 10 finished matches for a team (by provider-native team ID). */
  getTeamMatches(id: string): Promise<{ matches: Match[] }>;

  /** Full team profile by provider-native team ID. */
  getTeam(id: string): Promise<import('@/lib/types').TeamDetail>;

  /**
   * Head-to-head record for a match.
   * Secondary providers may throw NotFoundError when IDs don't map.
   */
  getHeadToHead(matchId: string): Promise<import('@/lib/types').HeadToHead>;
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
// Failback event — primary recovered and is serving traffic again
// ---------------------------------------------------------------------------

export interface FailbackEvent {
  /** Provider that recovered (always 'football-data' in current design). */
  provider:  ProviderName;
  /** Endpoint on which the recovery was first observed. */
  endpoint:  string;
  /** How many consecutive errors the provider had before recovering. */
  errorsBeforeRecovery: number;
  /** Unix epoch ms when the failback occurred. */
  timestamp: number;
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
  primaryHealthy:         boolean;
  secondaryHealthy:       boolean;
  /** true when FOOTBALL_API_KEY env var is set and non-empty. */
  footballDataConfigured: boolean;
  /** true when API_FOOTBALL_KEY env var is set and non-empty. */
  apiFootballConfigured:  boolean;
  primary:                ProviderHealth;
  secondary:              ProviderHealth;
  lastFailover:           FailoverEvent | null;
  lastFailback:           FailbackEvent | null;
  failoverCount:          number;
  failbackCount:          number;
  recentFailovers:        FailoverEvent[];
  requestsByProvider:     Record<ProviderName, number>;
  generatedAt:            string; // ISO
}
