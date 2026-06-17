/**
 * DATA-18A: Canonical Match type definitions + merge engine (dormant).
 *
 * This file is NOT imported by any page or API module.
 * It defines the target architecture for DATA-18B through S4 cutover.
 *
 * Constraints enforced by design:
 *   - FD always owns fixture identity (id, teams, utcDate, competitionCode)
 *   - ESPN never owns score (score only from FD feeds or snapshot.match.score)
 *   - State promotion is forward-only (STATE_RANK — never downgrade)
 *   - buildCanonicalMatch() is pure: zero KV reads, zero network calls
 *
 * Must pass: npx tsc --noEmit
 */

import type { Match, MatchDetail, Score, Goal, Booking, Substitution, Lineup, Referee, MatchStatus } from './types';
import type { MatchSnapshot } from './match-snapshot';
import { STATE_RANK } from './match-state-overlay';

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/** FD-authoritative team record. Identical shape to Team from types.ts. */
export interface CanonicalTeam {
  id:        number;
  name:      string;
  shortName: string;
  tla:       string;
  crest:     string;
}

/** FD-authoritative score. ESPN never provides score. */
export type CanonicalScore = Score;

/** Goal event with FD-reconciled team IDs (DATA-14A). */
export type CanonicalGoal = Goal;

/** Booking (card) event with FD-reconciled team IDs. */
export type CanonicalCard = Booking;

/** Substitution event. */
export type CanonicalSubstitution = Substitution;

/** Lineup data from ESPN enrichment. */
export type CanonicalLineups = { home: Lineup; away: Lineup };

/** Referee from FD match detail. */
export type CanonicalReferee = Pick<Referee, 'id' | 'name' | 'nationality'>;

/**
 * Provenance record — which data layers contributed to this canonical object.
 * Immutable after construction (built by buildCanonicalMatch()).
 */
export interface CanonicalMatchSource {
  /** Which FD bulk feed provided the base match record. */
  fdBulkFeed: 'scheduled' | 'results' | 'all';

  /** Present if the live cache contained an entry for this match at build time. */
  liveCache?: { observedAt: string };

  /**
   * Present if a per-match snapshot existed in KV at build time.
   * snapshotVersion is reserved for future schema migrations.
   */
  snapshot?: {
    /** Epoch-ms when the snapshot was built (MatchSnapshot.generatedAt). */
    generatedAt: number;
    /** 'espn' = ESPN enrichment applied; 'none' = snapshot had no event data. */
    enrichmentSource: 'espn' | 'af' | 'none';
    snapshotVersion: number;
  };

  /** ISO-8601 timestamp when buildCanonicalMatch() ran. */
  builtAt: string;
}

// ---------------------------------------------------------------------------
// CanonicalMatch interface
// ---------------------------------------------------------------------------

/**
 * DATA-18A: Real CanonicalMatch interface.
 *
 * A match that has passed through the full authority stack:
 *   FD bulk feeds (identity + status + score)
 *   + live cache overlay (IN_PLAY/PAUSED + minute)
 *   + per-match snapshot (ESPN-enriched goals/cards/subs/lineups)
 *
 * `state` is the derived display bucket — not the raw FD protocol status string.
 * `enrichmentApplied` is true iff at least one event (goal/card/sub) was populated
 * from a provider enrichment pass.
 */
export interface CanonicalMatch {
  // ── Identity (FD authority, never from ESPN or AF) ─────────────────────────
  id:              number;
  fdMatchId:       number;
  espnMatchId?:    string;
  competitionCode: string;
  utcDate:         string;

  // ── State ─────────────────────────────────────────────────────────────────
  /**
   * Derived display bucket.
   * 'scheduled' = SCHEDULED/TIMED, kickoff in future
   * 'live'      = IN_PLAY/PAUSED
   * 'finished'  = FINISHED
   * 'cancelled' = POSTPONED/CANCELLED/SUSPENDED
   */
  state:    'scheduled' | 'live' | 'finished' | 'cancelled';
  minute?:  number;

  // ── Teams (FD authority) ──────────────────────────────────────────────────
  homeTeam: CanonicalTeam;
  awayTeam: CanonicalTeam;

  // ── Score (FD results feed authority — ESPN never provides score) ──────────
  score: CanonicalScore;

  // ── Match events (ESPN enrichment for WC 2026) ────────────────────────────
  goals:         CanonicalGoal[];
  cards:         CanonicalCard[];
  substitutions: CanonicalSubstitution[];
  lineups:       CanonicalLineups | null;

  // ── Venue & officials ─────────────────────────────────────────────────────
  venue:    string | null;
  referee:  CanonicalReferee | null;

  // ── Provenance ────────────────────────────────────────────────────────────
  source:            CanonicalMatchSource;
  lastUpdated:       string;
  enrichmentApplied: boolean;

  // ── Tournament context ────────────────────────────────────────────────────
  matchday: number | null;
  stage:    string;
  group:    string | null;
}

// ---------------------------------------------------------------------------
// State derivation helpers
// ---------------------------------------------------------------------------

/**
 * Convert a raw FD MatchStatus + utcDate into the CanonicalMatch `state` bucket.
 * Matches classifyMatchState() semantics but returns the CanonicalMatch union.
 */
function deriveState(
  status:   MatchStatus,
  utcDate:  string,
  todayUTC: string,
): CanonicalMatch['state'] {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live';
  if (status === 'FINISHED') return 'finished';
  if (status === 'SCHEDULED' || status === 'TIMED') {
    const matchDay = utcDate.split('T')[0];
    return matchDay <= todayUTC ? 'scheduled' : 'scheduled';
  }
  return 'cancelled';
}

/**
 * Infer which FD bulk feed provided the base match record.
 * Used to populate CanonicalMatchSource.fdBulkFeed.
 */
function inferFdFeed(status: MatchStatus): CanonicalMatchSource['fdBulkFeed'] {
  if (status === 'FINISHED') return 'results';
  if (status === 'SCHEDULED' || status === 'TIMED') return 'scheduled';
  return 'all';
}

// ---------------------------------------------------------------------------
// Merge engine
// ---------------------------------------------------------------------------

/**
 * DATA-18A: Build a single CanonicalMatch from all available data layers.
 *
 * Pure function — zero KV reads, zero network calls.
 * All inputs are read by the caller before invoking this function.
 *
 * Merge precedence:
 *   1. Live cache   (IN_PLAY/PAUSED — STATE_RANK=2)
 *   2. Snapshot     (can advance SCHEDULED→FINISHED — STATE_RANK forward-only)
 *   3. FD bulk feed (base, STATE_RANK=0–3)
 *
 * Score:  FD results feed > snapshot.match.score (both FD-sourced; ESPN never writes score)
 * Events: snapshot.match.goals/cards/subs (ESPN-enriched, team IDs reconciled per DATA-14A)
 * State:  derived via STATE_RANK, then mapped to CanonicalMatch.state bucket
 *
 * @param fdMatch   - Match from FD bulk feeds (SCHEDULED/TIMED/FINISHED)
 * @param snapshot  - Per-match snapshot from KV (ESPN-enriched, may be null on miss)
 * @param liveStatus - Status from live cache if present, null otherwise
 * @param liveMinute - Minute from live cache if present, undefined otherwise
 * @param espnMatchId - Resolved ESPN event ID from espn:lookup cache, undefined if unresolved
 * @param todayUTC  - 'YYYY-MM-DD' string for state derivation
 * @param builtAt   - ISO-8601 timestamp when this call was made (passed in, not Date.now())
 */
export function buildCanonicalMatch(
  fdMatch:      Match,
  snapshot:     MatchSnapshot | null,
  liveStatus:   MatchStatus | null,
  liveMinute:   number | undefined,
  espnMatchId:  string | undefined,
  todayUTC:     string,
  builtAt:      string,
): CanonicalMatch {

  // ── Step 1: Resolve status via STATE_RANK (forward-only) ─────────────────
  let resolvedStatus: MatchStatus = fdMatch.status;
  let resolvedMinute: number | undefined = fdMatch.minute ?? undefined;

  // Advance via snapshot
  if (snapshot !== null) {
    const snapStatus = snapshot.match.status;
    if ((STATE_RANK[snapStatus] ?? 0) > (STATE_RANK[resolvedStatus] ?? 0)) {
      resolvedStatus = snapStatus;
      resolvedMinute = snapshot.match.minute ?? undefined;
    }
  }

  // Advance via live cache
  if (liveStatus !== null) {
    if ((STATE_RANK[liveStatus] ?? 0) > (STATE_RANK[resolvedStatus] ?? 0)) {
      resolvedStatus = liveStatus;
      resolvedMinute = liveMinute;
    }
  }

  // ── Step 2: Derive display state bucket ──────────────────────────────────
  const state = deriveState(resolvedStatus, fdMatch.utcDate, todayUTC);

  // ── Step 3: Score (FD authority — ESPN never provides score) ─────────────
  let score: CanonicalScore = fdMatch.score;
  if (
    snapshot !== null &&
    resolvedStatus === 'FINISHED' &&
    snapshot.match.score?.fullTime?.home !== null
  ) {
    // Snapshot score is preferred for FINISHED: it may have been confirmed
    // before the bulk results feed propagated.
    score = snapshot.match.score;
  }

  // ── Step 4: Events (from snapshot, ESPN-enriched) ────────────────────────
  const matchDetail: MatchDetail | null = snapshot?.match ?? null;
  const goals:         CanonicalGoal[]         = matchDetail?.goals         ?? [];
  const cards:         CanonicalCard[]          = matchDetail?.bookings      ?? [];
  const substitutions: CanonicalSubstitution[]  = matchDetail?.substitutions ?? [];
  const rawLineups = matchDetail?.lineups ?? null;
  const lineups: CanonicalLineups | null = rawLineups
    ? { home: rawLineups.home, away: rawLineups.away }
    : null;

  // ── Step 5: Venue & referee ───────────────────────────────────────────────
  const venue:   string | null          = matchDetail?.venue        ?? null;
  const rawRef: Referee | undefined     = matchDetail?.referees?.[0];
  const referee: CanonicalReferee | null = rawRef
    ? { id: rawRef.id, name: rawRef.name, nationality: rawRef.nationality ?? null }
    : null;

  // ── Step 6: Timestamps ────────────────────────────────────────────────────
  const fdTs   = new Date(fdMatch.lastUpdated).getTime();
  const snapTs = snapshot ? snapshot.generatedAt : 0;
  const lastUpdated = new Date(Math.max(fdTs, snapTs)).toISOString();

  // ── Step 7: Provenance ────────────────────────────────────────────────────
  const hasEspnEvents =
    snapshot !== null &&
    (
      snapshot.match.goals.length > 0 ||
      snapshot.match.bookings.length > 0 ||
      snapshot.match.substitutions.length > 0
    );

  const source: CanonicalMatchSource = {
    fdBulkFeed: inferFdFeed(fdMatch.status),
    liveCache:  liveStatus !== null ? { observedAt: builtAt } : undefined,
    snapshot:   snapshot
      ? {
          generatedAt:      snapshot.generatedAt,
          enrichmentSource: hasEspnEvents ? 'espn' : 'none',
          snapshotVersion:  1,
        }
      : undefined,
    builtAt,
  };

  return {
    id:              fdMatch.id,
    fdMatchId:       fdMatch.id,
    espnMatchId,
    competitionCode: fdMatch.competition.code,
    utcDate:         fdMatch.utcDate,
    state,
    minute:          resolvedMinute,
    homeTeam:        fdMatch.homeTeam,
    awayTeam:        fdMatch.awayTeam,
    score,
    goals,
    cards,
    substitutions,
    lineups,
    venue,
    referee,
    source,
    lastUpdated,
    enrichmentApplied: goals.length > 0 || cards.length > 0 || substitutions.length > 0,
    matchday: fdMatch.matchday,
    stage:    fdMatch.stage,
    group:    fdMatch.group,
  };
}
