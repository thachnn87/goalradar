/**
 * GET /api/debug/prewarm-status
 *
 * Diagnostic endpoint — shows the last prewarm run result and the current
 * freshness of every WC KV cache entry.
 *
 * Auth
 * ────
 * Accessible without auth in development (NODE_ENV=development) or when
 * DEBUG_PREWARM=true is set.  In production both are off by default, so
 * CRON_SECRET is required (same header or ?secret= query param as the
 * prewarm route itself).
 *
 * Example response
 * ────────────────
 * {
 *   "checkedAt": "2026-06-08T12:00:00.000Z",
 *   "kvEnabled": true,
 *   "lastRun": {
 *     "timestamp":   "2026-06-08T11:55:00.000Z",
 *     "elapsedMs":   843,
 *     "ok":          6,
 *     "failed":      0,
 *     "total":       6,
 *     "triggeredBy": "header",
 *     "results": [
 *       { "label": "wc-fixtures", "status": "ok", "elapsedMs": 312 },
 *       ...
 *     ]
 *   },
 *   "secondsSinceLastRun": 300,
 *   "cacheEntries": [
 *     {
 *       "label":        "wc-fixtures",
 *       "kvKey":        "goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED",
 *       "state":        "fresh",
 *       "ageMs":        12000,
 *       "freshUntil":   "2026-06-08T12:15:00.000Z",
 *       "fetchedAt":    "2026-06-08T12:00:00.000Z"
 *     },
 *     {
 *       "label": "wc-live",
 *       "kvKey": "goalradar:live:wc-matches",
 *       "state": "fresh",
 *       "ageMs": 8000
 *     },
 *     ...
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { loadPrewarmRecord, isAuthorizedExternalRequest } from '@/lib/refresh';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAllowed(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.DEBUG_PREWARM === 'true')   return true;
  return isAuthorizedExternalRequest(req);
}

// ---------------------------------------------------------------------------
// KV freshness probe
// ---------------------------------------------------------------------------

// Matches the KVEntry schema in kv-cache.ts (data, fetchedAt, freshUntil)
interface StandardKVEntry {
  data:       unknown;
  fetchedAt:  number;
  freshUntil: number;
}

// Matches the entry schema in live-cache.ts (matches, fetchedAt — no freshUntil)
interface LiveCacheEntry {
  matches:   unknown[];
  fetchedAt: number;
}

type CacheState = 'fresh' | 'stale' | 'missing' | 'unknown';

interface CacheEntryStatus {
  label:      string;
  kvKey:      string;
  state:      CacheState;
  ageMs:      number | null;
  fetchedAt:  string | null;  // ISO string
  freshUntil: string | null;  // ISO string — null for live-cache entries
  count:      number | null;  // match count (where available)
}

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

const LIVE_CACHE_TTL_MS = 30_000; // must match live-cache.ts LIVE_TTL_SEC

/** Probe a standard KV entry (written by kv-cache.ts fetchWithKV). */
async function probeStandard(
  label:  string,
  kvKey:  string,
): Promise<CacheEntryStatus> {
  if (!KV_ENABLED) return { label, kvKey, state: 'unknown', ageMs: null, fetchedAt: null, freshUntil: null, count: null };
  try {
    const entry = await kv.get<StandardKVEntry>(kvKey);
    if (!entry) return { label, kvKey, state: 'missing', ageMs: null, fetchedAt: null, freshUntil: null, count: null };

    const now   = Date.now();
    const ageMs = now - entry.fetchedAt;
    const state: CacheState = now < entry.freshUntil ? 'fresh' : 'stale';

    // Count matches if the payload has a .matches array
    const data    = entry.data as { matches?: unknown[] } | null;
    const count   = Array.isArray(data?.matches) ? data.matches.length : null;

    return {
      label,
      kvKey,
      state,
      ageMs,
      fetchedAt:  new Date(entry.fetchedAt).toISOString(),
      freshUntil: new Date(entry.freshUntil).toISOString(),
      count,
    };
  } catch {
    return { label, kvKey, state: 'unknown', ageMs: null, fetchedAt: null, freshUntil: null, count: null };
  }
}

/** Probe the live-cache KV entry (written by live-cache.ts — different schema). */
async function probeLiveCache(
  label:  string,
  kvKey:  string,
): Promise<CacheEntryStatus> {
  if (!KV_ENABLED) return { label, kvKey, state: 'unknown', ageMs: null, fetchedAt: null, freshUntil: null, count: null };
  try {
    const entry = await kv.get<LiveCacheEntry>(kvKey);
    if (!entry) return { label, kvKey, state: 'missing', ageMs: null, fetchedAt: null, freshUntil: null, count: null };

    const now   = Date.now();
    const ageMs = now - entry.fetchedAt;
    const state: CacheState = ageMs < LIVE_CACHE_TTL_MS ? 'fresh' : 'stale';

    return {
      label,
      kvKey,
      state,
      ageMs,
      fetchedAt:  new Date(entry.fetchedAt).toISOString(),
      freshUntil: null,  // live-cache.ts does not store freshUntil
      count:      Array.isArray(entry.matches) ? entry.matches.length : null,
    };
  } catch {
    return { label, kvKey, state: 'unknown', ageMs: null, fetchedAt: null, freshUntil: null, count: null };
  }
}

// ---------------------------------------------------------------------------
// Cache keys to probe
// ---------------------------------------------------------------------------

function todayISO()  { return new Date().toISOString().split('T')[0]; }
function fromISO()   { return new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]; }

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAllowed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();

  // Read last prewarm run record from KV
  const lastRun = await loadPrewarmRecord();

  // Compute age of last run
  const secondsSinceLastRun = lastRun
    ? Math.floor((Date.now() - new Date(lastRun.timestamp).getTime()) / 1000)
    : null;

  // Probe each WC cache entry for freshness
  const cacheEntries = await Promise.all([
    probeStandard(
      'wc-fixtures',
      'goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED',
    ),
    probeStandard(
      'wc-results',
      'goalradar:/competitions/WC/matches?status=FINISHED',
    ),
    probeLiveCache(
      'wc-live',
      'goalradar:live:wc-matches',
    ),
    probeStandard(
      'wc-standings',
      'goalradar:/competitions/WC/standings',
    ),
    probeStandard(
      'wc-all-matches',
      'goalradar:/competitions/WC/matches',
    ),
    probeStandard(
      'wc-recent',
      `goalradar:/competitions/WC/matches?dateFrom=${fromISO()}&dateTo=${todayISO()}`,
    ),
  ]);

  const freshCount   = cacheEntries.filter((e) => e.state === 'fresh').length;
  const staleCount   = cacheEntries.filter((e) => e.state === 'stale').length;
  const missingCount = cacheEntries.filter((e) => e.state === 'missing').length;

  return NextResponse.json({
    checkedAt,
    kvEnabled: KV_ENABLED,
    lastRun,
    secondsSinceLastRun,
    summary: {
      fresh:   freshCount,
      stale:   staleCount,
      missing: missingCount,
      total:   cacheEntries.length,
    },
    cacheEntries,
  });
}
