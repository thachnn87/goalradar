/**
 * GET /api/debug/data18d-perf-benchmark
 *
 * DATA-18D Phase 3 — side-by-side performance benchmark.
 *
 * Runs both data paths for the /world-cup-2026/results page and measures:
 *   - Wall-clock duration
 *   - Match count returned
 *   - JSON payload size (bytes)
 *   - Authority cache telemetry (hits/misses/cold)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/data18d-perf-benchmark?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWCAuthorityMatches, getWCAuthorityMatchesV2 } from '@/lib/api';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const benchmarkedAt = new Date().toISOString();

  // ── OLD PATH: getWCAuthorityMatches() ────────────────────────────────────────
  const oldStart = Date.now();
  let oldMatches: unknown[] = [];
  let oldError: string | null = null;
  try {
    const result = await getWCAuthorityMatches();
    oldMatches = result.matches;
  } catch (err) {
    oldError = err instanceof Error ? err.message : String(err);
  }
  const oldDurationMs = Date.now() - oldStart;
  const oldPayloadBytes = Buffer.byteLength(JSON.stringify(oldMatches), 'utf8');

  // ── NEW PATH: getWCAuthorityMatchesV2() ──────────────────────────────────────
  // Use a fresh builtAt for each measurement to avoid clock skew in telemetry.
  const builtAt  = new Date().toISOString();
  const newStart = Date.now();
  let newMatches: unknown[] = [];
  let newError: string | null = null;
  try {
    const result = await getWCAuthorityMatchesV2(builtAt);
    newMatches = result.matches;
  } catch (err) {
    newError = err instanceof Error ? err.message : String(err);
  }
  const newDurationMs  = Date.now() - newStart;
  const newPayloadBytes = Buffer.byteLength(JSON.stringify(newMatches), 'utf8');

  // ── Authority cache telemetry ─────────────────────────────────────────────────
  let telemetry: Record<string, number> | null = null;
  try {
    const { getAuthorityTelemetry } = await import('@/lib/authority-cache');
    telemetry = getAuthorityTelemetry();
  } catch {
    // non-fatal
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const durationDeltaMs  = oldDurationMs - newDurationMs;
  const payloadDeltaBytes = oldPayloadBytes - newPayloadBytes;
  const durationImprovedPct = oldDurationMs > 0
    ? Math.round((durationDeltaMs / oldDurationMs) * 100)
    : 0;

  return NextResponse.json({
    benchmarkedAt,

    old: {
      path:         'getWCAuthorityMatches',
      durationMs:   oldDurationMs,
      matchCount:   oldMatches.length,
      payloadBytes: oldPayloadBytes,
      payloadKB:    Math.round(oldPayloadBytes / 1024 * 10) / 10,
      error:        oldError,
    },

    new: {
      path:         'getWCAuthorityMatchesV2',
      durationMs:   newDurationMs,
      matchCount:   newMatches.length,
      payloadBytes: newPayloadBytes,
      payloadKB:    Math.round(newPayloadBytes / 1024 * 10) / 10,
      error:        newError,
    },

    delta: {
      durationMs:        durationDeltaMs,
      durationImprovedPct,
      payloadBytes:      payloadDeltaBytes,
      payloadKBReduced:  Math.round(payloadDeltaBytes / 1024 * 10) / 10,
      verdict:           durationDeltaMs > 0 ? 'NEW_FASTER' : durationDeltaMs < 0 ? 'OLD_FASTER' : 'EQUAL',
    },

    authorityTelemetry: telemetry,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
