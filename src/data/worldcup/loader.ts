/**
 * src/data/worldcup/loader.ts
 *
 * Static World Cup 2026 data loader.
 *
 * When WORLD_CUP_DATA_SOURCE=static, pages use this module instead of making
 * API calls for pre-tournament data (fixtures, groups, bracket slots).
 * Live scores, match results and standings continue to use external APIs
 * even in static mode, since those require real-time data.
 *
 * Data sources
 * ────────────
 * · teams.json     — 48 qualified teams with group, confederation, FIFA rank
 * · groups.json    — group letter → team slug array mapping
 * · stadiums.json  — 16 host venues with capacity
 * · fixtures.json  — 72 group + 32 knockout fixtures (104 total)
 * · tv-guide.json  — broadcaster index by country
 *
 * Usage
 * ─────
 * import { isStaticMode, getStaticGroupFixtures, getStaticKnockoutSlots } from '@/data/worldcup/loader';
 *
 * if (isStaticMode()) {
 *   const fixtures = getStaticGroupFixtures();   // WCGroupFixture[]
 *   const slots    = getStaticKnockoutSlots();   // WCKnockoutSlot[]
 * }
 */

import type { Match, Competition, Score } from '@/lib/types';
import type { WCGroupFixture, WCKnockoutSlot } from '@/lib/wc-fixtures';

import teamsData    from './teams.json';
import groupsData   from './groups.json';
import stadiumsData from './stadiums.json';
import fixturesData from './fixtures.json';

// ---------------------------------------------------------------------------
// Env flag
// ---------------------------------------------------------------------------

/**
 * Returns true when WORLD_CUP_DATA_SOURCE=static.
 * When true, pages should use static data for pre-tournament content and
 * skip API calls for fixtures / bracket / group composition.
 * Live matches, results and standings remain API-driven even in static mode.
 */
export function isStaticMode(): boolean {
  return process.env.WORLD_CUP_DATA_SOURCE === 'static';
}

// ---------------------------------------------------------------------------
// Raw typed exports — direct access to JSON data
// ---------------------------------------------------------------------------

export interface StaticTeam {
  slug:          string;
  name:          string;
  flag:          string;
  group:         string;
  confederation: string;
  fifaRank:      number;
}

export interface StaticStadium {
  slug:     string;
  name:     string;
  city:     string;
  state:    string | null;
  country:  string;
  capacity: number;
}

export interface StaticGroupFixture {
  id:         string;
  stage:      'GROUP_STAGE';
  group:      string;
  matchday:   number;
  homeTeam:   string; // team slug
  awayTeam:   string; // team slug
  date:       string; // YYYY-MM-DD
  localTime:  string; // HH:MM local venue time
  venue:      string; // venue slug
  venueCity:  string;
}

export interface StaticKnockoutFixture {
  id:          string;
  stage:       string;
  matchNumber: number;
  homeSlot:    string;
  awaySlot:    string;
  date:        string;
  localTime:   string;
  venue:       string;
  venueCity:   string;
}

export type StaticFixture = StaticGroupFixture | StaticKnockoutFixture;

/** All 48 teams. */
export const STATIC_TEAMS: StaticTeam[] = teamsData as StaticTeam[];

/** Group letter → array of team slugs. */
export const STATIC_GROUPS: Record<string, string[]> = groupsData as Record<string, string[]>;

/** All 16 host venues. */
export const STATIC_STADIUMS: StaticStadium[] = stadiumsData as StaticStadium[];

/** All 104 fixtures (72 group + 32 knockout). */
export const STATIC_FIXTURES: StaticFixture[] = fixturesData as StaticFixture[];

// ---------------------------------------------------------------------------
// Derived helpers — lookup maps
// ---------------------------------------------------------------------------

const _teamBySlug = new Map<string, StaticTeam>(STATIC_TEAMS.map((t) => [t.slug, t]));
const _stadiumBySlug = new Map<string, StaticStadium>(STATIC_STADIUMS.map((s) => [s.slug, s]));

export function getTeamBySlug(slug: string): StaticTeam | undefined {
  return _teamBySlug.get(slug);
}

export function getStadiumBySlug(slug: string): StaticStadium | undefined {
  return _stadiumBySlug.get(slug);
}

// ---------------------------------------------------------------------------
// WCGroupFixture conversion — matches the type used by wc-fixtures.ts and
// the /world-cup-2026-schedule page's local fallback rendering path.
// ---------------------------------------------------------------------------

const WC_COMPETITION: Competition = {
  id:     2000,
  name:   'FIFA World Cup',
  code:   'WC',
  type:   'CUP',
  emblem: '',
  area:   { id: 0, name: 'World', code: 'WLD', flag: null },
};

const EMPTY_SCORE: Score = {
  winner:   null,
  duration: 'REGULAR',
  fullTime: { home: null, away: null },
  halfTime: { home: null, away: null },
};

const ROUND_LABELS: Record<string, string> = {
  LAST_32:       'Round of 32',
  LAST_16:       'Round of 16',
  QUARTER_FINALS:'Quarter-Finals',
  SEMI_FINALS:   'Semi-Finals',
  THIRD_PLACE:   'Third-Place Play-off',
  FINAL:         'Final',
};

/** Converts static group fixture data to the WCGroupFixture shape used by wc-fixtures.ts. */
export function getStaticGroupFixtures(): WCGroupFixture[] {
  let idx = 0;
  return STATIC_FIXTURES
    .filter((f): f is StaticGroupFixture => f.stage === 'GROUP_STAGE')
    .map((f) => {
      const home = _teamBySlug.get(f.homeTeam);
      const away = _teamBySlug.get(f.awayTeam);
      return {
        localId:   ++idx,
        group:     f.group,
        matchday:  f.matchday as 1 | 2 | 3,
        homeSlug:  f.homeTeam,
        awaySlug:  f.awayTeam,
        homeLabel: home?.name ?? f.homeTeam,
        awayLabel: away?.name ?? f.awayTeam,
        homeFlag:  home?.flag ?? '',
        awayFlag:  away?.flag ?? '',
        utcDate:   `${f.date}T${f.localTime}:00Z`,
        venueSlug: f.venue,
        venueCity: f.venueCity,
      } satisfies WCGroupFixture;
    });
}

/** Converts static knockout data to the WCKnockoutSlot shape used by wc-fixtures.ts. */
export function getStaticKnockoutSlots(): WCKnockoutSlot[] {
  let idx = 0;
  return STATIC_FIXTURES
    .filter((f): f is StaticKnockoutFixture => f.stage !== 'GROUP_STAGE')
    .map((f) => {
      const round = f.stage as WCKnockoutSlot['round'];
      return {
        localId:     ++idx,
        round,
        roundLabel:  ROUND_LABELS[f.stage] ?? f.stage,
        matchNumber: f.matchNumber,
        homeLabel:   f.homeSlot,
        awayLabel:   f.awaySlot,
        utcDate:     `${f.date}T${f.localTime}:00Z`,
        venueSlug:   f.venue,
        venueCity:   f.venueCity,
      } satisfies WCKnockoutSlot;
    });
}

// ---------------------------------------------------------------------------
// Match conversion — for pages that consume Match[] (hub page upcoming section)
// ---------------------------------------------------------------------------

/**
 * Returns all 72 group-stage fixtures as synthetic Match objects.
 * These have status=SCHEDULED, null scores, and synthetic numeric IDs.
 * Safe to pass to MatchCard / MatchGrid components.
 */
export function getStaticGroupMatches(): Match[] {
  const fixtures = STATIC_FIXTURES.filter(
    (f): f is StaticGroupFixture => f.stage === 'GROUP_STAGE',
  );

  return fixtures.map((f, idx) => {
    const home = _teamBySlug.get(f.homeTeam);
    const away = _teamBySlug.get(f.awayTeam);

    return {
      // Synthetic negative IDs: no collision with real API IDs (5–7 digit positives).
      // matchPath() and MatchCard both guard id ≤ 0 → static cards render as
      // non-linkable display tiles; no broken /match/-31-… URLs are ever emitted.
      id:          -(idx + 1),
      utcDate:     `${f.date}T${f.localTime}:00Z`,
      status:      'SCHEDULED',
      matchday:    f.matchday,
      stage:       'GROUP_STAGE',
      group:       `GROUP_${f.group}`,
      lastUpdated: '2026-06-08T00:00:00Z',
      competition: WC_COMPETITION,
      homeTeam: {
        id:        0,
        name:      home?.name  ?? f.homeTeam,
        shortName: home?.name  ?? f.homeTeam,
        tla:       f.homeTeam.slice(0, 3).toUpperCase(),
        crest:     '',
      },
      awayTeam: {
        id:        0,
        name:      away?.name  ?? f.awayTeam,
        shortName: away?.name  ?? f.awayTeam,
        tla:       f.awayTeam.slice(0, 3).toUpperCase(),
        crest:     '',
      },
      score: EMPTY_SCORE,
    } satisfies Match;
  });
}

/**
 * Returns group-stage fixtures starting from the given date (inclusive).
 * Use this in static mode to populate the hub page's "Upcoming" section.
 */
export function getStaticUpcomingMatches(fromDate: string): Match[] {
  return getStaticGroupMatches().filter(
    (m) => m.utcDate >= `${fromDate}T00:00:00Z`,
  );
}
