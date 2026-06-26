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

import { getWCAuthorityMatchesV2, getStandingsCached } from './api';
import type { Match } from './types';
import { canonicalToMatch } from './canonical-match';
import { injectKnockoutSlotLabels } from './wc-fixtures';

// ---------------------------------------------------------------------------
// Group-position map — teamId → editorial slot label ("1st Group A")
// ---------------------------------------------------------------------------

const ORDINAL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

/**
 * Build teamId → "{1st|2nd} Group X" from WC standings so R32 slot labels can be
 * anchored to the team FD has actually placed in each match (fixes the
 * "Mexico (1st Group A) shown in the wrong slot" bug). Best-effort: returns an
 * empty map on any failure, which makes injectKnockoutSlotLabels fall back to
 * pure ordinal-by-date mapping (no regression).
 */
async function buildGroupPositions(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const { standings } = await getStandingsCached('WC');
    for (const table of standings) {
      if (table.type !== 'TOTAL') continue;
      const letter = (table.group ?? '')
        .replace(/^GROUP[_\s]*/i, '')
        .replace(/^Group\s*/i, '')
        .trim()
        .toUpperCase();
      if (!letter) continue;
      for (const entry of table.table) {
        const ord = ORDINAL[entry.position];
        if (ord && entry.team?.id) map.set(entry.team.id, `${ord} Group ${letter}`);
      }
    }
  } catch {
    // standings unavailable — empty map → ordinal fallback in injection
  }
  return map;
}

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

  // Anchor R32 slot labels to the team FD has placed in each match (via standings
  // group position) instead of the unreliable kickoff order. Only meaningful for
  // LAST_32, whose labels are group positions ("1st Group A"); other rounds use
  // positional "Winner R32 Mx" labels that map fine by order.
  const groupPositions = await buildGroupPositions();

  // Enrich null team names with positional labels — must be called per stage with all stage matches
  const matches: Match[] = ALL_KNOCKOUT_STAGES
    .flatMap((stage) =>
      injectKnockoutSlotLabels(
        knockoutRaw.filter((m) => m.stage === stage),
        stage,
        stage === 'LAST_32' ? groupPositions : undefined,
      ),
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
