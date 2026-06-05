/**
 * GET /api/refresh/wc-fixtures
 *
 * Proactively refreshes all World Cup fixture data in Vercel KV.
 * Called by Vercel Cron every 10 minutes so users always read from cache.
 *
 * Endpoints refreshed:
 *   - All WC matches (bracket + WCBracket component)
 *   - Upcoming WC fixtures  (schedule, hub page)
 *   - Finished WC matches   (results page)
 *   - WC live matches        (live section — low cost, same cron run)
 *
 * Cron schedule: "* /10 * * * *"  (every 10 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshEndpoint, isAuthorizedCronRequest } from '@/lib/refresh';

// SWR timing constants must match SWR.FIXTURES / SWR.MATCH in kv-cache.ts
// so the user-facing cache entries are overwritten with the same TTL.
const FIXTURES_FRESH = 600;   // 10 min
const FIXTURES_STALE = 1200;  // 20 min (Redis TTL)
const MATCH_FRESH    = 60;    // 1 min
const MATCH_STALE    = 120;   // 2 min

// List of today's date for date-scoped endpoints
function todayISO() { return new Date().toISOString().split('T')[0]; }
function fromISO()  {
  return new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
}

const ENDPOINTS: Array<{ path: string; fresh: number; stale: number }> = [
  // All WC matches — used by WCBracket and hub page
  { path: '/competitions/WC/matches',                    fresh: MATCH_FRESH,    stale: MATCH_STALE    },
  // Upcoming WC fixtures — schedule + hub sections
  { path: '/competitions/WC/matches?status=SCHEDULED,TIMED', fresh: FIXTURES_FRESH, stale: FIXTURES_STALE },
  // Finished WC matches — results page
  { path: '/competitions/WC/matches?status=FINISHED',    fresh: MATCH_FRESH,    stale: MATCH_STALE    },
];

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  console.log('[Cron] wc-fixtures refresh started');

  // Build dynamic date-scoped endpoint inside the handler so it uses today's date.
  const dateScoped = {
    path:  `/competitions/WC/matches?dateFrom=${fromISO()}&dateTo=${todayISO()}`,
    fresh: FIXTURES_FRESH,
    stale: FIXTURES_STALE,
  };

  const all = [...ENDPOINTS, dateScoped];

  // Refresh all endpoints in parallel.
  const results = await Promise.all(
    all.map(({ path, fresh, stale }) => refreshEndpoint(path, fresh, stale))
  );

  const ok      = results.filter((r) => r.status === 'ok').length;
  const failed  = results.filter((r) => r.status === 'error').length;
  const elapsed = Date.now() - started;

  console.log(`[Cron] wc-fixtures done | ok=${ok} failed=${failed} | ${elapsed}ms`);

  return NextResponse.json({
    job:      'wc-fixtures',
    ok,
    failed,
    elapsed:  `${elapsed}ms`,
    results,
    timestamp: new Date().toISOString(),
  });
}
