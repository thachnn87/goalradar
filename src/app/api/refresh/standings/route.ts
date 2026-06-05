/**
 * GET /api/refresh/standings
 *
 * Proactively refreshes all competition standings in Vercel KV.
 * Called by Vercel Cron every 30 minutes so users always read from cache.
 *
 * Endpoints refreshed:
 *   - WC standings (all 12 group tables)
 *   - PL, PD, BL1, SA, FL1, CL standings
 *
 * Cron schedule: "* /30 * * * *"  (every 30 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshEndpoint, isAuthorizedCronRequest } from '@/lib/refresh';
import { COMPETITIONS } from '@/lib/types';

// Must match SWR.STANDINGS in kv-cache.ts.
const STANDINGS_FRESH = 1800;  // 30 min
const STANDINGS_STALE = 3600;  // 60 min (Redis TTL)

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  console.log('[Cron] standings refresh started');

  // Refresh standings for every competition, including WC.
  const results = await Promise.all(
    COMPETITIONS.map(({ code }) =>
      refreshEndpoint(
        `/competitions/${code}/standings`,
        STANDINGS_FRESH,
        STANDINGS_STALE
      )
    )
  );

  const ok      = results.filter((r) => r.status === 'ok').length;
  const failed  = results.filter((r) => r.status === 'error').length;
  const elapsed = Date.now() - started;

  console.log(`[Cron] standings done | ok=${ok} failed=${failed} | ${elapsed}ms`);

  return NextResponse.json({
    job:      'standings',
    ok,
    failed,
    elapsed:  `${elapsed}ms`,
    results,
    timestamp: new Date().toISOString(),
  });
}
