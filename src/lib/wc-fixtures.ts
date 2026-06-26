/**
 * wc-fixtures.ts
 *
 * WC 2026 knockout bracket slot structure and type definitions.
 *
 * Group fixture data (COMPACT array, WC_GROUP_FIXTURES, WC_ALL_FIXTURES,
 * getGroupFixtures, getTeamFixtures) was pre-draw editorial content and has
 * been removed (SEO-7 / DATA-9). Group-stage fixtures are now served
 * exclusively via the football-data.org live API (getWCAuthorityMatchesCached).
 *
 * This file retains:
 *  • WCGroupFixture / WCKnockoutSlot types (consumed by several pages)
 *  • WC_KNOCKOUT_SLOTS — bracket slot structure (used by bracket pages)
 */

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
  // ── Round of 32 — OFFICIAL FIFA 2026 bracket pairings ─────────────────────
  // Source: FIFA 2026 knockout bracket (Wikipedia / Sky Sports). matchNumber is
  // the official R32 match order; football-data.org assigns its match ids in this
  // same order, so injectKnockoutSlotLabels maps each FD match to its slot by
  // sorted match id (the authority's own bracket position). Home/away labels are
  // the deterministic group-position pairings; "3rd (…)" are the best-third-place
  // wildcards (resolved by FIFA's combination table only after all groups finish).
  ['LAST_32', 1,  '2026-07-02', '17:00', 'los-angeles',     'Inglewood, CA',        '1st Group E',  '3rd (A/B/C/D/F)'],
  ['LAST_32', 2,  '2026-07-02', '21:00', 'boston',          'Foxborough, MA',       '1st Group I',  '3rd (C/D/F/G/H)'],
  ['LAST_32', 3,  '2026-07-03', '17:00', 'metlife-stadium', 'East Rutherford, NJ',  '2nd Group A',  '2nd Group B'],
  ['LAST_32', 4,  '2026-07-03', '21:00', 'dallas',          'Arlington, TX',        '1st Group F',  '2nd Group C'],
  ['LAST_32', 5,  '2026-07-04', '17:00', 'seattle',         'Seattle, WA',          '2nd Group K',  '2nd Group L'],
  ['LAST_32', 6,  '2026-07-04', '21:00', 'atlanta',         'Atlanta, GA',          '1st Group H',  '2nd Group J'],
  ['LAST_32', 7,  '2026-07-05', '17:00', 'miami',           'Miami Gardens, FL',    '1st Group D',  '3rd (B/E/F/I/J)'],
  ['LAST_32', 8,  '2026-07-05', '21:00', 'kansas-city',     'Kansas City, MO',      '1st Group G',  '3rd (A/E/H/I/J)'],
  ['LAST_32', 9,  '2026-07-06', '17:00', 'philadelphia',    'Philadelphia, PA',     '1st Group C',  '2nd Group F'],
  ['LAST_32', 10, '2026-07-06', '21:00', 'san-francisco',   'Santa Clara, CA',      '2nd Group E',  '2nd Group I'],
  ['LAST_32', 11, '2026-07-07', '17:00', 'houston',         'Houston, TX',          '1st Group A',  '3rd (C/E/F/H/I)'],
  ['LAST_32', 12, '2026-07-07', '21:00', 'guadalajara',     'Guadalajara',          '1st Group L',  '3rd (E/H/I/J/K)'],
  ['LAST_32', 13, '2026-07-08', '17:00', 'mexico-city',     'Mexico City',          '1st Group J',  '2nd Group H'],
  ['LAST_32', 14, '2026-07-08', '21:00', 'monterrey',       'Monterrey',            '2nd Group D',  '2nd Group G'],
  ['LAST_32', 15, '2026-07-09', '17:00', 'toronto',         'Toronto, ON',          '1st Group B',  '3rd (E/F/G/I/J)'],
  ['LAST_32', 16, '2026-07-09', '21:00', 'vancouver',       'Vancouver, BC',        '1st Group K',  '3rd (D/E/I/J/L)'],

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

/** Knockout slots for a given round. */
export function getKnockoutSlots(round: WCKnockoutSlot['round']): WCKnockoutSlot[] {
  return WC_KNOCKOUT_SLOTS.filter((s) => s.round === round);
}

/**
 * Fill knockout fixtures that still have null team names with the correct bracket
 * content, derived from the SINGLE source — never reordered by editorial guesswork.
 *
 * MUST be called with ALL matches for a single stage at once.
 *
 * Slot mapping — by sorted match id:
 *   football-data.org assigns knockout match ids in official bracket order, so the
 *   i-th match by ascending id is bracket slot matchNumber i+1. This is the
 *   authority's own bracket position (verified: Germany=1E→match1, USA=1D→match7,
 *   Mexico=1A→match11, Argentina=1J→match13). No date heuristics, no reordering.
 *
 * Side resolution:
 *   • a side FD already names (confirmed team) is never overwritten;
 *   • a null side is filled from its slot's group-position label — resolved to the
 *     ACTUAL qualified team when `labelToTeam` has it (its group is decided), else
 *     left as the descriptive placeholder ("2nd Group I", "3rd (A/B/C/D/F)").
 */
type SlotTeam = { id: number; name: string; shortName: string; tla: string; crest: string };

export function injectKnockoutSlotLabels<T extends {
  id: number;
  utcDate: string;
  homeTeam: { id: number; name: string; shortName: string; tla: string; crest: string } | null | undefined;
  awayTeam: { id: number; name: string; shortName: string; tla: string; crest: string } | null | undefined;
}>(
  matches: T[],
  stage: string,
  labelToTeam?: Map<string, SlotTeam>,
): T[] {
  const teamFor = (label: string): SlotTeam =>
    labelToTeam?.get(label) ?? { id: 0, name: label, shortName: label, tla: '', crest: '' };

  const round = stage as WCKnockoutSlot['round'];
  const slots = WC_KNOCKOUT_SLOTS
    .filter((s) => s.round === round)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  if (slots.length === 0) return matches;

  // Authority bracket position = ascending match-id order → slot[i].
  const order = matches
    .map((_, i) => i)
    .sort((a, b) => (matches[a].id ?? 0) - (matches[b].id ?? 0));

  const result = [...matches];
  order.forEach((origIdx, pos) => {
    const slot = slots[pos];
    if (!slot) return;
    const m = result[origIdx];
    const needsHome = !m.homeTeam?.name;
    const needsAway = !m.awayTeam?.name;
    if (!needsHome && !needsAway) return;
    result[origIdx] = {
      ...m,
      homeTeam: needsHome ? teamFor(slot.homeLabel) : m.homeTeam,
      awayTeam: needsAway ? teamFor(slot.awayLabel) : m.awayTeam,
    };
  });
  return result;
}
