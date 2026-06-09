/**
 * Vercel KV cache with stale-while-revalidate strategy.
 *
 * Architecture — two cache tiers:
 *   L1: In-memory (cache.ts)  — sub-millisecond, per-process, cold-start miss.
 *   L2: Vercel KV (this file) — ~10 ms Redis, persists across cold starts,
 *                               shared across all instances in a deployment.
 *
 * Stale-while-revalidate (SWR) behaviour:
 *   ┌────────────────────────────────────────────────────────────────────────┐
 *   │  0 ──── freshTtl ──── staleTtl ──── (auto-expires) ──── disasterTtl  │
 *   │  [  fresh  ]  [ stale + bg-revalidate ]  [ miss ] [  emergency only ] │
 *   └────────────────────────────────────────────────────────────────────────┘
 *   - FRESH    : return stored data immediately, no revalidation.
 *   - STALE    : return stored data immediately AND trigger a background
 *                fetch to repopulate KV for the next request.
 *   - MISS     : await fresh fetch, store, return.
 *   - DISASTER : if MISS fetch also fails, read the separate emergency key
 *                (TTL 7 days) and serve very stale data rather than an
 *                empty/broken page.
 *
 * KV requires these env vars (auto-provisioned by Vercel KV dashboard):
 *   KV_REST_API_URL
 *   KV_REST_API_TOKEN
 *
 * Graceful degradation: if KV is not configured the function falls
 * through to a direct fetch — no crash, just no KV caching.
 */

import { kv } from '@vercel/kv';
import { recordDataSource } from './data-source-tracker';

// ---------------------------------------------------------------------------
// Availability guard
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

// ---------------------------------------------------------------------------
// SWR TTL presets  (seconds)
// ---------------------------------------------------------------------------

export const SWR = {
  /** Live scores — stale up to 60 s, KV entry lives 60 s. */
  LIVE: { fresh: 30, stale: 60 } as const,

  /** Match detail / H2H — stale up to 2 min. */
  MATCH: { fresh: 60, stale: 120 } as const,

  /** Fixtures / results — fresh 15 min, stale 30 min.
   *  Aligns with TTL.FIXTURES = 900 s. */
  FIXTURES: { fresh: 900, stale: 1_800 } as const,

  /** Standings / team info — fresh 1 hour, stale 2 hours.
   *  Aligns with TTL.STANDINGS = 3 600 s. */
  STANDINGS: { fresh: 3_600, stale: 7_200 } as const,

  /** World Cup structural data (all-matches, bracket payload) —
   *  fresh 6 hours, stale 12 hours.  The 104-match response changes only
   *  when knockout scores land; caching for 6 h saves the most API quota.
   *  Aligns with TTL.WC = 21 600 s. */
  WC: { fresh: 21_600, stale: 43_200 } as const,
};

/** Redis TTL for the emergency "disaster recovery" key — 7 days.
 *  Written alongside the main entry whenever we get fresh data.
 *  Read only when a blocking fetch fails with no other cache available. */
const DISASTER_TTL_SECONDS = 7 * 24 * 3_600; // 604 800 s

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

let _hits      = 0;
let _stale     = 0;
let _misses    = 0;
let _disasters = 0;

function logRatio() {
  const total = _hits + _stale + _misses;
  if (total === 0) return 'n/a';
  const effective = _hits + _stale;
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
    console.log(`[KV] SKIP ${key} — KV not configured, fetching directly`);
    return fetcher();
  }

  const now         = Date.now();
  const kvKey       = `goalradar:${key}`;
  const disasterKey = `goalradar:dr:${key}`;
  let   entry: KVEntry<T> | null = null;

  // ── 1. Try reading from KV ──────────────────────────────────────────────
  try {
    entry = await kv.get<KVEntry<T>>(kvKey);
  } catch (err) {
    console.error(`[KV] READ error on ${key}:`, err instanceof Error ? err.message : String(err));
  }

  // ── 2. FRESH hit ────────────────────────────────────────────────────────
  if (entry && now < entry.freshUntil) {
    _hits++;
    const remaining = Math.ceil((entry.freshUntil - now) / 1000);
    console.log(
      `[KV] HIT   ${key} | fresh ${remaining}s more | ratio ${logRatio()} (${_hits}+${_stale}/${_hits + _stale + _misses})`,
    );
    recordDataSource('kv');
    return entry.data;
  }

  // ── 3. STALE hit — serve immediately, revalidate in background ──────────
  if (entry) {
    _stale++;
    const staleAge = Math.ceil((now - entry.freshUntil) / 1000);
    console.log(`[STALE] SERVED ${key} | ${staleAge}s past fresh | bg-revalidate triggered | ratio ${logRatio()}`);
    recordDataSource('kv');
    revalidateInBackground(kvKey, disasterKey, key, swr, fetcher);
    return entry.data;
  }

  // ── 4. MISS — blocking fetch ─────────────────────────────────────────────
  _misses++;
  console.log(
    `[KV] MISS  ${key} | ratio ${logRatio()} (${_hits + _stale}/${_hits + _stale + _misses})`,
  );

  try {
    const data = await fetcher();
    // Write both normal and disaster-recovery keys.
    await Promise.all([
      storeInKV<T>(kvKey, key, data, swr),
      storeDisasterKey<T>(disasterKey, key, data),
    ]).catch((err) =>
      console.error(`[KV] WRITE error on ${key}:`, err instanceof Error ? err.message : String(err)),
    );
    return data;
  } catch (fetchErr) {
    // ── 5. DISASTER recovery — try the long-lived emergency key ──────────
    console.error(
      `[API] FALLBACK ${key} | fetch failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)} | checking disaster-recovery key`,
    );
    try {
      const dr = await kv.get<KVEntry<T>>(disasterKey);
      if (dr) {
        _disasters++;
        const ageSeconds = Math.ceil((now - dr.fetchedAt) / 1000);
        console.warn(`[API] FALLBACK ${key} | serving ${ageSeconds}s old disaster-recovery data | disasters=${_disasters}`);
        return dr.data;
      }
    } catch (drErr) {
      console.error(`[API] FALLBACK ${key} | disaster-recovery read failed:`, drErr instanceof Error ? drErr.message : String(drErr));
    }
    console.error(`[STALE] EXPIRED ${key} | no stale data available — propagating error`);
    throw fetchErr;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fire-and-forget background revalidation. */
function revalidateInBackground<T>(
  kvKey:       string,
  disasterKey: string,
  logKey:      string,
  swr:         { fresh: number; stale: number },
  fetcher:     () => Promise<T>,
): void {
  Promise.resolve()
    .then(() => fetcher())
    .then((data) =>
      Promise.all([
        storeInKV<T>(kvKey, logKey, data, swr),
        storeDisasterKey<T>(disasterKey, logKey, data),
      ]),
    )
    .then(() => console.log(`[KV] REVALIDATED ${logKey}`))
    .catch((err) =>
      console.error(
        `[KV] BG-REVALIDATE failed on ${logKey}:`,
        err instanceof Error ? err.message : String(err),
      ),
    );
}

/** Write a KV entry with the correct SWR TTL. */
async function storeInKV<T>(
  kvKey:  string,
  logKey: string,
  data:   T,
  swr:    { fresh: number; stale: number },
): Promise<void> {
  const entry: KVEntry<T> = {
    data,
    fetchedAt:  Date.now(),
    freshUntil: Date.now() + swr.fresh * 1000,
  };
  await kv.set(kvKey, entry, { ex: swr.stale });
  console.log(`[KV] SET   ${logKey} | fresh ${swr.fresh}s / stale ${swr.stale}s`);
}

/** Write a long-lived disaster-recovery key (7 days). Overwrites on every
 *  successful fresh fetch so it always holds the most recent known-good data. */
async function storeDisasterKey<T>(
  disasterKey: string,
  logKey:      string,
  data:        T,
): Promise<void> {
  const entry: KVEntry<T> = {
    data,
    fetchedAt:  Date.now(),
    freshUntil: 0, // always "stale" — only used as last resort
  };
  await kv.set(disasterKey, entry, { ex: DISASTER_TTL_SECONDS });
  console.log(`[KV] DR    ${logKey} | disaster key written (7d TTL)`);
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export function getKVCacheStats() {
  const total     = _hits + _stale + _misses;
  const effective = _hits + _stale;
  return {
    hits:           _hits,
    stale:          _stale,
    misses:         _misses,
    disasters:      _disasters,
    total,
    effectiveHits:  effective,
    hitRatio:       total > 0 ? Math.round((effective / total) * 100) : 0,
    kvEnabled:      KV_ENABLED,
  };
}

/** Manually invalidate a KV entry (e.g. after a write). */
export async function kvInvalidate(key: string): Promise<void> {
  if (!KV_ENABLED) return;
  await Promise.all([
    kv.del(`goalradar:${key}`),
    kv.del(`goalradar:dr:${key}`),
  ]).catch(() => undefined);
}
