/**
 * src/lib/prewarm/worldcup.ts
 *
 * Sprint PERF-3 / RATE-SAFE MODE — Pre-warm & Cache Seeding
 *
 * ── What this does ───────────────────────────────────────────────────────────
 *
 * Pre-populates KV entries for every WC match so users never hit a cold miss.
 * Called by the cron orchestrator; never called on the user request path.
 *
 * ── Intelligent seeding (never hammers the provider) ────────────────────────
 *
 * 1. Read from KV first.  The orchestrator already calls refreshEndpoint for
 *    `/competitions/WC/matches` earlier in the same run, so the KV entry is
 *    likely fresh.  Zero extra provider call in the normal case.
 *
 * 2. Only call providerManager.getAllMatches('WC') when the KV entry is
 *    missing or too stale (> WC_BULK_MAX_AGE_SEC old).
 *
 * 3. Skip individual matches whose snapshot is still within their tier TTL:
 *
 *      LIVE      → 30 s
 *      TODAY     → 5 min
 *      NEXT-3D   → 15 min
 *      FUTURE    → 6 h
 *      FINISHED  → 24 h
 *
 *    This means on a 30-min orchestrator cycle:
 *      - LIVE/TODAY/NEXT-3D matches are always re-seeded
 *      - FUTURE matches are re-seeded once per 6 h (≈ every 12th cycle)
 *      - FINISHED matches are re-seeded once per 24 h (≈ every 48th cycle)
 *
 * 4. Rate-safe mode check before EVERY provider call.  If football-data
 *    returned 429/403 this run, all provider calls stop immediately.
 *
 * ── KV keys written ─────────────────────────────────────────────────────────
 *
 *   goalradar:/matches/{id}       KVEntry<MatchDetail>   TTL: tier-based
 *   goalradar:dr:/matches/{id}    KVEntry<MatchDetail>   TTL: 7 days
 *   goalradar:match:{id}          MatchSnapshot          TTL: tier-based
 *   goalradar:dr:match:{id}       MatchSnapshot          TTL: 30 days
 *   goalradar:prewarm:match-ids   number[]               TTL: 7 days
 */

import { kv }                 from '@vercel/kv';
import { providerManager }    from '@/lib/providers/manager';
import type { Match, MatchDetail, StandingTable } from '@/lib/types';
import type { MatchSnapshot } from '@/lib/match-snapshot';
import {
  isRateSafeModeActive,
  logRateSafeSkip,
  getMatchTier,
  TIER_REFRESH_SEC,
  type MatchTier,
} from '@/lib/rate-safe';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

/**
 * If the bulk all-matches KV entry is fresher than this, we reuse it
 * without another provider call.  Set to 2× the orchestrator interval (1 h)
 * so that on a 30-min cron, the first run of the hour always refreshes.
 */
const WC_BULK_MAX_AGE_SEC = 3_600; // 1 h

/** TTL for seeded match detail entries per tier. */
const DETAIL_STALE_SEC: Record<MatchTier, number> = {
  'live':     60,
  'today':    TIER_REFRESH_SEC['today'],
  'next-3d':  TIER_REFRESH_SEC['next-3d'],
  'future':   TIER_REFRESH_SEC['future'],
  'finished': TIER_REFRESH_SEC['finished'],
};

/** Snapshot KV TTL per tier. */
const SNAPSHOT_STALE_SEC: Record<MatchTier, number> = {
  'live':     60,
  'today':    TIER_REFRESH_SEC['today']  + 60,
  'next-3d':  TIER_REFRESH_SEC['next-3d'] + 60,
  'future':   TIER_REFRESH_SEC['future'],
  'finished': TIER_REFRESH_SEC['finished'],
};

/** DR copy TTLs — long-lived safety net. */
const DETAIL_DR_TTL_SEC   = 7 * 24 * 3_600;  // 7 days
const SNAPSHOT_DR_TTL_SEC = 30 * 24 * 3_600; // 30 days

/** Max individual priority-tier API calls per run (next-24-h matches). */
const MAX_PRIORITY_FETCHES = 4;

/** KV key for the seeded match ID manifest. */
export const SEEDED_IDS_KEY = 'goalradar:prewarm:match-ids';

// ---------------------------------------------------------------------------
// KV entry schema (mirrors kv-cache.ts)
// ---------------------------------------------------------------------------

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface WorldCupPrewarmResult {
  durationMs:         number;
  fetchCalls:         number;
  seededMatchDetail:  number;
  seededSnapshots:    number;
  skippedFresh:       number;
  skippedLive:        number;
  totalWCMatches:     number;
  priorityMatches:    number;
  priorityRefreshed:  number;
  coveragePercent:    number;
  rateSafeMode:       boolean;  // true when aborted due to rate-safe mode
  tierBreakdown:      Record<MatchTier, number>;
  errors:             string[];
}

// ---------------------------------------------------------------------------
// KV key helpers
// ---------------------------------------------------------------------------

function detailKey   (id: number): string { return `goalradar:/matches/${id}`; }
function detailDRKey (id: number): string { return `goalradar:dr:/matches/${id}`; }
function snapshotKey (id: number): string { return `goalradar:match:${id}`; }
function snapshotDRKey(id: number): string { return `goalradar:dr:match:${id}`; }

/** The KV key written by refreshEndpoint for the bulk WC all-matches endpoint. */
const WC_ALL_MATCHES_KV = 'goalradar:/competitions/WC/matches';
const WC_STANDINGS_KV   = 'goalradar:/competitions/WC/standings';

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

/**
 * Cast a basic Match to MatchDetail by providing empty event arrays.
 * Acceptable for SCHEDULED/TIMED matches (no events to show).
 * FINISHED matches will have empty goal/booking/sub lists until a user's
 * on-demand fetch overwrites the entry with full event detail.
 */
function toMatchDetail(m: Match): MatchDetail {
  return {
    ...m,
    goals:         [],
    bookings:      [],
    substitutions: [],
    venue:         null,
    referees:      [],
  } as MatchDetail;
}

function buildPartialSnapshot(
  match:     MatchDetail,
  allMatches: Match[],
  standings: { standings: StandingTable[]; competition: { name: string; emblem: string } } | null,
): MatchSnapshot {
  const isWC    = match.competition?.code === 'WC';
  const hasGroup = Boolean(match.group);

  const seen       = new Set<number>();
  const wcAll      = isWC ? allMatches.filter((m) => {
    if (seen.has(m.id)) return false; seen.add(m.id); return true;
  }) : [];
  const wcGroup    = hasGroup ? wcAll.filter((m) => m.group === match.group) : [];

  return {
    match,
    headToHead:    null,
    standings:     isWC && hasGroup ? standings : null,
    wcGroupMatches: wcGroup,
    wcAllMatches:  wcAll,
    generatedAt:   Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Read bulk WC data from KV (avoids extra provider call when orchestrator
// already seeded these keys earlier in the same run)
// ---------------------------------------------------------------------------

async function readBulkFromKV(): Promise<{
  matches:   Match[] | null;
  standings: { standings: StandingTable[]; competition: { name: string; emblem: string } } | null;
}> {
  if (!KV_ENABLED) return { matches: null, standings: null };

  const [matchesEntry, standingsEntry] = await Promise.allSettled([
    kv.get<KVEntry<{ matches: Match[] }>>(WC_ALL_MATCHES_KV),
    kv.get<KVEntry<{ standings: StandingTable[]; competition: { name: string; emblem: string } }>>(WC_STANDINGS_KV),
  ]);

  const now = Date.now();

  const matches =
    matchesEntry.status === 'fulfilled' && matchesEntry.value &&
    (now - matchesEntry.value.fetchedAt) < WC_BULK_MAX_AGE_SEC * 1000
      ? matchesEntry.value.data.matches
      : null;

  const standings =
    standingsEntry.status === 'fulfilled' && standingsEntry.value
      ? standingsEntry.value.data
      : null;

  return { matches, standings };
}

// ---------------------------------------------------------------------------
// Tier-aware per-match seeding
// ---------------------------------------------------------------------------

async function seedMatch(
  match:     Match,
  allMatches: Match[],
  standings: { standings: StandingTable[]; competition: { name: string; emblem: string } } | null,
  now:       number,
  errors:    string[],
): Promise<{ seededDetail: boolean; seededSnapshot: boolean; skipped: boolean; live: boolean }> {

  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  if (isLive) {
    // Live matches are managed by live-cache.ts / refreshLiveMatches.
    // They also bypass the snapshot cache in match-snapshot.ts.
    return { seededDetail: false, seededSnapshot: false, skipped: false, live: true };
  }

  const tier       = getMatchTier(match);
  const tierTtlMs  = TIER_REFRESH_SEC[tier] * 1000;

  // ── Skip if the existing snapshot is still fresh for this tier ───────────
  if (KV_ENABLED) {
    try {
      const existing = await kv.get<MatchSnapshot>(snapshotKey(match.id));
      if (existing && (now - existing.generatedAt) < tierTtlMs) {
        return { seededDetail: false, seededSnapshot: false, skipped: true, live: false };
      }
    } catch {
      // Continue — write new entry
    }
  }

  const matchDetail    = toMatchDetail(match);
  const staleSec       = DETAIL_STALE_SEC[tier];
  const snapshotTtlSec = SNAPSHOT_STALE_SEC[tier];
  const freshSec       = Math.min(staleSec, TIER_REFRESH_SEC[tier]);

  const detailEntry: KVEntry<MatchDetail> = {
    data:       matchDetail,
    fetchedAt:  now,
    freshUntil: now + freshSec * 1000,
  };

  let seededDetail   = false;
  let seededSnapshot = false;

  if (KV_ENABLED) {
    try {
      await Promise.all([
        kv.set(detailKey(match.id),   detailEntry, { ex: staleSec }),
        kv.set(detailDRKey(match.id), detailEntry, { ex: DETAIL_DR_TTL_SEC }),
      ]);
      seededDetail = true;
    } catch (err) {
      errors.push(`detail:${match.id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const snap = buildPartialSnapshot(matchDetail, allMatches, standings);
      await Promise.all([
        kv.set(snapshotKey(match.id),   snap, { ex: snapshotTtlSec }),
        kv.set(snapshotDRKey(match.id), snap, { ex: SNAPSHOT_DR_TTL_SEC }),
      ]);
      seededSnapshot = true;
    } catch (err) {
      errors.push(`snapshot:${match.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { seededDetail, seededSnapshot, skipped: false, live: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pre-warm all WC match KV entries with tier-aware TTLs.
 *
 * Rate-safe: exits immediately if rate-safe mode is active.
 * Bulk-first: reads existing KV data before calling the provider.
 * Skip-if-fresh: per-match checks prevent redundant KV writes.
 */
export async function prewarmWorldCup(): Promise<WorldCupPrewarmResult> {
  const t0      = Date.now();
  const errors: string[] = [];
  let fetchCalls        = 0;
  let seededMatchDetail = 0;
  let seededSnapshots   = 0;
  let skippedFresh      = 0;
  let skippedLive       = 0;
  let priorityRefreshed = 0;
  const tierBreakdown: Record<MatchTier, number> = {
    'live': 0, 'today': 0, 'next-3d': 0, 'future': 0, 'finished': 0,
  };

  // ── Guard: abort if already in rate-safe mode ─────────────────────────────
  if (isRateSafeModeActive()) {
    logRateSafeSkip('prewarmWorldCup');
    return {
      durationMs: Date.now() - t0,
      fetchCalls: 0,
      seededMatchDetail: 0,
      seededSnapshots: 0,
      skippedFresh: 0,
      skippedLive: 0,
      totalWCMatches: 0,
      priorityMatches: 0,
      priorityRefreshed: 0,
      coveragePercent: 0,
      rateSafeMode: true,
      tierBreakdown,
      errors: ['skipped: rate-safe mode active'],
    };
  }

  // ── 1. Read bulk data from KV (reuse orchestrator-seeded keys) ────────────
  console.log('[Prewarm] worldcup: reading bulk data from KV');
  const { matches: kvMatches, standings: kvStandings } = await readBulkFromKV();

  let allMatches: Match[];
  let standings: { standings: StandingTable[]; competition: { name: string; emblem: string } } | null = kvStandings;

  if (kvMatches) {
    console.log(`[Prewarm] worldcup: KV bulk data fresh (${kvMatches.length} matches) | 0 provider calls needed`);
    allMatches = kvMatches;
  } else {
    // KV entry missing or too stale — fetch from provider
    if (isRateSafeModeActive()) {
      logRateSafeSkip('getAllMatches(WC)');
      return {
        durationMs: Date.now() - t0, fetchCalls: 0,
        seededMatchDetail: 0, seededSnapshots: 0,
        skippedFresh: 0, skippedLive: 0, totalWCMatches: 0,
        priorityMatches: 0, priorityRefreshed: 0, coveragePercent: 0,
        rateSafeMode: true, tierBreakdown, errors: ['skipped: rate-safe mode active'],
      };
    }

    console.log('[Prewarm] worldcup: KV bulk data stale/missing — fetching from provider');
    const [allMatchesResult, standingsResult] = await Promise.allSettled([
      providerManager.getAllMatches('WC'),
      standings ? Promise.resolve(standings) : providerManager.getStandings('WC'),
    ]);
    fetchCalls += standings ? 1 : 2;

    if (allMatchesResult.status === 'rejected') {
      const msg = allMatchesResult.reason instanceof Error
        ? allMatchesResult.reason.message : String(allMatchesResult.reason);
      errors.push(`getAllMatches: ${msg}`);
      console.error(`[Prewarm] worldcup: getAllMatches failed: ${msg}`);
      return {
        durationMs: Date.now() - t0, fetchCalls,
        seededMatchDetail: 0, seededSnapshots: 0,
        skippedFresh: 0, skippedLive: 0, totalWCMatches: 0,
        priorityMatches: 0, priorityRefreshed: 0, coveragePercent: 0,
        rateSafeMode: false, tierBreakdown, errors,
      };
    }
    allMatches = allMatchesResult.value.matches;
    if (!standings && standingsResult.status === 'fulfilled') {
      standings = standingsResult.value as { standings: StandingTable[]; competition: { name: string; emblem: string } };
    } else if (standingsResult.status === 'rejected') {
      errors.push(`getStandings: ${standingsResult.reason instanceof Error ? standingsResult.reason.message : String(standingsResult.reason)}`);
    }
  }

  console.log(`[Prewarm] worldcup: ${allMatches.length} WC matches | standings=${standings ? 'ok' : 'failed'}`);

  // ── 2. Identify priority matches (next 24 h, SCHEDULED/TIMED) ─────────────
  const now           = Date.now();
  const cutoff24h     = now + 24 * 3_600 * 1000;
  const priorityList  = allMatches.filter((m) => {
    const kickoff = new Date(m.utcDate).getTime();
    return kickoff >= now && kickoff <= cutoff24h &&
      (m.status === 'SCHEDULED' || m.status === 'TIMED');
  });

  // Count per-tier
  for (const m of allMatches) tierBreakdown[getMatchTier(m)]++;

  console.log(
    `[Prewarm] worldcup: tier breakdown | ` +
    Object.entries(tierBreakdown).map(([t, n]) => `${t}=${n}`).join(' '),
  );

  // ── 3. Tier-aware seeding — skip still-fresh entries ─────────────────────
  console.log('[Prewarm] worldcup: seeding match entries (tier-aware skip-if-fresh)');
  for (const match of allMatches) {
    const { seededDetail, seededSnapshot, skipped, live } = await seedMatch(
      match, allMatches, standings, now, errors,
    );
    if (live)           skippedLive++;
    else if (skipped)   skippedFresh++;
    if (seededDetail)   seededMatchDetail++;
    if (seededSnapshot) seededSnapshots++;
  }

  // ── 4. Priority tier: individually refresh next-24-h with full detail ─────
  const toRefresh = priorityList.slice(0, MAX_PRIORITY_FETCHES);
  for (const pm of toRefresh) {
    if (isRateSafeModeActive()) {
      logRateSafeSkip(`priority:${pm.id}`);
      break; // stop — don't attempt any more provider calls
    }
    try {
      console.log(`[Prewarm] worldcup: priority refresh match ${pm.id} (${pm.utcDate})`);
      const detail = await providerManager.getMatch(pm.id);
      fetchCalls++;
      const tier       = getMatchTier(pm);
      const staleSec   = DETAIL_STALE_SEC[tier];
      const freshSec   = TIER_REFRESH_SEC[tier];
      const entry: KVEntry<MatchDetail> = {
        data:       detail,
        fetchedAt:  now,
        freshUntil: now + freshSec * 1000,
      };
      if (KV_ENABLED) {
        await Promise.all([
          kv.set(detailKey(pm.id),   entry, { ex: staleSec }),
          kv.set(detailDRKey(pm.id), entry, { ex: DETAIL_DR_TTL_SEC }),
          kv.set(snapshotKey(pm.id),   buildPartialSnapshot(detail, allMatches, standings), { ex: SNAPSHOT_STALE_SEC[tier] }),
          kv.set(snapshotDRKey(pm.id), buildPartialSnapshot(detail, allMatches, standings), { ex: SNAPSHOT_DR_TTL_SEC }),
        ]);
      }
      priorityRefreshed++;
    } catch (err) {
      errors.push(`priority:${pm.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── 5. Persist seeded ID manifest ────────────────────────────────────────
  if (KV_ENABLED) {
    kv.set(SEEDED_IDS_KEY, allMatches.map((m) => m.id), { ex: DETAIL_DR_TTL_SEC })
      .catch((err) =>
        console.error('[Prewarm] manifest write failed:', err instanceof Error ? err.message : String(err)),
      );
  }

  const covered         = seededSnapshots + skippedFresh;
  const coveragePercent = allMatches.length > 0
    ? Math.round((covered / allMatches.length) * 100) : 0;

  const durationMs = Date.now() - t0;
  console.log(
    `[Prewarm] worldcup done | matches=${allMatches.length} ` +
    `seededDetail=${seededMatchDetail} seededSnap=${seededSnapshots} ` +
    `skippedFresh=${skippedFresh} skippedLive=${skippedLive} ` +
    `coverage=${coveragePercent}% priority=${priorityRefreshed}/${priorityList.length} ` +
    `fetchCalls=${fetchCalls} errors=${errors.length} | ${durationMs}ms`,
  );

  return {
    durationMs, fetchCalls,
    seededMatchDetail, seededSnapshots, skippedFresh, skippedLive,
    totalWCMatches: allMatches.length,
    priorityMatches: priorityList.length,
    priorityRefreshed,
    coveragePercent,
    rateSafeMode: false,
    tierBreakdown,
    errors,
  };
}
