/**
 * DATA-18A: Canonical Match type definitions + merge engine (dormant).
 * DATA-18A.2: B1–B4 blocking issues resolved.
 *
 * DO NOT IMPORT — this module is dormant until DATA-18B activates it.
 * Importing this file in a page or API module before S3 is a migration error.
 *
 * Fixes applied in DATA-18A.2:
 *   B1 — Score staleness: snapshot score only preferred when snapshot is newer than FD feed
 *   B2 — Dead deriveState branch removed: SCHEDULED/TIMED always returns 'scheduled'
 *   B3 — inferFdFeed() removed: caller passes fdFeed explicitly
 *   B4 — Dual live params replaced with single liveEntry object
 *
 * Constraints enforced by design:
 *   - FD always owns fixture identity (id, teams, utcDate, competitionCode)
 *   - ESPN never owns score (score only from FD feeds or snapshot.match.score)
 *   - State promotion is forward-only (STATE_RANK — never downgrade)
 *   - buildCanonicalMatch() is pure: zero KV reads, zero network calls
 *   - Lineups are NOT stored in CanonicalMatch — listing pages never display them;
 *     match detail pages read lineups directly from the per-match snapshot.
 *
 * Must pass: npx tsc --noEmit
 */

import type { Match, MatchDetail, Score, Goal, Booking, Substitution, Referee, MatchStatus } from './types';
import type { MatchSnapshot } from './match-snapshot';
import { STATE_RANK } from './match-state-overlay';

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/** FD-authoritative team record. */
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
export type CanonicalSubstitution = Pick<
  import('./types').Substitution,
  'minute' | 'team' | 'playerOut' | 'playerIn'
>;

/** Referee from FD match detail. */
export type CanonicalReferee = Pick<Referee, 'id' | 'name' | 'nationality'>;

/**
 * Live cache entry for a single match.
 * Passed into buildCanonicalMatch() as a single object (B4 fix).
 */
export interface LiveEntry {
  status: MatchStatus;
  minute?: number;
}

/**
 * Provenance record — which data layers contributed to this canonical object.
 * Immutable after construction.
 */
export interface CanonicalMatchSource {
  /**
   * Which FD bulk feed provided the base match record.
   * Passed explicitly by the caller (B3 fix — not inferred from status).
   */
  fdBulkFeed: 'scheduled' | 'results' | 'all';

  /** Present if the live cache had an entry for this match at build time. */
  liveCache?: { observedAt: string };

  /**
   * Present if a per-match snapshot existed in KV at build time.
   */
  snapshot?: {
    generatedAt: number;
    enrichmentSource: 'espn' | 'af' | 'none';
    snapshotVersion: number;
  };

  /** ISO-8601 timestamp when buildCanonicalMatch() ran. Passed in by caller. */
  builtAt: string;
}

// ---------------------------------------------------------------------------
// Integrity layer (DATA-18A.1 recommendation)
// ---------------------------------------------------------------------------

export type IntegrityStatus = 'ok' | 'warning' | 'degraded';

export interface IntegrityCheck {
  id:       string;
  result:   'pass' | 'warn' | 'fail';
  message?: string;
}

export interface IntegrityResult {
  status: IntegrityStatus;
  checks: IntegrityCheck[];
}

// ---------------------------------------------------------------------------
// CanonicalMatch interface
// ---------------------------------------------------------------------------

/**
 * DATA-18A: Real CanonicalMatch interface (not a Match alias).
 *
 * A match that has passed through the full authority stack:
 *   FD bulk feeds (identity + status + score)
 *   + live cache overlay (IN_PLAY/PAUSED + minute)
 *   + per-match snapshot (ESPN-enriched goals/cards/subs)
 *
 * Design decisions:
 *   - `state` is the derived display bucket, not the raw FD status string.
 *   - `lineups` are intentionally absent — listing pages never render them.
 *     Match detail pages read lineups directly from the per-match snapshot.
 *   - `enrichmentApplied` is true iff at least one event was populated from a
 *     provider enrichment pass (goals, cards, or substitutions non-empty).
 *   - `enrichmentAttempted` is true iff a snapshot with enrichment infrastructure
 *     was present — distinguishes "enriched 0-0 match" from "never enriched".
 *   - `integrity` carries the result of validateCanonicalMatch() at build time.
 */
export interface CanonicalMatch {
  // ── Identity (FD authority, never from ESPN or AF) ─────────────────────────
  id:              number;
  /** Explicit copy of id — makes FD provenance clear at call sites. */
  fdMatchId:       number;
  /** ESPN event ID, lazily resolved. Absent until resolved. */
  espnMatchId?:    string;
  competitionCode: string;
  utcDate:         string;

  // ── State ─────────────────────────────────────────────────────────────────
  /**
   * Derived display bucket.
   * 'scheduled' = SCHEDULED/TIMED (any future or past-kickoff pre-finish)
   * 'live'      = IN_PLAY/PAUSED
   * 'finished'  = FINISHED
   * 'cancelled' = POSTPONED/CANCELLED/SUSPENDED
   */
  state:   'scheduled' | 'live' | 'finished' | 'cancelled';
  minute?: number;

  // ── Teams (FD authority) ──────────────────────────────────────────────────
  homeTeam: CanonicalTeam;
  awayTeam: CanonicalTeam;

  // ── Score (FD results feed authority — ESPN never provides score) ──────────
  score: CanonicalScore;

  // ── Match events (ESPN enrichment for WC 2026) ────────────────────────────
  goals:         CanonicalGoal[];
  cards:         CanonicalCard[];
  substitutions: CanonicalSubstitution[];
  /**
   * Lineups intentionally excluded from CanonicalMatch.
   * Listing pages (Hub/Results/Schedule/Fixtures/Group) never display lineups.
   * Match detail pages read lineups directly from goalradar:match:{id} snapshot.
   * Excluding lineups reduces the authority cache bulk payload by ~8 KB per match
   * (from ~1.1 MB to ~200 KB for a fully-enriched 104-match tournament payload).
   */

  // ── Venue & officials ─────────────────────────────────────────────────────
  venue:   string | null;
  referee: CanonicalReferee | null;

  // ── Provenance ────────────────────────────────────────────────────────────
  source:      CanonicalMatchSource;
  lastUpdated: string;

  // ── Enrichment flags ──────────────────────────────────────────────────────
  /**
   * True iff at least one of goals/cards/substitutions came from a provider.
   * Note: false for a genuinely 0-0 match even if enrichment ran successfully.
   * Use enrichmentAttempted to distinguish "enriched but no events" from "never enriched".
   */
  enrichmentApplied: boolean;

  /**
   * True iff a snapshot with enrichment infrastructure was present at build time.
   * Distinguishes:
   *   enrichmentAttempted=false → match was never enriched (pre-kickoff, or snapshot absent)
   *   enrichmentAttempted=true  + enrichmentApplied=false → enriched, genuinely 0 events
   *   enrichmentAttempted=true  + enrichmentApplied=true  → enriched with events
   */
  enrichmentAttempted: boolean;

  // ── Integrity ─────────────────────────────────────────────────────────────
  /**
   * Result of validateCanonicalMatch() run at build time.
   * Carries structured checks for score consistency, team ID reconciliation, etc.
   */
  integrity: IntegrityResult;

  // ── Tournament context ────────────────────────────────────────────────────
  matchday: number | null;
  stage:    string;
  group:    string | null;
}

// ---------------------------------------------------------------------------
// State derivation helper
// ---------------------------------------------------------------------------

/**
 * Map raw FD MatchStatus to the CanonicalMatch `state` bucket.
 *
 * B2 fix: removed the dead conditional branch that compared matchDay to todayUTC
 * and returned 'scheduled' in both cases. Both SCHEDULED and TIMED map to
 * 'scheduled' regardless of whether kickoff has passed (the live cache is the
 * authority for the moment of transition to 'live').
 */
function deriveState(status: MatchStatus): CanonicalMatch['state'] {
  if (status === 'IN_PLAY' || status === 'PAUSED')     return 'live';
  if (status === 'FINISHED')                           return 'finished';
  if (status === 'SCHEDULED' || status === 'TIMED')    return 'scheduled';
  return 'cancelled'; // POSTPONED, CANCELLED, SUSPENDED
}

// ---------------------------------------------------------------------------
// Integrity validation
// ---------------------------------------------------------------------------

/**
 * Validate the internal consistency of a freshly-built CanonicalMatch.
 * Pure function — no KV reads, no network calls.
 *
 * Minimum viable checks (DATA-18A.1 recommendation):
 *   C2 — event team IDs reconciled to FD team IDs (DATA-14A regression guard)
 *   C3 — FINISHED match has non-null fullTime score
 *
 * Extended checks (low-priority, can be added in DATA-18C):
 *   C1 — score vs goal count consistency
 *   C4 — duplicate event detection
 *   C5 — ESPN ID vs enrichment consistency
 *   C6 — state vs score consistency
 */
export function validateCanonicalMatch(m: Omit<CanonicalMatch, 'integrity'>): IntegrityResult {
  const checks: IntegrityCheck[] = [];

  // ── C3 — Score completeness ───────────────────────────────────────────────
  if (
    m.state === 'finished' &&
    (m.score.fullTime.home === null || m.score.fullTime.away === null)
  ) {
    checks.push({
      id:      'C3_SCORE_NULL',
      result:  'fail',
      message: `FINISHED match ${m.id} has null fullTime score`,
    });
  } else {
    checks.push({ id: 'C3_SCORE_NULL', result: 'pass' });
  }

  // ── C2 — Event team ID reconciliation ────────────────────────────────────
  const validIds = new Set([m.homeTeam.id, m.awayTeam.id]);
  const unreconciled: number[] = [];

  for (const g of m.goals) {
    if (!validIds.has(g.team.id)) unreconciled.push(g.team.id);
  }
  for (const c of m.cards) {
    if (!validIds.has(c.team.id)) unreconciled.push(c.team.id);
  }
  for (const s of m.substitutions) {
    if (!validIds.has(s.team.id)) unreconciled.push(s.team.id);
  }

  if (unreconciled.length > 0) {
    checks.push({
      id:      'C2_TEAM_ID',
      result:  'fail',
      message: `${unreconciled.length} event(s) have unreconciled team IDs: [${[...new Set(unreconciled)].join(', ')}]`,
    });
  } else {
    checks.push({ id: 'C2_TEAM_ID', result: 'pass' });
  }

  // ── Derive overall status ─────────────────────────────────────────────────
  const hasFail = checks.some(c => c.result === 'fail');
  const hasWarn = checks.some(c => c.result === 'warn');

  return {
    status: hasFail ? 'degraded' : hasWarn ? 'warning' : 'ok',
    checks,
  };
}

// ---------------------------------------------------------------------------
// Merge engine
// ---------------------------------------------------------------------------

/**
 * DATA-18A.2: Build a single CanonicalMatch from all available data layers.
 *
 * Pure function — zero KV reads, zero network calls.
 * All inputs are read by the caller before invoking this function.
 *
 * API changes from DATA-18A (B3, B4 fixes):
 *   - `fdFeed` replaces the removed `inferFdFeed()` — caller states which feed
 *     the match came from, eliminating incorrect inference from status.
 *   - `liveEntry` replaces separate `liveStatus` + `liveMinute` parameters —
 *     prevents callers from passing an inconsistent (liveStatus, undefined minute) pair.
 *
 * Merge precedence:
 *   1. Live cache   (IN_PLAY/PAUSED — STATE_RANK=2)
 *   2. Snapshot     (can advance SCHEDULED→FINISHED — STATE_RANK forward-only)
 *   3. FD bulk feed (base, STATE_RANK=0–3)
 *
 * Score resolution (B1 fix):
 *   Snapshot score preferred for FINISHED only when snapshot is NEWER than FD feed.
 *   Without this guard, a 7-day-old snapshot could overwrite a corrected FD score.
 *
 * @param fdMatch   - Match from FD bulk feeds
 * @param fdFeed    - Which FD feed this match came from (explicitly provided by caller)
 * @param snapshot  - Per-match KV snapshot (ESPN-enriched). Null on cache miss.
 * @param liveEntry - Live cache entry if present. Null if match is not live.
 * @param espnMatchId - Resolved ESPN event ID. Undefined if unresolved.
 * @param builtAt   - ISO-8601 timestamp — passed in, never Date.now() (determinism)
 */
export function buildCanonicalMatch(
  fdMatch:      Match,
  fdFeed:       'scheduled' | 'results' | 'all',
  snapshot:     MatchSnapshot | null,
  liveEntry:    LiveEntry | null,
  espnMatchId:  string | undefined,
  builtAt:      string,
): CanonicalMatch {

  // ── Step 1: State resolution (forward-only via STATE_RANK) ────────────────
  let resolvedStatus: MatchStatus = fdMatch.status;
  let resolvedMinute: number | undefined = fdMatch.minute ?? undefined;

  // Advance via snapshot (never downgrade — FINISHED stays FINISHED)
  if (snapshot !== null) {
    const snapStatus = snapshot.match.status;
    if ((STATE_RANK[snapStatus] ?? 0) > (STATE_RANK[resolvedStatus] ?? 0)) {
      resolvedStatus = snapStatus;
      resolvedMinute = snapshot.match.minute ?? undefined;
    }
  }

  // Advance via live cache (IN_PLAY/PAUSED overrides SCHEDULED/TIMED)
  if (liveEntry !== null) {
    if ((STATE_RANK[liveEntry.status] ?? 0) > (STATE_RANK[resolvedStatus] ?? 0)) {
      resolvedStatus = liveEntry.status;
      resolvedMinute = liveEntry.minute;
    }
  }

  // ── Step 2: Display state bucket ──────────────────────────────────────────
  const state = deriveState(resolvedStatus);

  // ── Step 3: Score resolution (B1 fix — timestamp guard) ───────────────────
  //
  // Snapshot score is preferred for FINISHED only when the snapshot is newer
  // than the FD feed. Without this guard, a 7-day-old snapshot would overwrite
  // a score correction made by FD after the snapshot was built.
  let score: CanonicalScore = fdMatch.score;
  if (snapshot !== null && resolvedStatus === 'FINISHED') {
    const snapTs    = snapshot.generatedAt;
    const fdTs      = new Date(fdMatch.lastUpdated).getTime();
    const snapScore = snapshot.match.score;
    const snapIsNewer = snapTs > fdTs;

    if (snapIsNewer && snapScore?.fullTime?.home !== null && snapScore?.fullTime?.away !== null) {
      score = snapScore;
    }
  }

  // ── Step 4: Events (from snapshot, ESPN-enriched, team IDs reconciled) ────
  const matchDetail: MatchDetail | null = snapshot?.match ?? null;
  const goals:         CanonicalGoal[]         = matchDetail?.goals         ?? [];
  const cards:         CanonicalCard[]          = matchDetail?.bookings      ?? [];
  const substitutions: CanonicalSubstitution[]  = matchDetail?.substitutions ?? [];
  // Lineups intentionally NOT extracted — excluded from CanonicalMatch by design.
  // (See CanonicalMatch interface comment above.)

  // ── Step 5: Venue & referee ───────────────────────────────────────────────
  const venue:    string | null          = matchDetail?.venue        ?? null;
  const rawRef:   typeof matchDetail extends null ? undefined : Referee | undefined
                                         = matchDetail?.referees?.[0];
  const referee:  CanonicalReferee | null = rawRef
    ? { id: rawRef.id, name: rawRef.name, nationality: rawRef.nationality ?? null }
    : null;

  // ── Step 6: Timestamps ────────────────────────────────────────────────────
  const fdTs    = new Date(fdMatch.lastUpdated).getTime();
  const snapTs  = snapshot ? snapshot.generatedAt : 0;
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
    fdBulkFeed: fdFeed,
    liveCache:  liveEntry !== null ? { observedAt: builtAt } : undefined,
    snapshot:   snapshot
      ? {
          generatedAt:      snapshot.generatedAt,
          enrichmentSource: hasEspnEvents ? 'espn' : 'none',
          snapshotVersion:  1,
        }
      : undefined,
    builtAt,
  };

  // ── Step 8: Enrichment flags ──────────────────────────────────────────────
  const enrichmentApplied  = goals.length > 0 || cards.length > 0 || substitutions.length > 0;
  const enrichmentAttempted = snapshot !== null; // snapshot present = enrichment infrastructure ran

  // ── Step 9: Assemble (without integrity — passed to validateCanonicalMatch) ─
  const partial: Omit<CanonicalMatch, 'integrity'> = {
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
    venue,
    referee,
    source,
    lastUpdated,
    enrichmentApplied,
    enrichmentAttempted,
    matchday: fdMatch.matchday,
    stage:    fdMatch.stage,
    group:    fdMatch.group,
  };

  // ── Step 10: Integrity validation (pure, in-memory) ───────────────────────
  const integrity = validateCanonicalMatch(partial);

  return { ...partial, integrity };
}
