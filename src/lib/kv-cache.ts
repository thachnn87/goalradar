/**
 * Vercel KV cache with stale-while-revalidate strategy.
 *
 * Architecture — two cache tiers:
 *   L1: In-memory (cache.ts)  — sub-millisecond, per-process, cold-start miss.
 *   L2: Vercel KV (this file) — ~10 ms Redis, persists across cold starts,
 *                               shared across all instances in a deployment.
 *
 * Stale-while-revalidate (SWR) behaviour:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  0 ──── freshTtl ──── staleTtl ──── (KV auto-expires)      │
 *   │  [   fresh   ]  [ stale + bg-revalidate ]  [ miss ]        │
 *   └─────────────────────────────────────────────────────────────┘
 *   - FRESH : return stored data immediately, no revalidation.
 *   - STALE : return stored data immediately AND trigger a background
 *             fetch to repopulate KV for the next request.
 *   - MISS  : await fresh fetch, store, return.
 *
 * KV requires these env vars (auto-provisioned by Vercel KV dashboard):
 *   KV_REST_API_URL
 *   KV_REST_API_TOKEN
 *
 * Graceful degradation: if KV is not configured the function falls
 * through to a direct fetch — no crash, just no KV caching.
 */

import { kv } from '@vercel/kv';

// ---------------------------------------------------------------------------
// Availability guard
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

// ---------------------------------------------------------------------------
// SWR TTL presets
// ---------------------------------------------------------------------------

export const SWR = {
  /** Live scores — stale up to 60 s, KV entry lives 60 s. */
  LIVE: { fresh: 30, stale: 60 } as const,

  /** Match detail / H2H — stale up to 2 min. */
  MATCH: { fresh: 60, stale: 120 } as const,

  /** Fixtures / recent matches — stale up to 20 min. */
  FIXTURES: { fresh: 600, stale: 1200 } as const,

  /** Standings / team info — stale up to 1 hour. */
  STANDINGS: { fresh: 1800, stale: 3600 } as const,
};

// ---------------------------------------------------------------------------
// KV entry schema
// ---------------------------------------------------------------------------

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number; // epoch ms
  freshUntil: number; // epoch ms — after this time the entry is "stale"
}

// ---------------------------------------------------------------------------
// Hit/miss counters (per-process, resets on cold start)
// ---------------------------------------------------------------------------

let _hits   = 0;
let _stale  = 0;
let _misses = 0;

function logRatio() {
  const total = _hits + _stale + _misses;
  if (total === 0) return 'n/a';
  const effective = _hits + _stale; // stale still saves a blocking fetch
  return `${Math.round((effective / total) * 100)}%`;
}

// ---------------------------------------------------------------------------
// Core SWR function
// ---------------------------------------------------------------------------

/**
 * Fetch data with a stale-while-revalidate KV cache.
 *
 * @param key       Cache key — use the API endpoint string for clarity.
 * @param swr       SWR timing config (use SWR.* presets).
 * @param fetcher   Async function that performs the real data fetch.
 */
export async function withKVCache<T>(
  key:     string,
  swr:     { fresh: number; stale: number },
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!KV_ENABLED) {
    // KV not configured — fall through to direct fetch (dev / CI).
    console.log(`[KV] SKIP ${key} — KV not configured, fetching directly`);
    return fetcher();
  }

  const now      = Date.now();
  const kvKey    = `goalradar:${key}`;
  let   entry: KVEntry<T> | null = null;

  // ── 1. Try reading from KV ──────────────────────────────────────────────
  try {
    entry = await kv.get<KVEntry<T>>(kvKey);
  } catch (err) {
    // KV read failure — degrade gracefully, don't surface to user.
    console.error(`[KV] READ error on ${key}:`, err instanceof Error ? err.message : String(err));
  }

  // ── 2. FRESH hit ────────────────────────────────────────────────────────
  if (entry && now < entry.freshUntil) {
    _hits++;
    const remaining = Math.ceil((entry.freshUntil - now) / 1000);
    console.log(`[KV] HIT   ${key} | fresh for ${remaining}s more | ratio ${logRatio()} (${_hits}+${_stale}/${_hits + _stale + _misses})`);
    return entry.data;
  }

  // ── 3. STALE hit — serve stale, revalidate in background ────────────────
  if (entry) {
    _stale++;
    console.log(`[KV] STALE ${key} | serving stale, triggering bg-revalidate | ratio ${logRatio()}`);
    // Fire-and-forget background revalidation.
    // Best-effort in serverless — if the process is killed before the
    // revalidation completes the next request will also be stale,
    // triggering another background fetch until it eventually succeeds.
    revalidate(kvKey, key, swr, fetcher).catch((err) =>
      console.error(`[KV] BG-REVALIDATE failed on ${key}:`, err instanceof Error ? err.message : String(err))
    );
    return entry.data;
  }

  // ── 4. MISS — blocking fetch ─────────────────────────────────────────────
  _misses++;
  console.log(`[KV] MISS  ${key} | ratio ${logRatio()} (${_hits + _stale}/${_hits + _stale + _misses})`);

  const data = await fetcher();
  await storeInKV<T>(kvKey, key, data, swr).catch((err) =>
    console.error(`[KV] WRITE error on ${key}:`, err instanceof Error ? err.message : String(err))
  );
  return data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch fresh data and write it back to KV. */
async function revalidate<T>(
  kvKey:   string,
  logKey:  string,
  swr:     { fresh: number; stale: number },
  fetcher: () => Promise<T>,
): Promise<void> {
  const data = await fetcher();
  await storeInKV<T>(kvKey, logKey, data, swr);
  console.log(`[KV] REVALIDATED ${logKey}`);
}

/** Write a KV entry with the correct TTL and metadata. */
async function storeInKV<T>(
  kvKey:  string,
  logKey: string,
  data:   T,
  swr:    { fresh: number; stale: number },
): Promise<void> {
  const now   = Date.now();
  const entry: KVEntry<T> = {
    data,
    fetchedAt:  now,
    freshUntil: now + swr.fresh * 1000,
  };
  // The KV TTL (ex) is the *stale* period — Redis auto-purges after that.
  await kv.set(kvKey, entry, { ex: swr.stale });
  console.log(`[KV] SET   ${logKey} | fresh ${swr.fresh}s / stale ${swr.stale}s`);
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export function getKVCacheStats() {
  const total     = _hits + _stale + _misses;
  const effective = _hits + _stale;
  return {
    hits:          _hits,
    stale:         _stale,
    misses:        _misses,
    total,
    effectiveHits: effective,
    hitRatio:      total > 0 ? Math.round((effective / total) * 100) : 0,
    kvEnabled:     KV_ENABLED,
  };
}

/** Manually invalidate a KV entry (e.g. after a write). */
export async function kvInvalidate(key: string): Promise<void> {
  if (!KV_ENABLED) return;
  await kv.del(`goalradar:${key}`).catch(() => undefined);
}
