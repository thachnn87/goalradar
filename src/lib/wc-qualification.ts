/**
 * WC 2026 Qualification Engine
 *
 * Format: 12 groups, 4 teams each, 3 matches per team (round-robin).
 * Advances: Top 2 from each group (24) + best 8 third-placed teams (8) = 32 total.
 *
 * Status definitions:
 *   QUALIFIED              — mathematically certain to advance to the knockouts
 *   ELIMINATED             — mathematically certain to be knocked out
 *   THIRD_PLACE_CONTENDER  — currently 3rd, still competing for a best-8 spot
 *   UNDECIDED              — outcome still depends on remaining matches
 *
 * Usage:
 *   const tables = standings.filter(s => s.type === 'TOTAL');
 *   const qualMap = calculateQualificationStatus(tables);
 *   const q = qualMap.get(teamId);  // TeamQualification | undefined
 */

import type { StandingEntry, StandingTable } from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QualificationStatus =
  | 'QUALIFIED'
  | 'ELIMINATED'
  | 'THIRD_PLACE_CONTENDER'
  | 'UNDECIDED';

export interface TeamQualification {
  /** football-data.org numeric team ID (0 for static-skeleton entries) */
  teamId:                   number;
  teamName:                 string;
  /** Group letter: 'A'–'L' */
  group:                    string;
  /** Current position in group: 1–4 */
  position:                 number;
  qualificationStatus:      QualificationStatus;
  /** Human-readable explanation suitable for display */
  qualificationReason:      string;
  /** 0.0–1.0 probability estimate (1.0 = certain, 0.0 = certain elimination) */
  qualificationProbability: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAMES_PER_TEAM       = 3;  // each team plays 3 group games
const TOP_THIRD_QUALIFIERS = 8;  // best 8 of 12 third-placed teams advance

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function gamesRemaining(entry: StandingEntry): number {
  return Math.max(0, GAMES_PER_TEAM - entry.playedGames);
}

/**
 * FIFA WC third-place tiebreaker order:
 *   1. Points  2. Goal difference  3. Goals for  4. Fair-play  (omit = treat as equal)
 */
function compareThirdPlace(a: StandingEntry, b: StandingEntry): number {
  if (b.points            !== a.points)            return b.points            - a.points;
  if (b.goalDifference    !== a.goalDifference)    return b.goalDifference    - a.goalDifference;
  if (b.goalsFor          !== a.goalsFor)          return b.goalsFor          - a.goalsFor;
  return 0;
}

function ordinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1:  return 'st';
    case 2:  return 'nd';
    case 3:  return 'rd';
    default: return 'th';
  }
}

function ordinal(n: number): string {
  return `${n}${ordinalSuffix(n)}`;
}

/** Estimate probability for a P3 team ranked `rank` out of `totalKnown` groups. */
function estimateThirdPlaceProbability(
  rank: number,
  totalKnown: number,
  entry: StandingEntry,
): number {
  const pts = entry.points;
  const rem = gamesRemaining(entry);

  // Before any groups complete, use points as the main signal
  if (totalKnown < 4) {
    if (pts >= 7) return 0.92;
    if (pts >= 6) return 0.80;
    if (pts >= 4) return 0.60;
    if (pts >= 3 && rem > 0) return 0.45;
    if (rem > 0) return 0.30;
    return 0.15;
  }

  // Enough data to use ranking
  if (rank <= 4) {
    if (pts >= 7) return 0.95;
    if (pts >= 6) return 0.88;
    if (pts >= 5) return 0.78;
    if (pts >= 4) return 0.68;
    return 0.55;
  }
  if (rank <= 8) {
    if (pts >= 7) return 0.82;
    if (pts >= 6) return 0.68;
    if (pts >= 5) return 0.52;
    if (pts >= 4) return 0.40;
    if (pts >= 3) return 0.28;
    return 0.14;
  }
  // Ranked 9th–12th
  const maxPts = pts + rem * 3;
  if (maxPts >= 7) return 0.28;
  if (maxPts >= 6) return 0.18;
  if (maxPts >= 5) return 0.10;
  return 0.04;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Calculates qualification status for every team across all 12 WC 2026 groups.
 *
 * @param groupTables  StandingTable entries filtered to type === 'TOTAL', one per group.
 * @returns            Map from football-data.org team ID → TeamQualification.
 *                     Teams with id === 0 (static-skeleton entries) are included
 *                     but keyed at a negative synthetic ID to avoid collisions.
 */
export function calculateQualificationStatus(
  groupTables: StandingTable[],
): Map<number, TeamQualification> {
  const result = new Map<number, TeamQualification>();

  // Collect third-place entries for cross-group best-8 calculation
  type P3Entry = StandingEntry & { group: string };
  const allThirdPlace: P3Entry[] = [];

  // Synthetic ID counter for static-skeleton entries (id === 0)
  let staticCounter = -1;

  // ── First pass: positions 1, 2, 4 ────────────────────────────────────────
  for (const table of groupTables) {
    const groupLetter = (table.group ?? '').replace(/^GROUP_/, '');
    if (!groupLetter) continue;

    // Sort by position (API should already sort, but be defensive)
    const sorted = [...table.table].sort((a, b) => a.position - b.position);
    const groupComplete = sorted.every((e) => e.playedGames >= GAMES_PER_TEAM);

    for (const entry of sorted) {
      const rem    = gamesRemaining(entry);
      const mapKey = entry.team.id > 0 ? entry.team.id : staticCounter--;

      if (entry.position <= 2) {
        // Can all lower-positioned teams still catch up in points?
        const below = sorted.filter((e) => e.position > 2);
        const maxBelowPts = below.length > 0
          ? Math.max(...below.map((e) => e.points + gamesRemaining(e) * 3))
          : 0;

        // Safe = even if all teams below win every remaining match, they can't
        // reach this team's current points (which is our minimum — we only gain)
        const isMathSafe = maxBelowPts < entry.points;

        if (isMathSafe || groupComplete) {
          const posLabel = entry.position === 1 ? '1st' : '2nd';
          result.set(mapKey, {
            teamId:                   entry.team.id,
            teamName:                 entry.team.name,
            group:                    groupLetter,
            position:                 entry.position,
            qualificationStatus:      'QUALIFIED',
            qualificationReason:      `Qualified — finished ${posLabel} in Group ${groupLetter}`,
            qualificationProbability: 1.0,
          });
        } else {
          const posLabel = entry.position === 1 ? '1st' : '2nd';
          const prob = entry.position === 1 ? 0.84 : 0.72;
          result.set(mapKey, {
            teamId:                   entry.team.id,
            teamName:                 entry.team.name,
            group:                    groupLetter,
            position:                 entry.position,
            qualificationStatus:      'UNDECIDED',
            qualificationReason:      `${posLabel} in Group ${groupLetter} — ${rem} match${rem !== 1 ? 'es' : ''} remaining`,
            qualificationProbability: prob,
          });
        }
      } else if (entry.position === 3) {
        // Collect for second pass — placeholder status set now
        allThirdPlace.push({ ...entry, group: groupLetter });
        result.set(mapKey, {
          teamId:                   entry.team.id,
          teamName:                 entry.team.name,
          group:                    groupLetter,
          position:                 3,
          qualificationStatus:      'THIRD_PLACE_CONTENDER',
          qualificationReason:      `3rd in Group ${groupLetter} — competing for a best third-place spot`,
          qualificationProbability: 0.5,
        });
      } else if (entry.position === 4) {
        const p3Entry  = sorted.find((e) => e.position === 3);
        const p3Points = p3Entry?.points ?? 0;
        const maxAch   = entry.points + rem * 3;

        if (groupComplete || maxAch < p3Points) {
          result.set(mapKey, {
            teamId:                   entry.team.id,
            teamName:                 entry.team.name,
            group:                    groupLetter,
            position:                 4,
            qualificationStatus:      'ELIMINATED',
            qualificationReason:      `Eliminated — finished 4th in Group ${groupLetter}`,
            qualificationProbability: 0.0,
          });
        } else {
          result.set(mapKey, {
            teamId:                   entry.team.id,
            teamName:                 entry.team.name,
            group:                    groupLetter,
            position:                 4,
            qualificationStatus:      'UNDECIDED',
            qualificationReason:      `4th in Group ${groupLetter} — ${rem} match${rem !== 1 ? 'es' : ''} remaining`,
            qualificationProbability: 0.07,
          });
        }
      }
    }
  }

  // ── Second pass: refine third-place statuses using best-8 logic ──────────
  if (allThirdPlace.length > 0) {
    refineThirdPlace(allThirdPlace, result, groupTables.length);
  }

  return result;
}

function refineThirdPlace(
  allThirdPlace: Array<StandingEntry & { group: string }>,
  result:         Map<number, TeamQualification>,
  totalGroups:    number,
): void {
  // Sort all third-place teams by WC criteria
  const sorted = [...allThirdPlace].sort(compareThirdPlace);

  // How many groups have a FINISHED (3-game) P3 result?
  const completedP3    = allThirdPlace.filter((e) => e.playedGames >= GAMES_PER_TEAM);
  const numCompleted   = completedP3.length;
  const allGroupsDone  = numCompleted >= totalGroups;

  // The 8th-best completed P3 score (used for early-elimination check)
  const completedSorted = [...completedP3].sort(compareThirdPlace);
  const rank8Pts        = completedSorted[TOP_THIRD_QUALIFIERS - 1]?.points ?? 0;

  for (const p3Entry of allThirdPlace) {
    const rank   = sorted.findIndex((e) => e.team.id === p3Entry.team.id) + 1;
    const rem    = gamesRemaining(p3Entry);
    const maxPts = p3Entry.points + rem * 3;
    const mapKey = p3Entry.team.id > 0 ? p3Entry.team.id : undefined;
    if (mapKey === undefined) continue; // static entries: skip (result already set)

    if (allGroupsDone) {
      // All 12 groups done — definitive
      if (rank <= TOP_THIRD_QUALIFIERS) {
        result.set(mapKey, {
          teamId:                   p3Entry.team.id,
          teamName:                 p3Entry.team.name,
          group:                    p3Entry.group,
          position:                 3,
          qualificationStatus:      'QUALIFIED',
          qualificationReason:      `Qualified — ${ordinal(rank)} best third-placed team`,
          qualificationProbability: 1.0,
        });
      } else {
        result.set(mapKey, {
          teamId:                   p3Entry.team.id,
          teamName:                 p3Entry.team.name,
          group:                    p3Entry.group,
          position:                 3,
          qualificationStatus:      'ELIMINATED',
          qualificationReason:      `Eliminated — ranked ${ordinal(rank)} among third-placed teams (only top 8 advance)`,
          qualificationProbability: 0.0,
        });
      }
    } else {
      // Groups still in progress

      // Can we already eliminate? Need ≥8 complete groups AND this team's max
      // points is below the 8th-best completed score.
      const canEliminate = numCompleted >= TOP_THIRD_QUALIFIERS && maxPts < rank8Pts;
      if (canEliminate) {
        result.set(mapKey, {
          teamId:                   p3Entry.team.id,
          teamName:                 p3Entry.team.name,
          group:                    p3Entry.group,
          position:                 3,
          qualificationStatus:      'ELIMINATED',
          qualificationReason:      `Eliminated — max achievable ${maxPts} pts can't reach top 8 third-placed teams`,
          qualificationProbability: 0.0,
        });
        continue;
      }

      const prob        = estimateThirdPlaceProbability(rank, numCompleted, p3Entry);
      const rankContext = sorted.length >= 4
        ? `currently ${ordinal(rank)} of ${sorted.length} third-placed teams`
        : `${numCompleted} of 12 groups complete`;

      result.set(mapKey, {
        teamId:                   p3Entry.team.id,
        teamName:                 p3Entry.team.name,
        group:                    p3Entry.group,
        position:                 3,
        qualificationStatus:      'THIRD_PLACE_CONTENDER',
        qualificationReason:      `Competing for a best third-place spot — ${rankContext} · ${p3Entry.points} pts`,
        qualificationProbability: prob,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Look up a team's qualification status by display/API name (case-insensitive).
 * Use when you have a team name but not a numeric ID.
 */
export function findQualByName(
  qualMap: Map<number, TeamQualification>,
  name: string,
): TeamQualification | undefined {
  const lower = name.toLowerCase();
  for (const q of qualMap.values()) {
    if (q.teamName.toLowerCase() === lower) return q;
  }
  return undefined;
}

/**
 * Returns all TeamQualification entries for the given group letter ('A'–'L').
 */
export function getGroupQualifications(
  qualMap: Map<number, TeamQualification>,
  groupLetter: string,
): TeamQualification[] {
  const letter = groupLetter.toUpperCase();
  const out: TeamQualification[] = [];
  for (const q of qualMap.values()) {
    if (q.group === letter) out.push(q);
  }
  return out.sort((a, b) => a.position - b.position);
}

// ---------------------------------------------------------------------------
// Badge helpers (used by UI components to avoid duplicating style logic)
// ---------------------------------------------------------------------------

export interface QualBadgeStyle {
  label:           string;
  shortLabel:      string;
  borderColor:     string;  // Tailwind border-l-* class
  bgColor:         string;  // Tailwind bg-* class (for row highlight)
  textColor:       string;
  badgeClass:      string;  // full pill badge classes
}

export const QUAL_BADGE_STYLES: Record<QualificationStatus, QualBadgeStyle> = {
  QUALIFIED: {
    label:      'Qualified',
    shortLabel: 'Q',
    borderColor: 'border-l-green-500',
    bgColor:    'bg-green-950/15',
    textColor:  'text-green-400',
    badgeClass: 'bg-green-500/15 text-green-400 border border-green-500/30',
  },
  ELIMINATED: {
    label:      'Eliminated',
    shortLabel: 'E',
    borderColor: 'border-l-red-600',
    bgColor:    'bg-red-950/10',
    textColor:  'text-red-400',
    badgeClass: 'bg-red-500/15 text-red-400 border border-red-500/30',
  },
  THIRD_PLACE_CONTENDER: {
    label:      '3rd-Place Race',
    shortLabel: '3',
    borderColor: 'border-l-yellow-500',
    bgColor:    'bg-yellow-950/10',
    textColor:  'text-yellow-400',
    badgeClass: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  },
  UNDECIDED: {
    label:      'In Contention',
    shortLabel: '?',
    borderColor: 'border-l-gray-600',
    bgColor:    '',
    textColor:  'text-gray-400',
    badgeClass: 'bg-gray-700/40 text-gray-400 border border-gray-600/40',
  },
};

/**
 * Derive a qualification status purely from group position and game count,
 * without running the full engine.  Used as a fast fallback when no qualMap
 * is available (e.g. WCGroupTable in contexts that don't pass one).
 */
export function positionToStatus(
  position: number,
  playedGames: number,
): QualificationStatus {
  if (position <= 2) return playedGames >= GAMES_PER_TEAM ? 'QUALIFIED' : 'UNDECIDED';
  if (position === 3) return 'THIRD_PLACE_CONTENDER';
  return playedGames >= GAMES_PER_TEAM ? 'ELIMINATED' : 'UNDECIDED';
}

// ---------------------------------------------------------------------------
// Simulator helper — DATA-18WC.EXPERIENCE.V2
//
// Apply a hypothetical match result to a StandingTable and return a new
// StandingTable with updated points/GD/GF for both teams.
//
// Pure function — does NOT mutate the input. Does NOT re-run the engine.
// The caller re-runs calculateQualificationStatus() on the returned table
// to get the updated qualification map.
// ---------------------------------------------------------------------------

export function applyScenarioResult(
  table:     StandingTable,
  homeId:    number,
  awayId:    number,
  homeGoals: number,
  awayGoals: number,
): StandingTable {
  const delta = (id: number): Partial<StandingEntry> => {
    const isHome = id === homeId;
    const gf  = isHome ? homeGoals : awayGoals;
    const ga  = isHome ? awayGoals : homeGoals;
    const gd  = gf - ga;
    const pts = gf > ga ? 3 : gf === ga ? 1 : 0;
    return { playedGames: 1, goalsFor: gf, goalsAgainst: ga, goalDifference: gd, points: pts,
             won: gf > ga ? 1 : 0, draw: gf === ga ? 1 : 0, lost: gf < ga ? 1 : 0 };
  };

  const newTable = table.table.map((e): StandingEntry => {
    if (e.team.id !== homeId && e.team.id !== awayId) return e;
    const d = delta(e.team.id);
    return {
      ...e,
      playedGames:   e.playedGames   + (d.playedGames   ?? 0),
      points:        e.points        + (d.points        ?? 0),
      won:           e.won           + (d.won           ?? 0),
      draw:          e.draw          + (d.draw          ?? 0),
      lost:          e.lost          + (d.lost          ?? 0),
      goalsFor:      e.goalsFor      + (d.goalsFor      ?? 0),
      goalsAgainst:  e.goalsAgainst  + (d.goalsAgainst  ?? 0),
      goalDifference: e.goalDifference + (d.goalDifference ?? 0),
    };
  });

  // Re-sort by pts → GD → GF → team name (FIFA tiebreaker approximation)
  const sorted = [...newTable].sort((a, b) => {
    if (b.points          !== a.points)          return b.points          - a.points;
    if (b.goalDifference  !== a.goalDifference)  return b.goalDifference  - a.goalDifference;
    if (b.goalsFor        !== a.goalsFor)        return b.goalsFor        - a.goalsFor;
    return a.team.name.localeCompare(b.team.name);
  }).map((e, i) => ({ ...e, position: i + 1 }));

  return { ...table, table: sorted };
}
