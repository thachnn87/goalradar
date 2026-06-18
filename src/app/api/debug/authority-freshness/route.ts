/**
 * GET /api/debug/authority-freshness
 *
 * DATA-18G Phase 2 — Authority cache age and staleness check.
 *
 * Reads the raw authority cache envelope directly from KV without triggering
 * a cold rebuild (so it reports truly-absent cache as stale, not a fresh rebuild).
 *
 * Returns:
 *   {
 *     builtAt:   ISO-8601 build timestamp from the envelope
 *     ageSec:    seconds since the cache was built
 *     ttlTier:   'live' | 'today' | 'normal'
 *     ttlSec:    expected TTL for this tier in seconds
 *     stale:     true if ageSec > ttlSec * 1.5 (50% grace before declaring stale)
 *     source:    'primary' | 'dr' | 'absent'
 *     matchCount: number of matches in the payload
 *     liveCount:  number of live matches at build time
 *     drPresent:  true if DR copy is also present
 *   }
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/authority-freshness?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { AUTHORITY_KEY, AUTHORITY_DR_KEY, type AuthorityCacheEnvelope } from '@/lib/authority-cache';

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

// ---------------------------------------------------------------------------
// TTL tier expectations (must stay in sync with authority-cache.ts)
// ---------------------------------------------------------------------------

const TTL_BY_TIER: Record<AuthorityCacheEnvelope['ttlTier'], number> = {
  live:   30,
  today:  300,
  normal: 900,
};

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now = Date.now();
  const checkedAt = new Date(now).toISOString();

  // Read primary and DR in parallel — do NOT call readAuthorityCache() which would
  // trigger a cold rebuild and mask the absence.
  const [primaryResult, drResult] = await Promise.allSettled([
    kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY),
    kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY),
  ]);

  const primary = primaryResult.status === 'fulfilled' ? primaryResult.value : null;
  const dr      = drResult.status      === 'fulfilled' ? drResult.value      : null;

  const envelope = (primary?.version === 1) ? primary
                 : (dr?.version      === 1) ? dr
                 : null;

  const source: 'primary' | 'dr' | 'absent' =
    primary?.version === 1 ? 'primary'
    : dr?.version    === 1 ? 'dr'
    : 'absent';

  if (!envelope) {
    return NextResponse.json(
      {
        checkedAt,
        source:     'absent',
        builtAt:    null,
        ageSec:     null,
        ttlTier:    null,
        ttlSec:     null,
        stale:      true,
        matchCount: 0,
        liveCount:  0,
        drPresent:  false,
        verdict:    'RED',
        note:       'Authority cache absent from KV — cold rebuild will serve on demand. Non-critical; warm via orchestrator cron.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const ageSec  = Math.round((now - new Date(envelope.builtAt).getTime()) / 1000);
  const ttlSec  = TTL_BY_TIER[envelope.ttlTier] ?? 900;
  // Grace: 1.5× TTL before declaring stale — one missed cron cycle is acceptable
  const stale   = ageSec > ttlSec * 1.5;
  const drPresent = dr?.version === 1;

  const verdict: 'GREEN' | 'YELLOW' | 'RED' =
    source === 'absent'             ? 'YELLOW' // cache cold — cold rebuild serves correctly
    : stale && source === 'primary' ? 'YELLOW'
    : stale && source === 'dr'      ? 'RED'    // DR serving = primary evicted = degraded
    : 'GREEN';

  return NextResponse.json(
    {
      checkedAt,
      source,
      builtAt:    envelope.builtAt,
      ageSec,
      ttlTier:    envelope.ttlTier,
      ttlSec,
      stale,
      matchCount: envelope.matchCount,
      liveCount:  envelope.liveCount,
      drPresent,
      verdict,
      note: verdict === 'GREEN'
        ? `Authority cache fresh (${ageSec}s old, tier=${envelope.ttlTier}, ttl=${ttlSec}s).`
        : verdict === 'YELLOW'
        ? `Authority cache stale — ${ageSec}s old vs ${ttlSec}s TTL. Next cron will refresh.`
        : source === 'dr'
        ? `Primary evicted — serving from DR (${ageSec}s old). Orchestrator cron may be down.`
        : `Authority cache absent — cold rebuild serves on demand. Run orchestrator cron to pre-warm.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
