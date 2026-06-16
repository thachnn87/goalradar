/**
 * POST /api/debug/hybrid-enrichment/refresh-lookup
 *
 * DATA-11B: Build or refresh the api-football fixture ID lookup table.
 *
 * Fetches all WC 2026 fixtures from api-football (1 API call) and writes
 * goalradar:af:lookup:WC:2026 to KV with 24h TTL.
 *
 * Must be run once before ENABLE_AF_ENRICHMENT=true takes effect.
 * Re-run daily or after schedule changes.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development.
 *
 * Example:
 *   curl -X POST "https://goalradar.org/api/debug/hybrid-enrichment/refresh-lookup?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshAfLookupTable }      from '@/lib/af-id-map';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await refreshAfLookupTable();
    return NextResponse.json({
      ok:         true,
      count:      result.count,
      key:        result.key,
      collisions: result.collisions,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
