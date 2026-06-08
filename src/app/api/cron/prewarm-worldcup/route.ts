/**
 * GET /api/cron/prewarm-worldcup
 *
 * Externally-triggered cache prewarm for all World Cup 2026 data.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Why this exists
 * ─────────────────────────────────────────────────────────────────────────
 * Vercel Hobby plan does not include Cron Jobs. This route is a plain HTTP
 * endpoint that any external scheduler can call every 5 minutes.
 *
 * Calling it proactively populates Vercel KV so that every WC page render
 * hits [KV] HIT (sub-10 ms) instead of blocking on a live football-data.org
 * API call (100–400 ms, rate-limited at 10 req/min on free tier).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Data warmed (6 endpoints, all in parallel)
 * ─────────────────────────────────────────────────────────────────────────
 *  Label            Function               KV key
 *  ─────────────── ────────────────────── ────────────────────────────────
 *  wc-fixtures      getUpcomingMatches()   goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED
 *  wc-results       getWCResults()         goalradar:/competitions/WC/matches?status=FINISHED
 *  wc-live          getWCLiveMatches()     goalradar:live:matches     (via live-cache.ts, 30s TTL — shared with getLiveMatches)
 *  wc-standings     getStandings('WC')     goalradar:/competitions/WC/standings
 *  wc-all-matches   getWCKnockoutMatches() goalradar:/competitions/WC/matches
 *  wc-recent        getRecentMatches()     goalradar:/competitions/WC/matches?dateFrom=…
 *
 * Calls the same API functions pages use — same KV keys, same SWR TTLs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Authentication
 * ─────────────────────────────────────────────────────────────────────────
 * Set  CRON_SECRET  in Vercel environment variables (Settings → Environment).
 * The endpoint accepts the secret via EITHER:
 *
 *   Authorization: Bearer <secret>   header     (preferred)
 *   ?secret=<secret>                 query param (UptimeRobot free plan)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Trigger options (choose one)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ── 1. GitHub Actions (free, reliable, 5-min minimum) ────────────────────
 *
 *  Create .github/workflows/prewarm.yml:
 *
 *    name: WC Cache Prewarm
 *    on:
 *      schedule:
 *        - cron: '* /5 * * * *'   # every 5 minutes
 *    jobs:
 *      prewarm:
 *        runs-on: ubuntu-latest
 *        steps:
 *          - name: Trigger prewarm
 *            run: |
 *              curl -sf \
 *                -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
 *                https://goalradar.org/api/cron/prewarm-worldcup
 *
 *  Add CRON_SECRET to GitHub repo → Settings → Secrets → Actions.
 *
 * ── 2. EasyCron (free tier: 20 jobs, 1-min interval) ─────────────────────
 *
 *  1. Sign up at easycron.com (free plan is sufficient)
 *  2. New Cron Job:
 *       URL:     https://goalradar.org/api/cron/prewarm-worldcup
 *       Method:  GET
 *       Header:  Authorization: Bearer <your-CRON_SECRET>
 *       Schedule: Every 5 minutes  →  * /5 * * * *
 *  3. Enable "Failure notifications" so you get an email on HTTP errors.
 *
 * ── 3. UptimeRobot (free tier: 50 monitors, 5-min interval) ──────────────
 *
 *  Free plan cannot set custom headers. Use the query-param auth instead:
 *
 *  1. Add a new "HTTP(s)" monitor:
 *       URL: https://goalradar.org/api/cron/prewarm-worldcup?secret=<your-CRON_SECRET>
 *       Monitoring interval: 5 minutes
 *       Alert contacts: add your email
 *  2. The endpoint returns HTTP 200 on success — UptimeRobot will alert you
 *     if it gets anything else (500 = all tasks failed; 401 = wrong secret).
 *
 *  Note: the secret appears in the UptimeRobot dashboard URL. For higher
 *  security, use GitHub Actions or EasyCron instead.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Logging
 * ─────────────────────────────────────────────────────────────────────────
 *  [PREWARM] start  | WC | 6 endpoints | triggered=header
 *  [PREWARM] ok     | wc-fixtures | 312ms
 *  [PREWARM] fail   | wc-live | HTTP 429: rate limited
 *  [PREWARM] success | 5/6 ok | 1 failed | 843ms total
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Status / diagnostics
 * ─────────────────────────────────────────────────────────────────────────
 *  GET /api/debug/prewarm-status  — last run record + per-key cache freshness
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isAuthorizedExternalRequest,
  savePrewarmRecord,
  type PrewarmTaskResult,
} from '@/lib/refresh';
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
// Task definitions
// ---------------------------------------------------------------------------

interface WarmTask {
  label: string;
  fetch: () => Promise<unknown>;
}

function buildTasks(): WarmTask[] {
  return [
    { label: 'wc-fixtures',    fetch: () => getUpcomingMatches('WC') },
    { label: 'wc-results',     fetch: () => getWCResults() },
    // Routes through live-cache.ts → KV key goalradar:live:matches (30s TTL, shared with getLiveMatches)
    { label: 'wc-live',        fetch: () => getWCLiveMatches() },
    { label: 'wc-standings',   fetch: () => getStandings('WC') },
    // All 104 WC matches — powers bracket + hub summary
    { label: 'wc-all-matches', fetch: () => getWCKnockoutMatches() },
    // Date-scoped window (last 30 days) — same key as alias + results pages
    { label: 'wc-recent',      fetch: () => getRecentMatches('WC') },
  ];
}

// ---------------------------------------------------------------------------
// Task runner
// ---------------------------------------------------------------------------

async function runTask(task: WarmTask): Promise<PrewarmTaskResult> {
  const start = Date.now();
  try {
    await task.fetch();
    const elapsedMs = Date.now() - start;
    console.log(`[PREWARM] ok     | ${task.label} | ${elapsedMs}ms`);
    return { label: task.label, status: 'ok', elapsedMs };
  } catch (err) {
    const elapsedMs = Date.now() - start;
    const error     = err instanceof Error ? err.message : String(err);
    console.error(`[PREWARM] fail   | ${task.label} | ${error} | ${elapsedMs}ms`);
    return { label: task.label, status: 'fail', elapsedMs, error };
  }
}

// ---------------------------------------------------------------------------
// Detect which auth method was used (for the run record)
// ---------------------------------------------------------------------------

function detectTrigger(req: NextRequest): 'header' | 'queryparam' | 'unknown' {
  const secret = process.env.CRON_SECRET;
  if (!secret) return 'unknown';
  if (req.headers.get('authorization') === `Bearer ${secret}`) return 'header';
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('secret') === secret) return 'queryparam';
  } catch { /* ignore */ }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorizedExternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const triggeredBy = detectTrigger(req);
  const tasks       = buildTasks();
  const started     = Date.now();

  console.log(`[PREWARM] start  | WC | ${tasks.length} endpoints | triggered=${triggeredBy}`);

  // All tasks run in parallel — independent, no ordering dependency.
  const results  = await Promise.all(tasks.map(runTask));
  const elapsed  = Date.now() - started;
  const ok       = results.filter((r) => r.status === 'ok').length;
  const failed   = results.filter((r) => r.status === 'fail').length;

  if (failed === 0) {
    console.log(`[PREWARM] success | ${ok}/${tasks.length} ok | ${elapsed}ms total`);
  } else {
    console.warn(`[PREWARM] success | ${ok}/${tasks.length} ok | ${failed} failed | ${elapsed}ms total`);
  }

  // Persist run record to KV so /api/debug/prewarm-status can read it.
  savePrewarmRecord({
    timestamp:   new Date().toISOString(),
    elapsedMs:   elapsed,
    ok,
    failed,
    total:       tasks.length,
    results,
    triggeredBy,
  });

  // Return 500 only when ALL tasks fail (hard outage); partial failures
  // return 200 so external monitors don't halt scheduling on transient errors.
  return NextResponse.json(
    { job: 'prewarm-worldcup', ok, failed, total: tasks.length, elapsedMs: elapsed, results, timestamp: new Date().toISOString() },
    { status: failed > 0 && ok === 0 ? 500 : 200 },
  );
}
