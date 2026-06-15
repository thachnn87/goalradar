/**
 * GET /api/cron/orchestrator
 *
 * Single orchestrator that replaces three separate cron jobs:
 *   /api/refresh/wc-fixtures   (deprecated)
 *   /api/refresh/standings     (deprecated)
 *   /api/cron/prewarm-worldcup (deprecated)
 *
 * All 12 tasks run sequentially — never concurrent — so the global
 * football-data.org rate limiter (7 s / request) is never burst-triggered.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  OR  ?secret=<CRON_SECRET>
 * Schedule: every 30 min (configured externally via GitHub Actions / EasyCron / UptimeRobot)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  refreshEndpoint,
  refreshLiveMatches,
  isAuthorizedExternalRequest,
  savePrewarmRecord,
  type RefreshResult,
  type PrewarmTaskResult,
  type PrewarmRecord,
} from '@/lib/refresh';
import { prewarmWorldCup, type WorldCupPrewarmResult } from '@/lib/prewarm/worldcup';
import { readRateSafeFromKV, isRateSafeModeActive, getRateSafeState } from '@/lib/rate-safe';
import { COMPETITIONS } from '@/lib/types';
import { revalidateWCPaths, type RevalidationRecord } from '@/lib/revalidation';

export const dynamic = 'force-dynamic';

// SWR timing constants — must stay in sync with SWR.* in src/lib/kv-cache.ts.
// Duplicated here to keep the orchestrator self-contained and avoid
// importing the full kv-cache module (which pulls in @vercel/kv at build time).
const WC_FRESH        = 21_600; // 6 h   — SWR.WC.fresh
const WC_STALE        = 43_200; // 12 h  — SWR.WC.stale
const FIXTURES_FRESH  =    900; // 15 min — SWR.FIXTURES.fresh
const FIXTURES_STALE  =  1_800; // 30 min — SWR.FIXTURES.stale
const STANDINGS_FRESH =  3_600; // 1 h   — SWR.STANDINGS.fresh
const STANDINGS_STALE =  7_200; // 2 h   — SWR.STANDINGS.stale

// ── PERF-6 Phase 3: minimum refresh intervals (skip-if-fresh guard) ──────────
// refreshEndpoint() checks KV entry age before calling the provider.  If the
// data is younger than MIN_* seconds the task is logged as SKIP-FRESH and no
// provider call is made.  This eliminates redundant fetches when the cron fires
// more often than the underlying data changes.
//
//   WC fixtures  → skip if < 30 min old  (spec: max every 30 min)
//   Standings    → skip if < 30 min old  (spec: max every 30 min)
//   Today matches → skip if < 55 s old   (near-real-time; freshSec=60)
//   Live matches → NOT throttled (live data must always refresh)
const WC_MIN_INTERVAL_SEC        = 1_800; // 30 min
const STANDINGS_MIN_INTERVAL_SEC = 1_800; // 30 min
const TODAY_MIN_INTERVAL_SEC     =    55; // ~1 min

const CALLER = 'cron/orchestrator';

// ---------------------------------------------------------------------------
// Task list
// ---------------------------------------------------------------------------

type OrchestratorTask = {
  label: string;
  run:   () => Promise<RefreshResult>;
};

/**
 * Builds the ordered list of 12 tasks for one orchestrator run.
 * Date-scoped endpoints are computed fresh on each invocation.
 *
 * Task order:
 *   Phase 1 — WC Fixtures (4 tasks)
 *   Phase 2 — Live matches (1 task, canonical KV key)
 *   Phase 3 — Standings   (7 tasks: WC + 6 leagues)
 */
function buildTasks(): OrchestratorTask[] {
  const today = new Date().toISOString().split('T')[0];
  const from  = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];

  return [
    // ── Phase 1: WC Fixtures ─────────────────────────────────────────────────
    // PERF-6: minIntervalSec guards prevent re-fetching data that is still
    // within the 30-min freshness window even though the cron fires every 30 min.
    {
      label: 'wc-all-matches',
      run:   () => refreshEndpoint('/competitions/WC/matches', WC_FRESH, WC_STALE,
        { minIntervalSec: WC_MIN_INTERVAL_SEC, caller: CALLER }),
    },
    {
      label: 'wc-upcoming',
      run:   () => refreshEndpoint(
        '/competitions/WC/matches?status=SCHEDULED,TIMED',
        FIXTURES_FRESH,
        FIXTURES_STALE,
        { minIntervalSec: WC_MIN_INTERVAL_SEC, caller: CALLER },
      ),
    },
    {
      label: 'wc-finished',
      run:   () => refreshEndpoint(
        '/competitions/WC/matches?status=FINISHED',
        FIXTURES_FRESH,
        FIXTURES_STALE,
        { minIntervalSec: WC_MIN_INTERVAL_SEC, caller: CALLER },
      ),
    },
    {
      label: 'wc-recent',
      run:   () => refreshEndpoint(
        `/competitions/WC/matches?dateFrom=${from}&dateTo=${today}`,
        FIXTURES_FRESH,
        FIXTURES_STALE,
        { minIntervalSec: WC_MIN_INTERVAL_SEC, caller: CALLER },
      ),
    },
    // ── Phase 1b: Today's cross-competition matches ───────────────────────────
    // PERF-4.5: getTodayMatches() now has KV backing.  Seed the KV key so
    // page-safe getTodayMatchesCached() never needs to call the provider.
    // PERF-6: 55s minimum interval keeps queue depth low between cron runs.
    {
      label: 'today-matches',
      run:   () => refreshEndpoint(
        `/matches?dateFrom=${today}&dateTo=${today}`,
        60,    // fresh 60s (live page-level data)
        120,   // stale 120s (matches SWR window)
        { minIntervalSec: TODAY_MIN_INTERVAL_SEC, caller: CALLER },
      ),
    },
    // ── Phase 2: Live ─────────────────────────────────────────────────────────
    // Writes to goalradar:live:matches (30 s TTL) — NOT handled by refreshEndpoint.
    // Live matches are NOT throttled — always refresh every run.
    {
      label: 'live-matches',
      run:   refreshLiveMatches,
    },
    // ── Phase 3: Standings ────────────────────────────────────────────────────
    // COMPETITIONS includes WC, PL, PD, BL1, SA, FL1, CL (7 total)
    // PERF-6: standings skip if already refreshed within 30 min.
    ...COMPETITIONS.map(({ code }) => ({
      label: `standings-${code.toLowerCase()}`,
      run:   () => refreshEndpoint(
        `/competitions/${code}/standings`,
        STANDINGS_FRESH,
        STANDINGS_STALE,
        { minIntervalSec: STANDINGS_MIN_INTERVAL_SEC, caller: CALLER },
      ),
    })),
  ];
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorizedExternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  console.log('[Cron] orchestrator started');

  // ── RATE-SAFE MODE: sync in-process flag from KV before any provider calls ─
  // This picks up 429/403 events that fired in OTHER serverless instances since
  // the last time this process ran.  Zero-I/O checks within the run use the
  // synced in-process flag — no per-task KV reads needed.
  const rateSafeState = await readRateSafeFromKV();
  if (rateSafeState) {
    const expiresIn = Math.round((rateSafeState.expiresAt - Date.now()) / 1000);
    console.warn(
      `[Cron] orchestrator: RATE-SAFE mode active | reason=${rateSafeState.reason}` +
      ` | expiresIn=${expiresIn}s | all refresh tasks will be skipped`,
    );
  }

  // Capture auth method for the run record
  const triggeredBy: PrewarmRecord['triggeredBy'] =
    req.headers.get('authorization')?.startsWith('Bearer ') ? 'header'
    : new URL(req.url).searchParams.has('secret')            ? 'queryparam'
    : 'unknown';

  const tasks = buildTasks();
  const refreshResults: RefreshResult[]    = [];
  const taskResults:    PrewarmTaskResult[] = [];

  for (const task of tasks) {
    console.log(`[QUEUE] orchestrator | running ${task.label}`);
    const taskStart = Date.now();
    const result    = await task.run();
    const elapsedMs = Date.now() - taskStart;

    refreshResults.push(result);
    taskResults.push({
      label:     task.label,
      status:    result.status === 'ok'      ? 'ok'
               : result.status === 'skipped' ? 'skip'
               : 'fail',
      elapsedMs,
      ...(result.error !== undefined ? { error: result.error } : {}),
    });
  }

  const ok      = refreshResults.filter((r) => r.status === 'ok').length;
  const skipped = refreshResults.filter((r) => r.status === 'skipped').length;
  const failed  = refreshResults.filter((r) => r.status === 'error').length;
  const elapsed = Date.now() - started;

  console.log(`[Cron] orchestrator tasks done | ok=${ok} skipped=${skipped} failed=${failed} total=${tasks.length} | ${elapsed}ms`);

  // ── PERF-3: Seed all 104 WC match KV entries from bulk data ──────────────
  // Runs after the standard tasks so it can reuse the KV-cached responses.
  let seedResult: WorldCupPrewarmResult | null = null;
  try {
    console.log('[Cron] orchestrator: starting WC match seeding (PERF-3)');
    seedResult = await prewarmWorldCup();
    console.log(
      `[Cron] orchestrator: WC seeding done | ` +
      `seededDetail=${seedResult.seededMatchDetail} ` +
      `seededSnap=${seedResult.seededSnapshots} ` +
      `coverage=${seedResult.coveragePercent}% | ${seedResult.durationMs}ms`,
    );
  } catch (err) {
    console.error('[Cron] orchestrator: WC seeding threw', err instanceof Error ? err.message : String(err));
  }

  // ── DATA-9: On-demand ISR revalidation ───────────────────────────────────
  // Trigger only when at least one WC data task (fixtures or standings) succeeded.
  // This clears stale HTML caches immediately after fresh KV data is available.
  // Never triggered if all WC tasks failed — stale HTML beats incorrect HTML.
  let revalidationRecord: RevalidationRecord | null = null;
  const wcTasksOk = taskResults.some(
    (t) =>
      t.status === 'ok' &&
      (t.label.startsWith('wc-') || t.label === 'standings-wc'),
  );
  if (wcTasksOk) {
    try {
      const triggeredByStr = triggeredBy ?? 'unknown';
      revalidationRecord = await revalidateWCPaths('orchestrator', triggeredByStr);
      console.log(
        `[ISR] orchestrator: revalidated ${revalidationRecord.revalidated} WC paths | success=${revalidationRecord.success}`,
      );
    } catch (err) {
      console.error('[ISR] orchestrator: revalidation threw', err instanceof Error ? err.message : String(err));
    }
  } else {
    console.log('[ISR] orchestrator: skipping revalidation — no WC tasks succeeded');
  }

  const totalElapsed = Date.now() - started;
  console.log(`[Cron] orchestrator done | total=${totalElapsed}ms`);

  // Persist run record — backward-compatible with /api/debug/prewarm-status
  // which reads PREWARM_RECORD_KEY from KV.  PERF-3 enrichment fields are
  // optional so existing callers that only read the base fields continue to work.
  savePrewarmRecord({
    timestamp:   new Date().toISOString(),
    elapsedMs:   totalElapsed,
    ok,
    failed,
    total:       tasks.length,
    results:     taskResults,
    triggeredBy,
    // PERF-3 seed stats
    seededMatches:   seedResult?.seededMatchDetail ?? 0,
    seededStandings: ok > 0, // standings tasks ran as part of the main batch
    seededGroups:    ok > 0,
    seededResults:   ok > 0,
    coveragePercent: seedResult?.coveragePercent ?? 0,
    seedErrors:      seedResult?.errors ?? [],
    seedDurationMs:  seedResult?.durationMs ?? 0,
    priorityMatches: seedResult?.priorityMatches ?? 0,
  });

  return NextResponse.json({
    job:      'orchestrator',
    ok,
    skipped,
    failed,
    total:    tasks.length,
    elapsed:  `${elapsed}ms`,
    rateSafeMode: isRateSafeModeActive()
      ? { active: true, ...getRateSafeState() }
      : { active: false },
    results: refreshResults,
    // PERF-3 + RATE-SAFE
    seed: seedResult ? {
      seededMatchDetail: seedResult.seededMatchDetail,
      seededSnapshots:   seedResult.seededSnapshots,
      skippedFresh:      seedResult.skippedFresh,
      skippedLive:       seedResult.skippedLive,
      totalWCMatches:    seedResult.totalWCMatches,
      coveragePercent:   seedResult.coveragePercent,
      priorityMatches:   seedResult.priorityMatches,
      priorityRefreshed: seedResult.priorityRefreshed,
      fetchCalls:        seedResult.fetchCalls,
      durationMs:        seedResult.durationMs,
      rateSafeMode:      seedResult.rateSafeMode,
      tierBreakdown:     seedResult.tierBreakdown,
      errors:            seedResult.errors,
    } : null,
    timestamp: new Date().toISOString(),
    // DATA-9
    revalidation: revalidationRecord ? {
      success:     revalidationRecord.success,
      revalidated: revalidationRecord.revalidated,
      paths:       revalidationRecord.paths,
      ...(revalidationRecord.error ? { error: revalidationRecord.error } : {}),
    } : { skipped: true, reason: 'no WC tasks succeeded' },
  });
}
