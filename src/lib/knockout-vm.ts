/**
 * knockout-vm.ts — DATA-18WC.15
 *
 * Single source of truth for all knockout-stage data.
 * Every consumer (bracket page, round pages, WCBracket tree) must read from
 * buildKnockoutViewModel() — never fetch independently.
 *
 * The pilot gate (AUTHORITY_CACHE_PILOT) lives here so it applies uniformly
 * to every consumer; List and Tree are guaranteed to see identical data.
 */

import { getWCAuthorityMatchesV2 } from './api';
import type { Match } from './types';
import { canonicalToMatch } from './canonical-match';
import { injectKnockoutSlotLabels } from './wc-fixtures';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KnockoutStage =
  | 'LAST_32'
  | 'LAST_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL';

/** Rounds included in the visual bracket tree (R16 → Final, no R32/THIRD_PLACE). */
export const BRACKET_TREE_STAGES = new Set<KnockoutStage>([
  'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL',
]);

/** All knockout stages in chronological order. */
export const ALL_KNOCKOUT_STAGES: KnockoutStage[] = [
  'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL',
];

export interface KnockoutViewModel {
  /** All enriched knockout matches sorted by utcDate ascending. */
  matches: Match[];
  /** Round-of-32 matches (enriched — null teams replaced with positional labels). */
  r32: Match[];
  /** Round-of-16 matches. */
  r16: Match[];
  /** Quarter-final matches. */
  qf: Match[];
  /** Semi-final matches. */
  sf: Match[];
  /** Third-place play-off matches (0–1 elements). */
  thirdPlace: Match[];
  /** Final match (0–1 elements). */
  final: Match[];
  /** R16→Final matches for the WCBracket tree component (excludes R32 + THIRD_PLACE). */
  bracketMatches: Match[];
  /** true when the API returned at least one match; false when operating from static fallback. */
  hasApiData: boolean;
  /** Get enriched matches for any stage string. */
  byStage(stage: string): Match[];
}

// ---------------------------------------------------------------------------
// buildKnockoutViewModel
// ---------------------------------------------------------------------------

/**
 * Fetch and enrich all knockout-stage matches.
 *
 * DATA-18WC.CONSOLIDATE: single source. Reads authority:v1 unconditionally via
 * getWCAuthorityMatchesV2() and converts with the one canonical adapter
 * (canonicalToMatch). The former AUTHORITY_CACHE_PILOT gate and its legacy
 * getWCKnockoutMatchesCached() branch have been removed — there is now exactly
 * one knockout pipeline, so List ≡ Tree ≡ every round page by construction.
 *
 * Always call once per page render — React.cache() deduplicates within a
 * single render tree if multiple server components call this function.
 */
export const buildKnockoutViewModel: () => Promise<KnockoutViewModel> = async () => {
  let raw: Match[] = [];
  try {
    const data = await getWCAuthorityMatchesV2(new Date().toISOString(), {
      source: 'knockout-vm', sourceType: 'unknown',
    });
    raw = data.matches.map(canonicalToMatch);
  } catch {
    // graceful degradation — all stage arrays will be empty, hasApiData = false
  }

  // Filter to knockout stages and sort by date
  const stageSet = new Set<string>(ALL_KNOCKOUT_STAGES);
  const knockoutRaw = raw
    .filter((m) => stageSet.has(m.stage))
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  // Enrich null team names with positional labels — must be called per stage with all stage matches
  const matches: Match[] = ALL_KNOCKOUT_STAGES
    .flatMap((stage) =>
      injectKnockoutSlotLabels(knockoutRaw.filter((m) => m.stage === stage), stage),
    )
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  const byStage = (stage: string) => matches.filter((m) => m.stage === stage);

  return {
    matches,
    r32:            byStage('LAST_32'),
    r16:            byStage('LAST_16'),
    qf:             byStage('QUARTER_FINALS'),
    sf:             byStage('SEMI_FINALS'),
    thirdPlace:     byStage('THIRD_PLACE'),
    final:          byStage('FINAL'),
    bracketMatches: matches.filter((m) => BRACKET_TREE_STAGES.has(m.stage as KnockoutStage)),
    hasApiData:     knockoutRaw.length > 0,
    byStage,
  };
};
