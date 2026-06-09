/**
 * GET /api/refresh/standings
 *
 * @deprecated Merged into /api/cron/orchestrator (RATE-3).
 *
 * This endpoint is kept as a tombstone so existing external scheduler configs
 * continue to return HTTP 200 and don't trigger alerts. The cron orchestrator
 * now handles all standings refresh tasks sequentially.
 *
 * Update your scheduler to call /api/cron/orchestrator instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/refresh';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.warn('[Cron] standings is deprecated — use /api/cron/orchestrator');

  return NextResponse.json({
    deprecated: true,
    message:    'This endpoint has been merged into /api/cron/orchestrator (RATE-3). Please update your scheduler.',
    redirect:   '/api/cron/orchestrator',
    timestamp:  new Date().toISOString(),
  });
}
