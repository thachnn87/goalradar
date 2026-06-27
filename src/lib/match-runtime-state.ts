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
 * Derive a MatchRuntimeState from a MatchSnapshot.
 * Call exactly ONCE per request, at the top of the page component.
 * Pass the result to all sub-components via props.
 */
export function deriveRuntimeState(snapshot: MatchSnapshot): MatchRuntimeState {
  const { match, headToHead, standings, wcGroupMatches, wcAllMatches, generatedAt } = snapshot;

  const version    = Math.floor(generatedAt / 1000);
  const timestamp  = generatedAt;
  const pageState  = deriveMatchPageState(match);
  const storyContext = buildStoryContext(match);

  return {
    match,
    version,
    timestamp,
    pageState,
    storyContext,
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
