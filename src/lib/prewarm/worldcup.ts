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
// DATA-18K: guarded snapshot writers — replace the raw kv.set that bypassed
// the downgrade guard (proven root cause of pinned goals=0 snapshots).
import { writeKVSnapshot, writeDRSnapshot } from '@/lib/match-snapshot';
import { enrichMatchWithAFEvents } from '@/lib/af-id-map';
// DATA-4: forward-only state ranks — prewarm must never regress snapshot state
import { STATE_RANK } from '@/lib/match-state-overlay';
import {
  isRateSafeModeActive,
  logRateSafeSkip,
  getMatchTier,
  TIER_REFRESH_SEC,
  TIER_PRIORITY,
  HOT_TIERS,
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

/**
 * Orchestrator cron interval in seconds. KV TTLs for short-lived tiers must
 * exceed this so entries never expire between two consecutive cron runs.
 * 1920 s = 32 min > 30-min cron interval + 2-min safety margin.
 */
const CRON_INTERVAL_SEC    = 1_800; // 30 min
const CRON_OVERLAP_SEC     =   120; // 2 min safety margin
const CRON_SAFE_TTL        = CRON_INTERVAL_SEC + CRON_OVERLAP_SEC; // 1920 s

/**
 * How many matches to seed in parallel per batch.
 * Each match does up to 4 KV writes; 10 × 4 = 40 concurrent ops is safe for
 * Upstash (default connection limit 100).
 */
const SEED_BATCH_SIZE = 10;

/**
 * TTL for seeded match detail entries per tier.
 *
 * PERF-10 invariant: TTL = refresh threshold + CRON_SAFE_TTL margin.
 * The previous config used TTL == threshold for future/finished, which made
 * entries expire BETWEEN the cycle that skipped them (still fresh) and the
 * cycle that would have reseeded them — a guaranteed ~30-min cold window on
 * the largest buckets.
 */
const DETAIL_STALE_SEC: Record<MatchTier, number> = {
  'live':     60,
  // Hot tiers — reseeded every cycle; TTL just needs to outlive one cycle.
  'today':    CRON_SAFE_TTL,                                  // 32 min
  'next-24h': CRON_SAFE_TTL,                                  // 32 min
  // Cold tiers — TTL = threshold + cron-safe margin (gap-free).
  'next-3d':  TIER_REFRESH_SEC['next-3d'] + CRON_SAFE_TTL,    // 2 h 32 min
  'future':   TIER_REFRESH_SEC['future']  + CRON_SAFE_TTL,    // 12 h 32 min
  'finished': 7 * 24 * 3_600,                                 // 7 d — reseed only when missing
};

// DATA-18K: snapshot + DR TTLs are now owned by writeKVSnapshot/writeDRSnapshot
// (tier-aware getSnapshotTtlSec / DR_TTL_SEC). The prewarm-local SNAPSHOT_STALE_SEC
// and SNAPSHOT_DR_TTL_SEC tables were removed when the raw kv.set writes were
// replaced by the guarded writers.

/** DR copy TTL for the detail key — long-lived safety net. */
const DETAIL_DR_TTL_SEC   = 7 * 24 * 3_600;  // 7 days

/** Max individual priority-tier API calls per run (next-24-h matches). */
const MAX_PRIORITY_FETCHES = 4;

/** KV key for the seeded match ID manifest. */
export const SEEDED_IDS_KEY = 'goalradar:prewarm:match-ids';

/** PERF-10: KV key for the last prewarm run's hot/cold metrics
 *  (read by /api/debug/performance — cron runs in a different lambda,
 *  so in-process counters would not be visible there). */
export const PREWARM_METRICS_KEY = 'goalradar:prewarm:metrics';

export interface PrewarmMetrics {
  ts:                number;
  hotMatchCount:     number;  // live + today + next-24h
  coldMatchCount:    number;  // next-3d + future + finished
  snapshotSeedCount: number;  // snapshots written this run
  skippedFresh:      number;
  coveragePercent:   number;
  tierBreakdown:     Record<MatchTier, number>;
}

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
  match:           Match,
  existingSnapshot: MatchSnapshot | null,  // pre-fetched via mget — avoids per-match kv.get
  allMatches:      Match[],
  standings:       { standings: StandingTable[]; competition: { name: string; emblem: string } } | null,
  now:             number,
  errors:          string[],
): Promise<{ seededDetail: boolean; seededSnapshot: boolean; skipped: boolean; live: boolean }> {

  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  if (isLive) {
    // Live matches are managed by live-cache.ts / refreshLiveMatches.
    // They also bypass the snapshot cache in match-snapshot.ts.
    return { seededDetail: false, seededSnapshot: false, skipped: false, live: true };
  }

  const tier      = getMatchTier(match);
  const tierTtlMs = TIER_REFRESH_SEC[tier] * 1000;

  // ── PERF-10: FINISHED — reseed only when missing ─────────────────────────
  // Scores never change; any existing snapshot is valid until KV evicts it.
  if (tier === 'finished' && existingSnapshot) {
    return { seededDetail: false, seededSnapshot: false, skipped: true, live: false };
  }

  // ── Skip if the existing snapshot is still fresh for this tier ──────────
  if (existingSnapshot && (now - existingSnapshot.generatedAt) < tierTtlMs) {
    return { seededDetail: false, seededSnapshot: false, skipped: true, live: false };
  }

  // ── DATA-4: never regress snapshot state ─────────────────────────────────
  // The bulk WC list driving this seeding can be older than reality — a match
  // can finish AFTER the list refresh within the same cycle. If the existing
  // snapshot is AHEAD in the forward-only state machine (e.g. FINISHED while
  // the stale list still says TIMED), overwriting it would clobber the
  // fresher state — observed in production: a finished match regressed to a
  // scoreless TIMED card on the homepage. Keep the snapshot; the next list
  // refresh reconciles naturally.
  if (
    existingSnapshot &&
    (STATE_RANK[existingSnapshot.match.status] ?? 0) > (STATE_RANK[match.status] ?? 0)
  ) {
    console.log(
      `[Prewarm] STATE-GUARD match ${match.id}: keeping snapshot ${existingSnapshot.match.status} over stale list ${match.status}`,
    );
    return { seededDetail: false, seededSnapshot: false, skipped: true, live: false };
  }

  const matchDetail    = toMatchDetail(match);
  const staleSec       = DETAIL_STALE_SEC[tier];
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
      // DATA-18D.2 Phase 2: for new FINISHED scored matches, attempt AF enrichment
      // before writing — eliminates the 24h unenriched window.
      let matchDetailForSnap = matchDetail;
      if (tier === 'finished' && process.env.ENABLE_AF_ENRICHMENT === 'true') {
        const ftH = matchDetail.score?.fullTime?.home ?? 0;
        const ftA = matchDetail.score?.fullTime?.away ?? 0;
        if (ftH + ftA > 0) {
          try {
            matchDetailForSnap = await enrichMatchWithAFEvents(matchDetail);
          } catch {
            // best-effort — proceed with unenriched if AF throws
          }
        }
      }

      const snap = buildPartialSnapshot(matchDetailForSnap, allMatches, standings);

      // DATA-18D.2 Phase 3: warn when first build is unenriched (AF unavailable).
      const snapFtH = matchDetailForSnap.score?.fullTime?.home ?? 0;
      const snapFtA = matchDetailForSnap.score?.fullTime?.away ?? 0;
      const isUnenriched =
        tier === 'finished' &&
        snapFtH + snapFtA > 0 &&
        (snap.match.goals?.length ?? 0) === 0;
      if (isUnenriched) {
        console.warn(
          `[Prewarm] FIRST_BUILD_UNENRICHED match:${match.id}` +
          ` | score=${snapFtH}-${snapFtA} goals=0 | AF enrichment unavailable`,
        );
      }

      // DATA-18K: write through the guarded writers instead of a raw kv.set.
      //  - writeKVSnapshot applies the downgrade guard: an unenriched build
      //    (goals=0) can no longer overwrite an enriched primary — it is
      //    rescued from the enriched DR copy when one exists.
      //  - writeDRSnapshot applies the poison guard: it refuses to persist a
      //    FINISHED scored snapshot with goals=0 into DR.
      // This is the Phase-1 fix for the proven root cause (seedMatch bypass).
      // TTL is now derived inside writeKVSnapshot (tier-aware getSnapshotTtlSec).
      await writeKVSnapshot(String(match.id), snap);
      writeDRSnapshot(String(match.id), snap);
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
    'live': 0, 'today': 0, 'next-24h': 0, 'next-3d': 0, 'future': 0, 'finished': 0,
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

  // ── 3. Tier-aware seeding — batch freshness check + parallel writes ───────
  // PERF-10: seed in hot-first priority order (LIVE → TODAY → NEXT_24H →
  // NEXT_72H → FUTURE → FINISHED) so the matches users are most likely to
  // open are warmed first in every cycle.
  console.log('[Prewarm] worldcup: seeding match entries (hot-first, skip-if-fresh)');

  const prioritized = [...allMatches].sort(
    (a, b) => TIER_PRIORITY[getMatchTier(a)] - TIER_PRIORITY[getMatchTier(b)],
  );

  let existingSnaps: (MatchSnapshot | null)[] = prioritized.map(() => null);
  if (KV_ENABLED && prioritized.length > 0) {
    try {
      existingSnaps = await kv.mget<(MatchSnapshot | null)[]>(
        ...prioritized.map((m) => snapshotKey(m.id)),
      );
    } catch {
      // On mget failure, fall through — existingSnaps remain null (seed all)
    }
  }

  for (let i = 0; i < prioritized.length; i += SEED_BATCH_SIZE) {
    const batch = prioritized.slice(i, i + SEED_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((match, j) =>
        seedMatch(match, existingSnaps[i + j] ?? null, allMatches, standings, now, errors),
      ),
    );
    for (const { seededDetail, seededSnapshot, skipped, live } of results) {
      if (live)           skippedLive++;
      else if (skipped)   skippedFresh++;
      if (seededDetail)   seededMatchDetail++;
      if (seededSnapshot) seededSnapshots++;
    }
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
        // DATA-18K: detail keys stay raw (not the enrichment surface); the
        // snapshot + DR writes route through the guarded writers so a
        // partial/unenriched build cannot clobber an enriched primary or DR.
        const psnap = buildPartialSnapshot(detail, allMatches, standings);
        await Promise.all([
          kv.set(detailKey(pm.id),   entry, { ex: staleSec }),
          kv.set(detailDRKey(pm.id), entry, { ex: DETAIL_DR_TTL_SEC }),
        ]);
        await writeKVSnapshot(String(pm.id), psnap);
        writeDRSnapshot(String(pm.id), psnap);
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

  // ── PERF-10: persist hot/cold metrics for /api/debug/performance ─────────
  const hotMatchCount  = allMatches.filter((m) => HOT_TIERS.has(getMatchTier(m))).length;
  const coldMatchCount = allMatches.length - hotMatchCount;
  if (KV_ENABLED) {
    const metrics: PrewarmMetrics = {
      ts: Date.now(),
      hotMatchCount,
      coldMatchCount,
      snapshotSeedCount: seededSnapshots,
      skippedFresh,
      coveragePercent,
      tierBreakdown,
    };
    kv.set(PREWARM_METRICS_KEY, metrics, { ex: 24 * 3_600 }).catch(() => undefined);
  }

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
