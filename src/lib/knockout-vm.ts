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
import type { Match, Competition, Score } from './types';
import { deriveMatchDisplay } from './match-display';
import { canonicalToMatch } from './canonical-match';
import type { CanonicalMatch } from './canonical-match';
import { injectKnockoutSlotLabels, WC_KNOCKOUT_SLOTS } from './wc-fixtures';

// ---------------------------------------------------------------------------
// Static knockout structure — outage-safe fallback for the bracket tree
// ---------------------------------------------------------------------------

const WC_COMPETITION: Competition = {
  id: 2000, name: 'FIFA World Cup', code: 'WC', type: 'CUP', emblem: '',
  area: { id: 0, name: 'World', code: 'WLD', flag: null },
};
const EMPTY_SCORE: Score = {
  winner: null, duration: 'REGULAR',
  fullTime: { home: null, away: null }, halfTime: { home: null, away: null },
};

/**
 * Canonical knockout bracket as synthetic Match[], derived from the schedule
 * SSOT (WC_KNOCKOUT_SLOTS). Teams carry the deterministic slot labels
 * ("1st Group E", "Winner R32 M1", …) — the exact placeholder shape the
 * authority pipeline itself emits pre-tournament via injectKnockoutSlotLabels,
 * so downstream consumers (buildKnockoutGraph / WCBracket) treat both identically.
 *
 * Purpose: keep the knockout bracket TREE structurally present when the
 * authority cache is empty (provider outage / cold KV) instead of collapsing to
 * blank "TBD" columns. Ids are negative (matchPath renders them non-linkable),
 * scores null, status SCHEDULED — no fabricated results, structure only.
 */
export function getStaticKnockoutMatches(): Match[] {
  return WC_KNOCKOUT_SLOTS.map((s) => ({
    id:          -s.localId,          // negative synthetic id → non-linkable, no collision
    utcDate:     s.utcDate,
    status:      'SCHEDULED' as const,
    matchday:    null,
    stage:       s.round,
    group:       null,
    lastUpdated: '2026-06-08T00:00:00Z',
    competition: WC_COMPETITION,
    homeTeam: { id: 0, name: s.homeLabel, shortName: s.homeLabel, tla: '', crest: '' },
    awayTeam: { id: 0, name: s.awayLabel, shortName: s.awayLabel, tla: '', crest: '' },
    score: EMPTY_SCORE,
  }));
}

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

/** All 5 rounds the WCBracket component's own column layout expects (R32 → Final, no THIRD_PLACE). */
export const FULL_BRACKET_TREE_STAGES = new Set<KnockoutStage>([
  'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL',
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
  /** R32→Final matches for standalone WCBracket usage with no separate R32 list (excludes THIRD_PLACE). */
  fullBracketMatches: Match[];
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
    fullBracketMatches: matches.filter((m) => FULL_BRACKET_TREE_STAGES.has(m.stage as KnockoutStage)),
    hasApiData:     knockoutRaw.length > 0,
    byStage,
  };
};

// ===========================================================================
// Knockout bracket GRAPH — explicit directed acyclic graph (source of truth)
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS
// The authority feed (football-data.org) gives each knockout match its ACTUAL
// participants (real teams once known, or "Winner R16 M5" placeholders before)
// plus its stage — but NO explicit parent-match linkage. It also numbers matches
// in SCHEDULE order, which is not their top-to-bottom position in the bracket
// tree. Rendering the tree by match id / date / array index therefore draws a
// match between the wrong pair of parents.
//
// This module reconstructs the true bracket as an explicit DAG. Every node
// carries `leftParentMatchId` / `rightParentMatchId`, resolved ONLY from:
//   • the winning team's identity in the previous round (played matches), or
//   • the "Winner <round> M<n>" placeholder label (upcoming matches).
// Never from array index, position, sort order, or fixture order. Slot geometry
// is then a pure consequence of the parent links (a DFS from the final), so a
// node always sits between its two real parents. A validation pass asserts that
// every participant originates only from that node's two parents.
// ===========================================================================

/** Bracket rounds, leftmost → final (THIRD_PLACE is a standalone playoff, excluded). */
export const BRACKET_ROUND_ORDER: KnockoutStage[] = [
  'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL',
];

export type ParentSource = 'winner-identity' | 'placeholder-label' | 'unresolved';

export interface BracketNode {
  matchId: number;
  stage: KnockoutStage;
  /** 0-based top-to-bottom position within the round, derived from parent links. */
  slot: number;
  /** Authority match number = 1-based rank of the match id within its round. */
  matchNumber: number;
  /** Parent feeding the top half of this node (smaller parent slot). */
  leftParentMatchId: number | null;
  /** Parent feeding the bottom half of this node (larger parent slot). */
  rightParentMatchId: number | null;
  leftParentSource: ParentSource;
  rightParentSource: ParentSource;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  winner: 'home' | 'away' | null;
  winnerTeamId: number | null;
  winnerTeam: string | null;
}

export interface BracketIssue {
  matchId: number;
  stage: string;
  slot: number;
  code: 'PARENT_UNRESOLVED' | 'PARENT_WRONG_ROUND' | 'PARTICIPANT_MISMATCH';
  message: string;
}

export interface KnockoutGraph {
  rounds: KnockoutStage[];
  /** Nodes per stage, ordered by slot (bracket geometry). */
  nodes: Record<string, BracketNode[]>;
  /** matchIds per stage in slot order — the ONLY ordering a renderer should use. */
  order: Record<string, number[]>;
  /** true when the parent linkage fully reconstructs the base round (no gaps). */
  complete: boolean;
  issues: BracketIssue[];
  valid: boolean;
}

function winnerOf(m: Match): { side: 'home' | 'away' | null; teamId: number | null; teamName: string | null } {
  const w = deriveMatchDisplay(m).winner;
  if (w === 'home') return { side: 'home', teamId: m.homeTeam?.id ?? null, teamName: m.homeTeam?.name ?? null };
  if (w === 'away') return { side: 'away', teamId: m.awayTeam?.id ?? null, teamName: m.awayTeam?.name ?? null };
  return { side: null, teamId: null, teamName: null };
}

/** Trailing integer of a slot label ("Winner R16 M5" → 5, "Winner QF2" → 2). */
function trailingNumber(label: string | undefined): number | null {
  const mm = (label ?? '').match(/(\d+)\s*$/);
  return mm ? parseInt(mm[1], 10) : null;
}

/**
 * Build the explicit knockout DAG from a flat match list.
 *
 * @param matches raw knockout matches (any order — id/date irrelevant)
 * @param rounds  the contiguous rounds to include, leftmost → final
 */
export function buildKnockoutGraph(
  matches: Match[],
  rounds: KnockoutStage[] = BRACKET_ROUND_ORDER,
): KnockoutGraph {
  // Canonical id order per round (authority match-number order). Used ONLY to
  // resolve "Winner <round> M<n>" placeholder labels — n is the authority match
  // number, i.e. the n-th match of that round by ascending id. Never used to
  // position a match in the tree.
  const canon: Record<string, Match[]> = {};
  for (const r of rounds) {
    canon[r] = matches.filter((m) => m.stage === r).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }

  const roundIndex = new Map<string, number>(rounds.map((r, i) => [r, i]));

  // Per-round: winning team id → the match that team won. This is the primary
  // (and only authoritative) parent signal for a played round.
  const winnerByRound = new Map<string, Map<number, Match>>();
  for (const r of rounds) {
    const w = new Map<number, Match>();
    for (const m of canon[r]) {
      const wi = winnerOf(m);
      if (wi.teamId) w.set(wi.teamId, m);
    }
    winnerByRound.set(r, w);
  }

  const resolveParent = (m: Match, side: 'home' | 'away'): { match: Match | null; source: ParentSource } => {
    const ri = roundIndex.get(m.stage);
    if (ri == null || ri <= 0) return { match: null, source: 'unresolved' };
    const prev = rounds[ri - 1];
    const team = side === 'home' ? m.homeTeam : m.awayTeam;
    // Primary: this side's team won a specific match in the previous round.
    if (team?.id) {
      const played = winnerByRound.get(prev)?.get(team.id);
      if (played) return { match: played, source: 'winner-identity' };
    }
    // Fallback (upcoming match): "Winner <round> M<n>" → n-th match of prev round.
    const n = trailingNumber(team?.name);
    if (n != null && canon[prev][n - 1]) return { match: canon[prev][n - 1], source: 'placeholder-label' };
    return { match: null, source: 'unresolved' };
  };

  // Leaves under a node — a DFS through parent links. Determines slot geometry.
  const leavesMemo = new Map<number, Match[]>();
  const leaves = (m: Match): Match[] => {
    const ri = roundIndex.get(m.stage) ?? 0;
    if (ri === 0) return [m];
    const cached = leavesMemo.get(m.id);
    if (cached) return cached;
    const l = resolveParent(m, 'home').match;
    const r = resolveParent(m, 'away').match;
    const res = [...(l ? leaves(l) : []), ...(r ? leaves(r) : [])];
    leavesMemo.set(m.id, res);
    return res;
  };

  const baseKey = rounds[0];
  const topKey = rounds[rounds.length - 1];
  const baseOrder = (canon[topKey] ?? []).flatMap((m) => leaves(m));
  const baseAll = canon[baseKey] ?? [];
  const complete =
    baseAll.length > 0 &&
    baseOrder.length === baseAll.length &&
    new Set(baseOrder.map((m) => m.id)).size === baseAll.length;

  const baseIndex = new Map<number, number>(baseOrder.map((m, i) => [m.id, i]));
  const orderRound = (r: KnockoutStage): Match[] => {
    if (!complete) return canon[r]; // honest fallback: authority id order
    if (r === baseKey) return baseOrder;
    return [...canon[r]].sort((a, b) => {
      const fa = Math.min(...leaves(a).map((l) => baseIndex.get(l.id) ?? 0));
      const fb = Math.min(...leaves(b).map((l) => baseIndex.get(l.id) ?? 0));
      return fa - fb || (a.id ?? 0) - (b.id ?? 0);
    });
  };

  const matchNumberOf = (m: Match): number => (canon[m.stage]?.findIndex((x) => x.id === m.id) ?? -1) + 1;

  // ── Build nodes round by round (previous round's slots are known first) ────
  const nodes: Record<string, BracketNode[]> = {};
  const order: Record<string, number[]> = {};
  const slotOf = new Map<number, number>(); // matchId → slot (for parent ordering)

  for (const r of rounds) {
    const ordered = orderRound(r);
    nodes[r] = ordered.map((m, slot) => {
      slotOf.set(m.id, slot);
      const fh = resolveParent(m, 'home');
      const fa = resolveParent(m, 'away');
      // Order parents top→bottom by their slot in the previous round.
      let left = fh, right = fa;
      if (fh.match && fa.match) {
        const sh = slotOf.get(fh.match.id) ?? 0;
        const sa = slotOf.get(fa.match.id) ?? 0;
        if (sa < sh) { left = fa; right = fh; }
      }
      const wi = winnerOf(m);
      return {
        matchId: m.id,
        stage: r,
        slot,
        matchNumber: matchNumberOf(m),
        leftParentMatchId: left.match?.id ?? null,
        rightParentMatchId: right.match?.id ?? null,
        leftParentSource: left.source,
        rightParentSource: right.source,
        homeTeam: m.homeTeam?.name ?? 'TBD',
        awayTeam: m.awayTeam?.name ?? 'TBD',
        homeTeamId: m.homeTeam?.id ?? 0,
        awayTeamId: m.awayTeam?.id ?? 0,
        winner: wi.side,
        winnerTeamId: wi.teamId,
        winnerTeam: wi.teamName,
      };
    });
    order[r] = nodes[r].map((n) => n.matchId);
  }

  // ── Validation: every participant must originate from this node's parents ──
  const nodeById = new Map<number, BracketNode>();
  for (const r of rounds) for (const n of nodes[r]) nodeById.set(n.matchId, n);

  const issues: BracketIssue[] = [];
  for (let ri = 1; ri < rounds.length; ri++) {
    const prev = rounds[ri - 1];
    for (const n of nodes[rounds[ri]]) {
      if (n.leftParentMatchId == null || n.rightParentMatchId == null) {
        issues.push({
          matchId: n.matchId, stage: n.stage, slot: n.slot, code: 'PARENT_UNRESOLVED',
          message: `slot ${n.slot} (${n.homeTeam} vs ${n.awayTeam}) has no explicit parent for one/both sides`,
        });
        continue;
      }
      const L = nodeById.get(n.leftParentMatchId);
      const R = nodeById.get(n.rightParentMatchId);
      if (!L || !R || L.stage !== prev || R.stage !== prev) {
        issues.push({
          matchId: n.matchId, stage: n.stage, slot: n.slot, code: 'PARENT_WRONG_ROUND',
          message: `parents must both be ${prev}; got ${L?.stage ?? '?'} / ${R?.stage ?? '?'}`,
        });
        continue;
      }
      // When both parents are decided and both participants are real teams, the
      // two participants MUST be exactly the two parent winners.
      const expected = [L.winnerTeamId, R.winnerTeamId].filter((x): x is number => !!x);
      const actual = [n.homeTeamId, n.awayTeamId].filter((x) => x > 0);
      if (expected.length === 2 && actual.length === 2) {
        const exp = new Set(expected);
        if (!actual.every((t) => exp.has(t))) {
          issues.push({
            matchId: n.matchId, stage: n.stage, slot: n.slot, code: 'PARTICIPANT_MISMATCH',
            message: `${n.homeTeam} vs ${n.awayTeam} are not the winners of parents ` +
              `[${L.winnerTeam ?? '—'} @M${L.matchId}] / [${R.winnerTeam ?? '—'} @M${R.matchId}]`,
          });
        }
      }
    }
  }

  return { rounds, nodes, order, complete, issues, valid: issues.length === 0 };
}
