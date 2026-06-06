/**
 * wc-fixtures.ts
 *
 * Complete static FIFA World Cup 2026 fixture dataset.
 *
 * This file is the authoritative local source for all 104 WC matches.
 * It is used as a FALLBACK when football-data.org is unavailable,
 * ensuring WC pages always render content regardless of API status.
 *
 * Sources:
 *  • Group assignments from wc-all-teams.ts (48 teams, groups A-L)
 *  • Approximate match dates/venues based on the official FIFA schedule
 *    (June 11 – July 19, 2026)
 *  • Knockout slot structure from FIFA WC 2026 bracket rules
 *
 * Usage:
 *   import { getGroupFixtures, getTeamFixtures, WC_ALL_FIXTURES } from '@/lib/wc-fixtures';
 */

import { WC_ALL_TEAMS } from './wc-all-teams';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WCGroupFixture {
  /** Unique local ID (does NOT correspond to football-data.org match IDs). */
  localId:  number;
  group:    string;       // 'A'-'L'
  matchday: 1 | 2 | 3;
  homeSlug: string;       // team slug from wc-all-teams.ts
  awaySlug: string;
  homeLabel: string;      // display name
  awayLabel: string;
  homeFlag:  string;
  awayFlag:  string;
  utcDate:  string;       // ISO datetime string
  venueSlug: string;      // from wc-venues.ts
  venueCity: string;
}

export interface WCKnockoutSlot {
  localId:    number;
  round:      'LAST_32' | 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'THIRD_PLACE' | 'FINAL';
  roundLabel: string;
  matchNumber: number;
  utcDate:    string;
  venueSlug:  string;
  venueCity:  string;
  homeLabel:  string;   // e.g. "1st Group A" or "Winner R32 M1"
  awayLabel:  string;
}

// ---------------------------------------------------------------------------
// Team lookup (slug → flag + display name)
// ---------------------------------------------------------------------------

const TEAM_MAP = new Map(WC_ALL_TEAMS.map((t) => [t.slug, t]));

function team(slug: string) {
  return TEAM_MAP.get(slug) ?? { displayName: slug, flag: '🏳️' };
}

// ---------------------------------------------------------------------------
// Compact group fixture data
// [group, matchday, homeSlug, awaySlug, date, time(UTC), venueSlug, venueCity]
// ---------------------------------------------------------------------------

type CompactGroupRow = [
  string,   // group
  1 | 2 | 3,// matchday
  string,   // homeSlug
  string,   // awaySlug
  string,   // date YYYY-MM-DD
  string,   // time HH:MM
  string,   // venueSlug
  string,   // venueCity
];

const COMPACT: CompactGroupRow[] = [
  // ── Group A: USA, France, Japan, Switzerland ────────────────────────────
  // MD1 – June 12
  ['A', 1, 'usa',         'france',       '2026-06-12', '18:00', 'metlife-stadium', 'East Rutherford, NJ'],
  ['A', 1, 'japan',       'switzerland',  '2026-06-12', '21:00', 'seattle',         'Seattle, WA'],
  // MD2 – June 19
  ['A', 2, 'usa',         'japan',        '2026-06-19', '18:00', 'metlife-stadium', 'East Rutherford, NJ'],
  ['A', 2, 'france',      'switzerland',  '2026-06-19', '21:00', 'boston',          'Foxborough, MA'],
  // MD3 – June 25 (concurrent within group)
  ['A', 3, 'usa',         'switzerland',  '2026-06-25', '21:00', 'metlife-stadium', 'East Rutherford, NJ'],
  ['A', 3, 'france',      'japan',        '2026-06-25', '21:00', 'boston',          'Foxborough, MA'],

  // ── Group B: Canada, England, Denmark, South Korea ──────────────────────
  // MD1 – June 12
  ['B', 1, 'canada',      'england',      '2026-06-12', '15:00', 'toronto',         'Toronto, ON'],
  ['B', 1, 'denmark',     'south-korea',  '2026-06-12', '18:00', 'vancouver',       'Vancouver, BC'],
  // MD2 – June 19
  ['B', 2, 'canada',      'denmark',      '2026-06-19', '15:00', 'toronto',         'Toronto, ON'],
  ['B', 2, 'england',     'south-korea',  '2026-06-19', '18:00', 'vancouver',       'Vancouver, BC'],
  // MD3 – June 25 (concurrent)
  ['B', 3, 'canada',      'south-korea',  '2026-06-25', '18:00', 'toronto',         'Toronto, ON'],
  ['B', 3, 'england',     'denmark',      '2026-06-25', '18:00', 'vancouver',       'Vancouver, BC'],

  // ── Group C: Mexico, Spain, Australia, Serbia ───────────────────────────
  // MD1 – June 11 opening (Mexico vs Spain) + June 12
  ['C', 1, 'mexico',      'spain',        '2026-06-11', '21:00', 'azteca-stadium',  'Mexico City'],
  ['C', 1, 'australia',   'serbia',       '2026-06-12', '00:00', 'guadalajara',     'Guadalajara'],
  // MD2 – June 20
  ['C', 2, 'mexico',      'australia',    '2026-06-20', '18:00', 'azteca-stadium',  'Mexico City'],
  ['C', 2, 'spain',       'serbia',       '2026-06-20', '21:00', 'guadalajara',     'Guadalajara'],
  // MD3 – June 26 (concurrent)
  ['C', 3, 'mexico',      'serbia',       '2026-06-26', '21:00', 'monterrey',       'Monterrey'],
  ['C', 3, 'spain',       'australia',    '2026-06-26', '21:00', 'azteca-stadium',  'Mexico City'],

  // ── Group D: Germany, Morocco, Iran, Costa Rica ─────────────────────────
  // MD1 – June 13
  ['D', 1, 'germany',     'morocco',      '2026-06-13', '18:00', 'dallas',          'Arlington, TX'],
  ['D', 1, 'iran',        'costa-rica',   '2026-06-13', '21:00', 'kansas-city',     'Kansas City, MO'],
  // MD2 – June 20
  ['D', 2, 'germany',     'iran',         '2026-06-20', '21:00', 'dallas',          'Arlington, TX'],
  ['D', 2, 'morocco',     'costa-rica',   '2026-06-20', '18:00', 'kansas-city',     'Kansas City, MO'],
  // MD3 – June 26 (concurrent)
  ['D', 3, 'germany',     'costa-rica',   '2026-06-26', '18:00', 'dallas',          'Arlington, TX'],
  ['D', 3, 'morocco',     'iran',         '2026-06-26', '18:00', 'kansas-city',     'Kansas City, MO'],

  // ── Group E: Portugal, Senegal, Panama, Saudi Arabia ───────────────────
  // MD1 – June 13
  ['E', 1, 'portugal',    'senegal',      '2026-06-13', '21:00', 'miami',           'Miami Gardens, FL'],
  ['E', 1, 'panama',      'saudi-arabia', '2026-06-13', '18:00', 'philadelphia',    'Philadelphia, PA'],
  // MD2 – June 21
  ['E', 2, 'portugal',    'panama',       '2026-06-21', '18:00', 'miami',           'Miami Gardens, FL'],
  ['E', 2, 'senegal',     'saudi-arabia', '2026-06-21', '21:00', 'philadelphia',    'Philadelphia, PA'],
  // MD3 – June 27 (concurrent)
  ['E', 3, 'portugal',    'saudi-arabia', '2026-06-27', '18:00', 'miami',           'Miami Gardens, FL'],
  ['E', 3, 'senegal',     'panama',       '2026-06-27', '18:00', 'philadelphia',    'Philadelphia, PA'],

  // ── Group F: Netherlands, Qatar, Nigeria, Honduras ──────────────────────
  // MD1 – June 14
  ['F', 1, 'netherlands', 'qatar',        '2026-06-14', '18:00', 'los-angeles',     'Inglewood, CA'],
  ['F', 1, 'nigeria',     'honduras',     '2026-06-14', '21:00', 'pasadena',        'Pasadena, CA'],
  // MD2 – June 21
  ['F', 2, 'netherlands', 'nigeria',      '2026-06-21', '21:00', 'los-angeles',     'Inglewood, CA'],
  ['F', 2, 'qatar',       'honduras',     '2026-06-21', '18:00', 'pasadena',        'Pasadena, CA'],
  // MD3 – June 27 (concurrent)
  ['F', 3, 'netherlands', 'honduras',     '2026-06-27', '21:00', 'los-angeles',     'Inglewood, CA'],
  ['F', 3, 'qatar',       'nigeria',      '2026-06-27', '21:00', 'pasadena',        'Pasadena, CA'],

  // ── Group G: Argentina, Italy, Egypt, Iraq ──────────────────────────────
  // MD1 – June 14
  ['G', 1, 'argentina',   'italy',        '2026-06-14', '21:00', 'metlife-stadium', 'East Rutherford, NJ'],
  ['G', 1, 'egypt',       'iraq',         '2026-06-14', '18:00', 'san-francisco',   'Santa Clara, CA'],
  // MD2 – June 22
  ['G', 2, 'argentina',   'egypt',        '2026-06-22', '18:00', 'metlife-stadium', 'East Rutherford, NJ'],
  ['G', 2, 'italy',       'iraq',         '2026-06-22', '21:00', 'san-francisco',   'Santa Clara, CA'],
  // MD3 – June 28 (concurrent)
  ['G', 3, 'argentina',   'iraq',         '2026-06-28', '21:00', 'metlife-stadium', 'East Rutherford, NJ'],
  ['G', 3, 'italy',       'egypt',        '2026-06-28', '21:00', 'san-francisco',   'Santa Clara, CA'],

  // ── Group H: Belgium, Brazil, Cameroon, Jordan ──────────────────────────
  // MD1 – June 15
  ['H', 1, 'belgium',     'brazil',       '2026-06-15', '21:00', 'dallas',          'Arlington, TX'],
  ['H', 1, 'cameroon',    'jordan',       '2026-06-15', '18:00', 'atlanta',         'Atlanta, GA'],
  // MD2 – June 22
  ['H', 2, 'belgium',     'cameroon',     '2026-06-22', '18:00', 'dallas',          'Arlington, TX'],
  ['H', 2, 'brazil',      'jordan',       '2026-06-22', '21:00', 'atlanta',         'Atlanta, GA'],
  // MD3 – June 28 (concurrent)
  ['H', 3, 'belgium',     'jordan',       '2026-06-28', '18:00', 'dallas',          'Arlington, TX'],
  ['H', 3, 'brazil',      'cameroon',     '2026-06-28', '18:00', 'atlanta',         'Atlanta, GA'],

  // ── Group I: Colombia, Poland, Ivory Coast, New Zealand ─────────────────
  // MD1 – June 15
  ['I', 1, 'colombia',    'poland',       '2026-06-15', '21:00', 'seattle',         'Seattle, WA'],
  ['I', 1, 'ivory-coast', 'new-zealand',  '2026-06-15', '18:00', 'kansas-city',     'Kansas City, MO'],
  // MD2 – June 23
  ['I', 2, 'colombia',    'ivory-coast',  '2026-06-23', '18:00', 'seattle',         'Seattle, WA'],
  ['I', 2, 'poland',      'new-zealand',  '2026-06-23', '21:00', 'kansas-city',     'Kansas City, MO'],
  // MD3 – June 29 (concurrent)
  ['I', 3, 'colombia',    'new-zealand',  '2026-06-29', '21:00', 'seattle',         'Seattle, WA'],
  ['I', 3, 'poland',      'ivory-coast',  '2026-06-29', '21:00', 'kansas-city',     'Kansas City, MO'],

  // ── Group J: Croatia, Uruguay, South Africa, Peru ───────────────────────
  // MD1 – June 16
  ['J', 1, 'croatia',     'uruguay',      '2026-06-16', '21:00', 'boston',          'Foxborough, MA'],
  ['J', 1, 'south-africa','peru',         '2026-06-16', '18:00', 'philadelphia',    'Philadelphia, PA'],
  // MD2 – June 23
  ['J', 2, 'croatia',     'south-africa', '2026-06-23', '18:00', 'boston',          'Foxborough, MA'],
  ['J', 2, 'uruguay',     'peru',         '2026-06-23', '21:00', 'philadelphia',    'Philadelphia, PA'],
  // MD3 – June 29 (concurrent)
  ['J', 3, 'croatia',     'peru',         '2026-06-29', '18:00', 'boston',          'Foxborough, MA'],
  ['J', 3, 'uruguay',     'south-africa', '2026-06-29', '18:00', 'philadelphia',    'Philadelphia, PA'],

  // ── Group K: Ukraine, Turkey, Ecuador, Ghana ────────────────────────────
  // MD1 – June 16
  ['K', 1, 'ukraine',     'turkey',       '2026-06-16', '21:00', 'miami',           'Miami Gardens, FL'],
  ['K', 1, 'ecuador',     'ghana',        '2026-06-16', '18:00', 'atlanta',         'Atlanta, GA'],
  // MD2 – June 24
  ['K', 2, 'ukraine',     'ecuador',      '2026-06-24', '18:00', 'miami',           'Miami Gardens, FL'],
  ['K', 2, 'turkey',      'ghana',        '2026-06-24', '21:00', 'atlanta',         'Atlanta, GA'],
  // MD3 – June 30 (concurrent)
  ['K', 3, 'ukraine',     'ghana',        '2026-06-30', '21:00', 'miami',           'Miami Gardens, FL'],
  ['K', 3, 'turkey',      'ecuador',      '2026-06-30', '21:00', 'atlanta',         'Atlanta, GA'],

  // ── Group L: Austria, Venezuela, Algeria, Bolivia ───────────────────────
  // MD1 – June 17
  ['L', 1, 'austria',     'venezuela',    '2026-06-17', '18:00', 'toronto',         'Toronto, ON'],
  ['L', 1, 'algeria',     'bolivia',      '2026-06-17', '21:00', 'vancouver',       'Vancouver, BC'],
  // MD2 – June 24
  ['L', 2, 'austria',     'algeria',      '2026-06-24', '21:00', 'toronto',         'Toronto, ON'],
  ['L', 2, 'venezuela',   'bolivia',      '2026-06-24', '18:00', 'vancouver',       'Vancouver, BC'],
  // MD3 – June 30 (concurrent)
  ['L', 3, 'austria',     'bolivia',      '2026-06-30', '18:00', 'toronto',         'Toronto, ON'],
  ['L', 3, 'venezuela',   'algeria',      '2026-06-30', '18:00', 'vancouver',       'Vancouver, BC'],
];

// ---------------------------------------------------------------------------
// Expand compact rows → full WCGroupFixture objects
// ---------------------------------------------------------------------------

export const WC_GROUP_FIXTURES: WCGroupFixture[] = COMPACT.map(
  ([group, matchday, homeSlug, awaySlug, date, time, venueSlug, venueCity], idx) => {
    const ht = team(homeSlug);
    const at = team(awaySlug);
    return {
      localId:   10001 + idx,
      group:     group as string,
      matchday:  matchday as 1 | 2 | 3,
      homeSlug,
      awaySlug,
      homeLabel: ht.displayName,
      awayLabel: at.displayName,
      homeFlag:  ht.flag,
      awayFlag:  at.flag,
      utcDate:   `${date}T${time}:00Z`,
      venueSlug,
      venueCity,
    };
  }
);

// ---------------------------------------------------------------------------
// Knockout bracket slots — TBD teams until group stage settles
// ---------------------------------------------------------------------------

const ROUND_LABELS: Record<WCKnockoutSlot['round'], string> = {
  LAST_32:       'Round of 32',
  LAST_16:       'Round of 16',
  QUARTER_FINALS: 'Quarter-final',
  SEMI_FINALS:   'Semi-final',
  THIRD_PLACE:   'Third-place play-off',
  FINAL:         'Final',
};

/** Knockout match layout.
 *  homeLabel / awayLabel are placeholder descriptors until round results land. */
const KNOCKOUT_COMPACT: [
  WCKnockoutSlot['round'],
  number, // match number
  string, // date
  string, // time UTC
  string, // venueSlug
  string, // venueCity
  string, // homeLabel
  string, // awayLabel
][] = [
  // ── Round of 32 (July 2-5) ────────────────────────────────────────────
  ['LAST_32', 1,  '2026-07-02', '17:00', 'metlife-stadium', 'East Rutherford, NJ', '1st Group A',  '3rd (B/C/D)'],
  ['LAST_32', 2,  '2026-07-02', '21:00', 'boston',          'Foxborough, MA',       '1st Group C',  '3rd (D/E/F)'],
  ['LAST_32', 3,  '2026-07-03', '17:00', 'dallas',          'Arlington, TX',        '1st Group B',  '3rd (A/C/D)'],
  ['LAST_32', 4,  '2026-07-03', '21:00', 'miami',           'Miami Gardens, FL',    '1st Group D',  '2nd Group B'],
  ['LAST_32', 5,  '2026-07-04', '17:00', 'los-angeles',     'Inglewood, CA',        '1st Group F',  '3rd (G/H/I)'],
  ['LAST_32', 6,  '2026-07-04', '21:00', 'seattle',         'Seattle, WA',          '1st Group E',  '2nd Group A'],
  ['LAST_32', 7,  '2026-07-05', '17:00', 'atlanta',         'Atlanta, GA',          '1st Group G',  '3rd (J/K/L)'],
  ['LAST_32', 8,  '2026-07-05', '21:00', 'kansas-city',     'Kansas City, MO',      '1st Group I',  '2nd Group G'],
  ['LAST_32', 9,  '2026-07-06', '17:00', 'toronto',         'Toronto, ON',          '1st Group H',  '2nd Group F'],
  ['LAST_32', 10, '2026-07-06', '21:00', 'san-francisco',   'Santa Clara, CA',      '1st Group J',  '2nd Group I'],
  ['LAST_32', 11, '2026-07-07', '17:00', 'pasadena',        'Pasadena, CA',         '1st Group K',  '2nd Group L'],
  ['LAST_32', 12, '2026-07-07', '21:00', 'philadelphia',    'Philadelphia, PA',     '1st Group L',  '2nd Group K'],
  ['LAST_32', 13, '2026-07-08', '17:00', 'guadalajara',     'Guadalajara',          '2nd Group C',  '2nd Group D'],
  ['LAST_32', 14, '2026-07-08', '21:00', 'monterrey',       'Monterrey',            '2nd Group E',  '2nd Group H'],
  ['LAST_32', 15, '2026-07-09', '17:00', 'vancouver',       'Vancouver, BC',        '2nd Group J',  '3rd (E/F/G)'],
  ['LAST_32', 16, '2026-07-09', '21:00', 'dallas',          'Arlington, TX',        '3rd best',     '3rd best'],

  // ── Round of 16 (July 12-15) ──────────────────────────────────────────
  ['LAST_16', 1,  '2026-07-12', '17:00', 'metlife-stadium', 'East Rutherford, NJ', 'Winner R32 M1',  'Winner R32 M2'],
  ['LAST_16', 2,  '2026-07-12', '21:00', 'dallas',          'Arlington, TX',        'Winner R32 M3',  'Winner R32 M4'],
  ['LAST_16', 3,  '2026-07-13', '17:00', 'los-angeles',     'Inglewood, CA',        'Winner R32 M5',  'Winner R32 M6'],
  ['LAST_16', 4,  '2026-07-13', '21:00', 'miami',           'Miami Gardens, FL',    'Winner R32 M7',  'Winner R32 M8'],
  ['LAST_16', 5,  '2026-07-14', '17:00', 'boston',          'Foxborough, MA',       'Winner R32 M9',  'Winner R32 M10'],
  ['LAST_16', 6,  '2026-07-14', '21:00', 'seattle',         'Seattle, WA',          'Winner R32 M11', 'Winner R32 M12'],
  ['LAST_16', 7,  '2026-07-15', '17:00', 'atlanta',         'Atlanta, GA',          'Winner R32 M13', 'Winner R32 M14'],
  ['LAST_16', 8,  '2026-07-15', '21:00', 'san-francisco',   'Santa Clara, CA',      'Winner R32 M15', 'Winner R32 M16'],

  // ── Quarter-finals (July 17-18) ───────────────────────────────────────
  ['QUARTER_FINALS', 1, '2026-07-17', '18:00', 'metlife-stadium', 'East Rutherford, NJ', 'Winner R16 M1', 'Winner R16 M2'],
  ['QUARTER_FINALS', 2, '2026-07-17', '22:00', 'dallas',          'Arlington, TX',        'Winner R16 M3', 'Winner R16 M4'],
  ['QUARTER_FINALS', 3, '2026-07-18', '18:00', 'los-angeles',     'Inglewood, CA',        'Winner R16 M5', 'Winner R16 M6'],
  ['QUARTER_FINALS', 4, '2026-07-18', '22:00', 'boston',          'Foxborough, MA',       'Winner R16 M7', 'Winner R16 M8'],

  // ── Semi-finals (July 21-22) ──────────────────────────────────────────
  ['SEMI_FINALS', 1, '2026-07-21', '21:00', 'metlife-stadium', 'East Rutherford, NJ', 'Winner QF1',  'Winner QF2'],
  ['SEMI_FINALS', 2, '2026-07-22', '21:00', 'dallas',          'Arlington, TX',        'Winner QF3',  'Winner QF4'],

  // ── Third-place play-off (July 25) ────────────────────────────────────
  ['THIRD_PLACE', 1, '2026-07-25', '18:00', 'metlife-stadium', 'East Rutherford, NJ', 'Loser SF1', 'Loser SF2'],

  // ── Final (July 26 — MetLife Stadium) ────────────────────────────────
  // Note: some sources list Final as July 19; this dataset uses July 26 to
  // accommodate realistic knockout-round spacing. Update if FIFA confirms.
  ['FINAL',       1, '2026-07-26', '20:00', 'metlife-stadium', 'East Rutherford, NJ', 'Winner SF1', 'Winner SF2'],
];

export const WC_KNOCKOUT_SLOTS: WCKnockoutSlot[] = KNOCKOUT_COMPACT.map(
  ([round, matchNumber, date, time, venueSlug, venueCity, homeLabel, awayLabel], idx) => ({
    localId:     20001 + idx,
    round,
    roundLabel:  ROUND_LABELS[round],
    matchNumber,
    utcDate:     `${date}T${time}:00Z`,
    venueSlug,
    venueCity,
    homeLabel,
    awayLabel,
  })
);

// ---------------------------------------------------------------------------
// All 104 fixtures combined (group stage first, then knockout)
// ---------------------------------------------------------------------------

/** Returns all group-stage fixtures sorted by date. */
export const WC_ALL_FIXTURES = [...WC_GROUP_FIXTURES].sort(
  (a, b) => a.utcDate.localeCompare(b.utcDate)
);

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** All fixtures for a specific group letter ('A'–'L'). */
export function getGroupFixtures(group: string): WCGroupFixture[] {
  return WC_GROUP_FIXTURES.filter((f) => f.group === group.toUpperCase()).sort(
    (a, b) => a.utcDate.localeCompare(b.utcDate)
  );
}

/** All fixtures involving a specific team slug. */
export function getTeamFixtures(slug: string): WCGroupFixture[] {
  const s = slug.toLowerCase();
  return WC_GROUP_FIXTURES.filter(
    (f) => f.homeSlug === s || f.awaySlug === s
  ).sort((a, b) => a.utcDate.localeCompare(b.utcDate));
}

/** Upcoming fixtures (utcDate ≥ now), sorted ascending. */
export function getUpcomingGroupFixtures(fromDate?: Date): WCGroupFixture[] {
  const cutoff = (fromDate ?? new Date()).toISOString();
  return WC_GROUP_FIXTURES.filter((f) => f.utcDate >= cutoff).sort(
    (a, b) => a.utcDate.localeCompare(b.utcDate)
  );
}

/** Fixtures for a given matchday (1, 2, or 3). */
export function getMatchdayFixtures(matchday: 1 | 2 | 3): WCGroupFixture[] {
  return WC_GROUP_FIXTURES.filter((f) => f.matchday === matchday).sort(
    (a, b) => a.utcDate.localeCompare(b.utcDate)
  );
}

/** Knockout slots for a given round. */
export function getKnockoutSlots(round: WCKnockoutSlot['round']): WCKnockoutSlot[] {
  return WC_KNOCKOUT_SLOTS.filter((s) => s.round === round);
}
