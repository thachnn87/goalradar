/**
 * GET /api/debug/provider-health
 *
 * Actively tests both providers by making a real fixtures request
 * (WC upcoming matches) to each and measuring latency + success.
 *
 * Unlike /api/debug/providers (which returns in-process counters),
 * this endpoint makes LIVE HTTP calls on every invocation so it
 * accurately reflects whether each provider is reachable right now.
 *
 * Response:
 *   {
 *     football-data: { healthy, latencyMs, error? },
 *     api-football:  { healthy, latencyMs, error? },
 *     testedAt:      ISO string,
 *   }
 *
 * Access control: same DEBUG_TOKEN guard as /api/debug/providers.
 *
 * Example:
 *   GET /api/debug/provider-health?token=my-secret-token
 */

import { NextRequest, NextResponse } from 'next/server';
import { FootballDataProvider }       from '@/lib/providers/football-data';
import { ApiFootballProvider }        from '@/lib/providers/api-football';

export const dynamic = 'force-dynamic'; // never cache

const isProd = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Auth helper (shared with /api/debug/providers)
// ---------------------------------------------------------------------------

function checkAuth(req: NextRequest): NextResponse | null {
  if (!isProd) return null; // dev — skip auth

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
  return null;
}

// ---------------------------------------------------------------------------
// Single provider probe — times a real getFixtures('WC') call
// ---------------------------------------------------------------------------

interface ProbeResult {
  healthy:    boolean;
  latencyMs:  number;
  matchCount?: number;
  error?:      string;
}

async function probeProvider(
  name: string,
  probe: () => Promise<{ matches: { length: number }[] } | { matches: { length: number } }>,
): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const result = await probe() as { matches: unknown[] };
    return {
      healthy:    true,
      latencyMs:  Date.now() - t0,
      matchCount: Array.isArray(result.matches) ? result.matches.length : 0,
    };
  } catch (err) {
    return {
      healthy:   false,
      latencyMs: Date.now() - t0,
      error:     err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const fd = new FootballDataProvider();
  const af = new ApiFootballProvider();

  // Run both probes in parallel — independent, don't wait for each other.
  const [fdResult, afResult] = await Promise.all([
    probeProvider('football-data', () => fd.getFixtures('WC')),
    probeProvider('api-football',  () => af.getFixtures('WC')),
  ]);

  const body = {
    'football-data': fdResult,
    'api-football':  afResult,
    testedAt:        new Date().toISOString(),
  };

  // Log results for Vercel log analysis
  console.log(
    `[PROVIDER_HEALTH] football-data=${fdResult.healthy ? 'OK' : 'FAIL'} ` +
    `latency=${fdResult.latencyMs}ms | ` +
    `api-football=${afResult.healthy ? 'OK' : 'FAIL'} ` +
    `latency=${afResult.latencyMs}ms`,
  );

  return NextResponse.json(body, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
