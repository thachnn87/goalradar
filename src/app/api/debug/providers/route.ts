/**
 * GET /api/debug/providers
 *
 * Returns the current health snapshot of the multi-provider architecture:
 *   - Which provider is currently active
 *   - Per-provider request / error counts and last error
 *   - Last 10 failover events with timestamps
 *
 * Access control:
 *   Requires the DEBUG_TOKEN env var to match the ?token= query param.
 *   In development (NODE_ENV !== 'production') the token check is skipped.
 *   Set DEBUG_TOKEN in Vercel project settings for production access.
 *
 * Example:
 *   GET /api/debug/providers?token=my-secret-token
 *
 * Response shape: ProvidersDebugResponse (src/lib/providers/types.ts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { providerManager }           from '@/lib/providers/manager';

export const dynamic = 'force-dynamic'; // never cache — always fresh snapshot

const isProd = process.env.NODE_ENV === 'production';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────
  if (isProd) {
    const debugToken = process.env.DEBUG_TOKEN;
    const provided   = req.nextUrl.searchParams.get('token');

    if (!debugToken) {
      return NextResponse.json(
        { error: 'DEBUG_TOKEN env var is not set — endpoint disabled in production' },
        { status: 503 },
      );
    }

    if (provided !== debugToken) {
      return NextResponse.json(
        { error: 'Unauthorized — invalid or missing ?token= param' },
        { status: 401 },
      );
    }
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────
  const snapshot = providerManager.getDebugSnapshot();

  return NextResponse.json(snapshot, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type':  'application/json',
    },
  });
}
