/**
 * GET /api/cron/prewarm-worldcup
 *
 * @deprecated Merged into /api/cron/orchestrator (RATE-3).
 *
 * This endpoint is kept as a tombstone so existing external scheduler configs
 * (UptimeRobot, EasyCron, GitHub Actions) continue to return HTTP 200 and
 * don't trigger alerts. The cron orchestrator now handles all WC prewarm
 * tasks — and all standings tasks — in a single sequential run.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  OR  ?secret=<CRON_SECRET>
 * Update your scheduler to call /api/cron/orchestrator instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedExternalRequest } from '@/lib/refresh';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAuthorizedExternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.warn('[Cron] prewarm-worldcup is deprecated — use /api/cron/orchestrator');

  return NextResponse.json({
    deprecated: true,
    message:    'This endpoint has been merged into /api/cron/orchestrator (RATE-3). Please update your scheduler.',
    redirect:   '/api/cron/orchestrator',
    timestamp:  new Date().toISOString(),
  });
}
