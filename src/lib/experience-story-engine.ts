/**
 * experience-story-engine.ts — ONE STORY ENGINE
 *
 * Rule/plugin system for generating narrative Story Cards from group standings.
 * Components MUST NOT call generateStoriesForGroup directly — read from
 * ExperienceViewModel.stories or ExperienceViewModel.groups[].stories instead.
 *
 * To add a new rule: call registerStoryRule() anywhere before buildExperienceViewModel().
 * Rules are sorted by priority (lower = fires first); only the first matching rule
 * per team per group produces a story.
 */

import type { StandingEntry, StandingTable } from './types';
import type { TeamQualification } from './wc-qualification';

// ---------------------------------------------------------------
// Public types
// ---------------------------------------------------------------

export type StoryType =
  | 'TITLE_DECIDER'
  | 'MUST_WIN'
  | 'DEAD_RUBBER'
  | 'ALREADY_QUALIFIED'
  | 'ONE_POINT_TO_GO'
  | 'ELIMINATED'
  | 'LEVEL_ON_POINTS'
  | 'GROUP_LEADER'
  | 'BEST_THIRD_CONTENDER';

export type StoryUrgency = 'critical' | 'high' | 'medium' | 'low';

export interface Story {
  /** Stable identifier: `${teamId}-${type}` */
  id: string;
  teamId: number;
  teamName: string;
  /** Group letter A–L */
  group: string;
  type: StoryType;
  headline: string;
  sub: string;
  urgency: StoryUrgency;
}

export interface RuleContext {
  entry: StandingEntry;
  /** All 4 entries in the group, sorted by position ascending */
  allEntries: StandingEntry[];
  groupLetter: string;
  qual: TeamQualification | undefined;
  gamesRemaining: number;
}

export interface StoryRule {
  type: StoryType;
  /**
   * Lower priority fires first.
   * Only the first matching rule produces a story per team.
   */
  priority: number;
  test: (ctx: RuleContext) => boolean;
  generate: (ctx: RuleContext) => { headline: string; sub: string; urgency: StoryUrgency };
}

// ---------------------------------------------------------------
// Plugin registry
// ---------------------------------------------------------------

const REGISTRY: StoryRule[] = [];

export function registerStoryRule(rule: StoryRule): void {
  REGISTRY.push(rule);
  REGISTRY.sort((a, b) => a.priority - b.priority);
}

export function getRegisteredRules(): readonly StoryRule[] {
  return REGISTRY;
}

// ---------------------------------------------------------------
// Built-in rules (registered at module load)
// ---------------------------------------------------------------

const titleDeciderRule: StoryRule = {
  type: 'TITLE_DECIDER',
  priority: 10,
  test: ({ entry, allEntries, gamesRemaining }) => {
    if (gamesRemaining === 0 || entry.position > 2) return false;
    const [p1, p2] = allEntries;
    return p1 && p2 && p1.points === p2.points && p1.playedGames === p2.playedGames;
  },
  generate: ({ entry, groupLetter }) => ({
    headline: `Group ${groupLetter} title decider`,
    sub: `${entry.team.name} are level at the top — the final matchday settles first place`,
    urgency: 'critical',
  }),
};

const mustWinRule: StoryRule = {
  type: 'MUST_WIN',
  priority: 20,
  test: ({ entry, allEntries, gamesRemaining, qual }) => {
    if (gamesRemaining !== 1 || qual?.qualificationStatus === 'ELIMINATED') return false;
    if (entry.position < 3) return false;
    // Can only survive with a win: max points still below 2nd place minimum
    const maxPts = entry.points + 3;
    const secondPts = allEntries[1]?.points ?? 0;
    return entry.position === 3 && maxPts <= secondPts;
  },
  generate: ({ entry }) => ({
    headline: `${entry.team.shortName} must win`,
    sub: `Only a win in the final group game keeps ${entry.team.name} alive`,
    urgency: 'critical',
  }),
};

const deadRubberRule: StoryRule = {
  type: 'DEAD_RUBBER',
  priority: 30,
  test: ({ entry, qual, gamesRemaining }) =>
    qual?.qualificationStatus === 'ELIMINATED' && gamesRemaining === 1,
  generate: ({ entry }) => ({
    headline: `Dead rubber for ${entry.team.shortName}`,
    sub: `${entry.team.name} are already eliminated — the last match is for pride`,
    urgency: 'medium',
  }),
};

const alreadyQualifiedRule: StoryRule = {
  type: 'ALREADY_QUALIFIED',
  priority: 40,
  test: ({ qual }) => qual?.qualificationStatus === 'QUALIFIED',
  generate: ({ entry, groupLetter }) => ({
    headline: `${entry.team.shortName} qualified`,
    sub: `${entry.team.name} have secured their place in the knockout stage from Group ${groupLetter}`,
    urgency: 'medium',
  }),
};

const onePointRule: StoryRule = {
  type: 'ONE_POINT_TO_GO',
  priority: 50,
  test: ({ entry, gamesRemaining, qual }) =>
    gamesRemaining > 0 &&
    entry.position <= 2 &&
    qual?.qualificationStatus !== 'QUALIFIED' &&
    entry.points >= 4,
  generate: ({ entry }) => ({
    headline: `${entry.team.shortName} needs 1 point`,
    sub: `A draw in any remaining game is enough to qualify ${entry.team.name}`,
    urgency: 'high',
  }),
};

const eliminatedRule: StoryRule = {
  type: 'ELIMINATED',
  priority: 60,
  test: ({ qual }) => qual?.qualificationStatus === 'ELIMINATED',
  generate: ({ entry, groupLetter }) => ({
    headline: `${entry.team.shortName} eliminated`,
    sub: `${entry.team.name} cannot progress from Group ${groupLetter}`,
    urgency: 'high',
  }),
};

const levelDeciderRule: StoryRule = {
  type: 'LEVEL_ON_POINTS',
  priority: 70,
  test: ({ entry, allEntries, gamesRemaining }) => {
    if (gamesRemaining === 0 || entry.position > 2) return false;
    const [p1, p2] = allEntries;
    return Boolean(p1 && p2 && p1.points === p2.points && entry.position <= 2);
  },
  generate: ({ entry, groupLetter }) => ({
    headline: `Group ${groupLetter} too close to call`,
    sub: `${entry.team.name} are level — goal difference and head-to-head could decide it`,
    urgency: 'high',
  }),
};

const groupLeaderRule: StoryRule = {
  type: 'GROUP_LEADER',
  priority: 80,
  test: ({ entry, allEntries }) =>
    entry.position === 1 && (allEntries[1]?.points ?? 0) < entry.points,
  generate: ({ entry, groupLetter }) => ({
    headline: `${entry.team.shortName} lead Group ${groupLetter}`,
    sub: `${entry.team.name} are clear at the top of the standings`,
    urgency: 'low',
  }),
};

const bestThirdRule: StoryRule = {
  type: 'BEST_THIRD_CONTENDER',
  priority: 90,
  test: ({ entry, qual }) =>
    entry.position === 3 && qual?.qualificationStatus === 'THIRD_PLACE_CONTENDER',
  generate: ({ entry }) => ({
    headline: `${entry.team.shortName} in the best-third race`,
    sub: `${entry.team.name} are competing for one of 8 best third-place knockout spots`,
    urgency: 'medium',
  }),
};

// Register all built-in rules
registerStoryRule(titleDeciderRule);
registerStoryRule(mustWinRule);
registerStoryRule(deadRubberRule);
registerStoryRule(alreadyQualifiedRule);
registerStoryRule(onePointRule);
registerStoryRule(eliminatedRule);
registerStoryRule(levelDeciderRule);
registerStoryRule(groupLeaderRule);
registerStoryRule(bestThirdRule);

// ---------------------------------------------------------------
// Engine
// ---------------------------------------------------------------

export function generateStoriesForGroup(
  table: StandingEntry[],
  groupLetter: string,
  qualMap: Map<number, TeamQualification>,
): Story[] {
  const stories: Story[] = [];

  for (const entry of table) {
    const gamesRemaining = Math.max(0, 3 - entry.playedGames);
    const qual = entry.team.id > 0 ? qualMap.get(entry.team.id) : undefined;

    const ctx: RuleContext = {
      entry,
      allEntries: table,
      groupLetter,
      qual,
      gamesRemaining,
    };

    for (const rule of REGISTRY) {
      if (rule.test(ctx)) {
        const { headline, sub, urgency } = rule.generate(ctx);
        stories.push({
          id: `${entry.team.id}-${rule.type}`,
          teamId: entry.team.id,
          teamName: entry.team.name,
          group: groupLetter,
          type: rule.type,
          headline,
          sub,
          urgency,
        });
        break; // only first matching rule per team
      }
    }
  }

  return stories;
}

export function generateAllStories(
  totalTables: StandingTable[],
  qualMap: Map<number, TeamQualification>,
): Story[] {
  const all: Story[] = [];
  for (const table of totalTables) {
    const letter = (table.group ?? '').replace(/^GROUP_/, '');
    if (!letter) continue;
    all.push(...generateStoriesForGroup(table.table, letter, qualMap));
  }
  return all;
}
