/**
 * GET /api/debug/revalidation
 *
 * Diagnostic endpoint — shows the last on-demand ISR revalidation run.
 *
 * Auth: same as prewarm-status — CRON_SECRET header/queryparam, or
 *       NODE_ENV=development, or DEBUG_PREWARM=true.
 *
 * Example response:
 * {
 *   "checkedAt": "2026-06-15T12:00:00.000Z",
 *   "lastRun": {
 *     "timestamp":   "2026-06-15T11:55:00.000Z",
 *     "source":      "orchestrator",
 *     "paths":       ["/world-cup-2026", ...],
 *     "revalidated": 11,
 *     "success":     true,
 *     "triggeredBy": "header"
 *   },
 *   "secondsSinceLastRun": 300,
 *   "availablePaths": [...]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadRevalidationRecord, WC_DATA_PATHS } from '@/lib/revalidation';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Auth — mirrors prewarm-status pattern
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.DEBUG_PREWARM === 'true')   return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const lastRun   = await loadRevalidationRecord();

  const secondsSinceLastRun = lastRun
    ? Math.round((Date.now() - new Date(lastRun.timestamp).getTime()) / 1000)
    : null;

  return NextResponse.json({
    checkedAt,
    lastRun,
    secondsSinceLastRun,
    availablePaths: WC_DATA_PATHS,
  });
}
