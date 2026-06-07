/**
 * match-snapshot.ts
 *
 * Composite KV snapshot for match pages.
 *
 * Problem solved
 * ──────────────
 * The match page previously made 5-6 API calls per render:
 *   1. getMatchDetail(id)          ← in generateMetadata()
 *   2. getMatchDetail(id)          ← duplicate, in page component
 *   3. getHeadToHead(id)
 *   4. getUpcomingMatches('WC')
 *   5. getRecentMatches('WC')
 *   6. getStandings('WC')
 *
 * This module collapses all of that into ONE KV read when the snapshot is warm.
 *
 * Cache strategy
 * ──────────────
 *   • KV key:  goalradar:match:{id}    (TTL 15 min for finished/scheduled)
 *   • Live matches (IN_PLAY, PAUSED) are NOT snapshotted — they skip KV and
 *     fall through to the individual per-endpoint caches (30-60 s TTL) which
 *     provide the freshness live pages need.
 *
 * Per-request deduplication via React.cache()
 * ────────────────────────────────────────────
 * `getOrBuildMatchSnapshot` is wrapped with `cache()` from React.  Within a
 * single Next.js server render both `generateMetadata()` and the page component
 * call it with the same matchId — React's cache ensures the async work happens
 * EXACTLY ONCE and the result is shared.  On warm KV that's 1 KV read total.
 *
 * Flow
 *   generateMetadata()  ─┐
 *                         ├→ getOrBuildMatchSnapshot(id) → React.cache hits → 0 extra work
 *   MatchPage()         ─┘
 *
 * Benchmark hook
 * ──────────────
 * Set MATCH_SNAPSHOT_BENCH=true to emit timing lines:
 *   [Snapshot] BENCH match:537327 | source=kv | total=12ms
 *   [Snapshot] BENCH match:537327 | source=built | total=243ms (match=42ms h2h=38ms wc=51ms)
 */

import { cache } from 'react';
import { kv }   from '@vercel/kv';

import {
  getMatchDetail,
  getHeadToHead,
  getUpcomingMatches,
  getRecentMatches,
  getStandings,
} from './api';
import type {
  MatchDetail,
  HeadToHead,
  Match,
  StandingEntry,
  StandingTable,
} from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

const BENCH = process.env.MATCH_SNAPSHOT_BENCH === 'true';

/** Snapshot TTL: 15 minutes.  Live matches bypass KV entirely. */
const SNAPSHOT_TTL_SEC = 900;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface MatchSnapshot {
  /** Full match detail (goals, bookings, subs, referees, venue). */
  match: MatchDetail;

  /** Head-to-head record — null if API call failed. */
  headToHead: HeadToHead | null;

  /**
   * Full WC standings payload — null for non-WC or API failure.
   * The page derives `wcGroupTable` from this by filtering on `match.group`.
   */
  standings: {
    standings:   StandingTable[];
    competition: { name: string; emblem: string };
  } | null;

  /**
   * Deduplicated WC matches in the same group as this match
   * (upcoming + recent).  Empty array for non-WC or non-group matches.
   */
  wcGroupMatches: Match[];

  /**
   * All WC matches (upcoming + recent, across all groups).
   * Used for "More from World Cup 2026" related fixtures panel.
   * Empty for non-WC matches.
   */
  wcAllMatches: Match[];

  /** Epoch-ms when this snapshot was built. */
  generatedAt: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function kvKey(matchId: string): string {
  return `goalradar:match:${matchId}`;
}

/** Live matches must not be served from a 15-minute-old snapshot. */
function isLiveStatus(status: MatchDetail['status']): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}

/**
 * Build a fresh snapshot by fetching all required data in parallel.
 * The match detail is fetched first (to determine isWC/group); the rest
 * are fetched concurrently.
 */
async function buildSnapshot(matchId: string): Promise<MatchSnapshot> {
  const t0    = Date.now();
  const tMatch = Date.now();

  const match = await getMatchDetail(matchId);

  const matchMs = Date.now() - tMatch;
  const isWC    = match.competition?.code === 'WC';
  const hasGroup = Boolean(match.group);

  const t1 = Date.now();

  const [h2hResult, upcomingResult, recentResult, standingsResult] =
    await Promise.allSettled([
      getHeadToHead(matchId),
      isWC && hasGroup ? getUpcomingMatches('WC') : Promise.resolve(null),
      isWC && hasGroup ? getRecentMatches('WC')   : Promise.resolve(null),
      isWC && hasGroup ? getStandings('WC')       : Promise.resolve(null),
    ]);

  const parallelMs = Date.now() - t1;
  const totalMs    = Date.now() - t0;

  // Merge upcoming + recent WC group matches, deduped
  const dedup = (arr: Match[]): Match[] => {
    const seen = new Set<number>();
    return arr.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  };

  const wcUpcoming: Match[] =
    upcomingResult.status === 'fulfilled' && upcomingResult.value
      ? upcomingResult.value.matches : [];
  const wcRecent: Match[] =
    recentResult.status === 'fulfilled' && recentResult.value
      ? recentResult.value.matches : [];

  const wcAllMatches    = dedup([...wcUpcoming, ...wcRecent]);
  const wcGroupMatches  = wcAllMatches.filter((m) => m.group === match.group);

  const snapshot: MatchSnapshot = {
    match,
    headToHead:    h2hResult.status === 'fulfilled' ? h2hResult.value : null,
    standings:     standingsResult.status === 'fulfilled' ? standingsResult.value : null,
    wcGroupMatches,
    wcAllMatches,
    generatedAt:   Date.now(),
  };

  if (BENCH) {
    console.log(
      `[Snapshot] BENCH match:${matchId} | source=built | ` +
      `total=${totalMs}ms (match=${matchMs}ms parallel=${parallelMs}ms)`,
    );
  }

  return snapshot;
}

/** Read snapshot from KV.  Returns null on miss, error, or if match is live. */
async function readKVSnapshot(matchId: string): Promise<MatchSnapshot | null> {
  if (!KV_ENABLED) return null;

  try {
    const raw = await kv.get<MatchSnapshot>(kvKey(matchId));
    if (!raw) return null;

    // Don't serve a stale snapshot for live matches
    if (isLiveStatus(raw.match.status)) {
      console.log(`[Snapshot] SKIP match:${matchId} — status=${raw.match.status}, bypassing stale snapshot`);
      return null;
    }

    const ageSeconds = Math.ceil((Date.now() - raw.generatedAt) / 1000);
    console.log(`[Snapshot] HIT  match:${matchId} | age ${ageSeconds}s | status=${raw.match.status}`);
    return raw;
  } catch (err) {
    console.error(
      `[Snapshot] KV read error for match:${matchId}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Store snapshot in KV.  Fire-and-forget errors (non-fatal). */
async function writeKVSnapshot(matchId: string, snapshot: MatchSnapshot): Promise<void> {
  if (!KV_ENABLED) return;

  // Don't cache live matches — they change every minute
  if (isLiveStatus(snapshot.match.status)) {
    console.log(`[Snapshot] SKIP write match:${matchId} — status=${snapshot.match.status}`);
    return;
  }

  try {
    await kv.set(kvKey(matchId), snapshot, { ex: SNAPSHOT_TTL_SEC });
    console.log(`[Snapshot] SET  match:${matchId} | ttl=${SNAPSHOT_TTL_SEC}s | status=${snapshot.match.status}`);
  } catch (err) {
    console.error(
      `[Snapshot] KV write error for match:${matchId}:`,
      err instanceof Error ? err.message : String(err),
    );
    // Non-fatal — page still renders from built snapshot
  }
}

// ---------------------------------------------------------------------------
// Core fetch — memoised with React.cache()
// ---------------------------------------------------------------------------

/**
 * Fetch or build the match snapshot.
 *
 * Wrapped with `React.cache()` so that within a single server render
 * (generateMetadata + page component both call this), the async work happens
 * exactly once and the result is shared — 0 duplicate work.
 *
 * Priority:
 *   1. React per-request cache (memoisation) — instant, 0 network
 *   2. Vercel KV — ~10-15 ms single read
 *   3. Build from individual API calls (5-6 calls in parallel) — ~100-300 ms
 */
export const getOrBuildMatchSnapshot: (matchId: string) => Promise<MatchSnapshot> = cache(
  async (matchId: string): Promise<MatchSnapshot> => {
    const t0 = Date.now();

    // ── 1. Try KV ─────────────────────────────────────────────────────────
    const kvHit = await readKVSnapshot(matchId);
    if (kvHit) {
      if (BENCH) {
        console.log(
          `[Snapshot] BENCH match:${matchId} | source=kv | total=${Date.now() - t0}ms`,
        );
      }
      return kvHit;
    }

    // ── 2. Build from APIs ─────────────────────────────────────────────────
    console.log(`[Snapshot] MISS match:${matchId} — building snapshot`);
    const snapshot = await buildSnapshot(matchId);

    // Store to KV (fire-and-forget — don't block the response)
    writeKVSnapshot(matchId, snapshot).catch(() => undefined);

    return snapshot;
  },
);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Derive the group standings table for this match's group from the snapshot.
 * Returns null for non-WC matches or if standings are unavailable.
 */
export function getGroupTable(snapshot: MatchSnapshot): StandingEntry[] | null {
  const { match, standings } = snapshot;
  if (!standings || !match.group) return null;
  const row = standings.standings.find(
    (s) => s.type === 'TOTAL' && s.group === match.group,
  );
  return row?.table ?? null;
}

/**
 * Manually invalidate a match's KV snapshot (e.g. after a score update).
 * No-op if KV is not configured.
 */
export async function invalidateMatchSnapshot(matchId: string): Promise<void> {
  if (!KV_ENABLED) return;
  try {
    await kv.del(kvKey(matchId));
    console.log(`[Snapshot] INVALIDATED match:${matchId}`);
  } catch {
    // best-effort
  }
}
