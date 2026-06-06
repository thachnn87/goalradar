/**
 * GET /api/analytics/summary
 *
 * Returns a 7-day GA4 metrics summary: total page views, top pages,
 * and top competitions by competition_view event count.
 *
 * Auth: Google service account (see src/lib/ga4-reporting.ts).
 * Returns null JSON body if credentials are not configured — callers
 * must handle the null case gracefully.
 *
 * Cache: s-maxage=1800 (30 min). The GA4 Data API has a default quota
 * of 10 requests per hour per property — caching prevents exhaustion.
 */

import { NextResponse } from 'next/server';
import { fetchGA4Summary } from '@/lib/ga4-reporting';

export const dynamic = 'force-dynamic';

export async function GET() {
  const summary = await fetchGA4Summary();

  return NextResponse.json(summary, {
    status: 200,
    headers: {
      // Edge cache 30 min; serve stale for up to 1 h while revalidating
      'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600',
    },
  });
}
