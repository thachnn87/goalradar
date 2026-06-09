/**
 * src/lib/prewarm/worldcup.ts
 *
 * Sprint PERF-3 — Pre-warm & Cache Seeding
 *
 * Populates every World Cup KV cache entry before users arrive.
 * Called by the cron orchestrator; never called on the request path.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Strategy: bulk-first seeding (Phase 11 — Intelligent Seeding)
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Rather than fetching 104 matches individually (104 × 7 s = 728 s), we:
 *
 *   1. getAllMatches('WC')  — 1 API call → 104 Match objects
 *   2. getStandings('WC')  — 1 API call → group standings
 *   3. From that data alone, write:
 *        goalradar:/matches/{id}          (match detail KV key)
 *        goalradar:match:{id}             (composite snapshot KV key)
 *      for EVERY match — zero extra provider calls.
 *
 * For the next 24 h of matches (priority tier), we also write the
 * disaster-recovery snapshot key so users can never be left with an
 * empty page even if the provider goes down mid-tournament.
 *
 * Match detail seeded this way carries basic match data (score, teams,
 * status, matchday, group).  Goals/bookings/substitutions are fetched
 * on-demand when a user opens the match page — and then cached normally.
 * For SCHEDULED/TIMED matches there are no events anyway, so seeding is
 * complete for those.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * KV keys written (all standard goalradar: prefix):
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   goalradar:/matches/{id}              KVEntry<MatchDetail>   TTL: 120 s
 *   goalradar:dr:/matches/{id}           KVEntry<MatchDetail>   TTL: 7 days
 *   goalradar:match:{id}                 MatchSnapshot          TTL: 900 s
 *   goalradar:dr:match:{id}              MatchSnapshot          TTL: 30 days
 *   goalradar:prewarm:match-ids          number[]               TTL: 7 days
 *
 * Seeded by the calling orchestrator (via refreshEndpoint):
 *   goalradar:/competitions/WC/matches
 *   goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED
 *   goalradar:/competitions/WC/matches?status=FINISHED
 *   goalradar:/competitions/WC/standings
 *   goalradar:live:matches
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Rate-limit contract
 * ──────────────────────────────────────────────────────────────────────────
 *
 * This module makes exactly 2 provider calls (getAllMatches + getStandings)
 * regardless of how many WC matches exist.  All 104 match KV entries are
 * derived from those 2 responses.  Additional provider calls are only made
 * for "priority" matches in the next 24 h window, capped at MAX_PRIORITY_FETCHES
 * per run (default 4).
 */

import { kv }               from '@vercel/kv';
import { providerManager }  from '@/lib/providers/manager';
import type { Match, MatchDetail, StandingTable } from '@/lib/types';
import type { MatchSnapshot } from '@/lib/match-snapshot';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

/** TTL for seeded match detail entries (seconds) — mirrors SWR.MATCH.stale */
const MATCH_DETAIL_STALE_SEC  = 120;
const MATCH_DETAIL_FRESH_SEC  =  60;
/** Longer TTL for SCHEDULED/TIMED matches — they won't change until kick-off */
const MATCH_DETAIL_FUTURE_SEC = 1_800; // 30 min

/** TTL for seeded composite snapshots — mirrors match-snapshot.ts SNAPSHOT_TTL_SEC */
const SNAPSHOT_TTL_SEC = 900;
/** DR snapshot TTL — mirrors match-snapshot.ts DR_TTL_SEC */
const SNAPSHOT_DR_TTL_SEC = 30 * 24 * 3_600; // 30 days
/** Match detail DR TTL */
const MATCH_DR_TTL_SEC = 7 * 24 * 3_600; // 7 days

/** Max per-match API calls per prewarm run (priority tier only). */
const MAX_PRIORITY_FETCHES = 4;

/** 24 h window (ms) for the priority tier. */
const PRIORITY_WINDOW_MS = 24 * 3_600 * 1000;

/** KV key for the seeded match ID manifest. */
export const SEEDED_IDS_KEY = 'goalradar:prewarm:match-ids';

// ---------------------------------------------------------------------------
// Internal KV entry shape (mirrors kv-cache.ts)
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
  /** Wall-clock ms for the entire prewarm run. */
  durationMs:         number;
  /** Provider API calls made by this function (normally 2). */
  fetchCalls:         number;
  /** goalradar:/matches/{id} keys written to KV. */
  seededMatchDetail:  number;
  /** goalradar:match:{id} snapshot keys written to KV. */
  seededSnapshots:    number;
  /** Entries skipped because a fresh KV entry already existed. */
  skippedFresh:       number;
  /** Total WC matches returned by getAllMatches. */
  totalWCMatches:     number;
  /** Number of matches in the next-24-h priority tier. */
  priorityMatches:    number;
  /** How many priority-tier matches were individually refreshed. */
  priorityRefreshed:  number;
  /** (seededSnapshots + skippedFresh) / totalWCMatches × 100 */
  coveragePercent:    number;
  /** Non-fatal error messages (one per failed KV write or API call). */
  errors:             string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchDetailKey(id: number): string {
  return `goalradar:/matches/${id}`;
}
function matchDetailDRKey(id: number): string {
  return `goalradar:dr:/matches/${id}`;
}
function snapshotKey(id: number): string {
  return `goalradar:match:${id}`;
}
function snapshotDRKey(id: number): string {
  return `goalradar:dr:match:${id}`;
}

/**
 * Cast a Match (basic) to MatchDetail by filling in default arrays for
 * event fields. Matches that haven't been individually fetched will have
 * empty goals/bookings/substitutions — acceptable for SCHEDULED matches;
 * on-demand fetches will overwrite these for FINISHED matches.
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

/**
 * Build a partial MatchSnapshot from the bulk-fetched data.
 * headToHead is null (requires a per-match API call we deliberately avoid).
 */
function buildPartialSnapshot(
  match: MatchDetail,
  allMatches: Match[],
  standings: { standings: StandingTable[]; competition: { name: string; emblem: string } } | null,
): MatchSnapshot {
  const isWC    = match.competition?.code === 'WC';
  const hasGroup = Boolean(match.group);

  const dedup = (arr: Match[]): Match[] => {
    const seen = new Set<number>();
    return arr.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  };

  const wcAllMatches   = isWC ? dedup(allMatches) : [];
  const wcGroupMatches = isWC && hasGroup
    ? wcAllMatches.filter((m) => m.group === match.group)
    : [];

  return {
    match,
    headToHead:    null,   // requires individual API call — fetched on user demand
    standings:     isWC && hasGroup ? standings : null,
    wcGroupMatches,
    wcAllMatches,
    generatedAt:   Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Core seeding function for a single match
// ---------------------------------------------------------------------------

async function seedMatch(
  match: Match,
  allMatches: Match[],
  standings: { standings: StandingTable[]; competition: { name: string; emblem: string } } | null,
  now: number,
  errors: string[],
): Promise<{ seededDetail: boolean; seededSnapshot: boolean; skipped: boolean }> {

  const isLive      = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isFuture    = match.status === 'SCHEDULED' || match.status === 'TIMED';
  const matchDetail = toMatchDetail(match);

  // ── Phase 6 queue-bypass: skip live matches — live-cache handles them ───
  if (isLive) {
    return { seededDetail: false, seededSnapshot: false, skipped: true };
  }

  // ── Check if a fresh snapshot already exists — skip if so ──────────────
  if (KV_ENABLED) {
    try {
      const existing = await kv.get<MatchSnapshot>(snapshotKey(match.id));
      if (existing && (now - existing.generatedAt) < SNAPSHOT_TTL_SEC * 1000) {
        return { seededDetail: false, seededSnapshot: false, skipped: true };
      }
    } catch {
      // Continue to write
    }
  }

  // ── Write match detail KV entry (goalradar:/matches/{id}) ───────────────
  const freshSec = isFuture ? MATCH_DETAIL_FUTURE_SEC : MATCH_DETAIL_FRESH_SEC;
  const staleSec = isFuture ? MATCH_DETAIL_FUTURE_SEC : MATCH_DETAIL_STALE_SEC;
  const detailEntry: KVEntry<MatchDetail> = {
    data:       matchDetail,
    fetchedAt:  now,
    freshUntil: now + freshSec * 1000,
  };
  let seededDetail = false;
  if (KV_ENABLED) {
    try {
      await Promise.all([
        kv.set(matchDetailKey(match.id), detailEntry, { ex: staleSec }),
        kv.set(matchDetailDRKey(match.id), detailEntry, { ex: MATCH_DR_TTL_SEC }),
      ]);
      seededDetail = true;
    } catch (err) {
      errors.push(`detail:${match.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Write composite snapshot (goalradar:match:{id}) ─────────────────────
  const snapshot = buildPartialSnapshot(matchDetail, allMatches, standings);
  let seededSnapshot = false;
  if (KV_ENABLED) {
    try {
      await Promise.all([
        kv.set(snapshotKey(match.id), snapshot, { ex: SNAPSHOT_TTL_SEC }),
        kv.set(snapshotDRKey(match.id), snapshot, { ex: SNAPSHOT_DR_TTL_SEC }),
      ]);
      seededSnapshot = true;
    } catch (err) {
      errors.push(`snapshot:${match.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { seededDetail, seededSnapshot, skipped: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pre-warm all WC match KV entries.
 *
 * Makes 2 provider API calls (getAllMatches + getStandings) and derives
 * KV entries for every WC match from those responses.  Optionally makes
 * up to MAX_PRIORITY_FETCHES extra calls for next-24-h matches to seed
 * full match detail (with event lists).
 *
 * Safe to call from cron routes; never blocks user requests.
 */
export async function prewarmWorldCup(): Promise<WorldCupPrewarmResult> {
  const t0     = Date.now();
  const errors: string[] = [];
  let fetchCalls        = 0;
  let seededMatchDetail = 0;
  let seededSnapshots   = 0;
  let skippedFresh      = 0;
  let priorityRefreshed = 0;

  // ── 1. Fetch all WC data (2 API calls in parallel) ──────────────────────
  console.log('[Prewarm] worldcup: fetching bulk data (getAllMatches + getStandings)');
  const [allMatchesResult, standingsResult] = await Promise.allSettled([
    providerManager.getAllMatches('WC'),
    providerManager.getStandings('WC'),
  ]);
  fetchCalls += 2;

  if (allMatchesResult.status === 'rejected') {
    const msg = allMatchesResult.reason instanceof Error
      ? allMatchesResult.reason.message : String(allMatchesResult.reason);
    errors.push(`getAllMatches: ${msg}`);
    console.error(`[Prewarm] getAllMatches failed: ${msg}`);
    return {
      durationMs: Date.now() - t0,
      fetchCalls,
      seededMatchDetail: 0,
      seededSnapshots: 0,
      skippedFresh: 0,
      totalWCMatches: 0,
      priorityMatches: 0,
      priorityRefreshed: 0,
      coveragePercent: 0,
      errors,
    };
  }

  const allMatches = allMatchesResult.value.matches;
  const standings  = standingsResult.status === 'fulfilled' ? standingsResult.value : null;
  if (standingsResult.status === 'rejected') {
    errors.push(`getStandings: ${standingsResult.reason instanceof Error ? standingsResult.reason.message : String(standingsResult.reason)}`);
  }

  console.log(`[Prewarm] worldcup: ${allMatches.length} WC matches found; standings=${standings ? 'ok' : 'failed'}`);

  // ── 2. Identify priority matches (next 24 h) ────────────────────────────
  const now          = Date.now();
  const priorityCutoff = now + PRIORITY_WINDOW_MS;
  const priorityMatches = allMatches.filter((m) => {
    const kickoff = new Date(m.utcDate).getTime();
    return kickoff >= now && kickoff <= priorityCutoff &&
      (m.status === 'SCHEDULED' || m.status === 'TIMED');
  });

  console.log(`[Prewarm] worldcup: ${priorityMatches.length} matches in next-24-h priority tier`);

  // ── 3. Seed all matches from bulk data (no extra API calls) ─────────────
  console.log('[Prewarm] worldcup: seeding match detail + snapshot KV entries');
  for (const match of allMatches) {
    const { seededDetail, seededSnapshot, skipped } = await seedMatch(
      match, allMatches, standings, now, errors,
    );
    if (skipped)        skippedFresh++;
    if (seededDetail)   seededMatchDetail++;
    if (seededSnapshot) seededSnapshots++;
  }

  // ── 4. Priority tier: individually refresh next-24-h matches ─────────────
  // These get full MatchDetail (with event lists) where possible.
  const toRefresh = priorityMatches.slice(0, MAX_PRIORITY_FETCHES);
  for (const pm of toRefresh) {
    if (fetchCalls >= 2 + MAX_PRIORITY_FETCHES) break;
    try {
      console.log(`[Prewarm] worldcup: priority refresh match ${pm.id} (${pm.utcDate})`);
      const detail = await providerManager.getMatch(pm.id);
      fetchCalls++;
      // Overwrite the match detail entry with the full version
      const freshSec  = MATCH_DETAIL_FUTURE_SEC;
      const entry: KVEntry<MatchDetail> = {
        data:       detail,
        fetchedAt:  now,
        freshUntil: now + freshSec * 1000,
      };
      if (KV_ENABLED) {
        await Promise.all([
          kv.set(matchDetailKey(pm.id), entry, { ex: MATCH_DETAIL_FUTURE_SEC }),
          kv.set(matchDetailDRKey(pm.id), entry, { ex: MATCH_DR_TTL_SEC }),
        ]);
        // Rebuild snapshot with full detail
        const snap = buildPartialSnapshot(detail, allMatches, standings);
        await Promise.all([
          kv.set(snapshotKey(pm.id), snap, { ex: SNAPSHOT_TTL_SEC }),
          kv.set(snapshotDRKey(pm.id), snap, { ex: SNAPSHOT_DR_TTL_SEC }),
        ]);
      }
      priorityRefreshed++;
    } catch (err) {
      errors.push(`priority:${pm.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── 5. Persist seeded ID manifest ────────────────────────────────────────
  const seededIds = allMatches.map((m) => m.id);
  if (KV_ENABLED) {
    kv.set(SEEDED_IDS_KEY, seededIds, { ex: MATCH_DR_TTL_SEC }).catch((err) =>
      console.error('[Prewarm] manifest write failed:', err instanceof Error ? err.message : String(err)),
    );
  }

  const covered          = seededSnapshots + skippedFresh;
  const coveragePercent  = allMatches.length > 0
    ? Math.round((covered / allMatches.length) * 100)
    : 0;

  const durationMs = Date.now() - t0;
  console.log(
    `[Prewarm] worldcup done | matches=${allMatches.length} seededDetail=${seededMatchDetail} ` +
    `seededSnap=${seededSnapshots} skipped=${skippedFresh} coverage=${coveragePercent}% ` +
    `priority=${priorityRefreshed}/${priorityMatches.length} errors=${errors.length} | ${durationMs}ms`,
  );

  return {
    durationMs,
    fetchCalls,
    seededMatchDetail,
    seededSnapshots,
    skippedFresh,
    totalWCMatches: allMatches.length,
    priorityMatches: priorityMatches.length,
    priorityRefreshed,
    coveragePercent,
    errors,
  };
}
