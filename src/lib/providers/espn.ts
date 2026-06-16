/**
 * espn.ts — ESPN public API client for WC event enrichment.
 *
 * DATA-13: ESPN is used exclusively for post-match event data:
 *   goals, scorers, cards, substitutions.
 *
 * football-data.org remains the authority for fixtures, standings, scores,
 * status, and kickoff times. ESPN is NEVER called for live polling.
 *
 * Endpoints used (no API key required):
 *   Scoreboard: https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard?dates={YYYYMMDD}
 *   Summary:    https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={id}
 *
 * League slug: fifa.world (overridable via ESPN_WC_LEAGUE env var).
 */

import type { Goal, Booking, Substitution, Team } from '@/lib/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ESPN_BASE    = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_LEAGUE  = process.env.ESPN_WC_LEAGUE ?? 'fifa.world';
const TIMEOUT_MS   = 10_000;

// ---------------------------------------------------------------------------
// ESPN API response shapes (internal — not exported)
// ---------------------------------------------------------------------------

interface EspnTeam {
  id:                string;
  displayName:       string;
  shortDisplayName?: string;
  abbreviation?:     string;
}

interface EspnCompetitor {
  homeAway: 'home' | 'away';
  team:     EspnTeam;
}

interface EspnCompetition {
  competitors: EspnCompetitor[];
}

interface EspnEvent {
  id:           string;
  name:         string;
  date:         string;
  competitions: EspnCompetition[];
}

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

// Participant type is a string or an object depending on ESPN API version
interface EspnParticipant {
  athlete: { id: string; displayName: string; shortName?: string };
  type:    { id?: string; text: string } | string;
}

interface EspnScoringPlay {
  id:           string;
  type:         { id?: string; text: string };
  period:       { number: number };
  clock:        { displayValue: string };
  team:         EspnTeam;
  participants?: EspnParticipant[];
}

interface EspnPlay {
  id:            string;
  type:          { id?: string; text: string };
  period:        { number: number };
  clock:         { displayValue: string };
  team?:         EspnTeam;
  participants?: EspnParticipant[];
}

interface EspnSummaryResponse {
  scoringPlays?: EspnScoringPlay[];
  plays?:        EspnPlay[];
}

// ---------------------------------------------------------------------------
// Exported result shape
// ---------------------------------------------------------------------------

export interface EspnMatchEvents {
  espnMatchId:   string;
  goals:         Goal[];
  bookings:      Booking[];
  substitutions: Substitution[];
}

// ---------------------------------------------------------------------------
// Team name normalisation (mirrors af-id-map.ts)
// ---------------------------------------------------------------------------

const ESPN_ALIASES: Record<string, string> = {
  'united states':       'usa',
  'united states men':   'usa',
  'trinidad & tobago':   'trinidad and tobago',
  'korea republic':      'south korea',
  "côte d'ivoire":       'ivory coast',
  "cote d'ivoire":       'ivory coast',
  'czechia':             'czech republic',
  'bosnia-herzegovina':  'bosnia',
  'cape verde islands':  'cape verde',
  'república dominicana':'dominican republic',
};

function normaliseName(name: string): string {
  const stripped = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return ESPN_ALIASES[stripped] ?? stripped;
}

// ---------------------------------------------------------------------------
// Clock parsing
// ---------------------------------------------------------------------------

/**
 * Convert ESPN clock to cumulative match minute.
 *
 * ESPN period clocks may be cumulative (0→90) or reset per half (0→45).
 * We normalise both: if period 2 clock < 45, we add 45 (per-half format).
 */
function espnClockToMinute(displayValue: string, periodNumber: number): number {
  const [minStr] = displayValue.split(':');
  const min = parseInt(minStr, 10) || 0;

  if (periodNumber === 1) return min;
  if (periodNumber === 2) return min < 45 ? 45 + min : min;
  if (periodNumber === 3) return min < 90 ? 90 + min : min;   // ET 1st half
  if (periodNumber === 4) return min < 105 ? 105 + min : min; // ET 2nd half
  return min;
}

// ---------------------------------------------------------------------------
// Minimal Team builder (events only — crest/TLA not available from ESPN)
// ---------------------------------------------------------------------------

function buildTeam(espnTeam: EspnTeam): Team {
  return {
    id:        parseInt(espnTeam.id, 10) || 0,
    name:      espnTeam.displayName,
    shortName: espnTeam.shortDisplayName ?? espnTeam.displayName,
    tla:       espnTeam.abbreviation ?? '',
    crest:     '',
  };
}

// ---------------------------------------------------------------------------
// Participant helpers
// ---------------------------------------------------------------------------

function participantTypeText(p: EspnParticipant): string {
  return typeof p.type === 'string' ? p.type : (p.type?.text ?? '');
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function espnFetch<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`ESPN HTTP ${res.status} for ${url}`);
    return await res.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// findEspnMatch
// ---------------------------------------------------------------------------

/**
 * Find the ESPN event ID for a football-data.org match.
 *
 * Queries the ESPN WC scoreboard for the match date and locates the event
 * by matching normalised home/away team names.
 *
 * Returns the ESPN event ID string, or null if not found.
 * Throws on network/parse failure (caller should catch and return null).
 */
export async function findEspnMatch(
  homeTeamName: string,
  awayTeamName: string,
  utcDate:      string,
): Promise<string | null> {
  // YYYYMMDD from UTC date string
  const dateStr = utcDate.slice(0, 10).replace(/-/g, '');
  const url     = `${ESPN_BASE}/${ESPN_LEAGUE}/scoreboard?dates=${dateStr}`;

  const data = await espnFetch<EspnScoreboardResponse>(url);
  const events = data.events ?? [];

  const normHome = normaliseName(homeTeamName);
  const normAway = normaliseName(awayTeamName);

  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const home = competition.competitors.find((c) => c.homeAway === 'home');
    const away = competition.competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;

    const espnHome = normaliseName(home.team.displayName);
    const espnAway = normaliseName(away.team.displayName);

    if (espnHome === normHome && espnAway === normAway) {
      return event.id;
    }

    // Fallback: check shortDisplayName
    const espnHomeShort = normaliseName(home.team.shortDisplayName ?? '');
    const espnAwayShort = normaliseName(away.team.shortDisplayName ?? '');
    if (espnHomeShort === normHome && espnAwayShort === normAway) {
      return event.id;
    }
  }

  console.warn(
    `[ESPN] no match found for "${homeTeamName}" vs "${awayTeamName}" on ${dateStr}` +
    ` (${events.length} events in scoreboard)`,
  );
  return null;
}

// ---------------------------------------------------------------------------
// getEspnMatchEvents
// ---------------------------------------------------------------------------

/**
 * Fetch goals, bookings, and substitutions for an ESPN event ID.
 *
 * Goals:          scoringPlays array (reliable, ESPN-maintained)
 * Bookings:       plays array filtered by type text
 * Substitutions:  plays array filtered by type text
 *
 * Returns null on network/parse failure (caller should handle).
 */
export async function getEspnMatchEvents(espnMatchId: string): Promise<EspnMatchEvents | null> {
  const url  = `${ESPN_BASE}/${ESPN_LEAGUE}/summary?event=${espnMatchId}`;
  const data = await espnFetch<EspnSummaryResponse>(url);

  return {
    espnMatchId,
    goals:         parseGoals(data.scoringPlays ?? []),
    bookings:      parseBookings(data.plays ?? []),
    substitutions: parseSubstitutions(data.plays ?? []),
  };
}

// ---------------------------------------------------------------------------
// Event parsers
// ---------------------------------------------------------------------------

function parseGoals(plays: EspnScoringPlay[]): Goal[] {
  const goals: Goal[] = [];

  for (const play of plays) {
    const typeText = play.type?.text?.toLowerCase() ?? '';
    // Scoring plays include goals and own goals; skip penalty shootout markers
    if (!typeText.includes('goal')) continue;

    const minute    = espnClockToMinute(play.clock?.displayValue ?? '0:00', play.period?.number ?? 1);
    const team      = buildTeam(play.team);
    const isOwnGoal = typeText.includes('own');

    const participants = play.participants ?? [];
    const scorer = participants.find(
      (p) => participantTypeText(p).toLowerCase().includes('scorer') ||
             participantTypeText(p).toLowerCase().includes('goal'),
    );
    const assist = participants.find(
      (p) => participantTypeText(p).toLowerCase().includes('assist'),
    );

    // Skip plays with no scorer info (data gap)
    if (!scorer) continue;

    goals.push({
      minute,
      injuryTime: null,
      type:       isOwnGoal ? 'OWN' : 'REGULAR',
      team,
      scorer: {
        id:   parseInt(scorer.athlete.id, 10) || 0,
        name: scorer.athlete.displayName,
      },
      assist: assist
        ? { id: parseInt(assist.athlete.id, 10) || 0, name: assist.athlete.displayName }
        : null,
    });
  }

  return goals;
}

function parseBookings(plays: EspnPlay[]): Booking[] {
  const bookings: Booking[] = [];

  const CARD_TYPES: Record<string, Booking['card']> = {
    'yellow card':        'YELLOW',
    'red card':           'RED',
    'second yellow card': 'YELLOW_RED',
    'yellow-red card':    'YELLOW_RED',
  };

  for (const play of plays) {
    const typeText = play.type?.text?.toLowerCase() ?? '';
    const card     = CARD_TYPES[typeText];
    if (!card || !play.team) continue;

    const minute = espnClockToMinute(play.clock?.displayValue ?? '0:00', play.period?.number ?? 1);
    const team   = buildTeam(play.team);

    const participants = play.participants ?? [];
    const recipient    = participants[0]; // typically only one participant for cards
    if (!recipient) continue;

    bookings.push({
      minute,
      team,
      player: {
        id:   parseInt(recipient.athlete.id, 10) || 0,
        name: recipient.athlete.displayName,
      },
      card,
    });
  }

  return bookings;
}

function parseSubstitutions(plays: EspnPlay[]): Substitution[] {
  const substitutions: Substitution[] = [];

  for (const play of plays) {
    const typeText = play.type?.text?.toLowerCase() ?? '';
    if (!typeText.includes('substitution') && !typeText.includes('sub ')) continue;
    if (!play.team) continue;

    const minute = espnClockToMinute(play.clock?.displayValue ?? '0:00', play.period?.number ?? 1);
    const team   = buildTeam(play.team);

    const participants = play.participants ?? [];
    const playerOut    = participants.find(
      (p) => participantTypeText(p).toLowerCase().includes('out') ||
             participantTypeText(p).toLowerCase().includes('replaced'),
    );
    const playerIn     = participants.find(
      (p) => participantTypeText(p).toLowerCase().includes('in') ||
             participantTypeText(p).toLowerCase().includes('replacement'),
    );

    // Some ESPN feeds list sub participants without explicit in/out labels
    // Fall back to positional order: index 0 = out, index 1 = in
    const pOut = playerOut ?? participants[0];
    const pIn  = playerIn  ?? participants[1];
    if (!pOut || !pIn) continue;

    substitutions.push({
      minute,
      team,
      playerOut: { id: parseInt(pOut.athlete.id, 10) || 0, name: pOut.athlete.displayName },
      playerIn:  { id: parseInt(pIn.athlete.id, 10)  || 0, name: pIn.athlete.displayName  },
    });
  }

  return substitutions;
}
