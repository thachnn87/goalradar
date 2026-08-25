/**
 * wc-frozen-view.ts — presentation adapter for the frozen WC-2026 dataset.
 * EPIC-WC-FROZEN-DATA-001 Phase 2C.
 *
 * Converts the FIFA-derived frozen dataset (src/data/wc-2026-frozen/dataset.json,
 * via wc-frozen-dataset.ts) into the exact shapes the historical WC-2026 surfaces
 * already consume:
 *   - CanonicalMatch[]   (as getWCAuthorityMatchesV2().matches)
 *   - StandingTable[]     (as getStandingsCached('WC').standings, type TOTAL)
 *   - team roster + per-country presentation meta (flag, confederation)
 *
 * This lets each page swap ONLY its data source behind the WC_2026_HISTORICAL_AVAILABLE
 * gate — the JSX renders real FIFA data unchanged. NO synthetic data (WC_ALL_TEAMS,
 * wc-fixtures, A2/DR seed, provider) is read here.
 *
 * Country meta (flag emoji + confederation) is stable public reference data keyed
 * by the FIFA 3-letter code — NOT a tournament-result claim. It is presentation
 * only; the tournament FACTS (teams, groups, matches, scores, standings, bracket,
 * champion) come entirely from the frozen FIFA dataset.
 */

import type { CanonicalMatch, IntegrityResult } from './canonical-match';
import type { Match, Score, StandingTable, StandingEntry, Team } from './types';
import {
  FROZEN_WC_2026_DATASET,
  FROZEN_WC_2026_MANIFEST,
  type FrozenDataset,
  type FrozenMatch,
  type FrozenTeam,
} from './wc-frozen-dataset';
import { canonicalToMatch } from './canonical-match';

const DATA: FrozenDataset = FROZEN_WC_2026_DATASET;
const BUILT_AT = String((FROZEN_WC_2026_MANIFEST as Record<string, unknown>).captureTimestamp ?? '2026-08-24T15:45:03Z');

export type Confederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';

/** FIFA 3-letter code → flag emoji + confederation. Stable public facts, presentation only. */
export const WC_COUNTRY_META: Record<string, { flag: string; confederation: Confederation }> = {
  ALG: { flag: '🇩🇿', confederation: 'CAF' },
  ARG: { flag: '🇦🇷', confederation: 'CONMEBOL' },
  AUS: { flag: '🇦🇺', confederation: 'AFC' },
  AUT: { flag: '🇦🇹', confederation: 'UEFA' },
  BEL: { flag: '🇧🇪', confederation: 'UEFA' },
  BIH: { flag: '🇧🇦', confederation: 'UEFA' },
  BRA: { flag: '🇧🇷', confederation: 'CONMEBOL' },
  CAN: { flag: '🇨🇦', confederation: 'CONCACAF' },
  CIV: { flag: '🇨🇮', confederation: 'CAF' },
  COD: { flag: '🇨🇩', confederation: 'CAF' },
  COL: { flag: '🇨🇴', confederation: 'CONMEBOL' },
  CPV: { flag: '🇨🇻', confederation: 'CAF' },
  CRO: { flag: '🇭🇷', confederation: 'UEFA' },
  CUW: { flag: '🇨🇼', confederation: 'CONCACAF' },
  CZE: { flag: '🇨🇿', confederation: 'UEFA' },
  ECU: { flag: '🇪🇨', confederation: 'CONMEBOL' },
  EGY: { flag: '🇪🇬', confederation: 'CAF' },
  ENG: { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA' },
  ESP: { flag: '🇪🇸', confederation: 'UEFA' },
  FRA: { flag: '🇫🇷', confederation: 'UEFA' },
  GER: { flag: '🇩🇪', confederation: 'UEFA' },
  GHA: { flag: '🇬🇭', confederation: 'CAF' },
  HAI: { flag: '🇭🇹', confederation: 'CONCACAF' },
  IRN: { flag: '🇮🇷', confederation: 'AFC' },
  IRQ: { flag: '🇮🇶', confederation: 'AFC' },
  JOR: { flag: '🇯🇴', confederation: 'AFC' },
  JPN: { flag: '🇯🇵', confederation: 'AFC' },
  KOR: { flag: '🇰🇷', confederation: 'AFC' },
  KSA: { flag: '🇸🇦', confederation: 'AFC' },
  MAR: { flag: '🇲🇦', confederation: 'CAF' },
  MEX: { flag: '🇲🇽', confederation: 'CONCACAF' },
  NED: { flag: '🇳🇱', confederation: 'UEFA' },
  NOR: { flag: '🇳🇴', confederation: 'UEFA' },
  NZL: { flag: '🇳🇿', confederation: 'OFC' },
  PAN: { flag: '🇵🇦', confederation: 'CONCACAF' },
  PAR: { flag: '🇵🇾', confederation: 'CONMEBOL' },
  POR: { flag: '🇵🇹', confederation: 'UEFA' },
  QAT: { flag: '🇶🇦', confederation: 'AFC' },
  RSA: { flag: '🇿🇦', confederation: 'CAF' },
  SCO: { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA' },
  SEN: { flag: '🇸🇳', confederation: 'CAF' },
  SUI: { flag: '🇨🇭', confederation: 'UEFA' },
  SWE: { flag: '🇸🇪', confederation: 'UEFA' },
  TUN: { flag: '🇹🇳', confederation: 'CAF' },
  TUR: { flag: '🇹🇷', confederation: 'UEFA' },
  URU: { flag: '🇺🇾', confederation: 'CONMEBOL' },
  USA: { flag: '🇺🇸', confederation: 'CONCACAF' },
  UZB: { flag: '🇺🇿', confederation: 'AFC' },
};

export function countryMeta(idCountry: string): { flag: string; confederation: Confederation | null } {
  return WC_COUNTRY_META[idCountry] ?? { flag: '🏳️', confederation: null };
}

// ---------------------------------------------------------------------------
// Team helpers
// ---------------------------------------------------------------------------

/** Enriched frozen team (dataset fields + presentation meta). */
export interface FrozenTeamView extends FrozenTeam {
  flag: string;
  confederation: Confederation | null;
}

export function frozenTeams(): FrozenTeamView[] {
  return DATA.teams.map((t) => {
    const meta = countryMeta(t.idCountry);
    return { ...t, flag: meta.flag, confederation: meta.confederation };
  });
}

export function frozenTeamBySlug(slug: string): FrozenTeamView | undefined {
  return frozenTeams().find((t) => t.slug === slug);
}

export function frozenTeamSlugs(): string[] {
  return DATA.teams.map((t) => t.slug);
}

/** slug ↔ idTeam lookups so surfaces can resolve links from either side. */
export function frozenSlugByTeamId(idTeam: string): string | undefined {
  return DATA.teams.find((t) => t.idTeam === idTeam)?.slug;
}

function toTeam(idTeam: string, name: string, abbreviation: string): Team {
  return {
    id: Number(idTeam),
    name,
    shortName: name,
    tla: abbreviation ?? '',
    crest: '',
  };
}

// ---------------------------------------------------------------------------
// Matches → CanonicalMatch[]
// ---------------------------------------------------------------------------

const OK_INTEGRITY: IntegrityResult = { status: 'ok', checks: [] };

function scoreOf(m: FrozenMatch): Score {
  const winner: Score['winner'] =
    m.winner == null
      ? (m.homeScore === m.awayScore ? 'DRAW' : m.homeScore > m.awayScore ? 'HOME_TEAM' : 'AWAY_TEAM')
      : m.winner === m.home.idTeam
        ? 'HOME_TEAM'
        : m.winner === m.away.idTeam
          ? 'AWAY_TEAM'
          : 'DRAW';
  // Only claim a shootout when penalties are present. Never assert AET without evidence.
  const duration: Score['duration'] =
    (m.homePenalty != null || m.awayPenalty != null) ? 'PENALTY_SHOOTOUT' : 'REGULAR';
  return {
    winner,
    duration,
    fullTime: { home: m.homeScore, away: m.awayScore },
    halfTime: { home: null, away: null },
  };
}

function toCanonical(m: FrozenMatch): CanonicalMatch {
  return {
    id: Number(m.idMatch),
    fdMatchId: Number(m.idMatch),
    competitionCode: 'WC',
    utcDate: m.dateUtc,
    state: 'finished',
    homeTeam: toTeam(m.home.idTeam, m.home.name, m.home.abbreviation),
    awayTeam: toTeam(m.away.idTeam, m.away.name, m.away.abbreviation),
    score: scoreOf(m),
    goals: [],
    cards: [],
    substitutions: [],
    venue: m.venue?.name ?? null,
    referee: null,
    source: { fdBulkFeed: 'all', builtAt: BUILT_AT },
    lastUpdated: BUILT_AT,
    enrichmentApplied: false,
    enrichmentAttempted: false,
    integrity: OK_INTEGRITY,
    matchday: null,
    stage: m.stage,
    group: m.group ? `GROUP_${m.group}` : null,
  };
}

/** All 104 frozen matches as CanonicalMatch[] (every match FINISHED, real scores). */
export function frozenCanonicalMatches(): CanonicalMatch[] {
  return DATA.matches.map(toCanonical);
}

/** Raw frozen match by numeric FIFA id (Number(idMatch)). */
export function frozenMatchById(id: number): FrozenMatch | undefined {
  return DATA.matches.find((m) => Number(m.idMatch) === id);
}

/** All 104 frozen matches as Match[] (via the one canonical adapter). */
export function frozenMatches(): Match[] {
  return frozenCanonicalMatches().map(canonicalToMatch);
}

// ---------------------------------------------------------------------------
// Standings → StandingTable[]
// ---------------------------------------------------------------------------

/** 12 group tables (type TOTAL, group 'GROUP_A'…'GROUP_L') derived from FIFA results. */
export function frozenStandings(): StandingTable[] {
  return DATA.standings.map((grp) => ({
    stage: 'GROUP_STAGE',
    type: 'TOTAL',
    group: `GROUP_${grp.group}`,
    table: grp.table.map<StandingEntry>((r) => ({
      position: r.position,
      team: toTeam(r.idTeam, r.name, ''),
      playedGames: r.P,
      form: null,
      won: r.W,
      draw: r.D,
      lost: r.L,
      points: r.Pts,
      goalsFor: r.GF,
      goalsAgainst: r.GA,
      goalDifference: r.GD,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Champion / tournament summary
// ---------------------------------------------------------------------------

export function frozenChampion() {
  return DATA.champion;
}

export function frozenTournamentMeta() {
  return DATA.tournament;
}

export function frozenVenues() {
  return DATA.venues;
}
