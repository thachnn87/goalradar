/**
 * GET /api/debug/authority-drift
 *
 * DATA-18F Phase 2 — Authority Cache vs Match Snapshot drift detector.
 *
 * For every FINISHED WC match, compares:
 *   - score (fullTime home/away)
 *   - state  (authority) vs status (snapshot)
 *   - enrichmentApplied
 *   - goals count
 *   - lineup presence (snapshot only — authority cache excludes lineups by design)
 *
 * Returns:
 *   { green, yellow, red, total, driftMatches[] }
 *
 * Severity:
 *   GREEN  — authority and snapshot agree on all checked fields
 *   YELLOW — enrichment or goals mismatch only (data correct, enrichment drift)
 *   RED    — score mismatch OR snapshot missing (critical — user-visible error)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/authority-drift?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { readAuthorityCache }        from '@/lib/authority-cache';
import type { CanonicalMatch }       from '@/lib/canonical-match';
import type { MatchSnapshot }        from '@/lib/match-snapshot';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

// ---------------------------------------------------------------------------
// Drift result types
// ---------------------------------------------------------------------------

type DriftSeverity = 'GREEN' | 'YELLOW' | 'RED';

interface DriftMatch {
  matchId:          number;
  home:             string;
  away:             string;
  score:            string;
  severity:         DriftSeverity;
  drifts: {
    scoreDrift:           boolean;
    stateDrift:           boolean;
    enrichmentDrift:      boolean;
    goalsCountDrift:      boolean;
    lineupMissing:        boolean;
    snapshotMissing:      boolean;
  };
  detail: {
    authority: AuthoritySummary;
    snapshot:  SnapshotSummary | null;
  };
}

interface AuthoritySummary {
  state:             string;
  scoreHome:         number | null;
  scoreAway:         number | null;
  enrichmentApplied: boolean;
  goalsCount:        number;
}

interface SnapshotSummary {
  status:            string;
  scoreHome:         number | null;
  scoreAway:         number | null;
  enrichmentApplied: boolean | 'N/A';
  goalsCount:        number;
  lineupPresent:     boolean;
  snapshotAgeHours:  number;
}

// ---------------------------------------------------------------------------
// State normaliser — CanonicalMatch.state → comparable bucket
// ---------------------------------------------------------------------------

function stateFromStatus(status: string): string {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live';
  if (status === 'FINISHED') return 'finished';
  if (status === 'SCHEDULED' || status === 'TIMED') return 'scheduled';
  return 'cancelled';
}

// ---------------------------------------------------------------------------
// Differ
// ---------------------------------------------------------------------------

function diffMatch(
  auth:    CanonicalMatch,
  snap:    MatchSnapshot | null,
  now:     number,
): DriftMatch {
  const authSummary: AuthoritySummary = {
    state:             auth.state,
    scoreHome:         auth.score?.fullTime?.home ?? null,
    scoreAway:         auth.score?.fullTime?.away ?? null,
    enrichmentApplied: auth.enrichmentApplied,
    goalsCount:        auth.goals?.length ?? 0,
  };

  if (!snap) {
    return {
      matchId:  auth.id,
      home:     auth.homeTeam?.name ?? '?',
      away:     auth.awayTeam?.name ?? '?',
      score:    `${authSummary.scoreHome ?? '?'}–${authSummary.scoreAway ?? '?'}`,
      severity: 'RED',
      drifts: {
        scoreDrift:       true,
        stateDrift:       true,
        enrichmentDrift:  true,
        goalsCountDrift:  true,
        lineupMissing:    true,
        snapshotMissing:  true,
      },
      detail: { authority: authSummary, snapshot: null },
    };
  }

  const m          = snap.match;
  const snapStatus = stateFromStatus(m.status ?? '');
  const snapHome   = m.score?.fullTime?.home ?? null;
  const snapAway   = m.score?.fullTime?.away ?? null;
  const snapGoals  = (m.goals ?? []).length;
  const snapEnrich = (m as { enrichmentApplied?: boolean }).enrichmentApplied ?? 'N/A';
  const lineupOk   = (m.lineups?.home?.players?.length ?? 0) > 0 &&
                     (m.lineups?.away?.players?.length ?? 0) > 0;
  const ageHours   = Math.round((now - snap.generatedAt) / 3_600_000 * 10) / 10;

  const snapSummary: SnapshotSummary = {
    status:            snapStatus,
    scoreHome:         snapHome,
    scoreAway:         snapAway,
    enrichmentApplied: snapEnrich,
    goalsCount:        snapGoals,
    lineupPresent:     lineupOk,
    snapshotAgeHours:  ageHours,
  };

  const scoreDrift      = snapHome !== authSummary.scoreHome || snapAway !== authSummary.scoreAway;
  const stateDrift      = snapStatus !== auth.state;
  const enrichDrift     = snapEnrich !== 'N/A' && snapEnrich !== auth.enrichmentApplied;
  const goalsDrift      = snapGoals !== authSummary.goalsCount;
  const lineupMissing   = !lineupOk;

  // Severity: RED if score or snapshot missing; YELLOW if enrichment/goals/lineup only; GREEN if none
  const severity: DriftSeverity =
    scoreDrift || stateDrift ? 'RED'
    : enrichDrift || goalsDrift || lineupMissing ? 'YELLOW'
    : 'GREEN';

  return {
    matchId:  auth.id,
    home:     auth.homeTeam?.name ?? m.homeTeam?.name ?? '?',
    away:     auth.awayTeam?.name ?? m.awayTeam?.name ?? '?',
    score:    `${authSummary.scoreHome ?? '?'}–${authSummary.scoreAway ?? '?'}`,
    severity,
    drifts: {
      scoreDrift,
      stateDrift,
      enrichmentDrift:  enrichDrift,
      goalsCountDrift:  goalsDrift,
      lineupMissing,
      snapshotMissing:  false,
    },
    detail: { authority: authSummary, snapshot: snapSummary },
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now     = Date.now();
  const builtAt = new Date(now).toISOString();

  // ── 1. Read authority cache ────────────────────────────────────────────────
  let allMatches: CanonicalMatch[];
  try {
    allMatches = await readAuthorityCache(builtAt, { source: '/api/debug/authority-drift', sourceType: 'debug' });
  } catch (err) {
    return NextResponse.json({
      error: `Authority cache read failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 503 });
  }

  const finished = allMatches.filter(m => m.state === 'finished');

  // ── 2. Batch-read all match snapshots ─────────────────────────────────────
  const snapResults = await Promise.allSettled(
    finished.map(m => kv.get<MatchSnapshot>(`goalradar:match:${m.id}`)),
  );

  // ── 3. Diff each pair ─────────────────────────────────────────────────────
  const driftResults: DriftMatch[] = finished.map((auth, i) => {
    const res  = snapResults[i];
    const snap = res.status === 'fulfilled' ? res.value : null;
    return diffMatch(auth, snap, now);
  });

  const green  = driftResults.filter(d => d.severity === 'GREEN').length;
  const yellow = driftResults.filter(d => d.severity === 'YELLOW').length;
  const red    = driftResults.filter(d => d.severity === 'RED').length;

  const driftMatches = driftResults.filter(d => d.severity !== 'GREEN');

  return NextResponse.json(
    {
      checkedAt:    builtAt,
      total:        finished.length,
      green,
      yellow,
      red,
      verdict:      red > 0 ? 'RED' : yellow > 0 ? 'YELLOW' : 'GREEN',
      driftMatches,
      note: red > 0
        ? `${red} RED match(es) — score or state drift detected. Immediate repair required.`
        : yellow > 0
        ? `${yellow} YELLOW match(es) — enrichment/lineup drift only. Non-critical.`
        : `All ${green} finished matches GREEN. No drift detected.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
