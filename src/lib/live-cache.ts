/**
 * live-cache.ts
 *
 * Single shared KV cache for all live match data.
 *
 * Problem
 * ───────
 * getLiveMatches() and getWCLiveMatches() were backed by two separate KV keys,
 * meaning each 30-second window could trigger up to 2 football-data.org API
 * calls for live data — one for all competitions, one WC-only.
 *
 * Solution
 * ────────
 * One canonical source:  goalradar:live:matches  (30s TTL)
 * Populated by a single call to /matches?status=IN_PLAY,PAUSED.
 * getWCLiveMatches() filters the shared result in memory — zero extra API call.
 *
 * Cache hierarchy
 * ───────────────
 *   L1  in-memory (this process)  — sub-ms,  30s TTL, per-instance
 *   L2  Vercel KV (shared Redis)  — ~10 ms,  30s TTL, cross-instance
 *   L3  football-data.org API     — 100+ ms, actual source
 *
 * KV key
 * ──────
 *   goalradar:live:matches   ← /matches?status=IN_PLAY,PAUSED (all competitions)
 *
 * Logging
 * ───────
 *   [LIVE CACHE] hit  | live-matches | L1 in-memory
 *   [LIVE CACHE] hit  | live-matches | KV age 8s
 *   [LIVE CACHE] miss | live-matches | fetching from API
 *   [LIVE CACHE] set  | live-matches | ttl=30s | count=3
 */

import { kv } from '@vercel/kv';
import type { Match } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

/** Shared TTL for live data — must match the L1 TTL in cache.ts (TTL.LIVE=30s). */
const LIVE_TTL_SEC = 30;

/** Single canonical KV key for all live match data. */
const KV_KEY = 'goalradar:live:matches';

/** Disaster-recovery key — 7-day TTL, written on every successful fetch.
 *  Served when KV misses AND the API is unavailable (403/429/5xx). */
const DR_KEY = 'goalradar:dr:live:matches';

// ---------------------------------------------------------------------------
// L1 in-process store
// ---------------------------------------------------------------------------

interface L1Entry {
  matches:   Match[];
  fetchedAt: number; // epoch ms
}

const _l1 = new Map<string, L1Entry>();

function l1Get(key: string): Match[] | null {
  const entry = _l1.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > LIVE_TTL_SEC * 1000) return null; // expired
  return entry.matches;
}

function l1Set(key: string, matches: Match[]): void {
  _l1.set(key, { matches, fetchedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// KV helpers
// ---------------------------------------------------------------------------

interface KVEntry {
  matches:   Match[];
  fetchedAt: number;
}

async function kvGet(key: string): Promise<KVEntry | null> {
  if (!KV_ENABLED) return null;
  try {
    return await kv.get<KVEntry>(key);
  } catch (err) {
    console.error(
      `[LIVE CACHE] KV read error on ${key}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

function kvSet(key: string, matches: Match[]): void {
  if (!KV_ENABLED) return;
  const entry: KVEntry = { matches, fetchedAt: Date.now() };
  kv.set(key, entry, { ex: LIVE_TTL_SEC }).catch((err) =>
    console.error(
      `[LIVE CACHE] KV write error on ${key}:`,
      err instanceof Error ? err.message : String(err),
    ),
  );
}

/** Write disaster-recovery key with 7-day TTL — fire-and-forget. */
function kvSetDR(key: string, matches: Match[]): void {
  if (!KV_ENABLED) return;
  const entry: KVEntry = { matches, fetchedAt: Date.now() };
  kv.set(key, entry, { ex: 7 * 24 * 3_600 }).catch((err) =>
    console.error(
      `[LIVE CACHE] DR write error on ${key}:`,
      err instanceof Error ? err.message : String(err),
    ),
  );
}

// ---------------------------------------------------------------------------
// Core fetch function
// ---------------------------------------------------------------------------

/**
 * Fetch live matches with L1 → L2 (KV) → API caching.
 * Always uses the single canonical KV key (KV_KEY).
 *
 * @param fetcher  Async function that calls /matches?status=IN_PLAY,PAUSED
 */
async function fetchLiveCached(
  fetcher: () => Promise<{ matches: Match[] }>,
): Promise<Match[]> {

  // ── 1. L1 hit ─────────────────────────────────────────────────────────────
  const l1 = l1Get(KV_KEY);
  if (l1) {
    console.log(`[LIVE CACHE] hit  | live-matches | L1 in-memory`);
    return l1;
  }

  // ── 2. L2 (KV) hit ────────────────────────────────────────────────────────
  const kvEntry = await kvGet(KV_KEY);
  if (kvEntry) {
    const ageMs = Date.now() - kvEntry.fetchedAt;
    if (ageMs < LIVE_TTL_SEC * 1000) {
      const ageSec = Math.ceil(ageMs / 1000);
      console.log(`[LIVE CACHE] hit  | live-matches | KV age ${ageSec}s`);
      l1Set(KV_KEY, kvEntry.matches); // warm L1 for subsequent requests in this instance
      return kvEntry.matches;
    }
    // KV entry exists but is stale — fetch fresh
    console.log(`[LIVE CACHE] stale KV entry for live-matches — fetching fresh`);
  }

  // ── 3. API fetch ──────────────────────────────────────────────────────────
  console.log(`[LIVE CACHE] miss | live-matches | fetching from API`);

  try {
    const { matches } = await fetcher();

    l1Set(KV_KEY, matches);
    kvSet(KV_KEY, matches);
    kvSetDR(DR_KEY, matches); // update disaster-recovery key on every successful fetch
    console.log(`[LIVE CACHE] set  | live-matches | ttl=${LIVE_TTL_SEC}s | count=${matches.length}`);

    return matches;

  } catch (fetchErr) {
    // ── 4. Stale fallback — disaster-recovery key (7-day TTL) ───────────────
    console.error(
      `[API] FALLBACK live-matches | fetch failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)} | checking disaster-recovery key`,
    );
    if (KV_ENABLED) {
      try {
        const dr = await kv.get<KVEntry>(DR_KEY);
        if (dr) {
          const ageSec = Math.ceil((Date.now() - dr.fetchedAt) / 1000);
          console.warn(`[API] FALLBACK live-matches | serving ${ageSec}s old disaster-recovery data | count=${dr.matches.length}`);
          l1Set(KV_KEY, dr.matches); // warm L1 to avoid re-reading KV on next request
          return dr.matches;
        }
      } catch (drErr) {
        console.error(`[API] FALLBACK live-matches | disaster-recovery read failed:`, drErr instanceof Error ? drErr.message : String(drErr));
      }
    }
    // No stale data at all — return empty rather than throwing.
    // Live match data is best-effort; an empty list renders "no live matches"
    // which is far better than an error page.
    console.warn(`[STALE] EXPIRED live-matches | no stale data available — returning empty`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * All live matches across all competitions.
 * Backed by goalradar:live:matches (30s TTL).
 *
 * @param fetcher  () => fetchDirect('/matches?status=IN_PLAY,PAUSED', TTL.LIVE)
 */
export async function getCachedLiveMatches(
  fetcher: () => Promise<{ matches: Match[] }>,
): Promise<{ matches: Match[] }> {
  const matches = await fetchLiveCached(fetcher);
  return { matches };
}

/**
 * WC live matches only.
 * Reads from the SAME goalradar:live:matches key and filters in memory.
 * No second API call — zero extra quota usage.
 *
 * @param fetcher  () => fetchDirect('/matches?status=IN_PLAY,PAUSED', TTL.LIVE)
 *                 (same fetcher as getCachedLiveMatches — WC filtering is local)
 */
export async function getCachedWCLiveMatches(
  fetcher: () => Promise<{ matches: Match[] }>,
): Promise<{ matches: Match[] }> {
  const all = await fetchLiveCached(fetcher);
  const wc  = all.filter((m) => m.competition?.code === 'WC');
  return { matches: wc };
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export function getLiveCacheStats() {
  const now = Date.now();
  return {
    kvEnabled: KV_ENABLED,
    kvKey:     KV_KEY,
    l1Entries: [..._l1.entries()].map(([key, entry]) => ({
      key,
      ageMs:     now - entry.fetchedAt,
      count:     entry.matches.length,
      expiresIn: Math.max(0, LIVE_TTL_SEC * 1000 - (now - entry.fetchedAt)),
    })),
  };
}
