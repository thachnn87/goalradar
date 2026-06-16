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


// keyEvents is the actual event array returned by the ESPN summary endpoint for WC 2026.
// scoringPlays and plays are NOT present in WC 2026 summary responses.
interface EspnKeyEvent {
  id:           string;
  type:         { id: string; text: string; type?: string };
  text?:        string;
  shortText?:   string;
  period:       { number: number };
  clock:        { value?: number; displayValue: string };
  scoringPlay?: boolean;
  team?:        EspnTeam;
  participants?: Array<{ athlete: { id: string; displayName: string; shortName?: string } }>;
}

interface EspnSummaryResponse {
  keyEvents?: EspnKeyEvent[];
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

export function normaliseName(name: string): string {
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
/** Convert a UTC ISO date string to an ESPN YYYYMMDD string. */
function toEspnDateStr(utcDate: string): string {
  return utcDate.slice(0, 10).replace(/-/g, '');
}

/** Subtract one calendar day from a YYYYMMDD string. */
function prevDayStr(dateStr: string): string {
  const year  = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(4, 6), 10) - 1;
  const day   = parseInt(dateStr.slice(6, 8), 10);
  const d     = new Date(Date.UTC(year, month, day - 1));
  const y     = d.getUTCFullYear();
  const m     = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da    = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${da}`;
}

function matchInScoreboard(
  events: EspnEvent[],
  normHome: string,
  normAway: string,
): string | null {
  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const home = competition.competitors.find((c) => c.homeAway === 'home');
    const away = competition.competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;

    if (
      normaliseName(home.team.displayName) === normHome &&
      normaliseName(away.team.displayName) === normAway
    ) {
      return event.id;
    }

    // Fallback: check shortDisplayName
    if (
      normaliseName(home.team.shortDisplayName ?? '') === normHome &&
      normaliseName(away.team.shortDisplayName ?? '') === normAway
    ) {
      return event.id;
    }
  }
  return null;
}

export async function findEspnMatch(
  homeTeamName: string,
  awayTeamName: string,
  utcDate:      string,
): Promise<string | null> {
  const normHome = normaliseName(homeTeamName);
  const normAway = normaliseName(awayTeamName);

  // ESPN groups events by US local time (~UTC-5/6). Matches at 01:00–02:00Z
  // UTC appear on the previous calendar day. Try UTC date first, then prev day.
  const dateStr  = toEspnDateStr(utcDate);
  const prevDate = prevDayStr(dateStr);

  const dates = [dateStr, prevDate];

  for (const d of dates) {
    const url  = `${ESPN_BASE}/${ESPN_LEAGUE}/scoreboard?dates=${d}`;
    const data = await espnFetch<EspnScoreboardResponse>(url);
    const events = data.events ?? [];

    const found = matchInScoreboard(events, normHome, normAway);
    if (found) {
      if (d !== dateStr) {
        console.log(`[ESPN] found match on prev-day ${d} (utcDate=${dateStr})`);
      }
      return found;
    }
  }

  console.warn(
    `[ESPN] no match found for "${homeTeamName}" vs "${awayTeamName}"` +
    ` on ${dateStr} or ${prevDate}`,
  );
  return null;
}

// ---------------------------------------------------------------------------
// getEspnMatchEvents
// ---------------------------------------------------------------------------

/**
 * Fetch goals, bookings, and substitutions for an ESPN event ID.
 *
 * ESPN WC 2026 summary responses do not include `scoringPlays` or `plays`.
 * All events are in the `keyEvents` array, filtered by type.id:
 *   70 = Goal, 76 = Substitution, 94 = Yellow Card, 95/96 = Red Card variants
 *
 * Returns null on network/parse failure (caller should handle).
 */
export async function getEspnMatchEvents(espnMatchId: string): Promise<EspnMatchEvents | null> {
  const url  = `${ESPN_BASE}/${ESPN_LEAGUE}/summary?event=${espnMatchId}`;
  const data = await espnFetch<EspnSummaryResponse>(url);

  const keyEvents = data.keyEvents ?? [];

  return {
    espnMatchId,
    goals:         parseGoals(keyEvents.filter((e) => e.scoringPlay === true)),
    bookings:      parseBookings(keyEvents.filter((e) => ['94', '95', '96'].includes(e.type?.id ?? ''))),
    substitutions: parseSubstitutions(keyEvents.filter((e) => e.type?.id === '76')),
  };
}

// ---------------------------------------------------------------------------
// Event parsers — all operate on pre-filtered EspnKeyEvent[] slices
// ---------------------------------------------------------------------------

// keyEvents participants carry no type labels — roles are positional:
//   Goal:         participants[0] = scorer, participants[1] = assist (optional)
//   Substitution: participants[0] = playerIn,  participants[1] = playerOut
//   Card:         participants[0] = recipient (single)

function parseGoals(events: EspnKeyEvent[]): Goal[] {
  const goals: Goal[] = [];

  for (const ev of events) {
    if (!ev.team) continue;

    const minute    = espnClockToMinute(ev.clock?.displayValue ?? '0:00', ev.period?.number ?? 1);
    const team      = buildTeam(ev.team);
    const typeText  = ev.type?.text?.toLowerCase() ?? '';
    const isOwnGoal = typeText.includes('own');

    const participants = ev.participants ?? [];
    const scorer       = participants[0]; // always the scorer
    const assist       = participants[1]; // present only when there is an assist

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

function parseBookings(events: EspnKeyEvent[]): Booking[] {
  const bookings: Booking[] = [];

  // type.id 94 = Yellow, 95 = Red, 96 = Second Yellow / Yellow-Red
  const CARD_BY_TYPE_ID: Record<string, Booking['card']> = {
    '94': 'YELLOW',
    '95': 'RED',
    '96': 'YELLOW_RED',
  };

  for (const ev of events) {
    if (!ev.team) continue;

    const card = CARD_BY_TYPE_ID[ev.type?.id ?? ''];
    if (!card) continue;

    const minute       = espnClockToMinute(ev.clock?.displayValue ?? '0:00', ev.period?.number ?? 1);
    const team         = buildTeam(ev.team);
    const participants = ev.participants ?? [];
    const recipient    = participants[0];
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

function parseSubstitutions(events: EspnKeyEvent[]): Substitution[] {
  const substitutions: Substitution[] = [];

  for (const ev of events) {
    if (!ev.team) continue;

    const minute       = espnClockToMinute(ev.clock?.displayValue ?? '0:00', ev.period?.number ?? 1);
    const team         = buildTeam(ev.team);
    const participants = ev.participants ?? [];

    // Positional: index 0 = coming on (playerIn), index 1 = going off (playerOut)
    // Validated from event text: "Nilson Angulo replaces Alan Minda" → [0]=Angulo, [1]=Minda
    const pIn  = participants[0];
    const pOut = participants[1];
    if (!pIn || !pOut) continue;

    substitutions.push({
      minute,
      team,
      playerOut: { id: parseInt(pOut.athlete.id, 10) || 0, name: pOut.athlete.displayName },
      playerIn:  { id: parseInt(pIn.athlete.id, 10)  || 0, name: pIn.athlete.displayName  },
    });
  }

  return substitutions;
}
