/**
 * WC-2026 frozen dataset — CANDIDATE loader + validator (EPIC-WC-FROZEN-DATA-001 Phase 2B).
 *
 * This module loads and validates the FIFA-derived frozen WC-2026 dataset
 * (src/data/wc-2026-frozen/{dataset,manifest}.json). The dataset was captured
 * from the authoritative FIFA record via the FIFA-owned public API
 * (api.fifa.com/api/v3), normalized, reconciled against WC_ALL_TEAMS, and
 * validated. No synthetic GoalRadar data (WC_ALL_TEAMS / wc-fixtures / A2 / DR /
 * provider cache) enters this dataset — see manifest.sourceDiffs.
 *
 * ⚠️  GATE STATUS: this is a VALIDATED CANDIDATE, not yet SIGNED_OFF / FROZEN.
 *     It is intentionally NOT wired into wc-frozen.ts::getFrozenWCTournament(),
 *     which still returns null (WC_2026_HISTORICAL_AVAILABLE === false). Wiring
 *     it in — flipping the production gate — requires the recorded Business +
 *     Historical-Authority sign-off (DGP-001 G8). Until then, historical WC-2026
 *     surfaces stay honestly "unavailable". Do NOT flip the gate without sign-off.
 *
 * The accompanying test (wc-frozen-dataset.test.ts) locks the dataset's counts,
 * integrity, and checksum in CI so the candidate cannot silently drift.
 */

import { createHash } from 'crypto';
import datasetJson from '../data/wc-2026-frozen/dataset.json';
import manifestJson from '../data/wc-2026-frozen/manifest.json';

// ---------------------------------------------------------------------------
// Types (mirror dataset.json — FIFA-derived, independent of WC_ALL_TEAMS)
// ---------------------------------------------------------------------------

export interface FrozenTeam {
  idTeam: string;
  name: string;
  abbreviation: string;
  idCountry: string;
  slug: string;
  group: string;
}

export interface FrozenMatchSide {
  idTeam: string;
  name: string;
  abbreviation: string;
}

export interface FrozenVenue {
  idStadium: string;
  name: string;
  city: string;
  country: string;
}

export interface FrozenMatch {
  idMatch: string;
  matchNumber: number;
  stage: string;
  stageName: string;
  group: string | null;
  dateUtc: string;
  localDate: string;
  status: string;
  resultType: number;
  home: FrozenMatchSide;
  away: FrozenMatchSide;
  homeScore: number;
  awayScore: number;
  homePenalty: number | null;
  awayPenalty: number | null;
  winner: string | null;
  venue: FrozenVenue | null;
}

export interface FrozenStandingRow {
  idTeam: string;
  name: string;
  P: number; W: number; D: number; L: number;
  GF: number; GA: number; GD: number; Pts: number;
  position: number;
}

export interface FrozenDataset {
  datasetId: string;
  version: string;
  schemaVersion: number;
  tournament: {
    competitionId: string;
    seasonId: string;
    name: string;
    year: number;
    hostCountries: string[];
  };
  teams: FrozenTeam[];
  groups: Record<string, string[]>;
  matches: FrozenMatch[];
  standings: Array<{ group: string; table: FrozenStandingRow[] }>;
  knockout: Array<{ stage: string; matches: string[] }>;
  champion: {
    idTeam: string;
    name: string;
    runnerUp: { idTeam: string; name: string } | null;
    third: { idTeam: string; name: string } | null;
    final: {
      idMatch: string;
      homeScore: number;
      awayScore: number;
      homePenalty: number | null;
      awayPenalty: number | null;
    };
  };
  venues: FrozenVenue[];
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/** The validated WC-2026@v1 frozen dataset candidate (FIFA-derived). */
export const FROZEN_WC_2026_DATASET = datasetJson as unknown as FrozenDataset;

/** The candidate manifest (provenance, checksums, counts, sign-off status). */
export const FROZEN_WC_2026_MANIFEST = manifestJson as unknown as {
  datasetId: string;
  version: string;
  status: { captured: boolean; validated: boolean; signedOff: boolean; frozen: boolean; note: string };
  checksum: { algorithm: string; dataset: string; rawMatchesResponse: string; rawStagesResponse: string };
  counts: Record<string, number>;
  signOff: { status: string; required: string[]; approvals: unknown[]; note: string };
  [k: string]: unknown;
};

// ---------------------------------------------------------------------------
// Deterministic checksum (must match scripts/build canonicalisation exactly)
// ---------------------------------------------------------------------------

/** Recursive key-sorted canonical JSON — the input to the sha256 checksum. */
export function canonicalise(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalise).join(',') + ']';
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return '{' + Object.keys(obj).sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalise(obj[k]))
      .join(',') + '}';
  }
  return JSON.stringify(value);
}

/** sha256 over the canonical representation. Deterministic + reproducible. */
export function computeFrozenChecksum(dataset: FrozenDataset): string {
  return createHash('sha256').update(canonicalise(dataset)).digest('hex');
}

// ---------------------------------------------------------------------------
// Validator — the 22 tournament-integrity invariants + checksum
// ---------------------------------------------------------------------------

export interface FrozenCheck { id: string; pass: boolean; detail: string; }
export interface FrozenValidation { passed: number; failed: number; checks: FrozenCheck[]; }

const KO_ORDER = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'] as const;
const KO_EXPECTED: Record<string, number> = {
  LAST_32: 16, LAST_16: 8, QUARTER_FINALS: 4, SEMI_FINALS: 2, THIRD_PLACE: 1, FINAL: 1,
};

/**
 * Validate the frozen dataset against all tournament-integrity invariants.
 * Pure — no IO beyond the already-imported dataset. Returns structured results
 * so the CI test can assert `failed === 0` and print any discrepancy.
 */
export function validateFrozenDataset(d: FrozenDataset): FrozenValidation {
  const checks: FrozenCheck[] = [];
  const add = (id: string, pass: boolean, detail = '') => checks.push({ id, pass, detail });

  const groupLetters = Object.keys(d.groups).sort();
  const stage = (s: string) => d.matches.filter((m) => m.stage === s);
  const teamIds = new Set(d.teams.map((t) => t.idTeam));

  add('teams_48', d.teams.length === 48, `teams=${d.teams.length}`);
  add('groups_12', groupLetters.length === 12 && groupLetters.join('') === 'ABCDEFGHIJKL', groupLetters.join(','));
  add('four_per_group', groupLetters.every((g) => d.groups[g].length === 4), '');
  add('teams_group_field_4', groupLetters.every((g) => d.teams.filter((t) => t.group === g).length === 4), '');
  add('matches_104', d.matches.length === 104, `matches=${d.matches.length}`);
  add('group_72', stage('GROUP_STAGE').length === 72, `group=${stage('GROUP_STAGE').length}`);
  add('knockout_32', d.matches.filter((m) => m.stage !== 'GROUP_STAGE').length === 32, '');
  add('ko_distribution', KO_ORDER.every((s) => stage(s).length === KO_EXPECTED[s]),
    KO_ORDER.map((s) => `${s}=${stage(s).length}`).join(' '));
  add('six_per_group', groupLetters.every((g) => stage('GROUP_STAGE').filter((m) => m.group === g).length === 6), '');

  const ids = d.matches.map((m) => m.idMatch);
  add('no_duplicate_ids', new Set(ids).size === ids.length, '');
  add('no_synthetic_negative_ids', ids.every((id) => /^\d+$/.test(id) && Number(id) > 0), 'all positive numeric FIFA ids');

  const participants = new Set<string>();
  d.matches.forEach((m) => { participants.add(m.home.idTeam); participants.add(m.away.idTeam); });
  add('no_orphan_participant', [...participants].every((id) => teamIds.has(id)), '');
  add('no_orphan_team', [...teamIds].every((id) => participants.has(id)), '');

  add('all_finished', d.matches.every((m) => m.status === 'FINISHED'), '');
  add('all_scores_present', d.matches.every((m) => m.homeScore != null && m.awayScore != null), '');

  // chronology
  const t = (m: FrozenMatch) => new Date(m.dateUtc).getTime();
  add('chrono_group_before_ko',
    Math.max(...stage('GROUP_STAGE').map(t)) <= Math.min(...stage('LAST_32').map(t)), '');
  add('chrono_sf_before_final',
    Math.max(...stage('SEMI_FINALS').map(t)) < t(stage('FINAL')[0]), '');

  // knockout progression reconciliation via Winner
  const winners = (s: string) => stage(s).map((m) => m.winner).filter(Boolean) as string[];
  const teamsIn = (s: string) => { const set = new Set<string>(); stage(s).forEach((m) => { set.add(m.home.idTeam); set.add(m.away.idTeam); }); return set; };
  const reconcile = (prev: string, next: string) => {
    const w = new Set(winners(prev)); const p = teamsIn(next);
    return p.size === w.size && [...p].every((id) => w.has(id));
  };
  add('r32_from_groups', teamsIn('LAST_32').size === 32 && [...teamsIn('LAST_32')].every((id) => teamIds.has(id)), '');
  add('r16_are_r32_winners', reconcile('LAST_32', 'LAST_16'), '');
  add('qf_are_r16_winners', reconcile('LAST_16', 'QUARTER_FINALS'), '');
  add('sf_are_qf_winners', reconcile('QUARTER_FINALS', 'SEMI_FINALS'), '');

  const sfTeams = [...teamsIn('SEMI_FINALS')];
  const sfWinners = winners('SEMI_FINALS');
  const sfLosers = sfTeams.filter((id) => !sfWinners.includes(id));
  const final = stage('FINAL')[0];
  const bronze = stage('THIRD_PLACE')[0];
  const finalists = new Set([final.home.idTeam, final.away.idTeam]);
  const bronzePair = new Set([bronze.home.idTeam, bronze.away.idTeam]);
  add('final_from_sf_winners', finalists.size === 2 && sfWinners.every((id) => finalists.has(id)), '');
  add('bronze_from_sf_losers', bronzePair.size === 2 && sfLosers.every((id) => bronzePair.has(id)), '');
  add('champion_is_final_winner',
    !!final.winner && final.winner === d.champion.idTeam && finalists.has(d.champion.idTeam),
    `champion=${d.champion.name}`);

  // venues
  const venueIds = new Set<string>();
  d.matches.forEach((m) => { if (m.venue) venueIds.add(m.venue.idStadium); });
  add('venues_16', venueIds.size === 16 && d.venues.length === 16, `venues=${venueIds.size}`);
  add('all_matches_have_venue', d.matches.every((m) => m.venue && m.venue.name), '');

  // penalties only in knockout
  add('penalties_only_knockout',
    d.matches.filter((m) => m.homePenalty != null || m.awayPenalty != null).every((m) => m.stage !== 'GROUP_STAGE'), '');

  // standings reconcile with results (recompute from matches, compare stats)
  const recomputed: Record<string, Record<string, { P: number; Pts: number; GF: number; GA: number }>> = {};
  for (const g of groupLetters) { recomputed[g] = {}; for (const id of d.groups[g]) recomputed[g][id] = { P: 0, Pts: 0, GF: 0, GA: 0 }; }
  for (const m of stage('GROUP_STAGE')) {
    const r = recomputed[m.group as string];
    const h = r[m.home.idTeam]; const a = r[m.away.idTeam];
    h.P++; a.P++; h.GF += m.homeScore; h.GA += m.awayScore; a.GF += m.awayScore; a.GA += m.homeScore;
    if (m.homeScore > m.awayScore) h.Pts += 3;
    else if (m.homeScore < m.awayScore) a.Pts += 3;
    else { h.Pts++; a.Pts++; }
  }
  let standingsOk = true;
  for (const grp of d.standings) {
    for (const row of grp.table) {
      const rc = recomputed[grp.group][row.idTeam];
      if (!rc || rc.P !== row.P || rc.Pts !== row.Pts || rc.GF !== row.GF || rc.GA !== row.GA || row.GD !== row.GF - row.GA) standingsOk = false;
    }
  }
  add('standings_reconcile_results', standingsOk, '');

  // top-2 of every group advanced + exactly 8 thirds advanced
  const r32 = teamsIn('LAST_32');
  const top2Advanced = d.standings.every((grp) => grp.table.slice(0, 2).every((r) => r32.has(r.idTeam)));
  const thirdsAdvanced = d.standings.filter((grp) => r32.has(grp.table[2].idTeam)).length;
  add('top2_advanced', top2Advanced, '');
  add('eight_thirds_advanced', thirdsAdvanced === 8, `thirds=${thirdsAdvanced}`);

  const failed = checks.filter((c) => !c.pass).length;
  return { passed: checks.length - failed, failed, checks };
}
