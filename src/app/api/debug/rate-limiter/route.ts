/**
 * GET /api/debug/rate-limiter
 *
 * Live snapshot of the global football-data.org rate limiter and the primary
 * provider health.  Use this to confirm the limiter is draining correctly and
 * that the provider is not stuck in a disabled state after a 403.
 *
 * Response shape:
 * {
 *   queuedRequests:     number,   // callers currently waiting for a slot
 *   lastRequestAt:      string | null,  // ISO timestamp of last dispatch
 *   requestsLastMinute: number,   // dispatches in the rolling 60 s window
 *   intervalMs:         number,   // configured spacing between requests
 *   providerHealthy:    boolean,  // football-data primary has 0 consecutive errors
 *   footballDataConfigured: boolean,
 *   primaryStats: {
 *     requestCount:      number,
 *     errorCount:        number,
 *     consecutiveErrors: number,
 *     lastError:         string | null,
 *     lastErrorAt:       string | null,
 *   },
 *   generatedAt: string,
 * }
 *
 * Auth: requires ?token=<DEBUG_TOKEN> in production.
 *       Unrestricted in development.
 */

import { NextRequest, NextResponse } from 'next/server';
import { footballDataLimiter }       from '@/lib/rate-limiter';
import { providerManager }           from '@/lib/providers/manager';

export const dynamic = 'force-dynamic';

const isProd = process.env.NODE_ENV === 'production';

function checkAuth(req: NextRequest): NextResponse | null {
  if (!isProd) return null;
  const debugToken = process.env.DEBUG_TOKEN;
  const provided   = req.nextUrl.searchParams.get('token');
  if (!debugToken) {
    return NextResponse.json(
      { error: 'DEBUG_TOKEN env var not set — endpoint disabled in production' },
      { status: 503 },
    );
  }
  if (provided !== debugToken) {
    return NextResponse.json(
      { error: 'Unauthorized — invalid or missing ?token= param' },
      { status: 401 },
    );
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const limiter  = footballDataLimiter.getSnapshot();
  const snapshot = providerManager.getDebugSnapshot();
  const primary  = snapshot.primary;

  const body = {
    // Rate limiter state
    queuedRequests:     limiter.queuedRequests,
    lastRequestAt:      limiter.lastRequestAt,
    requestsLastMinute: limiter.requestsLastMinute,
    intervalMs:         limiter.intervalMs,

    // Provider health
    providerHealthy:          snapshot.primaryHealthy,
    footballDataConfigured:   snapshot.footballDataConfigured,

    // Detailed primary stats (for diagnosing sustained errors)
    primaryStats: {
      requestCount:      primary.requestCount,
      errorCount:        primary.errorCount,
      consecutiveErrors: primary.consecutiveErrors,
      lastError:         primary.lastError,
      lastErrorAt:       primary.lastErrorAt
                           ? new Date(primary.lastErrorAt).toISOString()
                           : null,
    },

    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
