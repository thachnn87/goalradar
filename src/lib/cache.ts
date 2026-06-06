/**
 * In-memory server-side cache for football-data.org API responses.
 *
 * Two layers of protection:
 *   1. TTL cache  — returns stored data until it expires.
 *   2. In-flight deduplication  — collapses concurrent requests for the
 *      same key into a single HTTP call, preventing the thundering-herd
 *      problem during high-traffic bursts.
 *   3. Stale-on-error fallback — if the network fetch fails and an expired
 *      entry exists in memory, that entry is served instead of throwing.
 *      This keeps pages populated during brief API outages or 429 storms.
 *
 * Persists across requests for the lifetime of the Node.js process.
 * In serverless environments (Vercel) it remains warm within the same
 * function instance; a cold start will miss and re-populate.
 *
 * Usage:
 *   const data = await withCache('key', TTL.FIXTURES, () => fetchSomething());
 */

// ---------------------------------------------------------------------------
// TTL constants  (seconds)
// ---------------------------------------------------------------------------

export const TTL = {
  /** Live scores — must be very fresh. */
  LIVE:      30,
  /** Match detail, H2H — refresh every minute. */
  MATCH:     60,
  /** Fixtures, results, team match history — 15 minutes. */
  FIXTURES:  900,
  /** Standings, team profiles — 1 hour. */
  STANDINGS: 3_600,
  /** World Cup structural data (all-matches, bracket) — 6 hours.
   *  The full 104-match WC payload changes only when knockout results land;
   *  caching for 6 h dramatically cuts API quota consumption. */
  WC:        21_600,
} as const;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface CacheEntry {
  data:      unknown;
  expiresAt: number; // ms since epoch
  fetchedAt: number; // ms since epoch
}

/** Primary cache store. Expired entries are NOT deleted immediately — they
 *  serve as a stale-fallback reservoir when the upstream API is down. */
const store    = new Map<string, CacheEntry>();

/** In-flight deduplication. Key → pending promise. */
const inflight = new Map<string, Promise<unknown>>();

/** Hit/miss/stale-fallback counters (resets on server restart). */
let _hits          = 0;
let _misses        = 0;
let _staleFallback = 0;

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

function staleAge(entry: CacheEntry): number {
  return Math.ceil((Date.now() - entry.expiresAt) / 1000);
}

// ---------------------------------------------------------------------------
// Core cache function
// ---------------------------------------------------------------------------

/**
 * Wraps an async fetcher with in-memory TTL caching, in-flight deduplication,
 * and stale-on-error fallback.
 *
 * @param key       Cache key — typically the API endpoint string.
 * @param ttl       Time-to-live in seconds (use TTL.* constants).
 * @param fetcher   Async function that performs the actual data fetch.
 */
export async function withCache<T>(
  key:     string,
  ttl:     number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();

  // ── 1. Cache hit (fresh) ─────────────────────────────────────────────────
  const cached = store.get(key);
  if (cached && cached.expiresAt > now) {
    _hits++;
    console.log(
      `[Cache] HIT   ${key} | ttl ${ttlRemaining(cached)}s remaining | ratio ${ratio()} (${_hits}/${_hits + _misses})`,
    );
    return cached.data as T;
  }

  // ── 2. In-flight deduplication ───────────────────────────────────────────
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) {
    console.log(`[Cache] DEDUP ${key} | coalescing with in-flight request`);
    return pending;
  }

  // ── 3. Cache miss — launch fetch ─────────────────────────────────────────
  _misses++;
  console.log(
    `[Cache] MISS  ${key} | ratio ${ratio()} (${_hits}/${_hits + _misses})`,
  );

  const promise = fetcher()
    .then((data) => {
      store.set(key, { data, expiresAt: now + ttl * 1000, fetchedAt: now });
      inflight.delete(key);
      return data;
    })
    .catch((err: unknown) => {
      inflight.delete(key);

      // ── Stale-on-error fallback ─────────────────────────────────────────
      // If an expired entry exists, serve it rather than throwing.
      // This keeps the page populated during transient API failures (429,
      // timeout, brief downtime) without requiring a page-level try/catch
      // restructure.
      const stale = store.get(key);
      if (stale) {
        _staleFallback++;
        console.warn(
          `[Cache] STALE-FALLBACK ${key} | serving data ${staleAge(stale)}s expired | fetch error: ${err instanceof Error ? err.message : String(err)} | fallbacks=${_staleFallback}`,
        );
        // Extend the stale entry's TTL by 60 s so concurrent requests don't
        // all hammer the API simultaneously while the outage persists.
        stale.expiresAt = Date.now() + 60_000;
        return stale.data as T;
      }

      throw err;
    });

  inflight.set(key, promise as Promise<unknown>);
  return promise;
}

// ---------------------------------------------------------------------------
// Cache management utilities
// ---------------------------------------------------------------------------

/** Returns current hit/miss/stale-fallback statistics. */
export function getCacheStats() {
  const total = _hits + _misses;
  return {
    hits:           _hits,
    misses:         _misses,
    staleFallbacks: _staleFallback,
    total,
    hitRatio:       total > 0 ? Math.round((_hits / total) * 100) : 0,
    hitRatioStr:    ratio(),
    storeSize:      store.size,
    inflightCount:  inflight.size,
  };
}

/** Evict a single key (useful after a write/mutation). */
export function invalidate(key: string): boolean {
  return store.delete(key);
}

/** Remove all expired entries. Safe to call periodically. */
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
