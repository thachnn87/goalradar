/**
 * GET /api/debug/provider-smoke
 *
 * Smoke-tests both providers independently by making real getFixtures('WC')
 * calls to each, bypassing providerManager failover so each is tested in
 * isolation.
 *
 * Response:
 *   {
 *     footballData: { success, status, fixtureCount, latencyMs, error? },
 *     apiFootball:  { success, status, fixtureCount, latencyMs, error? },
 *     testedAt:     ISO string,
 *   }
 *
 * Access control: DEBUG_TOKEN guard (same as other debug endpoints).
 *   GET /api/debug/provider-smoke?token=<DEBUG_TOKEN>
 *   (token check skipped in development)
 */

import { NextRequest, NextResponse } from 'next/server';
import { FootballDataProvider }       from '@/lib/providers/football-data';
import { ApiFootballProvider }        from '@/lib/providers/api-football';
import { ApiUnavailableError }        from '@/lib/errors';
import { NotFoundError }              from '@/lib/errors';

export const dynamic = 'force-dynamic';

const isProd = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Per-provider smoke probe
// ---------------------------------------------------------------------------

interface SmokeResult {
  success:       boolean;
  status:        'ok' | 'error' | 'not_configured';
  fixtureCount?: number;
  latencyMs:     number;
  error?:        string;
}

async function probeFixtures(
  name:  string,
  probe: () => Promise<{ matches: unknown[] }>,
  configured: boolean,
): Promise<SmokeResult> {
  if (!configured) {
    return { success: false, status: 'not_configured', latencyMs: 0 };
  }

  const t0 = Date.now();
  try {
    const result = await probe();
    const latencyMs = Date.now() - t0;
    return {
      success:      true,
      status:       'ok',
      fixtureCount: Array.isArray(result.matches) ? result.matches.length : 0,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    let errMsg = err instanceof Error ? err.message : String(err);
    if (err instanceof ApiUnavailableError) errMsg = `ApiUnavailableError(${err.reason}): ${err.message}`;
    if (err instanceof NotFoundError)       errMsg = `NotFoundError: ${err.message}`;
    return { success: false, status: 'error', latencyMs, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const fdConfigured = typeof process.env.FOOTBALL_API_KEY  === 'string' && process.env.FOOTBALL_API_KEY.trim()  !== '';
  const afConfigured = typeof process.env.API_FOOTBALL_KEY  === 'string' && process.env.API_FOOTBALL_KEY.trim()  !== '';

  const fd = new FootballDataProvider();
  const af = new ApiFootballProvider();

  // Run both probes in parallel — independent, no failover between them.
  const [fdResult, afResult] = await Promise.all([
    probeFixtures('football-data', () => fd.getFixtures('WC'), fdConfigured),
    probeFixtures('api-football',  () => af.getFixtures('WC'), afConfigured),
  ]);

  const body = {
    footballData: fdResult,
    apiFootball:  afResult,
    testedAt:     new Date().toISOString(),
  };

  console.log(
    `[PROVIDER_SMOKE] football-data=${fdResult.success ? `OK fixtures=${fdResult.fixtureCount}` : `FAIL ${fdResult.error}`} ` +
    `latency=${fdResult.latencyMs}ms | ` +
    `api-football=${afResult.success ? `OK fixtures=${afResult.fixtureCount}` : `FAIL ${afResult.error}`} ` +
    `latency=${afResult.latencyMs}ms`,
  );

  return NextResponse.json(body, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
