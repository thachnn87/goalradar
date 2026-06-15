/**
 * POST /api/telemetry/live
 *
 * LIVE-1 Phase 4: receives per-poll metrics from MatchLiveZone clients.
 * Stores in-process via live-telemetry.ts (not durable — resets on cold start).
 * Best-effort: invalid payloads are dropped silently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordLiveUpdate } from '@/lib/live-telemetry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      matchId?: unknown;
      latencyMs?: unknown;
      scoreChanged?: unknown;
    };
    if (
      typeof body.matchId === 'string' &&
      typeof body.latencyMs === 'number' &&
      typeof body.scoreChanged === 'boolean'
    ) {
      recordLiveUpdate(body.matchId, body.latencyMs, body.scoreChanged);
    }
  } catch {
    // malformed beacon — ignore
  }
  return new NextResponse(null, { status: 204 });
}
