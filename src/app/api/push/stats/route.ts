/**
 * GET /api/push/stats
 *
 * Returns push notification opt-in statistics.
 * Reads from Vercel KV counters written by /api/push/opt-in.
 *
 * Response:
 *   {
 *     totalGrants: number,
 *     today:       number,   // grants today (YYYY-MM-DD)
 *     updatedAt:   string,   // ISO timestamp
 *   }
 *
 * Access: production requires ?token=<DEBUG_TOKEN> (same token as /api/debug/providers).
 * Development: no token check.
 *
 * Cached for 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';

export const revalidate = 300; // 5 minutes

const isProd      = process.env.NODE_ENV === 'production';
const KV_AVAILABLE =
  typeof process.env.KV_REST_API_URL === 'string' && process.env.KV_REST_API_URL.trim() !== '';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth (production only) ─────────────────────────────────────────────────
  if (isProd) {
    const debugToken = process.env.DEBUG_TOKEN;
    const provided   = req.nextUrl.searchParams.get('token');

    if (!debugToken) {
      return NextResponse.json({ error: 'DEBUG_TOKEN not set' }, { status: 503 });
    }
    if (provided !== debugToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  if (!KV_AVAILABLE) {
    return NextResponse.json({
      totalGrants: 0,
      today:       0,
      updatedAt:   new Date().toISOString(),
    });
  }

  const [totalGrants, todayGrants] = await Promise.all([
    kv.get<number>('push:grants:total'),
    kv.get<number>(`push:grants:${today}`),
  ]);

  return NextResponse.json({
    totalGrants: totalGrants ?? 0,
    today:       todayGrants ?? 0,
    updatedAt:   new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
