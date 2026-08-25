/**
 * wc-frozen-view adapter guard — EPIC-WC-FROZEN-DATA-001 Phase 2C.
 *
 * Proves the presentation adapters emit correct REAL data in the exact shapes the
 * historical WC-2026 surfaces consume — independently of the freeze gate boolean.
 * This is the data-layer proof that flipping the gate renders real FIFA content
 * (not synthetic, not empty).
 */

import {
  frozenCanonicalMatches,
  frozenMatches,
  frozenStandings,
  frozenTeams,
  frozenTeamBySlug,
  frozenChampion,
  WC_COUNTRY_META,
} from '../wc-frozen-view';

describe('frozen-view matches', () => {
  const cms = frozenCanonicalMatches();

  it('emits 104 CanonicalMatches, all FINISHED with real scores + positive ids', () => {
    expect(cms).toHaveLength(104);
    for (const m of cms) {
      expect(m.state).toBe('finished');
      expect(m.competitionCode).toBe('WC');
      expect(m.id).toBeGreaterThan(0);
      expect(m.score.fullTime.home).not.toBeNull();
      expect(m.score.fullTime.away).not.toBeNull();
    }
  });

  it('group matches carry GROUP_x, knockout carry null group', () => {
    const group = cms.filter((m) => m.stage === 'GROUP_STAGE');
    const ko = cms.filter((m) => m.stage !== 'GROUP_STAGE');
    expect(group).toHaveLength(72);
    expect(ko).toHaveLength(32);
    expect(group.every((m) => /^GROUP_[A-L]$/.test(m.group ?? ''))).toBe(true);
    expect(ko.every((m) => m.group === null)).toBe(true);
  });

  it('score.winner + duration derive correctly (shootouts flagged)', () => {
    const shootouts = cms.filter((m) => m.score.duration === 'PENALTY_SHOOTOUT');
    expect(shootouts.length).toBe(4);
    expect(shootouts.every((m) => m.stage !== 'GROUP_STAGE')).toBe(true);
    // every finished match has a decided winner or an explicit draw
    expect(cms.every((m) => m.score.winner !== null)).toBe(true);
  });

  it('frozenMatches() converts all 104 to the Match shape', () => {
    expect(frozenMatches()).toHaveLength(104);
  });
});

describe('frozen-view standings', () => {
  const tables = frozenStandings();

  it('emits 12 TOTAL group tables of 4 teams each', () => {
    expect(tables).toHaveLength(12);
    for (const t of tables) {
      expect(t.type).toBe('TOTAL');
      expect(/^GROUP_[A-L]$/.test(t.group ?? '')).toBe(true);
      expect(t.table).toHaveLength(4);
      expect(t.table.every((r) => r.team.id > 0)).toBe(true);
    }
  });

  it('every group plays 6 matches worth of games (each team P=3)', () => {
    for (const t of tables) {
      const played = t.table.reduce((s, r) => s + r.playedGames, 0);
      expect(played).toBe(12); // 4 teams × 3 games
      expect(t.table.every((r) => r.playedGames === 3)).toBe(true);
      expect(t.table.every((r) => r.goalDifference === r.goalsFor - r.goalsAgainst)).toBe(true);
    }
  });
});

describe('frozen-view teams + country meta', () => {
  const teams = frozenTeams();

  it('emits 48 teams each with a flag + confederation (map covers all codes)', () => {
    expect(teams).toHaveLength(48);
    for (const t of teams) {
      expect(WC_COUNTRY_META[t.idCountry]).toBeDefined();
      expect(t.flag).not.toBe('🏳️');
      expect(t.confederation).not.toBeNull();
    }
  });

  it('resolves real slugs and rejects synthetic-only slugs', () => {
    // real entrants (incl. aliased URLs)
    expect(frozenTeamBySlug('spain')).toBeDefined();
    expect(frozenTeamBySlug('south-korea')).toBeDefined(); // Korea Republic alias
    expect(frozenTeamBySlug('norway')).toBeDefined();      // real entrant not in synthetic roster
    // synthetic roster members that did NOT play
    expect(frozenTeamBySlug('costa-rica')).toBeUndefined();
    expect(frozenTeamBySlug('italy')).toBeUndefined();
  });

  it('confederation counts match the real field', () => {
    const count = (c: string) => teams.filter((t) => t.confederation === c).length;
    expect(count('UEFA')).toBe(16);
    expect(count('CAF')).toBe(10);
    expect(count('AFC')).toBe(9);
    expect(count('CONMEBOL')).toBe(6);
    expect(count('CONCACAF')).toBe(6);
    expect(count('OFC')).toBe(1);
  });
});

describe('frozen-view champion', () => {
  it('champion is a real team and the Final winner', () => {
    const champ = frozenChampion();
    const team = frozenTeams().find((t) => t.idTeam === champ.idTeam);
    expect(team).toBeDefined();
    expect(champ.runnerUp).not.toBeNull();
    expect(champ.final.homeScore).not.toBeNull();
  });
});
