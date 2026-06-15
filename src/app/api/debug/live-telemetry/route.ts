/**
 * GET /api/debug/live-telemetry
 *
 * LIVE-1 Phase 4: exposes aggregated live-poll metrics for all match IDs
 * seen since the last cold start. Data is in-process only.
 */

import { NextResponse } from 'next/server';
import { getLiveTelemetry } from '@/lib/live-telemetry';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getLiveTelemetry());
}
