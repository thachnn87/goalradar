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
  extractTeamIdsFromStandings,
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
import { recordCronRun }                             from '@/lib/cron-recorder';
import { writeAuthorityCache, type AuthorityCacheEnvelope } from '@/lib/authority-cache';

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

// ── Phase 4: Team detail constants ──────────────────────────────────────────
// Team detail data (name, crest, venue, coach) rarely changes — 6 h TTL is safe.
// Rate math: football-data.org ≤10 req/min (7 s/req enforced by rate limiter).
// TEAM_MAX_CALLS_PER_RUN × 7 s = 175 s — safely below the 300 s Vercel limit.
// Cold start: up to ~168 teams queued; warms fully across ~7 cron runs (3.5 h).
// Steady state (6 h minInterval, 30 min cron): ~14 due teams → ~98 s extra/run.
const TEAM_FRESH             =  6 * 3_600; // 6 h
const TEAM_STALE             = 24 * 3_600; // 24 h — KV TTL
const TEAM_MIN_INTERVAL_SEC  =  6 * 3_600; // 6 h — skip if refreshed within 6 h
const TEAM_MAX_CALLS_PER_RUN =         25; // max provider calls per run (cold-start guard)

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
      // DATA-16D: use WC_STALE (12 h) as KV TTL — finished results never change,
      // so a long stale window prevents the "No results" gap when the cron is delayed.
      // freshSec stays at FIXTURES_FRESH (15 min) so the SWR trigger still fires on reads.
      run:   () => refreshEndpoint(
        '/competitions/WC/matches?status=FINISHED',
        FIXTURES_FRESH,
        WC_STALE,
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

  // ── Phase 4: Team data ──────────────────────────────────────────────────────
  // Extract team IDs from standings KV entries written in Phase 3, then refresh
  // stale team detail records.  minIntervalSec=6h keeps provider calls sparse;
  // TEAM_MAX_CALLS_PER_RUN bounds cold-start wall-time to ~175 s (25 × 7 s).
  // Teams beyond the cap remain stale until the next run warms them.
  const teamIds = await extractTeamIdsFromStandings();
  console.log(`[Cron] orchestrator: Phase 4 teams | ids=${teamIds.length}`);
  let teamProviderCalls = 0;
  for (const id of teamIds) {
    if (teamProviderCalls >= TEAM_MAX_CALLS_PER_RUN) {
      console.log(`[Cron] orchestrator: Phase 4 cap reached (${TEAM_MAX_CALLS_PER_RUN} provider calls)`);
      break;
    }
    const label = `team-${id}`;
    console.log(`[QUEUE] orchestrator | running ${label}`);
    const taskStart = Date.now();
    const result    = await refreshEndpoint(
      `/teams/${id}`,
      TEAM_FRESH,
      TEAM_STALE,
      { minIntervalSec: TEAM_MIN_INTERVAL_SEC, caller: CALLER },
    );
    const elapsedMs = Date.now() - taskStart;
    refreshResults.push(result);
    taskResults.push({
      label,
      status:    result.status === 'ok'      ? 'ok'
               : result.status === 'skipped' ? 'skip'
               : 'fail',
      elapsedMs,
      ...(result.error !== undefined ? { error: result.error } : {}),
    });
    if (result.status !== 'skipped') teamProviderCalls++;
  }

  const ok      = refreshResults.filter((r) => r.status === 'ok').length;
  const skipped = refreshResults.filter((r) => r.status === 'skipped').length;
  const failed  = refreshResults.filter((r) => r.status === 'error').length;
  const elapsed = Date.now() - started;

  console.log(`[Cron] orchestrator tasks done | ok=${ok} skipped=${skipped} failed=${failed} total=${taskResults.length} | ${elapsed}ms`);

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

  // ── DATA-18C: Authority cache write ──────────────────────────────────────
  // Runs after prewarmWorldCup() so all per-match snapshot KV keys are fresh.
  // Gated by AUTHORITY_CACHE_ENABLED=true to allow safe rollback via env toggle.
  let authorityResult: AuthorityCacheEnvelope | null = null;
  // Default ON — disable by setting AUTHORITY_CACHE_ENABLED=false in Vercel dashboard.
  if (process.env.AUTHORITY_CACHE_ENABLED !== 'false') {
    try {
      console.log('[Cron] orchestrator: writing authority cache (DATA-18C)');
      authorityResult = await writeAuthorityCache(new Date().toISOString(), 'cron:orchestrator');
      console.log(
        `[Cron] orchestrator: authority cache written | matchCount=${authorityResult.matchCount}` +
        ` liveCount=${authorityResult.liveCount} ttlTier=${authorityResult.ttlTier}`,
      );
    } catch (err) {
      console.error('[Cron] authority cache write failed:', err instanceof Error ? err.message : String(err));
    }
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

  // Standard cron recorder — powers /api/debug/cron-status
  const orcTriggerSource =
    triggeredBy === 'header'    ? 'github-actions' as const
    : triggeredBy === 'queryparam' ? 'queryparam' as const
    : 'unknown' as const;
  recordCronRun('orchestrator', totalElapsed, failed > 0 ? 'error' : 'ok', orcTriggerSource)
    .catch(err => console.error('[Cron] recorder write failed:', err instanceof Error ? err.message : String(err)));

  // Persist run record — backward-compatible with /api/debug/prewarm-status
  // which reads PREWARM_RECORD_KEY from KV.  PERF-3 enrichment fields are
  // optional so existing callers that only read the base fields continue to work.
  savePrewarmRecord({
    timestamp:   new Date().toISOString(),
    elapsedMs:   totalElapsed,
    ok,
    failed,
    total:       taskResults.length,
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
    total:    taskResults.length,
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
    // DATA-18C authority cache
    authorityCache: authorityResult ? {
      matchCount: authorityResult.matchCount,
      liveCount:  authorityResult.liveCount,
      ttlTier:    authorityResult.ttlTier,
      builtAt:    authorityResult.builtAt,
    } : process.env.AUTHORITY_CACHE_ENABLED !== 'false' ? { error: 'write failed' } : { skipped: 'AUTHORITY_CACHE_ENABLED=false' },
    // DATA-9
    revalidation: revalidationRecord ? {
      success:     revalidationRecord.success,
      revalidated: revalidationRecord.revalidated,
      paths:       revalidationRecord.paths,
      ...(revalidationRecord.error ? { error: revalidationRecord.error } : {}),
    } : { skipped: true, reason: 'no WC tasks succeeded' },
  });
}
