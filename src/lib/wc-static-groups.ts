/**
 * Static WC 2026 group structure — used as a fallback when the API is
 * unavailable so group/standings pages always render content.
 *
 * Each entry provides enough data to render a skeleton standings table
 * (team name, flag, group letter) with zeroed statistics.  Once the API
 * recovers, real data replaces this automatically.
 *
 * Keep this file in sync with wc-all-teams.ts.
 */

import type { StandingTable, StandingEntry } from './types';
import { WC_ALL_TEAMS } from './wc-all-teams';

// ---------------------------------------------------------------------------
// Build a static StandingTable[] from the team roster
// ---------------------------------------------------------------------------

function makeEntry(
  position: number,
  name: string,
  flag: string,
): StandingEntry {
  return {
    position,
    team: {
      id:        0,
      name,
      shortName: name,
      tla:       name.slice(0, 3).toUpperCase(),
      crest:     '',
    },
    playedGames:    0,
    form:           null,
    won:            0,
    draw:           0,
    lost:           0,
    points:         0,
    goalsFor:       0,
    goalsAgainst:   0,
    goalDifference: 0,
  };
}

/** Generates a fully-formed StandingTable[] for all 12 groups from static
 *  team data.  Stats are zeroed — this is only shown before the tournament
 *  begins or when the API is temporarily unavailable. */
export function getStaticWCGroupTables(): StandingTable[] {
  const groups: Record<string, StandingTable> = {};

  for (const team of WC_ALL_TEAMS) {
    if (team.group === 'TBD') continue;
    const groupKey = `GROUP_${team.group}`;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        stage: 'GROUP_STAGE',
        type:  'TOTAL',
        group: groupKey,
        table: [],
      };
    }
    groups[groupKey].table.push(makeEntry(
      groups[groupKey].table.length + 1,
      team.displayName,
      team.flag,
    ));
  }

  // Sort groups A → L
  return Object.values(groups).sort((a, b) =>
    (a.group ?? '').localeCompare(b.group ?? '')
  );
}

/** Returns true when the static table will be needed (i.e. the real table
 *  has no entries or all teams have 0 played games). */
export function isStaticFallback(tables: StandingTable[]): boolean {
  return (
    tables.length === 0 ||
    tables.every((t) => t.table.every((e) => e.playedGames === 0))
  );
}
