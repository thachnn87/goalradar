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
import { COMPETITIONS } from '@/lib/types';

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
    {
      label: 'wc-all-matches',
      run:   () => refreshEndpoint('/competitions/WC/matches', WC_FRESH, WC_STALE),
    },
    {
      label: 'wc-upcoming',
      run:   () => refreshEndpoint(
        '/competitions/WC/matches?status=SCHEDULED,TIMED',
        FIXTURES_FRESH,
        FIXTURES_STALE,
      ),
    },
    {
      label: 'wc-finished',
      run:   () => refreshEndpoint(
        '/competitions/WC/matches?status=FINISHED',
        FIXTURES_FRESH,
        FIXTURES_STALE,
      ),
    },
    {
      label: 'wc-recent',
      run:   () => refreshEndpoint(
        `/competitions/WC/matches?dateFrom=${from}&dateTo=${today}`,
        FIXTURES_FRESH,
        FIXTURES_STALE,
      ),
    },
    // ── Phase 2: Live ─────────────────────────────────────────────────────────
    // Writes to goalradar:live:matches (30 s TTL) — NOT handled by refreshEndpoint.
    {
      label: 'live-matches',
      run:   refreshLiveMatches,
    },
    // ── Phase 3: Standings ────────────────────────────────────────────────────
    // COMPETITIONS includes WC, PL, PD, BL1, SA, FL1, CL (7 total)
    ...COMPETITIONS.map(({ code }) => ({
      label: `standings-${code.toLowerCase()}`,
      run:   () => refreshEndpoint(
        `/competitions/${code}/standings`,
        STANDINGS_FRESH,
        STANDINGS_STALE,
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
      status:    result.status === 'ok' ? 'ok' : 'fail',
      elapsedMs,
      ...(result.error !== undefined ? { error: result.error } : {}),
    });
  }

  const ok      = refreshResults.filter((r) => r.status === 'ok').length;
  const failed  = refreshResults.filter((r) => r.status === 'error').length;
  const elapsed = Date.now() - started;

  console.log(`[Cron] orchestrator done | ok=${ok} failed=${failed} total=${tasks.length} | ${elapsed}ms`);

  // Persist run record — backward-compatible with /api/debug/prewarm-status
  // which reads PREWARM_RECORD_KEY from KV.
  savePrewarmRecord({
    timestamp:   new Date().toISOString(),
    elapsedMs:   elapsed,
    ok,
    failed,
    total:       tasks.length,
    results:     taskResults,
    triggeredBy,
  });

  return NextResponse.json({
    job:       'orchestrator',
    ok,
    failed,
    total:     tasks.length,
    elapsed:   `${elapsed}ms`,
    results:   refreshResults,
    timestamp: new Date().toISOString(),
  });
}
