/**
 * GET /api/debug/data18d1-integrity-audit
 *
 * DATA-18D.1 Phase 3 — tournament integrity audit.
 *
 * Reads every FINISHED WC 2026 match snapshot and validates:
 *   1. goalsMatchScore:    goals.length === score.fullTime.home + score.fullTime.away
 *   2. homeGoalsMatch:     goals filtered by homeTeam.id count === score.fullTime.home
 *   3. awayGoalsMatch:     goals filtered by awayTeam.id count === score.fullTime.away
 *   4. lineupPresent:      lineups.home.players.length > 0 && lineups.away.players.length > 0
 *   5. subsPresent:        substitutions.length > 0  (relaxed: warn if 0 for scored match)
 *   6. noGoalsMissing:     score > 0 → goals.length > 0
 *   7. snapshotPresent:    snapshot exists in KV
 *
 * Returns PASS / WARN / FAIL per match and an overall tournament verdict.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/data18d1-integrity-audit?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import type { Match }                from '@/lib/types';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

const FINISHED_FEED_KEY = 'goalradar:/competitions/WC/matches?status=FINISHED';

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

// ---------------------------------------------------------------------------
// Integrity result per match
// ---------------------------------------------------------------------------

type CheckResult = 'pass' | 'warn' | 'fail';

interface MatchIntegrity {
  matchId:        number;
  home:           string;
  away:           string;
  score:          string;
  scoreTotal:     number;
  snapshotAge:    number | null;
  checks: {
    snapshotPresent:  CheckResult;
    noGoalsMissing:   CheckResult;
    goalsMatchScore:  CheckResult;
    homeGoalsMatch:   CheckResult;
    awayGoalsMatch:   CheckResult;
    lineupPresent:    CheckResult;
    subsPresent:      CheckResult;
  };
  verdict: 'PASS' | 'WARN' | 'FAIL';
  failReasons: string[];
}

function checkResult(pass: boolean, warn?: boolean): CheckResult {
  if (pass) return 'pass';
  if (warn) return 'warn';
  return 'fail';
}

function auditSnapshot(
  snap: MatchSnapshot,
  feedMatch: Match,
  now: number,
): MatchIntegrity {
  const m      = snap.match;
  const ftH    = m.score?.fullTime?.home ?? 0;
  const ftA    = m.score?.fullTime?.away ?? 0;
  const total  = ftH + ftA;
  const goals  = m.goals ?? [];

  const homeId = m.homeTeam?.id ?? feedMatch.homeTeam?.id ?? 0;
  const awayId = m.awayTeam?.id ?? feedMatch.awayTeam?.id ?? 0;

  // Count goals by team, accounting for own-goal attribution
  // Own goals (type='OWN_GOAL') scored by home team count for away and vice versa
  let homeGoalCount = 0;
  let awayGoalCount = 0;
  for (const g of goals) {
    const isHomeTeam = g.team?.id === homeId;
    const isOwnGoal  = g.type === 'OWN_GOAL';
    if (isHomeTeam && !isOwnGoal) homeGoalCount++;
    else if (!isHomeTeam && !isOwnGoal) awayGoalCount++;
    else if (isHomeTeam && isOwnGoal) awayGoalCount++; // home own goal → away
    else if (!isHomeTeam && isOwnGoal) homeGoalCount++; // away own goal → home
  }

  const snapshotAgeHrs = Math.round((now - snap.generatedAt) / 3_600_000 * 10) / 10;

  const failReasons: string[] = [];

  // Check 1: noGoalsMissing — scored match must have goal events
  const noGoalsMissing = total === 0 || goals.length > 0;
  if (!noGoalsMissing) failReasons.push(`score=${total} but goals.length=0`);

  // Check 2: goalsMatchScore — total goal events must equal total score
  const goalsMatchScore = goals.length === total;
  if (!goalsMatchScore && total > 0) failReasons.push(`goals.length=${goals.length} ≠ scoreTotal=${total}`);

  // Check 3: homeGoalsMatch
  const homeGoalsMatch = homeGoalCount === ftH;
  if (!homeGoalsMatch && ftH > 0 && goals.length > 0)
    failReasons.push(`home goals counted=${homeGoalCount} ≠ ftH=${ftH}`);

  // Check 4: awayGoalsMatch
  const awayGoalsMatch = awayGoalCount === ftA;
  if (!awayGoalsMatch && ftA > 0 && goals.length > 0)
    failReasons.push(`away goals counted=${awayGoalCount} ≠ ftA=${ftA}`);

  // Check 5: lineupPresent
  const hasLineup = (m.lineups?.home?.players?.length ?? 0) > 0 &&
                    (m.lineups?.away?.players?.length ?? 0) > 0;
  if (!hasLineup) failReasons.push('lineups missing');

  // Check 6: subsPresent — warn only (0 subs is theoretically possible but very unusual)
  const hasSubs = (m.substitutions?.length ?? 0) > 0;
  if (!hasSubs && total > 0) failReasons.push('substitutions=0 for scored match (warn)');

  const checks = {
    snapshotPresent: 'pass' as CheckResult,
    noGoalsMissing:  checkResult(noGoalsMissing),
    goalsMatchScore: checkResult(goalsMatchScore, total === 0), // 0-0 draws always pass
    homeGoalsMatch:  checkResult(homeGoalsMatch || goals.length === 0 || ftH === 0, false),
    awayGoalsMatch:  checkResult(awayGoalsMatch || goals.length === 0 || ftA === 0, false),
    lineupPresent:   checkResult(hasLineup),
    subsPresent:     hasSubs ? 'pass' : (total > 0 ? 'warn' : 'pass') as CheckResult,
  };

  const hasFail = Object.values(checks).some(v => v === 'fail');
  const hasWarn = Object.values(checks).some(v => v === 'warn');
  const verdict: 'PASS' | 'WARN' | 'FAIL' = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS';

  return {
    matchId:    m.id ?? feedMatch.id,
    home:       m.homeTeam?.shortName || m.homeTeam?.name || feedMatch.homeTeam?.name || '?',
    away:       m.awayTeam?.shortName || m.awayTeam?.name || feedMatch.awayTeam?.name || '?',
    score:      `${ftH}–${ftA}`,
    scoreTotal: total,
    snapshotAge: snapshotAgeHrs,
    checks,
    verdict,
    failReasons,
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now = Date.now();

  // ── 1. Read finished matches from dynamic KV feed ─────────────────────────
  const feedEntry = await kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY);
  if (!feedEntry) {
    return NextResponse.json({
      error: 'FINISHED feed not in KV',
      kvKey: FINISHED_FEED_KEY,
    }, { status: 503 });
  }

  const finishedMatches = (feedEntry.data?.matches ?? []).filter(m => m.status === 'FINISHED');
  const feedAgeHours    = Math.round((now - feedEntry.fetchedAt) / 3_600_000 * 10) / 10;

  // ── 2. Batch-read all snapshots ───────────────────────────────────────────
  const snapshots = await Promise.allSettled(
    finishedMatches.map(m => kv.get<MatchSnapshot>(`goalradar:match:${m.id}`)),
  );

  const results: MatchIntegrity[] = [];

  for (let i = 0; i < finishedMatches.length; i++) {
    const feedMatch = finishedMatches[i];
    const res       = snapshots[i];

    if (res.status === 'rejected' || !res.value) {
      const ftH = feedMatch.score?.fullTime?.home ?? 0;
      const ftA = feedMatch.score?.fullTime?.away ?? 0;
      results.push({
        matchId:    feedMatch.id,
        home:       feedMatch.homeTeam?.shortName || feedMatch.homeTeam?.name || '?',
        away:       feedMatch.awayTeam?.shortName || feedMatch.awayTeam?.name || '?',
        score:      `${ftH}–${ftA}`,
        scoreTotal: ftH + ftA,
        snapshotAge: null,
        checks: {
          snapshotPresent: 'fail',
          noGoalsMissing:  'fail',
          goalsMatchScore: 'fail',
          homeGoalsMatch:  'fail',
          awayGoalsMatch:  'fail',
          lineupPresent:   'fail',
          subsPresent:     'fail',
        },
        verdict:     'FAIL',
        failReasons: ['snapshot missing from KV'],
      });
      continue;
    }

    results.push(auditSnapshot(res.value, feedMatch, now));
  }

  const passCount = results.filter(r => r.verdict === 'PASS').length;
  const warnCount = results.filter(r => r.verdict === 'WARN').length;
  const failCount = results.filter(r => r.verdict === 'FAIL').length;

  const overallVerdict: 'PASS' | 'WARN' | 'FAIL' =
    failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS';

  const failedMatches = results.filter(r => r.verdict === 'FAIL');
  const warnMatches   = results.filter(r => r.verdict === 'WARN');

  return NextResponse.json({
    auditedAt:       new Date(now).toISOString(),
    feedAgeHours,
    totalMatches:    finishedMatches.length,
    pass:            passCount,
    warn:            warnCount,
    fail:            failCount,
    overallVerdict,
    failedMatches:   failedMatches.map(r => ({ matchId: r.matchId, home: r.home, away: r.away, score: r.score, reasons: r.failReasons })),
    warnMatches:     warnMatches.map(r => ({ matchId: r.matchId, home: r.home, away: r.away, score: r.score, reasons: r.failReasons })),
    matches:         results,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
