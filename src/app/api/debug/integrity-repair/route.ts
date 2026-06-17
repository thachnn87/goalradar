/**
 * GET /api/debug/integrity-repair
 *
 * DATA-18D.1 Phase 4 — automatic self-healing endpoint.
 *
 * Reads every FINISHED WC 2026 match snapshot, detects integrity failures,
 * and repairs them automatically. Idempotent — safe to re-run.
 *
 * Detection criteria:
 *   GOALS_MISSING:    score > 0 && goals.length === 0
 *   GOALS_MISMATCH:   goals.length !== ftHome + ftAway (and match is scored)
 *   LINEUP_MISSING:   lineups absent for a FINISHED match
 *   SUBS_MISSING:     substitutions.length === 0 for a scored FINISHED match
 *   DR_POISONED:      DR has score > 0 && goals.length === 0 (primary may be healthy)
 *   SNAPSHOT_MISSING: no snapshot in KV for a FINISHED match
 *
 * Repair action: delete primary + DR, then call getOrBuildMatchSnapshot()
 * which rebuilds from FD detail + AF enrichment. Single repair action covers
 * all failure modes. Processed in batches of 3 to avoid overwhelming AF API.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Usage (dry run — detect only, no writes):
 *   curl "https://www.goalradar.org/api/debug/integrity-repair?secret=$S&dryRun=true"
 *
 * Usage (repair):
 *   curl "https://www.goalradar.org/api/debug/integrity-repair?secret=$S"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { getOrBuildMatchSnapshot }   from '@/lib/match-snapshot';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import type { Match }                from '@/lib/types';

export const dynamic     = 'force-dynamic';
export const maxDuration = 300;

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
// Failure types
// ---------------------------------------------------------------------------

type FailureType =
  | 'GOALS_MISSING'
  | 'GOALS_MISMATCH'
  | 'LINEUP_MISSING'
  | 'SUBS_MISSING'
  | 'DR_POISONED'
  | 'SNAPSHOT_MISSING';

interface MatchFailure {
  matchId:   number;
  failures:  FailureType[];
}

interface RepairResult {
  matchId:      number;
  failures:     FailureType[];
  status:       'repaired' | 'failed' | 'dry-run';
  goalsAfter:   number | null;
  lineupAfter:  boolean | null;
  subsAfter:    number | null;
  rebuildMs:    number | null;
  error?:       string;
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function detectFailures(snap: MatchSnapshot | null, drSnap: MatchSnapshot | null): FailureType[] {
  const failures: FailureType[] = [];

  if (!snap) {
    failures.push('SNAPSHOT_MISSING');
    return failures;
  }

  const m    = snap.match;
  const ftH  = m.score?.fullTime?.home ?? 0;
  const ftA  = m.score?.fullTime?.away ?? 0;
  const total = ftH + ftA;
  const goals = m.goals?.length ?? 0;

  if (total > 0 && goals === 0)       failures.push('GOALS_MISSING');
  if (total > 0 && goals > 0 && goals !== total) failures.push('GOALS_MISMATCH');
  if (!(m.lineups?.home?.players?.length))       failures.push('LINEUP_MISSING');
  if (total > 0 && (m.substitutions?.length ?? 0) === 0) failures.push('SUBS_MISSING');

  if (drSnap) {
    const drH    = drSnap.match.score?.fullTime?.home ?? 0;
    const drA    = drSnap.match.score?.fullTime?.away ?? 0;
    const drGoals = drSnap.match.goals?.length ?? 0;
    if ((drH + drA) > 0 && drGoals === 0) failures.push('DR_POISONED');
  }

  return failures;
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

  const url    = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const now    = Date.now();

  // ── 1. Read finished matches ───────────────────────────────────────────────
  const feedEntry = await kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY);
  if (!feedEntry) {
    return NextResponse.json({ error: 'FINISHED feed not in KV', kvKey: FINISHED_FEED_KEY }, { status: 503 });
  }

  const finishedMatches = (feedEntry.data?.matches ?? []).filter(m => m.status === 'FINISHED');

  // ── 2. Batch-read primary + DR snapshots ──────────────────────────────────
  const [primarySnaps, drSnaps] = await Promise.all([
    Promise.allSettled(
      finishedMatches.map(m => kv.get<MatchSnapshot>(`goalradar:match:${m.id}`)),
    ),
    Promise.allSettled(
      finishedMatches.map(m => kv.get<MatchSnapshot>(`goalradar:dr:match:${m.id}`)),
    ),
  ]);

  // ── 3. Detect failures ────────────────────────────────────────────────────
  const toRepair: MatchFailure[] = [];

  for (let i = 0; i < finishedMatches.length; i++) {
    const id      = finishedMatches[i].id;
    const primary = primarySnaps[i].status === 'fulfilled' ? (primarySnaps[i] as PromiseFulfilledResult<MatchSnapshot | null>).value : null;
    const dr      = drSnaps[i].status      === 'fulfilled' ? (drSnaps[i]      as PromiseFulfilledResult<MatchSnapshot | null>).value : null;
    const failures = detectFailures(primary, dr);
    if (failures.length > 0) toRepair.push({ matchId: id, failures });
  }

  if (toRepair.length === 0) {
    return NextResponse.json({
      repairedAt:   new Date(now).toISOString(),
      feedAgeHours: Math.round((now - feedEntry.fetchedAt) / 3_600_000 * 10) / 10,
      checked:      finishedMatches.length,
      degraded:     0,
      repaired:     0,
      dryRun,
      verdict:      'HEALTHY',
      message:      'All finished WC matches pass integrity checks.',
      results:      [],
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (dryRun) {
    return NextResponse.json({
      repairedAt:   new Date(now).toISOString(),
      feedAgeHours: Math.round((now - feedEntry.fetchedAt) / 3_600_000 * 10) / 10,
      checked:      finishedMatches.length,
      degraded:     toRepair.length,
      repaired:     0,
      dryRun:       true,
      verdict:      'DRY_RUN',
      message:      `${toRepair.length} match(es) need repair. Re-run without dryRun=true to repair.`,
      results:      toRepair.map(({ matchId, failures }) => ({
        matchId, failures, status: 'dry-run', goalsAfter: null, lineupAfter: null, subsAfter: null, rebuildMs: null,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // ── 4. Repair in batches of 3 ─────────────────────────────────────────────
  const repairResults: RepairResult[] = [];

  for (let i = 0; i < toRepair.length; i += 3) {
    const batch = toRepair.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async ({ matchId, failures }): Promise<RepairResult> => {
        const id = String(matchId);
        const t1 = Date.now();
        try {
          await Promise.all([
            kv.del(`goalradar:match:${id}`),
            kv.del(`goalradar:dr:match:${id}`),
          ]);
          const rebuilt = await getOrBuildMatchSnapshot(id);
          return {
            matchId,
            failures,
            status:      'repaired',
            goalsAfter:  rebuilt.match.goals?.length ?? 0,
            lineupAfter: !!(rebuilt.match.lineups?.home?.players?.length),
            subsAfter:   rebuilt.match.substitutions?.length ?? 0,
            rebuildMs:   Date.now() - t1,
          };
        } catch (err) {
          return {
            matchId,
            failures,
            status:     'failed',
            goalsAfter: null, lineupAfter: null, subsAfter: null,
            rebuildMs:  Date.now() - t1,
            error:      err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    repairResults.push(...batchResults);
  }

  const repairedCount = repairResults.filter(r => r.status === 'repaired').length;
  const failedCount   = repairResults.filter(r => r.status === 'failed').length;

  return NextResponse.json({
    repairedAt:   new Date(now).toISOString(),
    feedAgeHours: Math.round((now - feedEntry.fetchedAt) / 3_600_000 * 10) / 10,
    totalMs:      Date.now() - now,
    checked:      finishedMatches.length,
    degraded:     toRepair.length,
    repaired:     repairedCount,
    failed:       failedCount,
    dryRun:       false,
    verdict:      failedCount === 0 ? 'ALL_REPAIRED' : 'PARTIAL',
    results:      repairResults,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
