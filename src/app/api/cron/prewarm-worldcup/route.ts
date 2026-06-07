/**
 * GET /api/cron/prewarm-worldcup
 *
 * Consolidated 5-minute prewarm cron for all World Cup 2026 data.
 *
 * Goal
 * ────
 * Ensure KV is always populated before any user request arrives, so
 * every WC page gets a [KV] HIT (never a blocking API call).
 *
 * Data warmed (every 5 minutes)
 * ─────────────────────────────
 *   1. WC fixtures   — /competitions/WC/matches?status=SCHEDULED,TIMED
 *                      KV key: goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED
 *   2. WC results    — /competitions/WC/matches?status=FINISHED
 *                      KV key: goalradar:/competitions/WC/matches?status=FINISHED
 *   3. WC live       — /competitions/WC/matches?status=IN_PLAY,PAUSED
 *                      KV key: goalradar:live:wc-matches  (via live-cache.ts)
 *   4. WC standings  — /competitions/WC/standings
 *                      KV key: goalradar:/competitions/WC/standings
 *   5. WC all (bracket/hub) — /competitions/WC/matches
 *                      KV key: goalradar:/competitions/WC/matches
 *   6. WC recent     — /competitions/WC/matches?dateFrom={-30d}&dateTo={today}
 *                      KV key: goalradar:/competitions/WC/matches?dateFrom=...
 *
 * Cache layer reuse
 * ─────────────────
 * Calls the same API functions used by pages (getUpcomingMatches, getWCResults,
 * getWCLiveMatches, getStandings, getWCKnockoutMatches, getRecentMatches).
 * Each function writes into KV via the existing fetchWithKV / live-cache.ts
 * layer — same keys, same TTLs, same SWR semantics. No duplication.
 *
 * Auth
 * ────
 * Vercel auto-injects  Authorization: Bearer <CRON_SECRET>  on scheduled
 * invocations. To test locally:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/prewarm-worldcup
 *
 * Vercel cron schedule (add to vercel.json → crons):
 *   { "path": "/api/cron/prewarm-worldcup", "schedule": "* /5 * * * *" }
 *
 * Logging
 * ───────
 *   [PREWARM] start  | WC | 6 endpoints
 *   [PREWARM] ok     | wc-fixtures | 312ms
 *   [PREWARM] ok     | wc-live | 198ms
 *   [PREWARM] fail   | wc-standings | HTTP 429: rate limit
 *   [PREWARM] success | 5/6 ok | 1 failed | 843ms total
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/refresh';
import {
  getUpcomingMatches,
  getWCResults,
  getWCLiveMatches,
  getStandings,
  getWCKnockoutMatches,
  getRecentMatches,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Task definitions — what to warm and how to label each in logs
// ---------------------------------------------------------------------------

interface WarmTask {
  label:   string;
  fetch:   () => Promise<unknown>;
}

function buildTasks(): WarmTask[] {
  return [
    {
      label: 'wc-fixtures',
      fetch: () => getUpcomingMatches('WC'),
    },
    {
      label: 'wc-results',
      fetch: () => getWCResults(),
    },
    {
      label: 'wc-live',
      // getWCLiveMatches routes through live-cache.ts (KV key: goalradar:live:wc-matches)
      // — a separate layer from fetchWithKV, correctly warmed by calling the
      // same function pages use.
      fetch: () => getWCLiveMatches(),
    },
    {
      label: 'wc-standings',
      fetch: () => getStandings('WC'),
    },
    {
      label: 'wc-all-matches',
      // Powers bracket + hub summary sections.
      fetch: () => getWCKnockoutMatches(),
    },
    {
      label: 'wc-recent',
      // Date-scoped results window (last 30 days) — same key as alias page.
      fetch: () => getRecentMatches('WC'),
    },
  ];
}

// ---------------------------------------------------------------------------
// Task runner — fetch + time + catch per item
// ---------------------------------------------------------------------------

interface TaskResult {
  label:    string;
  status:   'ok' | 'fail';
  elapsedMs: number;
  error?:   string;
}

async function runTask(task: WarmTask): Promise<TaskResult> {
  const start = Date.now();
  try {
    await task.fetch();
    const elapsedMs = Date.now() - start;
    console.log(`[PREWARM] ok     | ${task.label} | ${elapsedMs}ms`);
    return { label: task.label, status: 'ok', elapsedMs };
  } catch (err) {
    const elapsedMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[PREWARM] fail   | ${task.label} | ${error} | ${elapsedMs}ms`);
    return { label: task.label, status: 'fail', elapsedMs, error };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tasks   = buildTasks();
  const started = Date.now();

  console.log(`[PREWARM] start  | WC | ${tasks.length} endpoints`);

  // Run all tasks in parallel — independent fetches, no ordering dependency.
  const results = await Promise.all(tasks.map(runTask));

  const elapsed   = Date.now() - started;
  const succeeded = results.filter((r) => r.status === 'ok').length;
  const failed    = results.filter((r) => r.status === 'fail').length;

  if (failed === 0) {
    console.log(`[PREWARM] success | ${succeeded}/${tasks.length} ok | ${elapsed}ms total`);
  } else {
    console.warn(`[PREWARM] success | ${succeeded}/${tasks.length} ok | ${failed} failed | ${elapsed}ms total`);
  }

  return NextResponse.json({
    job:       'prewarm-worldcup',
    ok:        succeeded,
    failed,
    total:     tasks.length,
    elapsedMs: elapsed,
    results,
    timestamp: new Date().toISOString(),
  }, {
    status: failed > 0 && succeeded === 0 ? 500 : 200,
  });
}
