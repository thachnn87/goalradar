/**
 * match-snapshot.ts
 *
 * Composite KV snapshot for match pages.
 *
 * ── Sprint PERF-4: Snapshot-first, no provider on page load ──────────────────
 *
 *   Priority order (per PERF-4 Phase 2):
 *     1. KV snapshot   (goalradar:match:{id})           — read first
 *     2. KV detail     (goalradar:/matches/{id})        — used in buildSnapshot
 *     3. Static WC data (bundled fixtures.json)         — fallback for group matches
 *     4. Provider                                       — last resort only
 *
 *   Tier-aware TTLs (Phase 5):
 *     LIVE      →  30 s  (not written — live-cache.ts owns this)
 *     UPCOMING  →  min(6 h, time-until-kickoff + 5 min)  (no stale data after kickoff)
 *     FINISHED  →   7 d
 *
 *   Cross-request coalescing (Phase 4):
 *     Module-level _buildInflight map prevents 20 concurrent users from each
 *     running buildSnapshot independently. Only 1 build runs; the other 19
 *     await the same promise.  React.cache() handles within-render dedup.
 *
 *   generateMetadata now calls getOrBuildMatchSnapshot (Phase 7):
 *     Single snapshot read serves both metadata and page render.
 *     No separate getMatchDetail call from page.tsx needed.
 *
 * ── Cache flow ────────────────────────────────────────────────────────────────
 *
 *   generateMetadata()  ─┐
 *                         ├→ getOrBuildMatchSnapshot(id)  ← React.cache() dedup
 *   MatchDetailPage()   ─┘       │
 *   HeadToHeadDeferred  ─────────┤       1. KV snapshot hit → return (0 provider calls)
 *   WCGroupSectionDeferred ──────┘       2. KV snapshot miss → buildSnapshot:
 *                                              a. read detail from KV (no SWR trigger)
 *                                              b. parallel: H2H, WC fixtures, standings (KV)
 *                                              c. static WC fallback if KV misses
 *                                              d. provider only if ALL caches miss
 *                                           3. Write snapshot with tier-aware TTL
 *                                           4. DR key (30 days) written alongside
 *
 * ── Benchmark ─────────────────────────────────────────────────────────────────
 *   Set MATCH_SNAPSHOT_BENCH=true → emits [Snapshot] BENCH lines with ms breakdown.
 */

import { cache } from 'react';
import { kv }   from '@vercel/kv';
import { recordDataSource, getDataSourceStats } from './data-source-tracker';
import { recordSnapshotFetch }                  from './match-perf-tracker';
import { getStaticGroupMatches } from '@/data/worldcup/loader';
import { readKVLiveMatches } from './live-cache';
import { AF_ENRICHMENT_ENABLED, enrichMatchWithAFEvents }   from './af-id-map';
import { ESPN_ENRICHMENT_ENABLED, enrichMatchWithEspnEvents } from './espn-id-map';

import {
  getMatchDetail,
  // PERF-7A: use *Cached variants — read KV only, never trigger provider calls
  getHeadToHeadCached,
  getUpcomingMatchesCached,
  getRecentMatchesCached,
  getStandingsCached,
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

/** Disaster-recovery TTL: 30 days. Written on every successful snapshot build.
 *  Read when KV misses AND the API is unavailable (403/429/5xx). */
const DR_TTL_SEC = 30 * 24 * 3_600; // 2 592 000 s

// ---------------------------------------------------------------------------
// Tier-aware snapshot TTL (Phase 5)
// ---------------------------------------------------------------------------

/**
 * Return the KV TTL in seconds for a snapshot based on match status.
 *
 *   FINISHED  → 7 days   — score never changes
 *   UPCOMING  → min(6h, time-until-kickoff + 5 min grace)
 *               — forces refresh when match starts so we don't serve
 *                 SCHEDULED snapshot while match is IN_PLAY
 *   LIVE      → 30 s     — but live matches are not written (isLiveStatus guard)
 *   other     → 15 min   — safe default (POSTPONED, SUSPENDED, etc.)
 */
function getSnapshotTtlSec(match: MatchDetail): number {
  if (isLiveStatus(match.status)) return 30; // won't be reached (write guard above)

  if (match.status === 'FINISHED') return 7 * 24 * 3_600; // 7 days

  if (match.status === 'SCHEDULED' || match.status === 'TIMED') {
    const msUntilKickoff = new Date(match.utcDate).getTime() - Date.now();
    if (msUntilKickoff <= 0) {
      // Kickoff has passed; the match may be live but API hasn't updated yet.
      // Use 60 s to force a quick refresh.
      return 60;
    }
    const secUntilKickoff = Math.ceil(msUntilKickoff / 1000);
    // max 6 h; expire 5 min after scheduled kickoff so live status is picked up
    return Math.min(6 * 3_600, secUntilKickoff + 300);
  }

  return 15 * 60; // 900 s — default (POSTPONED, SUSPENDED, CANCELLED …)
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface MatchSnapshot {
  /** Full match detail (goals, bookings, subs, referees, venue). */
  match: MatchDetail;

  /** Head-to-head record — null if API call failed or not yet fetched. */
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
// KV entry schema (mirrors kv-cache.ts)
// ---------------------------------------------------------------------------

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function kvKey(matchId: string): string {
  return `goalradar:match:${matchId}`;
}

function drKey(matchId: string): string {
  return `goalradar:dr:match:${matchId}`;
}

/** Live matches must not be served from a stale snapshot. */
function isLiveStatus(status: MatchDetail['status']): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}

// ---------------------------------------------------------------------------
// Phase 2: Read match detail from KV without triggering SWR bg-revalidation
// ---------------------------------------------------------------------------

/**
 * Reads the prewarm-seeded (or withKVCache-written) detail entry
 * `goalradar:/matches/{id}` directly from KV.
 *
 * Unlike calling getMatchDetail() → withKVCache(), this does NOT trigger
 * a background revalidation when the entry is stale.  We use the data as-is
 * for snapshot construction — the snapshot's own tier-aware TTL controls
 * when the page data is considered fresh.
 *
 * Returns null on miss, KV error, or when KV is not configured.
 */
async function readMatchDetailFromKV(matchId: string): Promise<MatchDetail | null> {
  if (!KV_ENABLED) return null;
  try {
    const raw = await kv.get<KVEntry<MatchDetail>>(`goalradar:/matches/${matchId}`);
    if (!raw) return null;
    const ageS = Math.ceil((Date.now() - raw.fetchedAt) / 1000);
    console.log(`[Snapshot] kv-detail-hit match:${matchId} | age=${ageS}s`);
    recordDataSource('kv');
    return raw.data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// KV snapshot read / write
// ---------------------------------------------------------------------------

/** Read snapshot from KV.  Returns null on miss, error, or if match is live. */
async function readKVSnapshot(matchId: string): Promise<MatchSnapshot | null> {
  if (!KV_ENABLED) return null;

  try {
    const raw = await kv.get<MatchSnapshot>(kvKey(matchId));
    if (!raw) return null;

    // Live matches: always rebuild — their status changes every minute
    if (isLiveStatus(raw.match.status)) {
      console.log(`[Snapshot] SKIP match:${matchId} — status=${raw.match.status}, bypassing stale snapshot`);
      return null;
    }

    // Scheduled match past its kickoff → may be live now; force rebuild
    if ((raw.match.status === 'SCHEDULED' || raw.match.status === 'TIMED')) {
      const kickoffPlus5 = new Date(raw.match.utcDate).getTime() + 5 * 60 * 1_000;
      if (Date.now() > kickoffPlus5) {
        console.log(`[Snapshot] EXPIRED match:${matchId} — kickoff passed, may be live now`);
        return null;
      }
    }

    const ageSeconds = Math.ceil((Date.now() - raw.generatedAt) / 1000);
    console.log(`[Snapshot] HIT  match:${matchId} | age=${ageSeconds}s | status=${raw.match.status}`);
    recordDataSource('snapshot');
    return raw;
  } catch (err) {
    console.error(
      `[Snapshot] KV read error for match:${matchId}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Store snapshot in KV with tier-aware TTL.  Fire-and-forget errors. */
async function writeKVSnapshot(matchId: string, snapshot: MatchSnapshot): Promise<void> {
  if (!KV_ENABLED) return;

  // Live matches are served from live-cache.ts — never snapshot them
  if (isLiveStatus(snapshot.match.status)) {
    console.log(`[Snapshot] SKIP write match:${matchId} — status=${snapshot.match.status}`);
    return;
  }

  const ttl = getSnapshotTtlSec(snapshot.match);
  try {
    await kv.set(kvKey(matchId), snapshot, { ex: ttl });
    console.log(
      `[Snapshot] SET  match:${matchId} | ttl=${ttl}s | status=${snapshot.match.status}`,
    );
  } catch (err) {
    console.error(
      `[Snapshot] KV write error for match:${matchId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Read disaster-recovery snapshot.  Returns null on miss or error. */
async function readDRSnapshot(matchId: string): Promise<MatchSnapshot | null> {
  if (!KV_ENABLED) return null;

  try {
    const raw = await kv.get<MatchSnapshot>(drKey(matchId));
    if (!raw) {
      console.warn(`[DR] MISS match:${matchId} — no disaster-recovery snapshot`);
      return null;
    }
    const ageSeconds = Math.ceil((Date.now() - raw.generatedAt) / 1000);
    console.warn(`[DR] HIT  match:${matchId} | age=${ageSeconds}s | status=${raw.match.status}`);
    recordDataSource('snapshot');
    return raw;
  } catch (err) {
    console.error(
      `[DR] read error for match:${matchId}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Write disaster-recovery snapshot (30 days TTL).  Fire-and-forget. */
function writeDRSnapshot(matchId: string, snapshot: MatchSnapshot): void {
  if (!KV_ENABLED) return;
  if (isLiveStatus(snapshot.match.status)) return;

  kv.set(drKey(matchId), snapshot, { ex: DR_TTL_SEC })
    .then(() => console.log(`[DR] SAVE match:${matchId} | ttl=${DR_TTL_SEC}s`))
    .catch((err) =>
      console.error(
        `[DR] write error for match:${matchId}:`,
        err instanceof Error ? err.message : String(err),
      ),
    );
}

// ---------------------------------------------------------------------------
// Phase 6: Static WC fallback helpers
// ---------------------------------------------------------------------------

function getStaticWCFallback(): Match[] {
  try {
    return getStaticGroupMatches();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Core: Build snapshot from individual data sources
// ---------------------------------------------------------------------------

/**
 * Build a fresh snapshot.
 *
 * Priority order (Phase 2):
 *   1. KV detail key `goalradar:/matches/{id}` — read without triggering bg revalidation
 *   2. `getMatchDetail` via withCache → withKVCache → provider (if KV detail misses)
 *
 * For WC group data, `getUpcomingMatches`/`getRecentMatches`/`getStandings` already
 * route through KV (seeded by orchestrator).  If they miss, static WC fixtures
 * are used as a fallback (Phase 6).
 */
async function buildSnapshot(matchId: string): Promise<MatchSnapshot> {
  const t0 = Date.now();

  // ── 1. Match detail: KV first, provider fallback ───────────────────────────
  let match: MatchDetail | null = await readMatchDetailFromKV(matchId);
  let detailSource: 'kv' | 'provider' = 'kv';

  if (!match) {
    console.log(`[Snapshot] kv-detail-miss match:${matchId} — calling provider`);
    detailSource = 'provider';
    match = await getMatchDetail(matchId); // withCache → withKVCache → provider
  }

  // DATA-11B / DATA-13: Enrich FINISHED WC matches with event data
  // (goals, bookings, substitutions) which football-data.org free tier omits.
  // Guard: FINISHED + WC competition + no goals already present.
  // Provider order: api-football first (DATA-11B), ESPN fallback (DATA-13).
  // Best-effort: any failure returns unenriched match; snapshot still writes.
  const needsEnrichment =
    match.status === 'FINISHED' &&
    match.competition?.code === 'WC' &&
    (match.goals?.length ?? 0) === 0;

  if (needsEnrichment && AF_ENRICHMENT_ENABLED) {
    match = await enrichMatchWithAFEvents(match);
  }

  // ESPN enrichment: runs when AF enrichment is disabled or produced no events.
  if (needsEnrichment && ESPN_ENRICHMENT_ENABLED && (match.goals?.length ?? 0) === 0) {
    match = await enrichMatchWithEspnEvents(match);
  }

  // LIVE-2 / LIVE-2B: overlay score + status from live cache.
  // Condition guards on live.status (NOT match.status) so the overlay fires
  // even when the detail key still shows SCHEDULED — the "detail stale at
  // kickoff" race (LIVE-2B) where goalradar:live:matches is already IN_PLAY
  // but goalradar:/matches/{id} SWR hasn't refreshed yet.
  // Reading KV-direct (no L1, no provider) keeps SSR first-paint consistent
  // with /live and /api/live-score. Overlay is ephemeral — write guard still
  // prevents caching live snapshots.
  try {
    const kvLive = await readKVLiveMatches();
    if (kvLive) {
      const numId = parseInt(matchId, 10);
      const live  = kvLive.find((m) => m.id === numId);
      if (live && isLiveStatus(live.status)) {
        const prevStatus = match.status;
        match = { ...match, score: live.score, status: live.status };
        console.log(
          `[Snapshot] LIVE-OVERLAY match:${matchId}` +
          ` | score=${live.score?.fullTime?.home ?? '?'}-${live.score?.fullTime?.away ?? '?'}` +
          ` | status=${live.status}` +
          ` | detailWas=${prevStatus}`,
        );
      }
    }
  } catch {
    // live cache unavailable — use detail score as-is (graceful degradation)
  }

  return assembleSnapshot(matchId, match, detailSource, t0);
}

/**
 * Steps 2–3 of the snapshot build: parallel KV-only data + merge.
 * Shared by buildSnapshot (provider-fallback path) and
 * prewarmMatchSnapshotKVOnly (PERF-8, strictly KV-only path).
 */
async function assembleSnapshot(
  matchId:      string,
  match:        MatchDetail,
  detailSource: 'kv' | 'provider',
  t0:           number,
): Promise<MatchSnapshot> {
  const isWC    = match.competition?.code === 'WC';
  const hasGroup = Boolean(match.group);

  // ── 2. Parallel: H2H + WC group data ────────────────────────────────────
  // PERF-6: use *Cached variants (L1 → readKVOnly → static fallback).
  // These NEVER call the provider — snapshot builds must not add to the queue.
  const [h2hResult, upcomingResult, recentResult, standingsResult] =
    await Promise.allSettled([
      getHeadToHeadCached(matchId),
      isWC && hasGroup ? getUpcomingMatchesCached('WC') : Promise.resolve(null),
      isWC && hasGroup ? getRecentMatchesCached('WC')   : Promise.resolve(null),
      isWC && hasGroup ? getStandingsCached('WC')       : Promise.resolve(null),
    ]);

  const parallelMs = Date.now() - t0;

  // ── 3. Merge + dedup WC group matches; static fallback (Phase 6) ──────────
  const dedup = (arr: Match[]): Match[] => {
    const seen = new Set<number>();
    return arr.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  };

  let wcUpcoming: Match[];
  if (upcomingResult.status === 'fulfilled' && upcomingResult.value) {
    wcUpcoming = upcomingResult.value.matches;
  } else if (isWC && hasGroup) {
    // KV/provider miss — use bundled WC dataset (Phase 6)
    console.warn(`[Snapshot] static-fallback match:${matchId} — using bundled WC fixtures for upcoming`);
    wcUpcoming = getStaticWCFallback();
  } else {
    wcUpcoming = [];
  }

  const wcRecent: Match[] =
    recentResult.status === 'fulfilled' && recentResult.value
      ? recentResult.value.matches : [];

  const wcAllMatches   = dedup([...wcUpcoming, ...wcRecent]);
  const wcGroupMatches = wcAllMatches.filter((m) => m.group === match!.group);

  const snapshot: MatchSnapshot = {
    match,
    headToHead:    h2hResult.status     === 'fulfilled' ? h2hResult.value     : null,
    standings:     standingsResult.status === 'fulfilled' ? standingsResult.value as MatchSnapshot['standings'] : null,
    wcGroupMatches,
    wcAllMatches,
    generatedAt: Date.now(),
  };

  if (BENCH) {
    console.log(
      `[Snapshot] BENCH match:${matchId} | source=built | detail=${detailSource}` +
      ` | total=${Date.now() - t0}ms parallel=${parallelMs}ms`,
    );
  } else {
    console.log(
      `[Snapshot] BUILT match:${matchId} | detail=${detailSource}` +
      ` | h2h=${snapshot.headToHead ? 'ok' : 'null'}` +
      ` | standings=${snapshot.standings ? 'ok' : 'null'}` +
      ` | wcMatches=${wcAllMatches.length} | ${Date.now() - t0}ms`,
    );
  }

  return snapshot;
}

// ---------------------------------------------------------------------------
// PERF-8: KV-only snapshot prewarm (hover/touch/viewport hints)
// ---------------------------------------------------------------------------

/**
 * Prewarm a match snapshot WITHOUT any provider fallback.
 *
 * Called by /api/prewarm/match/[id] on hover / touch / viewport hints.
 * Outcomes:
 *   'hit'   — snapshot already in KV (nothing to do)
 *   'built' — snapshot assembled from KV detail + KV parallel data and written
 *   'skip'  — KV detail missing → do nothing (the provider path is
 *             structurally absent from this function; a later real page
 *             visit handles the full-cold case under the KV lock)
 */
export async function prewarmMatchSnapshotKVOnly(
  matchId: string,
): Promise<'hit' | 'built' | 'skip'> {
  const existing = await readKVSnapshot(matchId);
  if (existing) return 'hit';

  const detail = await readMatchDetailFromKV(matchId);
  if (!detail) {
    console.log(`[Prewarm-hint] SKIP match:${matchId} — no KV detail (provider not allowed)`);
    return 'skip';
  }

  // Coalesce with any concurrent page-render build of the same match.
  const inflight = _buildInflight.get(matchId);
  if (inflight) {
    await inflight.catch(() => undefined);
    return 'hit';
  }

  const snapshot = await assembleSnapshot(matchId, detail, 'kv', Date.now());
  await writeKVSnapshot(matchId, snapshot).catch(() => undefined);
  writeDRSnapshot(matchId, snapshot);
  console.log(`[Prewarm-hint] BUILT match:${matchId} (KV-only)`);
  return 'built';
}

// ---------------------------------------------------------------------------
// Phase 4: Cross-request inflight map
// ---------------------------------------------------------------------------

/**
 * Module-level inflight map for cross-request coalescing.
 *
 * React.cache() deduplicates getOrBuildMatchSnapshot WITHIN a single render.
 * This map deduplicates ACROSS concurrent requests:
 *   - 20 users hit the same uncached match simultaneously
 *   - User 1 starts buildSnapshot → promise stored in map
 *   - Users 2–20 find the in-flight promise → await same result
 *   - Only 1 buildSnapshot runs; only 1 set of provider/KV calls made
 *
 * Cleared automatically via .finally() when build completes.
 */
const _buildInflight = new Map<string, Promise<MatchSnapshot>>();

// ---------------------------------------------------------------------------
// Public API — memoised with React.cache()
// ---------------------------------------------------------------------------

/**
 * Fetch or build the match snapshot.
 *
 * Wrapped with `React.cache()` so that within a single server render
 * (generateMetadata + page component + Suspense deferred components all call this),
 * the async work happens exactly once per render.
 *
 * Priority (PERF-4):
 *   1. React per-request cache (memoisation)  — instant, 0 network
 *   2. KV snapshot   goalradar:match:{id}     — ~10 ms
 *   3. Build from KV detail + parallel data  — ~20 ms (all KV hits)
 *   4. Build from provider                   — ~200–7000 ms (last resort)
 */
export const getOrBuildMatchSnapshot: (matchId: string) => Promise<MatchSnapshot> = cache(
  async (matchId: string): Promise<MatchSnapshot> => {
    const t0 = Date.now();

    // ── 1. KV snapshot ─────────────────────────────────────────────────────
    const kvHit = await readKVSnapshot(matchId);
    if (kvHit) {
      const kvMs = Date.now() - t0;
      if (BENCH) console.log(`[Snapshot] BENCH match:${matchId} | source=kv | kvMs=${kvMs}`);
      recordSnapshotFetch(kvMs, 'kv');
      return kvHit;
    }

    // ── 2. Cross-request inflight dedup (within-instance, Phase 4) ──────────
    console.log(`[Snapshot] MISS match:${matchId} — building snapshot`);
    const existing = _buildInflight.get(matchId);
    if (existing) {
      console.log(`[Snapshot] DEDUP match:${matchId} — coalescing with in-flight build`);
      return existing;
    }

    // ── 2b. Cross-INSTANCE KV lock (PERF-6 Phase 4) ───────────────────────
    // Prevents multiple Vercel function instances from building the same
    // snapshot in parallel (each would make independent provider calls).
    // Lock TTL = 60 s — long enough for a full build to complete.
    if (KV_ENABLED) {
      const lockKey  = `goalradar:lock:snapshot:${matchId}`;
      const acquired = await kv.set(lockKey, '1', { nx: true, ex: 60 }).catch(() => null);
      if (!acquired) {
        // Another instance is already building — wait briefly then re-read KV.
        console.log(`[Snapshot] LOCK-MISS match:${matchId} — another instance building, waiting 3s`);
        await new Promise<void>((r) => setTimeout(r, 3_000));
        const raceHit = await readKVSnapshot(matchId);
        if (raceHit) {
          console.log(`[Snapshot] LOCK-MISS match:${matchId} — found snapshot after wait`);
          return raceHit;
        }
        // Snapshot still not there (build may have failed) — fall through and build anyway.
        console.warn(`[Snapshot] LOCK-MISS match:${matchId} — no snapshot after wait, building anyway`);
      } else {
        console.log(`[Snapshot] KV-LOCK match:${matchId} — acquired build lock`);
      }
    }

    // ── 3. Build (KV detail first, provider fallback) ──────────────────────
    let snapshot: MatchSnapshot;
    const buildPromise = buildSnapshot(matchId)
      .finally(() => _buildInflight.delete(matchId));
    _buildInflight.set(matchId, buildPromise);

    const statsBefore = getDataSourceStats();
    try {
      snapshot = await buildPromise;
    } catch (buildErr) {
      // ── 4. Disaster-recovery key ──────────────────────────────────────────
      console.error(
        `[Snapshot] BUILD failed match:${matchId}: ${buildErr instanceof Error ? buildErr.message : String(buildErr)}` +
        ` | checking disaster-recovery key`,
      );
      const dr = await readDRSnapshot(matchId);
      if (dr) {
        recordSnapshotFetch(Date.now() - t0, 'dr');
        return dr;
      }
      throw buildErr;
    }

    const statsAfter = getDataSourceStats();
    const usedProvider =
      statsAfter.footballDataHits > statsBefore.footballDataHits ||
      statsAfter.apiFootballHits  > statsBefore.apiFootballHits;
    recordSnapshotFetch(Date.now() - t0, usedProvider ? 'build-provider' : 'build-kv');

    // Write snapshot with tier-aware TTL (Phase 5) + DR key
    writeKVSnapshot(matchId, snapshot).catch(() => undefined);
    writeDRSnapshot(matchId, snapshot);

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
 * Also clears the ESPN event cache so re-enrichment fetches fresh data.
 * No-op if KV is not configured.
 */
export async function invalidateMatchSnapshot(matchId: string): Promise<void> {
  if (!KV_ENABLED) return;
  try {
    const { espnEventKvKey } = await import('./espn-id-map');
    await Promise.all([
      kv.del(kvKey(matchId)),
      kv.del(espnEventKvKey(matchId)),
    ]);
    console.log(`[Snapshot] INVALIDATED match:${matchId} + espn-event-cache`);
  } catch {
    // best-effort
  }
}
