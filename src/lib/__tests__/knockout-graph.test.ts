/**
 * Unit tests for buildKnockoutGraph() — the explicit knockout DAG.
 *
 * The regression these lock in: the authority numbers knockout matches in
 * SCHEDULE order, which is not their bracket geography. A semi-final can pair
 * the winners of two quarter-finals whose ids are non-adjacent, so ordering by
 * id/date/array-index draws a match between the wrong parents. The graph must
 * derive every parent link ONLY from winning-team identity (played rounds) or
 * "Winner <round> M<n>" labels (upcoming rounds) — never from ordering.
 *
 * Scenario mirrors the production screenshot case exactly, including the
 * "crossing" QF id order (Spain/Belgium id < Norway/England id).
 */

import { buildKnockoutGraph, type KnockoutStage } from '../knockout-vm';
import type { Match, MatchStatus, Score, Team } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPETITION: Match['competition'] = {
  id: 2000, name: 'FIFA World Cup', code: 'WC', type: 'CUP', emblem: '',
  area: { id: 2267, name: 'World', code: 'WLD', flag: null },
};

let teamSeq = 100;
const team = (name: string): Team => ({
  id: ++teamSeq, name, shortName: name, tla: name.slice(0, 3).toUpperCase(), crest: '',
});

// Placeholder "team" for an upcoming slot — id 0, name is the slot label.
const placeholder = (label: string): Team => ({ id: 0, name: label, shortName: label, tla: '', crest: '' });

function ko(
  id: number,
  stage: KnockoutStage,
  home: Team,
  away: Team,
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | null,
): Match {
  const finished = winner !== null;
  const score: Score = {
    winner,
    duration: 'REGULAR',
    fullTime: finished ? { home: winner === 'HOME_TEAM' ? 2 : 0, away: winner === 'AWAY_TEAM' ? 2 : 0 } : { home: null, away: null },
    halfTime: { home: null, away: null },
  };
  return {
    id,
    utcDate: '2026-07-01T18:00:00Z',
    status: (finished ? 'FINISHED' : 'SCHEDULED') as MatchStatus,
    matchday: null,
    stage,
    group: null,
    lastUpdated: '2026-07-01T20:00:00.000Z',
    competition: COMPETITION,
    homeTeam: home,
    awayTeam: away,
    score,
    minute: null,
  };
}

// Teams
const Paraguay = team('Paraguay'), France = team('France');
const Canada = team('Canada'), Morocco = team('Morocco');
const Brazil = team('Brazil'), Norway = team('Norway');
const Mexico = team('Mexico'), England = team('England');
const Portugal = team('Portugal'), Spain = team('Spain');
const USA = team('United States'), Belgium = team('Belgium');
const Argentina = team('Argentina'), Egypt = team('Egypt');
const Switzerland = team('Switzerland'), Colombia = team('Colombia');

/**
 * Round of 16 (all finished). Winners: France, Morocco, Norway, England,
 * Spain, Belgium, Argentina, Switzerland.
 */
const R16: Match[] = [
  ko(1, 'LAST_16', Paraguay, France, 'AWAY_TEAM'),    // M1 → France
  ko(2, 'LAST_16', Canada, Morocco, 'AWAY_TEAM'),     // M2 → Morocco
  ko(3, 'LAST_16', Brazil, Norway, 'AWAY_TEAM'),      // M3 → Norway
  ko(4, 'LAST_16', Mexico, England, 'AWAY_TEAM'),     // M4 → England
  ko(5, 'LAST_16', Portugal, Spain, 'AWAY_TEAM'),     // M5 → Spain
  ko(6, 'LAST_16', USA, Belgium, 'AWAY_TEAM'),        // M6 → Belgium
  ko(7, 'LAST_16', Argentina, Egypt, 'HOME_TEAM'),    // M7 → Argentina
  ko(8, 'LAST_16', Switzerland, Colombia, 'HOME_TEAM'), // M8 → Switzerland
];

/**
 * Quarter-finals — ids in the authority's CROSSING schedule order:
 * Spain/Belgium (id 12) precedes Norway/England (id 13) even though
 * Norway/England's parents (R16 M3,M4) come before Spain/Belgium's (M5,M6).
 * France/Morocco & Spain/Belgium are finished; the other half is upcoming.
 */
const QF: Match[] = [
  ko(11, 'QUARTER_FINALS', France, Morocco, 'HOME_TEAM'),   // ← R16 M1,M2
  ko(12, 'QUARTER_FINALS', Spain, Belgium, 'HOME_TEAM'),    // ← R16 M5,M6
  ko(13, 'QUARTER_FINALS', Norway, England, null),          // ← R16 M3,M4 (upcoming)
  ko(14, 'QUARTER_FINALS', Argentina, Switzerland, null),   // ← R16 M7,M8 (upcoming)
];

// Semi-finals: top half decided (France vs Spain), bottom half is a placeholder.
const SF: Match[] = [
  ko(21, 'SEMI_FINALS', France, Spain, null),                       // ← QF winners France, Spain
  ko(22, 'SEMI_FINALS', placeholder('Winner QF3'), placeholder('Winner QF4'), null),
];

const FINAL: Match[] = [
  ko(31, 'FINAL', placeholder('Winner SF1'), placeholder('Winner SF2'), null),
];

const ALL = [...R16, ...QF, ...SF, ...FINAL];
const ROUNDS: KnockoutStage[] = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildKnockoutGraph — parent linkage from identity, not order', () => {
  const graph = buildKnockoutGraph(ALL, ROUNDS);
  const qf = graph.nodes['QUARTER_FINALS'];
  const byId = new Map(ROUNDS.flatMap((r) => graph.nodes[r]).map((n) => [n.matchId, n]));

  it('reconstructs a complete, valid DAG', () => {
    expect(graph.complete).toBe(true);
    expect(graph.valid).toBe(true);
    expect(graph.issues).toEqual([]);
  });

  it('feeds Brazil/Norway + Mexico/England into the Norway vs England QF (the screenshot case)', () => {
    const norwayEngland = qf.find((n) => n.matchId === 13)!;
    const parents = [norwayEngland.leftParentMatchId, norwayEngland.rightParentMatchId].sort();
    expect(parents).toEqual([3, 4]); // R16 Brazil/Norway (3) + Mexico/England (4)
    expect(norwayEngland.homeTeam).toBe('Norway');
    expect(norwayEngland.awayTeam).toBe('England');
  });

  it('does NOT put Spain/Belgium in the Brazil-Norway / Mexico-England branch', () => {
    const spainBelgium = qf.find((n) => n.matchId === 12)!;
    const parents = [spainBelgium.leftParentMatchId, spainBelgium.rightParentMatchId].sort();
    expect(parents).toEqual([5, 6]); // Portugal/Spain (5) + USA/Belgium (6)
    // its parents' teams must be Portugal/Spain and USA/Belgium, never Brazil/Mexico
    const parentTeams = parents.flatMap((p) => [byId.get(p)!.homeTeam, byId.get(p)!.awayTeam]);
    expect(parentTeams).toEqual(expect.arrayContaining(['Portugal', 'Spain', 'United States', 'Belgium']));
    expect(parentTeams).not.toContain('Brazil');
    expect(parentTeams).not.toContain('Mexico');
  });

  it('every QF participant is exactly the winners of its two RO16 parents', () => {
    for (const n of qf) {
      const L = byId.get(n.leftParentMatchId!)!;
      const R = byId.get(n.rightParentMatchId!)!;
      expect(L.stage).toBe('LAST_16');
      expect(R.stage).toBe('LAST_16');
      const expected = new Set([L.winnerTeamId, R.winnerTeamId]);
      expect(expected.has(n.homeTeamId)).toBe(true);
      expect(expected.has(n.awayTeamId)).toBe(true);
    }
  });

  it('resolves an upcoming round via "Winner QF3/QF4" placeholder labels', () => {
    const sf2 = graph.nodes['SEMI_FINALS'].find((n) => n.matchId === 22)!;
    const parents = [sf2.leftParentMatchId, sf2.rightParentMatchId].sort();
    expect(parents).toEqual([13, 14]); // QF Norway/England (13) + Argentina/Switzerland (14)
    expect(sf2.leftParentSource).toBe('placeholder-label');
  });

  it('links the decided semi-final via winning-team identity', () => {
    const sf1 = graph.nodes['SEMI_FINALS'].find((n) => n.matchId === 21)!;
    const parents = [sf1.leftParentMatchId, sf1.rightParentMatchId].sort();
    expect(parents).toEqual([11, 12]); // QF France/Morocco (11) + Spain/Belgium (12)
    expect(sf1.leftParentSource).toBe('winner-identity');
  });

  it('orders the R16 column by bracket geometry, not by match id', () => {
    // Naive id order would be [1,2,3,4,5,6,7,8]. Correct geometry interleaves the
    // halves so QF France/Morocco + Spain/Belgium (SF top half) come first:
    //   [1,2, 5,6, 3,4, 7,8]  → Brazil/Norway (3) & Mexico/England (4) at slots 4,5,
    //   directly feeding the Norway vs England QF at slot 2.
    expect(graph.order['LAST_16']).toEqual([1, 2, 5, 6, 3, 4, 7, 8]);
  });
});

describe('buildKnockoutGraph — flags incoherent data instead of hiding it', () => {
  it('reports PARENT_UNRESOLVED when a participant descends from no parent match', () => {
    const Ghost = team('Ghostland'); // never played/won an R16 match
    const corrupted = ALL.map((m) =>
      m.id === 13 ? ko(13, 'QUARTER_FINALS', Ghost, England, null) : m,
    );
    const graph = buildKnockoutGraph(corrupted, ROUNDS);
    const unresolved = graph.issues.filter((i) => i.code === 'PARENT_UNRESOLVED');
    expect(graph.valid).toBe(false);
    expect(unresolved.some((i) => i.matchId === 13)).toBe(true);
  });
});
