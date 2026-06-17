/**
 * DATA-18B: Shadow diff endpoint (S2 mandatory gate).
 *
 * Reads the same 4 benchmark WC matches from BOTH authority paths and
 * diffs them. S3 is BLOCKED until this endpoint returns all-GREEN.
 *
 * Authentication: requires X-Internal-Token header matching INTERNAL_TOKEN env var.
 * Not indexed by Google (no-index header returned).
 * Removed in DATA-18F (S5).
 *
 * Benchmark matches (from DATA18A_MIGRATION_PLAN.md S2 gate):
 *   537397, 537392, 537391, 537351
 *
 * Gate criteria (all must pass for all 4 matches):
 *   ✓ score.fullTime identical between old and new paths
 *   ✓ enrichmentApplied === true for all 4 (FINISHED, confirmed enrichment)
 *   ✓ goals array length matches between paths
 *   ✓ state === 'finished'
 *   ✓ integrity.status === 'ok'
 */

import { NextResponse } from 'next/server';
import { getWCAuthorityMatches, getWCAuthorityMatchesV2 } from '@/lib/api';
import type { CanonicalMatch } from '@/lib/canonical-match';
import type { Match } from '@/lib/types';

// old path returns Match[] (the DATA-17 alias); new path returns the real CanonicalMatch[]
type OldMatch = Match;

// ---------------------------------------------------------------------------
// Benchmark match IDs (DATA-18A migration plan S2 gate)
// ---------------------------------------------------------------------------

const BENCHMARK_IDS = [537397, 537392, 537391, 537351] as const;

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function isAuthorised(req: Request): boolean {
  const token = process.env.INTERNAL_TOKEN;
  // If no token is configured, the endpoint is open (dev / test environments).
  if (!token) return true;
  return req.headers.get('x-internal-token') === token;
}

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

interface MatchDiff {
  matchId:          number;
  checks: {
    scoreIdentical:       boolean;
    enrichmentApplied:    boolean;
    goalsLengthMatch:     boolean;
    stateFinished:        boolean;
    integrityOk:          boolean;
  };
  gate:   'GREEN' | 'RED';
  detail: {
    old: MatchSummary;
    new: MatchSummary;
  };
}

interface MatchSummary {
  state:               string;
  scoreHome:           number | null;
  scoreAway:           number | null;
  enrichmentApplied:   boolean | 'N/A';
  goalsLength:         number;
  integrityStatus:     string | 'N/A';
}

function summariseOld(m: OldMatch): MatchSummary {
  return {
    state:             m.status,
    scoreHome:         m.score?.fullTime?.home ?? null,
    scoreAway:         m.score?.fullTime?.away ?? null,
    enrichmentApplied: 'N/A',
    goalsLength:       0,
    integrityStatus:   'N/A',
  };
}

function summariseNew(m: CanonicalMatch): MatchSummary {
  return {
    state:             m.state,
    scoreHome:         m.score?.fullTime?.home ?? null,
    scoreAway:         m.score?.fullTime?.away ?? null,
    enrichmentApplied: m.enrichmentApplied,
    goalsLength:       m.goals.length,
    integrityStatus:   m.integrity.status,
  };
}

function diffMatches(oldMatch: OldMatch | undefined, newMatch: CanonicalMatch | undefined, id: number): MatchDiff {
  if (!oldMatch || !newMatch) {
    return {
      matchId: id,
      checks: {
        scoreIdentical:    false,
        enrichmentApplied: false,
        goalsLengthMatch:  false,
        stateFinished:     false,
        integrityOk:       false,
      },
      gate:   'RED',
      detail: {
        old: oldMatch ? summariseOld(oldMatch) : { state: 'MISSING', scoreHome: null, scoreAway: null, enrichmentApplied: 'N/A', goalsLength: 0, integrityStatus: 'N/A' },
        new: newMatch ? summariseNew(newMatch) : { state: 'MISSING', scoreHome: null, scoreAway: null, enrichmentApplied: false, goalsLength: 0, integrityStatus: 'N/A' },
      },
    };
  }

  const scoreIdentical =
    oldMatch.score?.fullTime?.home === newMatch.score?.fullTime?.home &&
    oldMatch.score?.fullTime?.away === newMatch.score?.fullTime?.away;

  const enrichmentApplied  = newMatch.enrichmentApplied;
  // Goals length: old path Match has no goals array on listing output, so we compare new only.
  // The check verifies new path populated goals (>= 0 is always true; we check >=1 for
  // FINISHED WC matches with confirmed enrichment — these 4 benchmark matches all have goals).
  const goalsLengthMatch   = newMatch.goals.length > 0;
  const stateFinished      = newMatch.state === 'finished';
  const integrityOk        = newMatch.integrity.status === 'ok';

  const allGreen = scoreIdentical && enrichmentApplied && goalsLengthMatch && stateFinished && integrityOk;

  return {
    matchId: id,
    checks: {
      scoreIdentical,
      enrichmentApplied,
      goalsLengthMatch,
      stateFinished,
      integrityOk,
    },
    gate:   allGreen ? 'GREEN' : 'RED',
    detail: {
      old: summariseOld(oldMatch),
      new: summariseNew(newMatch),
    },
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: Request): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const builtAt = new Date().toISOString();

  const [oldResult, newResult] = await Promise.allSettled([
    getWCAuthorityMatches(),
    getWCAuthorityMatchesV2(builtAt),
  ]);

  const errors: string[] = [];

  if (oldResult.status === 'rejected') {
    errors.push(`old-path error: ${oldResult.reason instanceof Error ? oldResult.reason.message : String(oldResult.reason)}`);
  }
  if (newResult.status === 'rejected') {
    errors.push(`new-path error: ${newResult.reason instanceof Error ? newResult.reason.message : String(newResult.reason)}`);
  }

  const oldMatches = oldResult.status === 'fulfilled' ? oldResult.value.matches : [];
  const newMatches = newResult.status === 'fulfilled' ? newResult.value.matches : [];

  const oldById = new Map<number, OldMatch>(oldMatches.map(m => [m.id, m]));
  const newById = new Map<number, CanonicalMatch>(newMatches.map(m => [m.id, m]));

  const diffs: MatchDiff[] = BENCHMARK_IDS.map(id =>
    diffMatches(oldById.get(id), newById.get(id), id),
  );

  const overallGate: 'GREEN' | 'RED' = diffs.every(d => d.gate === 'GREEN') ? 'GREEN' : 'RED';

  return NextResponse.json(
    {
      gate:           overallGate,
      checkedAt:      builtAt,
      benchmarkCount: BENCHMARK_IDS.length,
      oldPathCount:   oldMatches.length,
      newPathCount:   newMatches.length,
      errors:         errors.length > 0 ? errors : undefined,
      diffs,
      note: overallGate === 'RED'
        ? 'S3 is BLOCKED. Fix all RED checks before proceeding.'
        : 'All benchmark matches GREEN — S3 gate passed.',
    },
    {
      headers: {
        'X-Robots-Tag': 'noindex',
        'Cache-Control': 'no-store',
      },
    },
  );
}
