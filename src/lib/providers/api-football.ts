/**
 * src/lib/providers/api-football.ts
 *
 * ApiFootballProvider — wraps v3.football.api-sports.io (api-football.com).
 *
 * This is the SECONDARY (failover) provider. It is invoked automatically
 * by ProviderManager when FootballDataProvider throws ApiUnavailableError
 * (rate_limit, disabled, http 5xx, timeout).
 *
 * Response normalisation:
 *   api-football uses a different shape, field names and status codes to
 *   football-data.org. This file maps every api-football response into the
 *   canonical types defined in src/lib/types.ts so callers receive the same
 *   objects regardless of which provider served the request.
 *
 * Env var required:
 *   API_FOOTBALL_KEY  — x-apisports-key header value
 *
 * Throws the same ApiUnavailableError / NotFoundError as FootballDataProvider
 * so ProviderManager can handle errors uniformly.
 */

import type {
  Match, MatchDetail, MatchStatus,
  StandingTable, StandingEntry,
  Goal, Booking, Substitution,
  Competition, Team, Score,
} from '@/lib/types';
import { NotFoundError, ApiUnavailableError } from '@/lib/api';
import type { MatchProvider } from './types';

const BASE_URL   = 'https://v3.football.api-sports.io';
const MAX_RETRIES = 3;
const TIMEOUT_MS  = 10_000;

// ---------------------------------------------------------------------------
// Competition code → api-football league/season mapping
// ---------------------------------------------------------------------------

interface LeagueSeason { leagueId: number; season: number }

const COMPETITION_MAP: Record<string, LeagueSeason> = {
  WC:  { leagueId: 1,   season: 2026 },
  PL:  { leagueId: 39,  season: 2025 },
  PD:  { leagueId: 140, season: 2025 },
  BL1: { leagueId: 78,  season: 2025 },
  SA:  { leagueId: 135, season: 2025 },
  FL1: { leagueId: 61,  season: 2025 },
  CL:  { leagueId: 2,   season: 2025 },
};

function leagueFor(competition: string): LeagueSeason {
  const mapping = COMPETITION_MAP[competition];
  if (!mapping) throw new Error(`ApiFootballProvider: unknown competition code "${competition}"`);
  return mapping;
}

// ---------------------------------------------------------------------------
// Status mapping: api-football short codes → our MatchStatus
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, MatchStatus> = {
  NS:   'SCHEDULED',
  TBD:  'TIMED',
  '1H': 'IN_PLAY',
  '2H': 'IN_PLAY',
  ET:   'IN_PLAY',
  BT:   'IN_PLAY',
  P:    'IN_PLAY',
  INT:  'IN_PLAY',
  HT:   'PAUSED',
  FT:   'FINISHED',
  AET:  'FINISHED',
  PEN:  'FINISHED',
  PST:  'POSTPONED',
  CANC: 'CANCELLED',
  ABD:  'SUSPENDED',
  SUSP: 'SUSPENDED',
  WO:   'FINISHED',
};

function mapStatus(short: string): MatchStatus {
  return STATUS_MAP[short] ?? 'SCHEDULED';
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function normaliseTeam(t: AFTeam): Team {
  return {
    id:        t.id,
    name:      t.name,
    shortName: t.name,
    tla:       t.name.slice(0, 3).toUpperCase(),
    crest:     t.logo ?? '',
  };
}

function normaliseCompetition(league: AFLeague): Competition {
  return {
    id:     league.id,
    name:   league.name,
    code:   Object.keys(COMPETITION_MAP).find((k) => COMPETITION_MAP[k].leagueId === league.id) ?? '',
    type:   'CUP',
    emblem: league.logo ?? '',
    area:   { id: 0, name: league.country ?? '', code: '', flag: null },
  };
}

/** Parse "Group Stage - 1" → group letter or null, matchday or null. */
function parseRound(round: string): { group: string | null; stage: string; matchday: number | null } {
  const groupMatch = round.match(/Group\s+([A-L])/i);
  const dayMatch   = round.match(/[-–]\s*(\d+)$/);
  return {
    group:    groupMatch ? `GROUP_${groupMatch[1].toUpperCase()}` : null,
    stage:    round.includes('Group') ? 'GROUP_STAGE'
            : round.includes('Round of 32') ? 'LAST_32'
            : round.includes('Round of 16') ? 'LAST_16'
            : round.includes('Quarter') ? 'QUARTER_FINALS'
            : round.includes('Semi') ? 'SEMI_FINALS'
            : round.includes('Final') ? 'FINAL'
            : round,
    matchday: dayMatch ? parseInt(dayMatch[1], 10) : null,
  };
}

function normaliseScore(goals: { home: number | null; away: number | null }, score: AFScore): Score {
  const winner: Score['winner'] =
    goals.home !== null && goals.away !== null
      ? goals.home > goals.away ? 'HOME_TEAM'
      : goals.away > goals.home ? 'AWAY_TEAM'
      : 'DRAW'
      : null;

  const duration: Score['duration'] =
    score.penalty?.home !== null ? 'PENALTY_SHOOTOUT'
    : score.extratime?.home !== null ? 'EXTRA_TIME'
    : 'REGULAR';

  return {
    winner,
    duration,
    fullTime: { home: goals.home, away: goals.away },
    halfTime: { home: score.halftime?.home ?? null, away: score.halftime?.away ?? null },
  };
}

function normaliseMatch(item: AFFixtureItem): Match {
  const { group, stage, matchday } = parseRound(item.league.round ?? '');
  return {
    id:          item.fixture.id,
    utcDate:     item.fixture.date,
    status:      mapStatus(item.fixture.status.short),
    matchday,
    stage,
    group,
    lastUpdated: item.fixture.date,
    competition: normaliseCompetition(item.league),
    homeTeam:    normaliseTeam(item.teams.home),
    awayTeam:    normaliseTeam(item.teams.away),
    score:       normaliseScore(item.goals, item.score),
  };
}

function normaliseMatchDetail(item: AFFixtureItem): MatchDetail {
  const base  = normaliseMatch(item);

  const goals: Goal[] = (item.events ?? [])
    .filter((e) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
    .map((e) => ({
      minute:     e.time.elapsed,
      injuryTime: e.time.extra ?? null,
      type:       e.detail ?? 'Normal Goal',
      team:       normaliseTeam(e.team),
      scorer:     { id: e.player?.id ?? 0, name: e.player?.name ?? '' },
      assist:     e.assist?.id ? { id: e.assist.id, name: e.assist.name ?? '' } : null,
    }));

  const bookings: Booking[] = (item.events ?? [])
    .filter((e) => e.type === 'Card')
    .map((e) => ({
      minute: e.time.elapsed,
      team:   normaliseTeam(e.team),
      player: { id: e.player?.id ?? 0, name: e.player?.name ?? '' },
      card:   e.detail === 'Red Card' ? 'RED'
            : e.detail === 'Yellow-Red Card' ? 'YELLOW_RED'
            : 'YELLOW',
    }));

  const substitutions: Substitution[] = (item.events ?? [])
    .filter((e) => e.type === 'subst')
    .map((e) => ({
      minute:    e.time.elapsed,
      team:      normaliseTeam(e.team),
      playerOut: { id: e.player?.id ?? 0,  name: e.player?.name ?? '' },
      playerIn:  { id: e.assist?.id ?? 0, name: e.assist?.name ?? '' },
    }));

  return {
    ...base,
    goals,
    bookings,
    substitutions,
    venue:     item.fixture.venue?.name ?? null,
    referees:  item.fixture.referee
      ? [{ id: 0, name: item.fixture.referee, type: 'REFEREE', nationality: null }]
      : [],
  };
}

function normaliseStandings(leagueId: number, leagueName: string, logo: string, rawStandings: AFStandingGroup[][]): {
  standings:   StandingTable[];
  competition: { name: string; emblem: string };
} {
  const tables: StandingTable[] = rawStandings.map((group) => {
    const groupName = group[0]?.group ?? null;
    const table: StandingEntry[] = group.map((row) => ({
      position:       row.rank,
      team:           normaliseTeam({ id: row.team.id, name: row.team.name, logo: row.team.logo }),
      playedGames:    row.all.played,
      form:           row.form ?? null,
      won:            row.all.win,
      draw:           row.all.draw,
      lost:           row.all.lose,
      points:         row.points,
      goalsFor:       row.all.goals.for,
      goalsAgainst:   row.all.goals.against,
      goalDifference: row.goalsDiff,
    }));
    return {
      stage:    'GROUP_STAGE',
      type:     'TOTAL',
      group:    groupName ? `GROUP_${groupName.replace('Group ', '')}` : null,
      table,
    };
  });

  return {
    standings:   tables,
    competition: { name: leagueName, emblem: logo },
  };
}

// ---------------------------------------------------------------------------
// Raw HTTP fetch
// ---------------------------------------------------------------------------

interface AFResponse<T> {
  errors:   unknown[];
  results:  number;
  response: T;
}

async function fetchRaw<T>(path: string): Promise<AFResponse<T>> {
  const apiKey = process.env.API_FOOTBALL_KEY ?? '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
          'x-apisports-key': apiKey,
          'Accept':          'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      const json = JSON.parse(text) as AFResponse<T> & { errors?: Record<string, string> };

      if (!res.ok) {
        if (res.status === 404)                          throw new NotFoundError();
        if (res.status === 429 || res.status === 499) {
          console.warn(`[AF] 429 ${path} | attempt ${attempt}/${MAX_RETRIES}`);
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, attempt * 5_000));
            continue;
          }
          throw new ApiUnavailableError('rate_limit');
        }
        if (res.status === 403) throw new ApiUnavailableError('disabled');
        if (res.status >= 500) {
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, attempt * 1_000));
            continue;
          }
          throw new ApiUnavailableError('http');
        }
        throw new ApiUnavailableError('http');
      }

      // api-football returns errors in body even on 200
      if (json.errors && typeof json.errors === 'object' && !Array.isArray(json.errors)) {
        const errVals = Object.values(json.errors as Record<string, string>);
        if (errVals.length > 0) {
          const msg = errVals.join(', ');
          console.error(`[AF] API error on ${path}: ${msg}`);
          if (msg.includes('limit') || msg.includes('rate')) throw new ApiUnavailableError('rate_limit');
          throw new ApiUnavailableError('http');
        }
      }

      return json;

    } catch (err) {
      clearTimeout(timer);
      if (err instanceof NotFoundError)       throw err;
      if (err instanceof ApiUnavailableError) {
        if (attempt >= MAX_RETRIES || err.reason === 'disabled' || err.reason === 'rate_limit') throw err;
        await new Promise((r) => setTimeout(r, attempt * 1_000));
        continue;
      }
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      console.error(`[AF] ${isTimeout ? 'TIMEOUT' : 'NETWORK'} ${path} (attempt ${attempt}/${MAX_RETRIES})`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 1_000));
        continue;
      }
      throw new ApiUnavailableError(isTimeout ? 'timeout' : 'unknown');
    }
  }

  throw new ApiUnavailableError();
}

// ---------------------------------------------------------------------------
// api-football response types (minimal — only what we need to normalise)
// ---------------------------------------------------------------------------

interface AFTeam  { id: number; name: string; logo?: string | null }
interface AFLeague { id: number; name: string; country?: string; logo?: string; round?: string; season?: number }

interface AFFixtureStatus { short: string; long: string; elapsed: number | null }
interface AFVenue         { name: string; city: string }

interface AFScore {
  halftime:  { home: number | null; away: number | null } | null;
  fulltime:  { home: number | null; away: number | null } | null;
  extratime: { home: number | null; away: number | null } | null;
  penalty:   { home: number | null; away: number | null } | null;
}

interface AFEvent {
  time:    { elapsed: number; extra: number | null };
  team:    AFTeam;
  player:  { id: number; name: string } | null;
  assist:  { id: number; name: string } | null;
  type:    string;
  detail:  string | null;
}

interface AFFixtureItem {
  fixture: {
    id:       number;
    referee:  string | null;
    timezone: string;
    date:     string;
    timestamp: number;
    status:   AFFixtureStatus;
    venue?:   AFVenue;
  };
  league: AFLeague;
  teams:  { home: AFTeam; away: AFTeam };
  goals:  { home: number | null; away: number | null };
  score:  AFScore;
  events?: AFEvent[];
}

interface AFStandingGroup {
  rank:      number;
  team:      { id: number; name: string; logo: string };
  points:    number;
  goalsDiff: number;
  group:     string;
  form:      string | null;
  all: {
    played: number;
    win:    number;
    draw:   number;
    lose:   number;
    goals:  { for: number; against: number };
  };
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export class ApiFootballProvider implements MatchProvider {
  readonly name = 'api-football' as const;

  async getMatch(id: number): Promise<MatchDetail> {
    const res = await fetchRaw<AFFixtureItem[]>(`/fixtures?id=${id}`);
    const item = (res.response as AFFixtureItem[])[0];
    if (!item) throw new NotFoundError();
    // Fetch events separately if not included
    const withEvents = await fetchRaw<AFFixtureItem[]>(`/fixtures?id=${id}&include=events`);
    const detailed = (withEvents.response as AFFixtureItem[])[0] ?? item;
    return normaliseMatchDetail(detailed);
  }

  async getFixtures(competition: string): Promise<{ matches: Match[]; resultSet: { count: number } }> {
    const { leagueId, season } = leagueFor(competition);
    const res = await fetchRaw<AFFixtureItem[]>(
      `/fixtures?league=${leagueId}&season=${season}&status=NS-TBD`,
    );
    const items = res.response as AFFixtureItem[];
    const matches = items.map(normaliseMatch);
    return { matches, resultSet: { count: matches.length } };
  }

  async getResults(competition: string): Promise<{ matches: Match[] }> {
    const { leagueId, season } = leagueFor(competition);
    const from  = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const res = await fetchRaw<AFFixtureItem[]>(
      `/fixtures?league=${leagueId}&season=${season}&status=FT-AET-PEN&from=${from}&to=${today}`,
    );
    return { matches: (res.response as AFFixtureItem[]).map(normaliseMatch) };
  }

  async getStandings(competition: string): Promise<{
    standings:   StandingTable[];
    competition: { name: string; emblem: string };
  }> {
    const { leagueId, season } = leagueFor(competition);
    const res = await fetchRaw<Array<{ league: { id: number; name: string; logo: string; standings: AFStandingGroup[][] } }>>(
      `/standings?league=${leagueId}&season=${season}`,
    );
    const league = (res.response as Array<{ league: { id: number; name: string; logo: string; standings: AFStandingGroup[][] } }>)[0]?.league;
    if (!league) throw new NotFoundError();
    return normaliseStandings(league.id, league.name, league.logo, league.standings);
  }

  async getLiveMatches(): Promise<{ matches: Match[] }> {
    const res = await fetchRaw<AFFixtureItem[]>('/fixtures?live=all');
    return { matches: (res.response as AFFixtureItem[]).map(normaliseMatch) };
  }
}
