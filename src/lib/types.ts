export interface Area {
  id: number;
  name: string;
  code: string;
  flag: string | null;
}

export interface Competition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
  area: Area;
}

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface Score {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

export type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'SUSPENDED';

export interface Match {
  id: number;
  utcDate: string;
  status: MatchStatus;
  matchday: number | null;
  stage: string;
  group: string | null;
  lastUpdated: string;
  competition: Competition;
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
}

export interface StandingEntry {
  position: number;
  team: Team;
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface StandingTable {
  stage: string;
  type: string;
  group: string | null;
  table: StandingEntry[];
}

export interface Goal {
  minute: number;
  injuryTime: number | null;
  type: string;
  team: Team;
  scorer: { id: number; name: string };
  assist: { id: number; name: string } | null;
}

export interface Booking {
  minute: number;
  team: Team;
  player: { id: number; name: string };
  card: 'YELLOW' | 'RED' | 'YELLOW_RED';
}

export interface Substitution {
  minute: number;
  team: Team;
  playerOut: { id: number; name: string };
  playerIn: { id: number; name: string };
}

export interface Referee {
  id: number;
  name: string;
  type: string;
  nationality: string | null;
}

export interface MatchDetail extends Match {
  goals: Goal[];
  bookings: Booking[];
  substitutions: Substitution[];
  venue: string | null;
  referees: Referee[];
}

export interface TeamDetail {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  address: string | null;
  website: string | null;
  founded: number | null;
  clubColors: string | null;
  venue: string | null;
  area: Area;
  runningCompetitions: {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string;
  }[];
  coach: {
    id: number;
    firstName: string;
    lastName: string;
    nationality: string | null;
  } | null;
}

export interface H2HTeamStat {
  id: number;
  name: string;
  wins: number;
  draws: number;
  losses: number;
}

export interface HeadToHead {
  resultSet: {
    count: number;
    first: string;
    last: string;
    played: number;
  };
  aggregates: {
    numberOfMatches: number;
    totalGoals: number;
    homeTeam: H2HTeamStat;
    awayTeam: H2HTeamStat;
  };
  matches: Match[];
}

export const COMPETITIONS: { code: string; name: string; flag: string }[] = [
  { code: 'PL', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'PD', name: 'La Liga', flag: '🇪🇸' },
  { code: 'BL1', name: 'Bundesliga', flag: '🇩🇪' },
  { code: 'SA', name: 'Serie A', flag: '🇮🇹' },
  { code: 'FL1', name: 'Ligue 1', flag: '🇫🇷' },
  { code: 'CL', name: 'Champions League', flag: '🇪🇺' },
];
