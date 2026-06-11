/**
 * POST /api/telemetry/navigation — PERF-8 Phase 4
 *
 * Receives click→content-visible beacons from match pages and feeds the
 * in-process navigationPerf percentiles (read via /api/debug/performance).
 * Best-effort: invalid payloads are dropped silently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordNavigation } from '@/lib/match-perf-tracker';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { clickToRenderMs?: number };
    if (typeof body.clickToRenderMs === 'number') {
      recordNavigation(body.clickToRenderMs);
      console.log(`[NAV_PERF] clickToRenderMs=${Math.round(body.clickToRenderMs)}`);
    }
  } catch {
    // malformed beacon — ignore
  }
  return new NextResponse(null, { status: 204 });
}
