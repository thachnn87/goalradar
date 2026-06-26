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

type SlotTeam = { id: number; name: string; shortName: string; tla: string; crest: string };

export interface GroupResolution {
  /** teamId → "1st Group A" — anchors a confirmed team to its true bracket slot. */
  positions: Map<number, string>;
  /**
   * "1st Group A" / "2nd Group A" → the actual qualified team, but ONLY for groups
   * whose stage is complete (every team has played all group matches). Lets the
   * bracket show the certain qualifier instead of a placeholder label. Wildcard
   * labels ("3rd (B/C/D)", "3rd best") are never resolvable here.
   */
  labelToTeam: Map<string, SlotTeam>;
}

/**
 * Derive bracket resolution from WC standings:
 *   • positions   — for anchoring confirmed teams to their correct slot.
 *   • labelToTeam — for filling decided 1st/2nd slots with the real qualified team.
 *
 * A group is "decided" only when every team in it has played the full group
 * schedule (playedGames === teams − 1). Until then its 1st/2nd are NOT resolved,
 * so the bracket never shows a team that could still change.
 *
 * Best-effort: returns empty maps on any failure → injection falls back to pure
 * ordinal-by-date label mapping (no regression).
 */
async function buildGroupResolution(): Promise<GroupResolution> {
  const positions   = new Map<number, string>();
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

      // Group decided when every team played the full schedule (N-1 matches).
      const expectedGames = table.table.length - 1;
      const decided = expectedGames > 0 && table.table.every((e) => e.playedGames === expectedGames);

      for (const entry of table.table) {
        const ord = ORDINAL[entry.position];
        if (!ord || !entry.team?.id) continue;
        const label = `${ord} Group ${letter}`;
        positions.set(entry.team.id, label);
        // Only 1st/2nd of a decided group are certain qualifiers.
        if (decided && (entry.position === 1 || entry.position === 2)) {
          labelToTeam.set(label, {
            id:        entry.team.id,
            name:      entry.team.name,
            shortName: entry.team.shortName ?? entry.team.name,
            tla:       entry.team.tla ?? '',
            crest:     entry.team.crest ?? '',
          });
        }
      }
    }
  } catch {
    // standings unavailable — empty maps → ordinal fallback in injection
  }
  return { positions, labelToTeam };
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
  // group position) instead of the unreliable kickoff order, AND resolve decided
  // group positions to the actual qualified team. Only meaningful for LAST_32,
  // whose labels are group positions ("1st Group A"); other rounds use positional
  // "Winner R32 Mx" labels that map fine by order.
  const { positions, labelToTeam } = await buildGroupResolution();

  // Enrich null team names with positional labels — must be called per stage with all stage matches
  const matches: Match[] = ALL_KNOCKOUT_STAGES
    .flatMap((stage) =>
      injectKnockoutSlotLabels(
        knockoutRaw.filter((m) => m.stage === stage),
        stage,
        stage === 'LAST_32' ? positions   : undefined,
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
