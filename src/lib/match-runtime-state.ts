/**
 * match-runtime-state.ts
 * DATA-18WC.RUNTIME.TRUTH — Phase 2: ONE MATCHSTATE
 * DATA-18WC.RUNTIME UNIFICATION — ONE DERIVATION
 *
 * MatchRuntimeState is the single runtime object that every component reads from.
 * It wraps MatchSnapshot and adds runtime-derived fields:
 *   - version:        monotonic integer derived from snapshot.generatedAt
 *   - pageState:      pre-derived page render state (no per-component re-derivation)
 *   - storyContext:   pre-derived story context (no per-call re-computation)
 *   - effectiveScore: resolved final score (provider → goals[] fallback → null)
 *   - isReliableScore: true when score.fullTime is provider-confirmed
 *
 * Flow:
 *   MatchSnapshot → deriveRuntimeState() → MatchRuntimeState → components / API
 *
 * ONE DERIVATION rule:
 *   resolveEffectiveScore() is private — called only by deriveRuntimeState().
 *   No component, route, or page may call it directly.
 *   To derive score for a live match in the API layer: call deriveRuntimeState()
 *   with a minimal snapshot, then read runtimeState.effectiveScore.
 */

import type { MatchDetail, Match, HeadToHead, Goal } from '@/lib/types';
import type { MatchSnapshot }                   from '@/lib/match-snapshot';
import { deriveMatchPageState, type MatchPageState } from '@/lib/match-page-state';
import { buildStoryContext, type StoryContext }       from '@/lib/match-story-engine';

// ---------------------------------------------------------------------------
// MatchRuntimeState
// ---------------------------------------------------------------------------

/** Resolved final score — ONE authoritative score per render.
 *  Primary: score.fullTime from provider.
 *  Fallback: derived from goals[] when provider returns null scores.
 *  null = no score data available (pre-match or cancelled). */
export interface EffectiveScore {
  home: number;
  away: number;
}

export interface MatchRuntimeState {
  /** The canonical match detail — every field origin is snapshot.match */
  match: MatchDetail;

  /** Monotonic version number derived from snapshot.generatedAt.
   *  Advances only on ISR revalidation or forced cache invalidation.
   *  Format: Unix seconds (floor of generatedAt milliseconds / 1000). */
  version: number;

  /** Epoch-ms timestamp from snapshot.generatedAt */
  timestamp: number;

  /** Pre-derived page render state — use this, never re-call deriveMatchPageState() */
  pageState: MatchPageState;

  /** Pre-derived story context — use this, never re-call buildStoryContext() */
  storyContext: StoryContext;

  /** Resolved final score — use this, never read match.score.fullTime directly.
   *  Reconciles provider score object with goal events when they diverge.
   *  null = score unavailable (pre-match, cancelled, or no data). */
  effectiveScore: EffectiveScore | null;

  /** true when score.fullTime is provider-confirmed (not derived from goals[]).
   *  false = score was inferred from goal events or is unavailable.
   *  Consumers may show "Awaiting official score" when false and effectiveScore is null. */
  isReliableScore: boolean;

  /** Related match data — passed through from MatchSnapshot */
  headToHead:     HeadToHead | null;
  standings:      MatchSnapshot['standings'];
  wcGroupMatches: Match[] | null;
  wcAllMatches:   Match[] | null;

  /** Original snapshot.generatedAt (epoch-ms) — preserved for debugging */
  generatedAt: number;
}

// ---------------------------------------------------------------------------
// Private derivation — called only by deriveRuntimeState()
// ---------------------------------------------------------------------------

/**
 * Resolve the authoritative final score for a match.
 * PRIVATE — not exported. Only deriveRuntimeState() may call this.
 *
 * Priority:
 *   1. score.fullTime from provider (both home + away non-null)
 *   2. Derived from goals[] (MatchDetail only — Match/KV has no goals)
 *   3. null — no data available
 */
function resolveEffectiveScore(match: Match): EffectiveScore | null {
  const ft = match.score?.fullTime;

  if (ft?.home !== null && ft?.home !== undefined &&
      ft?.away !== null && ft?.away !== undefined) {
    return { home: ft.home, away: ft.away };
  }

  // goals[] only exists on MatchDetail — Match (live/KV) has no goals
  const goals: Goal[] | undefined = (match as MatchDetail).goals;
  if (goals?.length) {
    let home = 0, away = 0;
    for (const g of goals) {
      const isOwnGoal = g.type === 'OWN_GOAL' || g.type === 'Own Goal' || g.type === 'OWN';
      const isHomeTeam = g.team?.id === match.homeTeam?.id;
      if (isOwnGoal ? !isHomeTeam : isHomeTeam) home++;
      else away++;
    }
    return { home, away };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive a MatchRuntimeState from a MatchSnapshot.
 *
 * This is the SINGLE entry point for all runtime data:
 *   - resolveEffectiveScore() is called here and nowhere else.
 *   - All derived fields (effectiveScore, isReliableScore, version, pageState,
 *     storyContext) are computed once and passed via props to every consumer.
 *
 * Call exactly ONCE per request, at the top of the page component OR in the
 * API route (wrapping a minimal snapshot).
 */
export function deriveRuntimeState(snapshot: MatchSnapshot): MatchRuntimeState {
  const { match, headToHead, standings, wcGroupMatches, wcAllMatches, generatedAt } = snapshot;

  const version        = Math.floor(generatedAt / 1000);
  const timestamp      = generatedAt;
  const pageState      = deriveMatchPageState(match);
  const storyContext   = buildStoryContext(match);
  const effectiveScore = resolveEffectiveScore(match);
  const isReliableScore =
    match.score?.fullTime?.home != null &&
    match.score?.fullTime?.away != null;

  return {
    match,
    version,
    timestamp,
    pageState,
    storyContext,
    effectiveScore,
    isReliableScore,
    headToHead,
    standings,
    wcGroupMatches: wcGroupMatches ?? null,
    wcAllMatches:   wcAllMatches   ?? null,
    generatedAt,
  };
}

// ---------------------------------------------------------------------------
// Version utilities
// ---------------------------------------------------------------------------

export function versionFromTimestamp(isoStringOrMs: string | number | null | undefined): number {
  if (!isoStringOrMs) return 0;
  const ms = typeof isoStringOrMs === 'number' ? isoStringOrMs : new Date(isoStringOrMs).getTime();
  return isNaN(ms) ? 0 : Math.floor(ms / 1000);
}
