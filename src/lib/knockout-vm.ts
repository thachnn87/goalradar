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
import type { CanonicalMatch } from './canonical-match';
import { injectKnockoutSlotLabels } from './wc-fixtures';

// ---------------------------------------------------------------------------
// Group-position map — teamId → editorial slot label ("1st Group A")
// ---------------------------------------------------------------------------

const ORDINAL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

type SlotTeam = { id: number; name: string; shortName: string; tla: string; crest: string };

/**
 * Build "1st Group A" / "2nd Group A" → the actual qualified team, but ONLY for
 * groups whose stage is COMPLETE (every team has played the full group schedule,
 * playedGames === teams − 1). This lets the bracket resolve a deterministic slot
 * label to the certain qualifier; until a group is decided its 1st/2nd are left
 * as descriptive placeholders so the bracket never shows a team that could still
 * change. Wildcard "3rd (…)" labels are never resolvable here (they depend on
 * FIFA's best-third-place combination, settled only after all groups finish).
 *
 * Best-effort: empty map on failure → injection shows placeholder labels.
 */
async function buildLabelToTeam(): Promise<Map<string, SlotTeam>> {
  const labelToTeam = new Map<string, SlotTeam>();
  try {
    const { standings } = await getStandingsCached('WC');
    for (const table of standings) {
      if (table.type !== 'TOTAL') continue;
      const letter = (table.group ?? '')
        .replace(/^GROUP[_\s]*/i, '')
        .replace(/^Group\s*/i, '')
        .trim()
        .toUpperCase();
      if (!letter || table.table.length === 0) continue;

      const expectedGames = table.table.length - 1;
      const decided = expectedGames > 0 && table.table.every((e) => e.playedGames === expectedGames);
      if (!decided) continue;

      for (const entry of table.table) {
        const ord = ORDINAL[entry.position];
        if (!ord || !entry.team?.id || (entry.position !== 1 && entry.position !== 2)) continue;
        labelToTeam.set(`${ord} Group ${letter}`, {
          id:        entry.team.id,
          name:      entry.team.name,
          shortName: entry.team.shortName ?? entry.team.name,
          tla:       entry.team.tla ?? '',
          crest:     entry.team.crest ?? '',
        });
      }
    }
  } catch {
    // standings unavailable — empty map → placeholder labels in injection
  }
  return labelToTeam;
}

/**
 * Enrich a raw authority match array with knockout slot labels.
 *
 * Non-knockout matches (GROUP_STAGE) pass through unchanged.
 * Knockout matches with empty/null team names get the official slot label
 * ("1st Group E", "2nd Group A", "Winner R32 M1", etc.).
 * Decided group positions are resolved to the actual team if the group is complete.
 *
 * ONE PIPELINE: call this in any page that receives raw authority matches and
 * must show upcoming knockout fixtures (schedule, fixtures, etc.).
 */
export async function enrichKnockoutSlots(matches: CanonicalMatch[]): Promise<CanonicalMatch[]> {
  const labelToTeam = await buildLabelToTeam();
  const knockoutSet = new Set<string>(ALL_KNOCKOUT_STAGES);

  // Enrich each knockout stage and index by id for O(1) lookup
  const enrichedById = new Map<number, CanonicalMatch>();
  for (const stage of ALL_KNOCKOUT_STAGES) {
    const stageMatches = matches.filter((m) => m.stage === stage);
    if (stageMatches.length === 0) continue;
    for (const m of injectKnockoutSlotLabels(stageMatches, stage, stage === 'LAST_32' ? labelToTeam : undefined)) {
      enrichedById.set(m.id, m);
    }
  }

  // Preserve caller's sort order
  return matches.map((m) => (knockoutSet.has(m.stage) ? (enrichedById.get(m.id) ?? m) : m));
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

// ---------------------------------------------------------------------------
// Team knockout path — DATA-18WC.EXPERIENCE.V2
//
// Returns all knockout matches that involved a given team (by id), sorted
// chronologically. Used by KnockoutJourney and RoadToFinal components.
// Pure function over an existing KnockoutViewModel — no new fetches.
// ---------------------------------------------------------------------------

export function getTeamKnockoutPath(vm: KnockoutViewModel, teamId: number): Match[] {
  return vm.matches
    .filter((m) => m.homeTeam?.id === teamId || m.awayTeam?.id === teamId)
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
}

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

  // Resolve decided group positions to the actual qualified team. Only meaningful
  // for LAST_32, whose labels are group positions ("1st Group A"); other rounds use
  // positional "Winner R32 Mx" labels that have no team to resolve.
  const labelToTeam = await buildLabelToTeam();

  // Enrich null team names — slot mapping is by sorted match id (authority bracket
  // position); decided group positions resolve to real teams via labelToTeam.
  const matches: Match[] = ALL_KNOCKOUT_STAGES
    .flatMap((stage) =>
      injectKnockoutSlotLabels(
        knockoutRaw.filter((m) => m.stage === stage),
        stage,
        stage === 'LAST_32' ? labelToTeam : undefined,
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
