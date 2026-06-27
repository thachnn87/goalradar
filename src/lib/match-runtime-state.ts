/**
 * match-runtime-state.ts
 * DATA-18WC.RUNTIME.TRUTH — Phase 2: ONE MATCHSTATE
 *
 * MatchRuntimeState is the single runtime object that every component reads from.
 * It wraps MatchSnapshot and adds runtime-derived fields:
 *   - version:      monotonic integer derived from snapshot.generatedAt
 *   - timestamp:    ISO string of when this state was derived
 *   - pageState:    pre-derived page render state (no per-component re-derivation)
 *   - storyContext: pre-derived story context (no per-call re-computation)
 *
 * Flow:
 *   MatchSnapshot → deriveRuntimeState() → MatchRuntimeState → components
 *
 * Rule: Every component reads from MatchRuntimeState.
 * Rule: No component calls deriveMatchPageState() or buildStoryContext() directly.
 * Rule: MatchRuntimeState owns version, pageState, storyContext for the render.
 */

import type { MatchDetail, Match, HeadToHead } from '@/lib/types';
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

  /** Related match data — passed through from MatchSnapshot */
  headToHead:     HeadToHead | null;
  standings:      MatchSnapshot['standings'];
  wcGroupMatches: Match[] | null;
  wcAllMatches:   Match[] | null;

  /** Original snapshot.generatedAt (epoch-ms) — preserved for debugging */
  generatedAt: number;
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/**
 * Resolve the authoritative final score for a match.
 *
 * Provider score objects can lag or return null during/after live matches.
 * Goal events are often populated before the score object is updated.
 * This function reconciles both sources so every display consumer gets
 * ONE consistent score — never a null-masked 0.
 *
 * Priority:
 *   1. score.fullTime from provider (both home + away non-null)
 *   2. Derived from goals[] (when score object is null/missing)
 *   3. null — no data available
 */
export function resolveEffectiveScore(match: MatchDetail): EffectiveScore | null {
  const ft = match.score?.fullTime;

  // Primary: provider score object is populated
  if (ft?.home !== null && ft?.home !== undefined &&
      ft?.away !== null && ft?.away !== undefined) {
    return { home: ft.home, away: ft.away };
  }

  // Fallback: derive from goal events when score object is null
  if (match.goals?.length) {
    let home = 0, away = 0;
    for (const g of match.goals) {
      const isOwnGoal = g.type === 'OWN_GOAL' || g.type === 'Own Goal' || g.type === 'OWN';
      const isHomeTeam = g.team?.id === match.homeTeam?.id;
      // Own goal credits the opponent; regular goal credits the scorer's team
      if (isOwnGoal ? !isHomeTeam : isHomeTeam) home++;
      else away++;
    }
    return { home, away };
  }

  return null;
}

/**
 * Derive a MatchRuntimeState from a MatchSnapshot.
 * Call exactly ONCE per request, at the top of the page component.
 * Pass the result to all sub-components via props.
 */
export function deriveRuntimeState(snapshot: MatchSnapshot): MatchRuntimeState {
  const { match, headToHead, standings, wcGroupMatches, wcAllMatches, generatedAt } = snapshot;

  const version      = Math.floor(generatedAt / 1000);
  const timestamp    = generatedAt;
  const pageState    = deriveMatchPageState(match);
  const storyContext = buildStoryContext(match);
  const effectiveScore = resolveEffectiveScore(match);

  return {
    match,
    version,
    timestamp,
    pageState,
    storyContext,
    effectiveScore,
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

/**
 * Derive a version number from an ISO timestamp string.
 * Used by both the server (snapshot.generatedAt) and the client
 * (/api/live-score response lastUpdated field).
 */
export function versionFromTimestamp(isoStringOrMs: string | number | null | undefined): number {
  if (!isoStringOrMs) return 0;
  const ms = typeof isoStringOrMs === 'number' ? isoStringOrMs : new Date(isoStringOrMs).getTime();
  return isNaN(ms) ? 0 : Math.floor(ms / 1000);
}
