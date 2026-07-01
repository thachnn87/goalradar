/**
 * experience-vm.ts — ONE EXPERIENCE VIEWMODEL
 *
 * Single server-computed object that powers the entire Experience Layer.
 * All client modules read via useExperience() — none compute data independently.
 *
 * Contract:
 *   - buildExperienceViewModel() is a PURE SYNC function.
 *   - Caller pages fetch all async data first, then pass it here.
 *   - No fetch, no async, no side effects.
 *   - ALL qualification status is computed once from calculateQualificationStatus().
 *   - ALL stories are generated once from experience-story-engine.ts.
 *   - Components MUST NOT import calculateQualificationStatus, buildKnockoutViewModel,
 *     or generateStoriesForGroup directly.
 */

import type { Match, StandingTable } from './types';
import { WC_KNOCKOUT_SLOTS, type WCKnockoutSlot } from './wc-fixtures';
import { WC_ROUNDS } from './wc-rounds';
import { calculateQualificationStatus, type TeamQualification, type QualificationStatus } from './wc-qualification';
import { generateAllStories, type Story, type StoryUrgency } from './experience-story-engine';
import { WC_ALL_TEAMS } from './wc-all-teams';

// ---------------------------------------------------------------
// Static lookup — flag emojis by team API name
// ---------------------------------------------------------------

const FLAG_LOOKUP = new Map(WC_ALL_TEAMS.map(t => [t.apiName.toLowerCase(), t.flag]));

// ---------------------------------------------------------------
// Types — Tournament state
// ---------------------------------------------------------------

export type TournamentPhase =
  | 'PRE_TOURNAMENT'
  | 'GROUP_STAGE'
  | 'KNOCKOUT'
  | 'COMPLETED';

export interface TournamentState {
  phase: TournamentPhase;
  currentIso: string;
  totalPlayed: number;
  totalGoals: number;
  totalRemaining: number;
  liveCount: number;
  activeMatchday: number | null;
}

// ---------------------------------------------------------------
// Types — Group ViewModel
// ---------------------------------------------------------------

export interface GroupTeamVM {
  teamId: number;
  teamName: string;
  shortName: string;
  flag: string;
  position: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  qualificationStatus: QualificationStatus;
  qualificationReason: string;
}

export interface GroupVM {
  letter: string;
  apiKey: string;
  slug: string;
  href: string;
  teams: GroupTeamVM[];
  matchesPlayed: number;
  isComplete: boolean;
  stories: Story[];
}

// ---------------------------------------------------------------
// Types — Bracket ViewModel (Road To Final)
// ---------------------------------------------------------------

export type BracketStage =
  | 'LAST_32' | 'LAST_16' | 'QUARTER_FINALS'
  | 'SEMI_FINALS' | 'THIRD_PLACE' | 'FINAL';

export interface BracketMatchVM {
  id: number;
  stage: BracketStage;
  /** 0-based slot index within the round */
  slotIndex: number;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  utcDate: string;
}

export interface BracketVM {
  matchesByStage: Record<BracketStage, BracketMatchVM[]>;
  /** teamName → ordered list of match IDs they played / are projected to play */
  teamPaths: Record<string, number[]>;
  /** matchId → match IDs closer to the FINAL (ancestors in the bracket tree) */
  matchAncestors: Record<number, number[]>;
  /** matchId → match IDs that fed into this match (descendants toward R32) */
  matchDescendants: Record<number, number[]>;
}

// ---------------------------------------------------------------
// Types — Journey ViewModel (Team Journey)
// ---------------------------------------------------------------

export type JourneyNodeStatus =
  | 'WIN' | 'DRAW' | 'LOSS' | 'LIVE' | 'UPCOMING' | 'UNREACHABLE';

export interface JourneyNode {
  stage: string;
  stageLabel: string;
  icon: string;
  status: JourneyNodeStatus;
  matchId: number | null;
  opponentName: string | null;
  /** "2–1" (from team's perspective) or summary string for group stage */
  score: string | null;
  date: string | null;
}

export interface TeamJourneyVM {
  teamName: string;
  nodes: JourneyNode[];
  /** Index of last played/live node (-1 if none) */
  currentStageIndex: number;
  isEliminated: boolean;
  eliminatedAt: string | null;
}

// ---------------------------------------------------------------
// Types — Timeline ViewModel
// ---------------------------------------------------------------

export interface TimelineNode {
  id: string;
  label: string;
  shortLabel: string;
  dateRange: string;
  isoStart: string;
  isoEnd: string;
  isToday: boolean;
  isPast: boolean;
  isCurrent: boolean;
  matchCount: number;
  completedCount: number;
}

export interface TimelineVM {
  nodes: TimelineNode[];
  /** Index of current round (-1 if none) */
  currentIndex: number;
  /** Index of today's node (-1 if none) */
  todayIndex: number;
}

// ---------------------------------------------------------------
// Types — Live ViewModel
// ---------------------------------------------------------------

export interface LiveVM {
  matches: Match[];
  lastUpdated: string;
}

// ---------------------------------------------------------------
// Root ExperienceViewModel
// ---------------------------------------------------------------

export interface ExperienceViewModel {
  tournament: TournamentState;
  groups: GroupVM[];
  /** All stories sorted by urgency (critical → low) */
  stories: Story[];
  bracket: BracketVM;
  /** One entry per team that appears in the fixture list */
  journeys: TeamJourneyVM[];
  timeline: TimelineVM;
  /** venueSlug → knockout matches played/scheduled at that venue */
  venueMatchMap: Record<string, Match[]>;
  live: LiveVM;
}

// ---------------------------------------------------------------
// Input
// ---------------------------------------------------------------

export interface ExperienceInput {
  /** All WC matches (group + knockout) */
  matches: Match[];
  /** All standing tables from the API */
  standingTables: StandingTable[];
  /** Currently live matches */
  liveMatches: Match[];
  /** Server-side current ISO datetime string */
  currentIso: string;
}

// ---------------------------------------------------------------
// Bracket slot tree — computed once from WC_KNOCKOUT_SLOTS
// ---------------------------------------------------------------

type SlotKey = string; // `${round}:${matchNumber}`
const sk = (round: string, n: number): SlotKey => `${round}:${n}`;

interface SlotNode {
  round: string;
  matchNumber: number;
  parentSlotKey: SlotKey | null;
  loserDestSlotKey: SlotKey | null;
  childSlotKeys: SlotKey[];
}

function buildSlotTree(): Map<SlotKey, SlotNode> {
  const tree = new Map<SlotKey, SlotNode>();

  for (const slot of WC_KNOCKOUT_SLOTS) {
    tree.set(sk(slot.round, slot.matchNumber), {
      round: slot.round,
      matchNumber: slot.matchNumber,
      parentSlotKey: null,
      loserDestSlotKey: null,
      childSlotKeys: [],
    });
  }

  // Parse homeLabel/awayLabel to wire parent → child relationships
  const WINNER_PATTERNS: [RegExp, string][] = [
    [/^Winner R32 M(\d+)$/, 'LAST_32'],
    [/^Winner R16 M(\d+)$/, 'LAST_16'],
    [/^Winner QF(\d+)$/,    'QUARTER_FINALS'],
    [/^Winner SF(\d+)$/,    'SEMI_FINALS'],
  ];
  const LOSER_RE = /^Loser SF(\d+)$/;

  for (const destSlot of WC_KNOCKOUT_SLOTS) {
    const destKey = sk(destSlot.round, destSlot.matchNumber);
    const isThirdPlace = destSlot.round === 'THIRD_PLACE';

    for (const label of [destSlot.homeLabel, destSlot.awayLabel]) {
      if (isThirdPlace) {
        const m = LOSER_RE.exec(label);
        if (m) {
          const srcKey = sk('SEMI_FINALS', +m[1]);
          const srcNode = tree.get(srcKey);
          if (srcNode) srcNode.loserDestSlotKey = destKey;
          const destNode = tree.get(destKey);
          if (destNode && !destNode.childSlotKeys.includes(srcKey)) {
            destNode.childSlotKeys.push(srcKey);
          }
        }
        continue;
      }
      for (const [re, round] of WINNER_PATTERNS) {
        const m = re.exec(label);
        if (m) {
          const srcKey = sk(round, +m[1]);
          const srcNode = tree.get(srcKey);
          if (srcNode && !srcNode.parentSlotKey) {
            srcNode.parentSlotKey = destKey;
          }
          const destNode = tree.get(destKey);
          if (destNode && !destNode.childSlotKeys.includes(srcKey)) {
            destNode.childSlotKeys.push(srcKey);
          }
          break;
        }
      }
    }
  }

  return tree;
}

const SLOT_TREE = buildSlotTree();

// ---------------------------------------------------------------
// Match ↔ slot mapping
// ---------------------------------------------------------------

const KNOCKOUT_STAGES: BracketStage[] = [
  'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL',
];

function mapMatchesToSlots(knockoutMatches: Match[]): {
  matchToSlot: Map<number, SlotKey>;
  slotToMatch: Map<SlotKey, number>;
} {
  const matchToSlot = new Map<number, SlotKey>();
  const slotToMatch = new Map<SlotKey, number>();

  for (const stage of KNOCKOUT_STAGES) {
    const stageMatches = knockoutMatches
      .filter(m => m.stage === stage)
      .sort((a, b) => a.id - b.id); // ascending API ID = bracket slot order

    const slots = WC_KNOCKOUT_SLOTS
      .filter(s => s.round === stage)
      .sort((a, b) => a.matchNumber - b.matchNumber);

    stageMatches.forEach((m, i) => {
      const slot = slots[i];
      if (!slot) return;
      const key = sk(stage, slot.matchNumber);
      matchToSlot.set(m.id, key);
      slotToMatch.set(key, m.id);
    });
  }

  return { matchToSlot, slotToMatch };
}

// ---------------------------------------------------------------
// Road To Final: team path through the bracket
// ---------------------------------------------------------------

const STAGE_ORDER_IDX: Record<string, number> = {
  LAST_32: 0, LAST_16: 1, QUARTER_FINALS: 2,
  SEMI_FINALS: 3, THIRD_PLACE: 4, FINAL: 5,
};

const SLOT_LABEL_RE = /^(Winner|Loser|1st|2nd|3rd|4th)[\s(]/;

function computeTeamPaths(
  knockoutMatches: Match[],
  slotToMatch: Map<SlotKey, number>,
  matchToSlot: Map<number, SlotKey>,
): Record<string, number[]> {
  const teamPaths: Record<string, number[]> = {};

  // Step 1: record confirmed appearances
  for (const m of knockoutMatches) {
    for (const teamName of [m.homeTeam?.name, m.awayTeam?.name]) {
      if (!teamName || SLOT_LABEL_RE.test(teamName)) continue;
      (teamPaths[teamName] ??= []).push(m.id);
    }
  }

  // Step 2: project forward for teams that won their latest match
  for (const [teamName, matchIds] of Object.entries(teamPaths)) {
    const sortedIds = [...matchIds].sort((a, b) => {
      const aStage = matchToSlot.get(a)?.split(':')[0] ?? '';
      const bStage = matchToSlot.get(b)?.split(':')[0] ?? '';
      return (STAGE_ORDER_IDX[aStage] ?? -1) - (STAGE_ORDER_IDX[bStage] ?? -1);
    });

    const latestId = sortedIds[sortedIds.length - 1];
    const latestSlotKey = matchToSlot.get(latestId);
    if (!latestSlotKey) continue;

    const latestMatch = knockoutMatches.find(m => m.id === latestId);
    if (!latestMatch || latestMatch.status !== 'FINISHED') continue;

    const isHome = latestMatch.homeTeam?.name === teamName;
    const winner =
      latestMatch.score.winner === 'HOME_TEAM'
        ? latestMatch.homeTeam?.name
        : latestMatch.score.winner === 'AWAY_TEAM'
          ? latestMatch.awayTeam?.name
          : null;
    if (winner !== teamName) continue; // team was eliminated here

    // Trace forward
    let currentKey: SlotKey | null = latestSlotKey;
    let depth = 0;
    while (currentKey && depth < 6) {
      const node = SLOT_TREE.get(currentKey);
      if (!node?.parentSlotKey) break;
      const nextId = slotToMatch.get(node.parentSlotKey);
      if (nextId !== undefined && !teamPaths[teamName].includes(nextId)) {
        teamPaths[teamName].push(nextId);
      }
      currentKey = node.parentSlotKey;
      depth++;
    }
  }

  return teamPaths;
}

// ---------------------------------------------------------------
// Match ancestor/descendant graph
// ---------------------------------------------------------------

function computeMatchGraph(
  matchToSlot: Map<number, SlotKey>,
  slotToMatch: Map<SlotKey, number>,
): {
  matchAncestors: Record<number, number[]>;
  matchDescendants: Record<number, number[]>;
} {
  const matchAncestors: Record<number, number[]> = {};
  const matchDescendants: Record<number, number[]> = {};

  for (const [matchId, slotKey] of matchToSlot) {
    // Ancestors: walk up toward FINAL
    const ancestors: number[] = [];
    let cur: SlotKey | null = slotKey;
    while (cur) {
      const node = SLOT_TREE.get(cur);
      if (!node?.parentSlotKey) break;
      const ancestorId = slotToMatch.get(node.parentSlotKey);
      if (ancestorId !== undefined) ancestors.push(ancestorId);
      cur = node.parentSlotKey;
    }
    matchAncestors[matchId] = ancestors;

    // Descendants: BFS toward R32
    const descendants: number[] = [];
    const queue: SlotKey[] = [slotKey];
    while (queue.length > 0) {
      const key = queue.shift()!;
      const node = SLOT_TREE.get(key);
      if (!node) continue;
      for (const childKey of node.childSlotKeys) {
        const childId = slotToMatch.get(childKey);
        if (childId !== undefined) descendants.push(childId);
        queue.push(childKey);
      }
    }
    matchDescendants[matchId] = descendants;
  }

  return { matchAncestors, matchDescendants };
}

// ---------------------------------------------------------------
// Sub-builders
// ---------------------------------------------------------------

const WC_START_ISO    = '2026-06-11';
const WC_GROUP_END    = '2026-07-02';
const WC_KNOCKOUT_START = '2026-07-02';
const WC_END_ISO      = '2026-07-26';

function buildTournamentState(
  matches: Match[],
  liveMatches: Match[],
  currentIso: string,
): TournamentState {
  const played = matches.filter(m => m.status === 'FINISHED').length;
  const goals = matches.reduce(
    (sum, m) => sum + (m.score.fullTime.home ?? 0) + (m.score.fullTime.away ?? 0),
    0,
  );
  const remaining = matches.filter(
    m => m.status === 'SCHEDULED' || m.status === 'TIMED',
  ).length;

  const today = currentIso.slice(0, 10);
  let phase: TournamentPhase = 'PRE_TOURNAMENT';
  if (today > WC_END_ISO) phase = 'COMPLETED';
  else if (today >= WC_KNOCKOUT_START) phase = 'KNOCKOUT';
  else if (today >= WC_START_ISO) phase = 'GROUP_STAGE';

  const todayGroupMatches = matches.filter(
    m => m.stage === 'GROUP_STAGE' && m.utcDate.startsWith(today),
  );
  const activeMatchday =
    todayGroupMatches.length > 0 ? (todayGroupMatches[0].matchday ?? null) : null;

  return {
    phase,
    currentIso,
    totalPlayed: played,
    totalGoals: goals,
    totalRemaining: remaining,
    liveCount: liveMatches.length,
    activeMatchday,
  };
}

function buildGroupViewModels(
  standingTables: StandingTable[],
  qualMap: Map<number, TeamQualification>,
  allStories: Story[],
): GroupVM[] {
  const totalTables = standingTables.filter(t => t.type === 'TOTAL');

  return totalTables
    .map(table => {
      const rawKey = table.group ?? '';
      const letter = rawKey.replace(/^GROUP_/, '');
      const slug = `group-${letter.toLowerCase()}`;

      const teams: GroupTeamVM[] = table.table.map(entry => {
        const qual = entry.team.id > 0 ? qualMap.get(entry.team.id) : undefined;
        return {
          teamId: entry.team.id,
          teamName: entry.team.name,
          shortName: entry.team.shortName,
          flag: FLAG_LOOKUP.get(entry.team.name.toLowerCase()) ?? '',
          position: entry.position,
          played: entry.playedGames,
          won: entry.won,
          draw: entry.draw,
          lost: entry.lost,
          goalsFor: entry.goalsFor,
          goalsAgainst: entry.goalsAgainst,
          goalDifference: entry.goalDifference,
          points: entry.points,
          qualificationStatus: qual?.qualificationStatus ?? 'UNDECIDED',
          qualificationReason: qual?.qualificationReason ?? '',
        };
      });

      const matchesPlayed = Math.round(
        table.table.reduce((sum, e) => sum + e.playedGames, 0) / 2,
      );
      const isComplete = table.table.every(e => e.playedGames >= 3);
      const groupStories = allStories.filter(s => s.group === letter);

      return { letter, apiKey: rawKey, slug, href: `/world-cup-2026/${slug}`, teams, matchesPlayed, isComplete, stories: groupStories };
    })
    .sort((a, b) => a.letter.localeCompare(b.letter));
}

function buildBracketVM(matches: Match[]): BracketVM {
  const knockoutMatches = matches.filter(m =>
    (KNOCKOUT_STAGES as string[]).includes(m.stage),
  );

  const { matchToSlot, slotToMatch } = mapMatchesToSlots(knockoutMatches);

  const matchesByStage: Record<BracketStage, BracketMatchVM[]> = {
    LAST_32: [], LAST_16: [], QUARTER_FINALS: [],
    SEMI_FINALS: [], THIRD_PLACE: [], FINAL: [],
  };

  for (const m of knockoutMatches) {
    const stage = m.stage as BracketStage;
    const slotKey = matchToSlot.get(m.id);
    const slotNum = slotKey ? +slotKey.split(':')[1] : 0;

    matchesByStage[stage].push({
      id: m.id,
      stage,
      slotIndex: slotNum - 1,
      homeName: m.homeTeam?.name ?? '',
      awayName: m.awayTeam?.name ?? '',
      homeScore: m.score.fullTime.home,
      awayScore: m.score.fullTime.away,
      status: m.status,
      utcDate: m.utcDate,
    });
  }

  for (const stage of KNOCKOUT_STAGES) {
    matchesByStage[stage].sort((a, b) => a.slotIndex - b.slotIndex);
  }

  const teamPaths = computeTeamPaths(knockoutMatches, slotToMatch, matchToSlot);
  const { matchAncestors, matchDescendants } = computeMatchGraph(matchToSlot, slotToMatch);

  return { matchesByStage, teamPaths, matchAncestors, matchDescendants };
}

const JOURNEY_STAGES: { stage: string; label: string; icon: string }[] = [
  { stage: 'GROUP_STAGE',     label: 'Group Stage',        icon: '🏟️' },
  { stage: 'LAST_32',         label: 'Round of 32',        icon: '🎯' },
  { stage: 'LAST_16',         label: 'Round of 16',        icon: '⚔️' },
  { stage: 'QUARTER_FINALS',  label: 'Quarter-finals',     icon: '🔥' },
  { stage: 'SEMI_FINALS',     label: 'Semi-finals',        icon: '🌟' },
  { stage: 'FINAL',           label: 'Final',              icon: '🏆' },
];

function buildJourneyVM(teamName: string, matches: Match[]): TeamJourneyVM {
  const teamMatches = matches
    .filter(m => m.homeTeam?.name === teamName || m.awayTeam?.name === teamName)
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  const nodes: JourneyNode[] = JOURNEY_STAGES.map(({ stage, label, icon }) => {
    const stageMatches = teamMatches.filter(m => m.stage === stage);

    if (stageMatches.length === 0) {
      return { stage, stageLabel: label, icon, status: 'UPCOMING', matchId: null, opponentName: null, score: null, date: null };
    }

    if (stage === 'GROUP_STAGE') {
      const finished = stageMatches.filter(m => m.status === 'FINISHED');
      const hasLive = stageMatches.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
      if (finished.length === 0 && !hasLive) {
        return { stage, stageLabel: label, icon, status: 'UPCOMING', matchId: null, opponentName: null, score: null, date: null };
      }

      let w = 0, d = 0, l = 0;
      for (const m of finished) {
        const isHome = m.homeTeam?.name === teamName;
        const winner = m.score.winner;
        if (winner === 'DRAW') d++;
        else if ((isHome && winner === 'HOME_TEAM') || (!isHome && winner === 'AWAY_TEAM')) w++;
        else l++;
      }

      return {
        stage,
        stageLabel: label,
        icon,
        status: hasLive ? 'LIVE' : (w > 0 || d > 0 ? 'WIN' : 'LOSS'),
        matchId: finished[finished.length - 1]?.id ?? null,
        opponentName: null,
        score: `${w}W ${d}D ${l}L · ${w * 3 + d}pts`,
        date: null,
      };
    }

    // Knockout match
    const m = stageMatches[0];
    const isHome = m.homeTeam?.name === teamName;
    const opponent = isHome ? m.awayTeam?.name : m.homeTeam?.name;
    const hs = m.score.fullTime.home;
    const as_ = m.score.fullTime.away;
    const scoreStr =
      hs !== null && hs !== undefined && as_ !== null && as_ !== undefined
        ? isHome ? `${hs}–${as_}` : `${as_}–${hs}`
        : null;

    let status: JourneyNodeStatus = 'UPCOMING';
    if (m.status === 'IN_PLAY' || m.status === 'PAUSED') {
      status = 'LIVE';
    } else if (m.status === 'FINISHED') {
      const won = isHome ? m.score.winner === 'HOME_TEAM' : m.score.winner === 'AWAY_TEAM';
      const drew = m.score.winner === 'DRAW';
      status = won ? 'WIN' : drew ? 'DRAW' : 'LOSS';
    }

    return {
      stage,
      stageLabel: label,
      icon,
      status,
      matchId: m.id,
      opponentName: opponent ?? null,
      score: scoreStr,
      date: m.utcDate.slice(0, 10),
    };
  });

  // Mark nodes after elimination as UNREACHABLE
  let eliminated = false;
  let eliminatedAt: string | null = null;
  for (const node of nodes) {
    if (eliminated) {
      node.status = 'UNREACHABLE';
    } else if (node.status === 'LOSS') {
      eliminated = true;
      eliminatedAt = node.stage;
    }
  }

  const currentStageIndex = nodes.reduce(
    (last, n, i) =>
      n.status === 'WIN' || n.status === 'DRAW' || n.status === 'LIVE' ? i : last,
    -1,
  );

  return { teamName, nodes, currentStageIndex, isEliminated: eliminated, eliminatedAt };
}

function buildTimelineVM(matches: Match[], currentIso: string): TimelineVM {
  const today = currentIso.slice(0, 10);
  const nodes: TimelineNode[] = [];

  for (let md = 1; md <= 3; md++) {
    const mdMatches = matches.filter(m => m.stage === 'GROUP_STAGE' && m.matchday === md);
    if (mdMatches.length === 0) continue;

    const dates = mdMatches.map(m => m.utcDate.slice(0, 10)).sort();
    const isoStart = dates[0];
    const isoEnd = dates[dates.length - 1];
    const completed = mdMatches.filter(m => m.status === 'FINISHED').length;
    const isCurrent = today >= isoStart && today <= isoEnd;

    nodes.push({
      id: `md-${md}`,
      label: `Matchday ${md}`,
      shortLabel: `MD${md}`,
      dateRange: fmtDateRange(isoStart, isoEnd),
      isoStart,
      isoEnd,
      isToday: isCurrent,
      isPast: today > isoEnd,
      isCurrent,
      matchCount: mdMatches.length,
      completedCount: completed,
    });
  }

  for (const roundConfig of WC_ROUNDS) {
    const roundMatches = matches.filter(m => m.stage === roundConfig.stage);
    const slots = WC_KNOCKOUT_SLOTS.filter(s => s.round === roundConfig.stage);

    const allDates =
      roundMatches.length > 0
        ? roundMatches.map(m => m.utcDate.slice(0, 10)).sort()
        : slots.map(s => s.utcDate.slice(0, 10)).sort();

    if (allDates.length === 0) continue;

    const isoStart = allDates[0];
    const isoEnd = allDates[allDates.length - 1];
    const completed = roundMatches.filter(m => m.status === 'FINISHED').length;
    const isCurrent = today >= isoStart && today <= isoEnd;

    nodes.push({
      id: `round-${roundConfig.slug}`,
      label: roundConfig.label,
      shortLabel: roundConfig.short,
      dateRange: fmtDateRange(isoStart, isoEnd),
      isoStart,
      isoEnd,
      isToday: isCurrent,
      isPast: today > isoEnd,
      isCurrent,
      matchCount: roundMatches.length > 0 ? roundMatches.length : slots.length,
      completedCount: completed,
    });
  }

  nodes.sort((a, b) => a.isoStart.localeCompare(b.isoStart));

  const currentIndex = nodes.findIndex(n => n.isCurrent);
  const todayIndex = nodes.findIndex(n => n.isToday);

  return { nodes, currentIndex, todayIndex };
}

function buildVenueMatchMap(matches: Match[]): Record<string, Match[]> {
  const map: Record<string, Match[]> = {};

  const knockoutMatches = matches.filter(m =>
    (KNOCKOUT_STAGES as string[]).includes(m.stage),
  );

  const byStage: Record<string, Match[]> = {};
  for (const m of knockoutMatches) {
    (byStage[m.stage] ??= []).push(m);
  }

  for (const [stage, stageMtchs] of Object.entries(byStage)) {
    const sorted = [...stageMtchs].sort((a, b) => a.id - b.id);
    const slots = WC_KNOCKOUT_SLOTS
      .filter(s => s.round === stage)
      .sort((a, b) => a.matchNumber - b.matchNumber);

    sorted.forEach((m, i) => {
      const slot = slots[i];
      if (slot) {
        (map[slot.venueSlug] ??= []).push(m);
      }
    });
  }

  return map;
}

// ---------------------------------------------------------------
// Main builder — public API
// ---------------------------------------------------------------

const URGENCY_SCORE: Record<StoryUrgency, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

export function buildExperienceViewModel(input: ExperienceInput): ExperienceViewModel {
  const { matches, standingTables, liveMatches, currentIso } = input;

  const totalTables = standingTables.filter(t => t.type === 'TOTAL');

  // Qualification status — computed once, used throughout
  const qualMap = calculateQualificationStatus(totalTables);

  // Stories — generated once, distributed to groups + root
  const allStories = generateAllStories(totalTables, qualMap);

  const tournament = buildTournamentState(matches, liveMatches, currentIso);
  const groups = buildGroupViewModels(totalTables, qualMap, allStories);
  const bracket = buildBracketVM(matches);

  // Journeys — one per real team (skip slot-label placeholder names)
  const teamNames = [
    ...new Set([
      ...matches.map(m => m.homeTeam?.name),
      ...matches.map(m => m.awayTeam?.name),
    ].filter((n): n is string => Boolean(n) && !SLOT_LABEL_RE.test(n))),
  ];
  const journeys = teamNames.map(name => buildJourneyVM(name, matches));

  const timeline = buildTimelineVM(matches, currentIso);
  const venueMatchMap = buildVenueMatchMap(matches);

  return {
    tournament,
    groups,
    stories: [...allStories].sort(
      (a, b) => URGENCY_SCORE[b.urgency] - URGENCY_SCORE[a.urgency],
    ),
    bracket,
    journeys,
    timeline,
    venueMatchMap,
    live: { matches: liveMatches, lastUpdated: currentIso },
  };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function fmtDateRange(start: string, end: string): string {
  const fmt = (iso: string) =>
    new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}
