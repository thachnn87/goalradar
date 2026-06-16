/**
 * GET /api/debug/live-health
 *
 * DATA-10 Phase 4 — Live cache health snapshot.
 *
 * Returns the current state of goalradar:live:matches without touching L1 or
 * the provider. Useful for verifying the live pipeline during a match.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development.
 *
 * Response:
 *   {
 *     status:        'ok' | 'stale' | 'empty' | 'kv-disabled',
 *     liveMatches:   number,           // count of IN_PLAY/PAUSED matches in KV
 *     kvAgeSeconds:  number | null,    // seconds since last KV write
 *     lastRefresh:   string | null,    // ISO timestamp of last KV write
 *     matches: [{ id, home, away, score, status, minute }],
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                         from '@vercel/kv';

export const dynamic = 'force-dynamic';

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

const KV_KEY      = 'goalradar:live:matches';
const LIVE_TTL_MS = 30_000;

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;

  return false;
}

interface KVEntry {
  matches:   { id: number; status: string; minute?: number | null; score: unknown;
               homeTeam?: { name?: string }; awayTeam?: { name?: string } }[];
  fetchedAt: number;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!KV_ENABLED) {
    return NextResponse.json({ status: 'kv-disabled', liveMatches: 0, kvAgeSeconds: null, lastRefresh: null, matches: [] });
  }

  const now = Date.now();

  let entry: KVEntry | null = null;
  try {
    entry = await kv.get<KVEntry>(KV_KEY);
  } catch (err) {
    return NextResponse.json({
      status: 'error',
      error:  err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }

  if (!entry) {
    return NextResponse.json({
      status:       'empty',
      liveMatches:  0,
      kvAgeSeconds: null,
      lastRefresh:  null,
      matches:      [],
    });
  }

  const kvAgeMs      = now - entry.fetchedAt;
  const kvAgeSeconds = Math.round(kvAgeMs / 1000);
  const lastRefresh  = new Date(entry.fetchedAt).toISOString();
  const isStale      = kvAgeMs > LIVE_TTL_MS;

  const matches = entry.matches.map((m) => ({
    id:     m.id,
    home:   m.homeTeam?.name ?? '?',
    away:   m.awayTeam?.name ?? '?',
    status: m.status,
    minute: m.minute ?? null,
    score:  m.score,
  }));

  return NextResponse.json({
    status:       isStale ? 'stale' : 'ok',
    liveMatches:  matches.length,
    kvAgeSeconds,
    lastRefresh,
    ttlSeconds:   30,
    matches,
    checkedAt:    new Date(now).toISOString(),
  });
}
