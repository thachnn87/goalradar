/**
 * DATA-18B: Unit tests for buildCanonicalMatch() and validateCanonicalMatch().
 *
 * Tests run in Node.js (jest + ts-jest, testEnvironment: 'node').
 * buildCanonicalMatch() is pure — no KV reads, no network calls.
 * All inputs are mocked inline.
 *
 * Coverage:
 *   State resolution  — all combinations of fdStatus × snapStatus × liveEntry
 *   Score preference  — snapshot newer → snapshot wins; FD newer → FD wins
 *   C2 integrity      — unreconciled team ID → degraded
 *   C3 integrity      — null score on FINISHED → degraded
 *   Enrichment flags  — enrichmentApplied, enrichmentAttempted
 */

import { buildCanonicalMatch, validateCanonicalMatch } from '../canonical-match';
import type { CanonicalMatch, LiveEntry } from '../canonical-match';
import type { Match, MatchDetail, Score } from '../types';
import type { MatchSnapshot } from '../match-snapshot';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const BASE_SCORE: Score = {
  winner: null,
  duration: 'REGULAR',
  fullTime:  { home: null, away: null },
  halfTime:  { home: null, away: null },
};

const FINISHED_SCORE: Score = {
  winner: 'HOME_TEAM',
  duration: 'REGULAR',
  fullTime:  { home: 3, away: 0 },
  halfTime:  { home: 1, away: 0 },
};

const HOME_TEAM = { id: 100, name: 'Home FC', shortName: 'Home', tla: 'HOM', crest: '' };
const AWAY_TEAM = { id: 200, name: 'Away FC', shortName: 'Away', tla: 'AWY', crest: '' };

function makeFdMatch(overrides: Partial<Match> = {}): Match {
  return {
    id:              537397,
    utcDate:         '2026-06-15T15:00:00Z',
    status:          'SCHEDULED',
    matchday:        1,
    stage:           'GROUP_STAGE',
    group:           'GROUP_A',
    lastUpdated:     '2026-06-10T10:00:00.000Z',
    minute:          undefined,
    competition:     { id: 2000, name: 'FIFA World Cup 2026', code: 'WC', type: 'CUP', emblem: '', area: { id: 2001, name: 'World', code: 'WLD', flag: null } },
    homeTeam:        HOME_TEAM,
    awayTeam:        AWAY_TEAM,
    score:           BASE_SCORE,
    ...overrides,
  };
}

function makeMatchDetail(overrides: Partial<MatchDetail> = {}): MatchDetail {
  return {
    ...makeFdMatch(),
    goals:          [],
    bookings:       [],
    substitutions:  [],
    lineups:        [],
    venue:          'Test Stadium',
    referees:       [],
    ...overrides,
  } as MatchDetail;
}

function makeSnapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    match:         makeMatchDetail(),
    headToHead:    null,
    standings:     null,
    wcGroupMatches: [],
    wcAllMatches:  [],
    generatedAt:   new Date('2026-06-15T16:00:00Z').getTime(), // 1h after FD lastUpdated
    ...overrides,
  };
}

const BUILT_AT = '2026-06-15T17:00:00.000Z';

// ---------------------------------------------------------------------------
// State resolution tests
// ---------------------------------------------------------------------------

describe('buildCanonicalMatch — state resolution', () => {

  test('SCHEDULED fd → state scheduled', () => {
    const m = buildCanonicalMatch(makeFdMatch({ status: 'SCHEDULED' }), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m.state).toBe('scheduled');
  });

  test('TIMED fd → state scheduled', () => {
    const m = buildCanonicalMatch(makeFdMatch({ status: 'TIMED' }), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m.state).toBe('scheduled');
  });

  test('FINISHED fd → state finished', () => {
    const m = buildCanonicalMatch(makeFdMatch({ status: 'FINISHED', score: FINISHED_SCORE }), 'results', null, null, undefined, BUILT_AT);
    expect(m.state).toBe('finished');
  });

  test('IN_PLAY fd → state live', () => {
    const m = buildCanonicalMatch(makeFdMatch({ status: 'IN_PLAY', minute: 45 }), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m.state).toBe('live');
  });

  test('PAUSED fd → state live', () => {
    const m = buildCanonicalMatch(makeFdMatch({ status: 'PAUSED' }), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m.state).toBe('live');
  });

  test('POSTPONED fd → state cancelled', () => {
    const m = buildCanonicalMatch(makeFdMatch({ status: 'POSTPONED' }), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m.state).toBe('cancelled');
  });

  test('CANCELLED fd → state cancelled', () => {
    const m = buildCanonicalMatch(makeFdMatch({ status: 'CANCELLED' }), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m.state).toBe('cancelled');
  });

  test('SUSPENDED fd → state cancelled', () => {
    const m = buildCanonicalMatch(makeFdMatch({ status: 'SUSPENDED' }), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m.state).toBe('cancelled');
  });

  test('snapshot advances SCHEDULED → FINISHED', () => {
    const snap = makeSnapshot({
      match: makeMatchDetail({ status: 'FINISHED', score: FINISHED_SCORE }),
    });
    const m = buildCanonicalMatch(makeFdMatch({ status: 'SCHEDULED' }), 'scheduled', snap, null, undefined, BUILT_AT);
    expect(m.state).toBe('finished');
  });

  test('live entry advances SCHEDULED → live', () => {
    const liveEntry: LiveEntry = { status: 'IN_PLAY', minute: 67 };
    const m = buildCanonicalMatch(makeFdMatch({ status: 'SCHEDULED' }), 'scheduled', null, liveEntry, undefined, BUILT_AT);
    expect(m.state).toBe('live');
    expect(m.minute).toBe(67);
  });

  test('live entry does NOT downgrade FINISHED → live', () => {
    const finishedMatch = makeFdMatch({ status: 'FINISHED', score: FINISHED_SCORE });
    const liveEntry: LiveEntry = { status: 'IN_PLAY', minute: 90 };
    const m = buildCanonicalMatch(finishedMatch, 'results', null, liveEntry, undefined, BUILT_AT);
    // FINISHED rank=3 > IN_PLAY rank=2 → live entry is ignored
    expect(m.state).toBe('finished');
  });

  test('live entry wins over SCHEDULED snapshot', () => {
    const snap = makeSnapshot({
      match: makeMatchDetail({ status: 'SCHEDULED' }),
    });
    const liveEntry: LiveEntry = { status: 'IN_PLAY', minute: 30 };
    const m = buildCanonicalMatch(makeFdMatch({ status: 'SCHEDULED' }), 'scheduled', snap, liveEntry, undefined, BUILT_AT);
    expect(m.state).toBe('live');
    expect(m.minute).toBe(30);
  });

});

// ---------------------------------------------------------------------------
// Score preference tests (B1 fix)
// ---------------------------------------------------------------------------

describe('buildCanonicalMatch — score preference', () => {

  test('snapshot newer than FD → snapshot score wins for FINISHED', () => {
    const fdLastUpdated = '2026-06-15T14:00:00.000Z'; // older
    const snapGeneratedAt = new Date('2026-06-15T16:00:00Z').getTime(); // newer

    const snapScore: Score = {
      winner: 'AWAY_TEAM',
      duration: 'REGULAR',
      fullTime:  { home: 1, away: 2 },
      halfTime:  { home: 0, away: 1 },
    };
    const fdScore: Score = {
      winner: 'HOME_TEAM',
      duration: 'REGULAR',
      fullTime:  { home: 3, away: 0 }, // FD would be "corrected" to this value
      halfTime:  { home: 1, away: 0 },
    };

    const snap = makeSnapshot({
      generatedAt: snapGeneratedAt,
      match: makeMatchDetail({ status: 'FINISHED', score: snapScore, lastUpdated: fdLastUpdated }),
    });
    const fdMatch = makeFdMatch({ status: 'FINISHED', score: fdScore, lastUpdated: fdLastUpdated });

    const m = buildCanonicalMatch(fdMatch, 'results', snap, null, undefined, BUILT_AT);
    expect(m.score.fullTime.home).toBe(1);
    expect(m.score.fullTime.away).toBe(2);
  });

  test('FD newer than snapshot → FD score wins for FINISHED (B1 regression guard)', () => {
    const fdLastUpdated    = '2026-06-15T18:00:00.000Z'; // newer (FD corrected the score)
    const snapGeneratedAt  = new Date('2026-06-15T16:00:00Z').getTime(); // older snapshot

    const snapScore: Score = {
      winner: 'AWAY_TEAM',
      duration: 'REGULAR',
      fullTime:  { home: 1, away: 2 },  // stale snapshot score
      halfTime:  { home: 0, away: 1 },
    };
    const fdScore: Score = {
      winner: 'HOME_TEAM',
      duration: 'REGULAR',
      fullTime:  { home: 3, away: 0 },  // corrected FD score
      halfTime:  { home: 1, away: 0 },
    };

    const snap = makeSnapshot({
      generatedAt: snapGeneratedAt,
      match: makeMatchDetail({ status: 'FINISHED', score: snapScore }),
    });
    const fdMatch = makeFdMatch({ status: 'FINISHED', score: fdScore, lastUpdated: fdLastUpdated });

    const m = buildCanonicalMatch(fdMatch, 'results', snap, null, undefined, BUILT_AT);
    expect(m.score.fullTime.home).toBe(3);
    expect(m.score.fullTime.away).toBe(0);
  });

  test('snapshot score not used for non-FINISHED match', () => {
    const snapScore: Score = {
      winner: null,
      duration: 'REGULAR',
      fullTime:  { home: 2, away: 1 },
      halfTime:  { home: 1, away: 0 },
    };
    const snap = makeSnapshot({
      generatedAt: Date.now() + 100_000, // newer
      match: makeMatchDetail({ status: 'IN_PLAY', score: snapScore }),
    });
    const fdMatch = makeFdMatch({ status: 'IN_PLAY', score: BASE_SCORE });

    const m = buildCanonicalMatch(fdMatch, 'scheduled', snap, null, undefined, BUILT_AT);
    // resolvedStatus is IN_PLAY — score preference block requires resolvedStatus===FINISHED
    expect(m.score.fullTime.home).toBeNull();
  });

});

// ---------------------------------------------------------------------------
// Integrity validation tests
// ---------------------------------------------------------------------------

describe('validateCanonicalMatch', () => {

  function makePartial(overrides: Partial<Omit<CanonicalMatch, 'integrity'>> = {}): Omit<CanonicalMatch, 'integrity'> {
    return {
      id:              537397,
      fdMatchId:       537397,
      espnMatchId:     undefined,
      competitionCode: 'WC',
      utcDate:         '2026-06-15T15:00:00Z',
      state:           'finished',
      minute:          undefined,
      homeTeam:        HOME_TEAM,
      awayTeam:        AWAY_TEAM,
      score:           FINISHED_SCORE,
      goals:           [],
      cards:           [],
      substitutions:   [],
      venue:           null,
      referee:         null,
      source:          { fdBulkFeed: 'results', builtAt: BUILT_AT },
      lastUpdated:     BUILT_AT,
      enrichmentApplied:   false,
      enrichmentAttempted: false,
      matchday:        1,
      stage:           'GROUP_STAGE',
      group:           'GROUP_A',
      ...overrides,
    };
  }

  test('C3: FINISHED with null score → degraded', () => {
    const partial = makePartial({
      state: 'finished',
      score: { ...BASE_SCORE },
    });
    const result = validateCanonicalMatch(partial);
    expect(result.status).toBe('degraded');
    expect(result.checks.find(c => c.id === 'C3_SCORE_NULL')?.result).toBe('fail');
  });

  test('C3: FINISHED with valid score → C3 passes', () => {
    const partial = makePartial({ state: 'finished', score: FINISHED_SCORE });
    const result = validateCanonicalMatch(partial);
    expect(result.checks.find(c => c.id === 'C3_SCORE_NULL')?.result).toBe('pass');
  });

  test('C3: scheduled with null score → C3 passes (not required for upcoming)', () => {
    const partial = makePartial({ state: 'scheduled', score: BASE_SCORE });
    const result = validateCanonicalMatch(partial);
    expect(result.checks.find(c => c.id === 'C3_SCORE_NULL')?.result).toBe('pass');
  });

  test('C2: goal with unreconciled team ID → degraded', () => {
    const partial = makePartial({
      state: 'finished',
      score: FINISHED_SCORE,
      goals: [
        {
          minute:   45,
          type:     'NORMAL',
          team:     { id: 999, name: 'Unknown Team', shortName: 'Unk', tla: 'UNK', crest: '' },
          scorer:   { id: 1, name: 'Scorer' },
          assist:   null,
        } as unknown as import('../types').Goal,
      ],
    });
    const result = validateCanonicalMatch(partial);
    expect(result.status).toBe('degraded');
    expect(result.checks.find(c => c.id === 'C2_TEAM_ID')?.result).toBe('fail');
  });

  test('C2: goal with reconciled home team ID → passes', () => {
    const partial = makePartial({
      state: 'finished',
      score: FINISHED_SCORE,
      goals: [
        {
          minute:   45,
          type:     'NORMAL',
          team:     HOME_TEAM,
          scorer:   { id: 1, name: 'Scorer' },
          assist:   null,
        } as unknown as import('../types').Goal,
      ],
    });
    const result = validateCanonicalMatch(partial);
    expect(result.checks.find(c => c.id === 'C2_TEAM_ID')?.result).toBe('pass');
  });

  test('all checks pass → status ok', () => {
    const partial = makePartial({ state: 'finished', score: FINISHED_SCORE });
    const result = validateCanonicalMatch(partial);
    expect(result.status).toBe('ok');
  });

});

// ---------------------------------------------------------------------------
// Enrichment flag tests
// ---------------------------------------------------------------------------

describe('buildCanonicalMatch — enrichment flags', () => {

  test('no snapshot → enrichmentAttempted=false, enrichmentApplied=false', () => {
    const m = buildCanonicalMatch(makeFdMatch(), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m.enrichmentAttempted).toBe(false);
    expect(m.enrichmentApplied).toBe(false);
  });

  test('snapshot with no events → enrichmentAttempted=true, enrichmentApplied=false', () => {
    const snap = makeSnapshot({ match: makeMatchDetail({ goals: [], bookings: [], substitutions: [] }) });
    const m = buildCanonicalMatch(makeFdMatch(), 'scheduled', snap, null, undefined, BUILT_AT);
    expect(m.enrichmentAttempted).toBe(true);
    expect(m.enrichmentApplied).toBe(false);
  });

  test('snapshot with goals → enrichmentAttempted=true, enrichmentApplied=true', () => {
    const snap = makeSnapshot({
      match: makeMatchDetail({
        status: 'FINISHED',
        score: FINISHED_SCORE,
        goals: [
          { minute: 10, type: 'NORMAL', team: HOME_TEAM, scorer: { id: 1, name: 'Scorer' }, assist: null } as unknown as import('../types').Goal,
        ],
      }),
    });
    const m = buildCanonicalMatch(
      makeFdMatch({ status: 'FINISHED', score: FINISHED_SCORE }),
      'results',
      snap,
      null,
      undefined,
      BUILT_AT,
    );
    expect(m.enrichmentAttempted).toBe(true);
    expect(m.enrichmentApplied).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// Provenance tests
// ---------------------------------------------------------------------------

describe('buildCanonicalMatch — provenance', () => {

  test('source.fdBulkFeed reflects the passed fdFeed param', () => {
    const m1 = buildCanonicalMatch(makeFdMatch({ status: 'SCHEDULED' }), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m1.source.fdBulkFeed).toBe('scheduled');

    const m2 = buildCanonicalMatch(makeFdMatch({ status: 'FINISHED', score: FINISHED_SCORE }), 'results', null, null, undefined, BUILT_AT);
    expect(m2.source.fdBulkFeed).toBe('results');
  });

  test('espnMatchId is stored on CanonicalMatch', () => {
    const m = buildCanonicalMatch(makeFdMatch(), 'scheduled', null, null, 'espn-abc-123', BUILT_AT);
    expect(m.espnMatchId).toBe('espn-abc-123');
  });

  test('builtAt matches the passed-in timestamp', () => {
    const m = buildCanonicalMatch(makeFdMatch(), 'scheduled', null, null, undefined, BUILT_AT);
    expect(m.source.builtAt).toBe(BUILT_AT);
  });

});
