/**
 * In-memory server-side cache for football-data.org API responses.
 *
 * Two layers of protection:
 *   1. TTL cache  — returns stored data until it expires.
 *   2. In-flight deduplication  — collapses concurrent requests for the
 *      same key into a single HTTP call, preventing the thundering-herd
 *      problem during high-traffic bursts.
 *
 * Persists across requests for the lifetime of the Node.js process.
 * In serverless environments (Vercel) it remains warm within the same
 * function instance; a cold start will miss and re-populate.
 *
 * Usage:
 *   const data = await withCache('key', TTL.FIXTURES, () => fetchSomething());
 */

// ---------------------------------------------------------------------------
// TTL constants
// ---------------------------------------------------------------------------

export const TTL = {
  /** Live scores — must be fresh. */
  LIVE:      30,
  /** Match detail, H2H — refresh every minute. */
  MATCH:     60,
  /** Fixtures, team match history, results — 10 minutes. */
  FIXTURES:  600,
  /** Standings, team profiles — 30 minutes. */
  STANDINGS: 1800,
} as const;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface CacheEntry {
  data:      unknown;
  expiresAt: number;
  fetchedAt: number;
}

/** Primary cache store. Key → entry. */
const store    = new Map<string, CacheEntry>();

/** In-flight deduplication. Key → pending promise. */
const inflight = new Map<string, Promise<unknown>>();

/** Hit/miss counters (resets on server restart). */
let _hits   = 0;
let _misses = 0;

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

function ratio(): string {
  const total = _hits + _misses;
  return total > 0 ? `${Math.round((_hits / total) * 100)}%` : 'n/a';
}

function ttlRemaining(entry: CacheEntry): number {
  return Math.ceil((entry.expiresAt - Date.now()) / 1000);
}

// ---------------------------------------------------------------------------
// Core cache function
// ---------------------------------------------------------------------------

/**
 * Wraps an async fetcher with in-memory TTL caching and in-flight deduplication.
 *
 * @param key       Cache key — typically the API endpoint string.
 * @param ttl       Time-to-live in seconds (use TTL.* constants).
 * @param fetcher   Async function that performs the actual data fetch.
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();

  // ── 1. Cache hit ─────────────────────────────────────────────────────────
  const cached = store.get(key);
  if (cached && cached.expiresAt > now) {
    _hits++;
    console.log(
      `[Cache] HIT   ${key} | remaining ${ttlRemaining(cached)}s | ratio ${ratio()} (${_hits}/${_hits + _misses})`
    );
    return cached.data as T;
  }

  // ── 2. In-flight deduplication ───────────────────────────────────────────
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) {
    console.log(`[Cache] DEDUP ${key} | coalescing with in-flight request`);
    return pending;
  }

  // ── 3. Cache miss — fetch ────────────────────────────────────────────────
  _misses++;
  console.log(
    `[Cache] MISS  ${key} | ratio ${ratio()} (${_hits}/${_hits + _misses})`
  );

  const promise = fetcher()
    .then((data) => {
      store.set(key, { data, expiresAt: Date.now() + ttl * 1000, fetchedAt: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err: unknown) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise as Promise<unknown>);
  return promise;
}

// ---------------------------------------------------------------------------
// Cache management utilities
// ---------------------------------------------------------------------------

/** Returns current hit ratio statistics. */
export function getCacheStats() {
  const total = _hits + _misses;
  return {
    hits:         _hits,
    misses:       _misses,
    total,
    hitRatio:     total > 0 ? Math.round((_hits / total) * 100) : 0,
    hitRatioStr:  ratio(),
    storeSize:    store.size,
    inflightCount: inflight.size,
  };
}

/** Evict a single key (useful after a write/mutation). */
export function invalidate(key: string): boolean {
  return store.delete(key);
}

/** Remove all expired entries (call periodically if needed). */
export function purgeExpired(): number {
  const now = Date.now();
  let purged = 0;
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
      purged++;
    }
  }
  return purged;
}
