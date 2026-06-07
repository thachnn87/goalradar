/**
 * live-cache.ts
 *
 * Centralised shared KV cache for live match endpoints.
 *
 * Problem
 * ───────
 * getLiveMatches() and getWCLiveMatches() are called from 7 pages.
 * Each Vercel serverless instance has its own in-memory (L1) cache.
 * When multiple instances handle concurrent requests during a live match,
 * every cold-start instance calls the football-data.org API independently —
 * burning quota on identical requests within the same 30-second window.
 *
 * Solution
 * ────────
 * Shared KV layer (L2) with 30-second TTL sits between L1 and the API.
 * The first instance that misses L1 checks KV before calling the API.
 * If KV also misses it fetches from API and writes back to both L1 and KV.
 * Every subsequent instance within the 30s window hits KV → 0 API calls.
 *
 * Cache hierarchy
 * ───────────────
 *   L1  in-memory (this process)  — sub-ms,  30s TTL, per-instance
 *   L2  Vercel KV (shared Redis)  — ~10 ms,  30s TTL, cross-instance ← NEW
 *   L3  football-data.org API     — 100+ ms, actual source
 *
 * KV keys
 * ───────
 *   goalradar:live:all-matches   ← /matches?status=IN_PLAY,PAUSED
 *   goalradar:live:wc-matches    ← /competitions/WC/matches?status=IN_PLAY,PAUSED
 *
 * Logging
 * ───────
 *   [LIVE CACHE] hit  | wc-matches | age 8s
 *   [LIVE CACHE] miss | all-matches | fetching from API
 *   [LIVE CACHE] set  | wc-matches | ttl=30s
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

const KV_KEYS = {
  all: 'goalradar:live:all-matches',
  wc:  'goalradar:live:wc-matches',
} as const;

// ---------------------------------------------------------------------------
// L1 in-process store (mirrors the withCache store for live endpoints)
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

// ---------------------------------------------------------------------------
// Core fetch function
// ---------------------------------------------------------------------------

/**
 * Fetch live matches with L1 → L2 (KV) → API caching.
 *
 * @param kvKey    KV store key (one of KV_KEYS)
 * @param label    Log label (e.g. "wc-matches")
 * @param fetcher  Async function that calls the football-data.org API
 */
async function fetchLiveCached(
  kvKey:   string,
  label:   string,
  fetcher: () => Promise<{ matches: Match[] }>,
): Promise<{ matches: Match[] }> {

  // ── 1. L1 hit ─────────────────────────────────────────────────────────────
  const l1 = l1Get(kvKey);
  if (l1) {
    console.log(`[LIVE CACHE] hit  | ${label} | L1 in-memory`);
    return { matches: l1 };
  }

  // ── 2. L2 (KV) hit ────────────────────────────────────────────────────────
  const kvEntry = await kvGet(kvKey);
  if (kvEntry) {
    const ageMs = Date.now() - kvEntry.fetchedAt;
    if (ageMs < LIVE_TTL_SEC * 1000) {
      const ageSec = Math.ceil(ageMs / 1000);
      console.log(`[LIVE CACHE] hit  | ${label} | KV age ${ageSec}s`);
      // Populate L1 so the next call in this instance is sub-ms
      l1Set(kvKey, kvEntry.matches);
      return { matches: kvEntry.matches };
    }
    // KV entry exists but is stale (expired by TTL but somehow still returned)
    console.log(`[LIVE CACHE] stale KV entry for ${label} — fetching fresh`);
  }

  // ── 3. API fetch ──────────────────────────────────────────────────────────
  console.log(`[LIVE CACHE] miss | ${label} | fetching from API`);
  const result = await fetcher();
  const { matches } = result;

  // Write to L1 and KV
  l1Set(kvKey, matches);
  kvSet(kvKey, matches);
  console.log(`[LIVE CACHE] set  | ${label} | ttl=${LIVE_TTL_SEC}s | count=${matches.length}`);

  return result;
}

// ---------------------------------------------------------------------------
// Public API — drop-in replacements for getLiveMatches / getWCLiveMatches
// ---------------------------------------------------------------------------

/**
 * Cached wrapper around /matches?status=IN_PLAY,PAUSED
 *
 * @param fetcher  The original uncached API fetcher (from api.ts)
 */
export function getCachedLiveMatches(
  fetcher: () => Promise<{ matches: Match[] }>,
): Promise<{ matches: Match[] }> {
  return fetchLiveCached(KV_KEYS.all, 'all-matches', fetcher);
}

/**
 * Cached wrapper around /competitions/WC/matches?status=IN_PLAY,PAUSED
 *
 * @param fetcher  The original uncached API fetcher (from api.ts)
 */
export function getCachedWCLiveMatches(
  fetcher: () => Promise<{ matches: Match[] }>,
): Promise<{ matches: Match[] }> {
  return fetchLiveCached(KV_KEYS.wc, 'wc-matches', fetcher);
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export function getLiveCacheStats() {
  const now = Date.now();
  return {
    kvEnabled: KV_ENABLED,
    l1Entries: [..._l1.entries()].map(([key, entry]) => ({
      key,
      ageMs:     now - entry.fetchedAt,
      count:     entry.matches.length,
      expiresIn: Math.max(0, LIVE_TTL_SEC * 1000 - (now - entry.fetchedAt)),
    })),
  };
}
