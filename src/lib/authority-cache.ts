/**
 * DATA-18B/18C: Authority Cache Builder — activated by DATA-18C.1.
 *
 * AUTHORITY_CACHE_ENABLED=true + orchestrator wiring added in DATA-18C.1.
 *
 * Responsibilities:
 *   buildAllCanonicalMatches() — batch-build 104 CanonicalMatch objects from
 *     FD feeds, live cache, per-match KV snapshots, and ESPN ID lookups.
 *     Zero network calls; all inputs are read before this function runs.
 *
 *   writeAuthorityCache()      — build + write goalradar:wc:authority:v1 with
 *     a versioned envelope and DR copy. Single-flight guard prevents concurrent
 *     rebuilds from racing. Also writes goalradar:authority:last-write record.
 *
 *   readAuthorityCache()       — primary → DR → cold rebuild (single-flight).
 *
 * Cache keys:
 *   goalradar:wc:authority:v1       — primary (TTL: 30s / 300s / 900s)
 *   goalradar:dr:wc:authority:v1    — disaster-recovery (7-day TTL)
 *   goalradar:authority:last-write  — write audit record (10-day TTL)
 *
 * Versioned envelope (version: 1):
 *   builtAt, matchCount, liveCount, ttlTier, matches[]
 *
 * Must pass: npx tsc --noEmit
 */

import { kv } from '@vercel/kv';
import type { Match } from './types';
import { recordAuthorityRead } from './authority-telemetry';
import type { MatchSnapshot } from './match-snapshot';
import { buildCanonicalMatch, type CanonicalMatch, type LiveEntry } from './canonical-match';
import { espnLookupKvKey, espnMissSuppressed, type LookupMiss } from './espn-id-map';
import { STATE_RANK } from './match-state-overlay';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

/** Primary KV key for the authority cache. */
export const AUTHORITY_KEY    = 'goalradar:wc:authority:v1';
/** Disaster-recovery KV key — 7-day TTL. */
export const AUTHORITY_DR_KEY = 'goalradar:dr:wc:authority:v1';
/** Write audit record key — updated on every successful writeAuthorityCache() call. */
export const AUTHORITY_WRITE_RECORD_KEY = 'goalradar:authority:last-write';

/** Audit record written after each successful cache write. */
export interface AuthorityWriteRecord {
  builtAt:    string;
  matchCount: number;
  liveCount:  number;
  ttlTier:    AuthorityCacheEnvelope['ttlTier'];
  durationMs: number;
  source:     string;
}

/** TTL tiers in seconds, matching ISR intervals in the migration plan. */
const TTL_LIVE   =  30;  // any match is IN_PLAY or PAUSED
const TTL_TODAY  = 300;  // any match kicks off today UTC
const TTL_NORMAL = 900;  // no live or today matches

/** 7-day disaster-recovery TTL — written on every successful cache write. */
const DR_TTL_SEC = 7 * 24 * 3_600; // 604 800 s

/**
 * Maximum age for a DR-sourced authority cache when live matches are present.
 * After this threshold, readAuthorityCache() triggers a cold rebuild rather than
 * returning stale 'live' state from DR — prevents hub from showing finished
 * matches as LIVE during orchestrator cron gaps.
 */
const DR_LIVE_STALE_MAX_MS = 120_000; // 2 minutes

// ---------------------------------------------------------------------------
// Versioned cache envelope (version: 1)
// ---------------------------------------------------------------------------

export interface AuthorityCacheEnvelope {
  /** Envelope version. Increment when shape changes to invalidate stale DR copies. */
  version:    1;
  /** ISO-8601 build timestamp (passed in by caller — never Date.now() here). */
  builtAt:    string;
  /** Total matches in this payload. */
  matchCount: number;
  /** Matches with state==='live' at build time. */
  liveCount:  number;
  /** TTL tier applied to the primary key. DR key always uses DR_TTL_SEC. */
  ttlTier:    'live' | 'today' | 'normal';
  /** All CanonicalMatch objects for this tournament. */
  matches:    CanonicalMatch[];
}

// ---------------------------------------------------------------------------
// Authority telemetry
// ---------------------------------------------------------------------------

/** Per-process telemetry counters — reset on cold start. */
const telemetry = {
  hits:          0,
  drHits:        0,
  coldRebuilds:  0,
  writeCount:    0,
  lastBuildMs:   0,   // duration of most recent cold rebuild
  lastWriteMs:   0,   // duration of most recent writeAuthorityCache() call
};

export function getAuthorityTelemetry() {
  return { ...telemetry };
}

function logHit(source: 'primary' | 'dr', envelope: AuthorityCacheEnvelope) {
  const ageMs = Date.now() - new Date(envelope.builtAt).getTime();
  const ageSec = Math.ceil(ageMs / 1000);
  console.log(
    `[Authority] HIT  | ${AUTHORITY_KEY} | source=${source} | ${envelope.matchCount} matches` +
    ` | live=${envelope.liveCount} | built ${ageSec}s ago | ttl=${envelope.ttlTier}`,
  );
}

function logMiss() {
  console.log(`[Authority] MISS | ${AUTHORITY_KEY} | cold rebuild started`);
}

function logSet(envelope: AuthorityCacheEnvelope, durationMs: number, ttlSec: number) {
  console.log(
    `[Authority] SET  | ${AUTHORITY_KEY} | ${envelope.matchCount} matches` +
    ` | live=${envelope.liveCount} | built in ${durationMs}ms | ttl=${ttlSec}s`,
  );
}

// ---------------------------------------------------------------------------
// Single-flight lock for cold rebuilds
// ---------------------------------------------------------------------------

/**
 * Module-level in-flight promise for cold rebuilds.
 * Prevents concurrent cold starts from each independently reading 104 snapshot keys.
 * Pattern mirrors match-snapshot.ts `_buildInflight`.
 */
let _rebuildInflight: Promise<CanonicalMatch[]> | null = null;

// ---------------------------------------------------------------------------
// TTL tier derivation
// ---------------------------------------------------------------------------

function deriveTtlTier(matches: CanonicalMatch[], todayUTC: string): AuthorityCacheEnvelope['ttlTier'] {
  const hasLive  = matches.some(m => m.state === 'live');
  if (hasLive) return 'live';
  const hasToday = matches.some(m => m.utcDate.startsWith(todayUTC));
  if (hasToday) return 'today';
  return 'normal';
}

function ttlSecForTier(tier: AuthorityCacheEnvelope['ttlTier']): number {
  if (tier === 'live')   return TTL_LIVE;
  if (tier === 'today')  return TTL_TODAY;
  return TTL_NORMAL;
}

// ---------------------------------------------------------------------------
// buildAllCanonicalMatches — batch merge engine
// ---------------------------------------------------------------------------

/**
 * DATA-18B: Batch-build CanonicalMatch[] from all available data layers.
 *
 * Pure in terms of side effects: no KV writes, no network calls.
 * All KV reads happen in the caller (writeAuthorityCache / cold rebuild).
 *
 * @param fdMatches   All WC matches from FD bulk feeds (upcoming + results merged
 *                    by STATE_RANK — same merge as getWCAuthorityMatchesCached but
 *                    WITHOUT overlayMatchStates since we apply liveMap here).
 * @param liveMap     Map from match ID to LiveEntry for IN_PLAY/PAUSED matches.
 *                    Empty map is valid (no live matches right now).
 * @param snapshotMap Map from match ID to MatchSnapshot. Populated by mget of
 *                    goalradar:match:{id} keys for all fdMatches.
 * @param espnIdMap   Map from match ID to ESPN event ID string. Populated by mget
 *                    of goalradar:espn:lookup:{id} keys. Only includes resolved IDs
 *                    (misses and LookupMiss sentinels are excluded by caller).
 * @param builtAt     ISO-8601 timestamp — passed in by caller for determinism.
 */
export function buildAllCanonicalMatches(
  fdMatches:   Match[],
  liveMap:     Map<number, LiveEntry>,
  snapshotMap: Map<number, MatchSnapshot>,
  espnIdMap:   Map<number, string>,
  builtAt:     string,
): CanonicalMatch[] {
  return fdMatches.map((fdMatch) => {
    // Determine which FD feed this match came from (B3 fix: explicit, not inferred).
    // fdMatches have already been merged by STATE_RANK; the effective feed is:
    //   FINISHED → came from results feed (STATE_RANK=3)
    //   otherwise → came from upcoming feed (STATE_RANK=0)
    // IN_PLAY at this point is rare (the liveMap overlays it), but if present
    // it was in the upcoming feed and the live cache is applied below.
    const fdFeed: 'scheduled' | 'results' = fdMatch.status === 'FINISHED' ? 'results' : 'scheduled';

    const snapshot    = snapshotMap.get(fdMatch.id) ?? null;
    const liveEntry   = liveMap.get(fdMatch.id) ?? null;
    const espnMatchId = espnIdMap.get(fdMatch.id);

    return buildCanonicalMatch(fdMatch, fdFeed, snapshot, liveEntry, espnMatchId, builtAt);
  });
}

// ---------------------------------------------------------------------------
// KV batch read helpers
// ---------------------------------------------------------------------------

/**
 * mget all per-match snapshot keys for a list of matches.
 * Returns a Map from match ID to MatchSnapshot for all non-null results.
 */
async function readSnapshotMap(matches: Match[]): Promise<Map<number, MatchSnapshot>> {
  if (!KV_ENABLED || matches.length === 0) return new Map();
  try {
    const keys = matches.map(m => `goalradar:match:${m.id}`);
    // kv.mget expects spread args — chunk to avoid oversized Redis command.
    const CHUNK = 100;
    const resultMap = new Map<number, MatchSnapshot>();

    for (let i = 0; i < keys.length; i += CHUNK) {
      const chunkKeys  = keys.slice(i, i + CHUNK);
      const chunkIds   = matches.slice(i, i + CHUNK).map(m => m.id);
      const snaps      = await kv.mget<(MatchSnapshot | null)[]>(...chunkKeys);
      for (let j = 0; j < snaps.length; j++) {
        const snap = snaps[j];
        if (snap !== null) resultMap.set(chunkIds[j], snap);
      }
    }
    return resultMap;
  } catch (err) {
    console.error(
      `[Authority] snapshot mget error:`,
      err instanceof Error ? err.message : String(err),
    );
    return new Map(); // best-effort — proceed without snapshots
  }
}

/**
 * mget all ESPN lookup keys for a list of matches.
 * Returns a Map from match ID to ESPN event ID (string).
 * Entries where the stored value is a LookupMiss sentinel are excluded.
 */
async function readEspnIdMap(matches: Match[]): Promise<Map<number, string>> {
  if (!KV_ENABLED || matches.length === 0) return new Map();
  try {
    const keys   = matches.map(m => espnLookupKvKey(m.id));
    const chunkSize = 100;
    const resultMap = new Map<number, string>();

    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunkKeys = keys.slice(i, i + chunkSize);
      const chunkIds  = matches.slice(i, i + chunkSize).map(m => m.id);
      // Stored value is either a bare string (ESPN ID) or a LookupMiss object.
      const values    = await kv.mget<(string | LookupMiss | null)[]>(...chunkKeys);
      const now = Date.now();
      for (let j = 0; j < values.length; j++) {
        const v = values[j];
        if (typeof v === 'string' && v !== '__NOT_FOUND__') {
          resultMap.set(chunkIds[j], v);
        } else if (v !== null && typeof v === 'object' && 'lastAttemptAt' in v) {
          // LookupMiss sentinel — skip (no ESPN ID resolved)
          void espnMissSuppressed(v as LookupMiss, now); // type-check only
        }
      }
    }
    return resultMap;
  } catch (err) {
    console.error(
      `[Authority] ESPN ID mget error:`,
      err instanceof Error ? err.message : String(err),
    );
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// Core cold rebuild
// ---------------------------------------------------------------------------

/**
 * Run a full cold rebuild of the authority cache.
 * Reads FD feeds, snapshots, ESPN IDs, live cache — then calls buildAllCanonicalMatches().
 * Returns the freshly-built CanonicalMatch[].
 *
 * Single-flight guarded: concurrent callers share the same in-flight promise.
 */
async function coldRebuild(builtAt: string): Promise<CanonicalMatch[]> {
  // Single-flight: if a rebuild is already in progress, return its result.
  if (_rebuildInflight !== null) {
    console.log(`[Authority] COALESCE | cold rebuild already in-flight — awaiting`);
    return _rebuildInflight;
  }

  const start = Date.now();
  logMiss();
  telemetry.coldRebuilds++;

  _rebuildInflight = (async () => {
    try {
      // Read FD feeds (same sources as getWCAuthorityMatchesCached but without overlay).
      const [
        { getUpcomingMatchesCached },
        { getWCResultsCached },
        { getWCLiveMatches },
      ] = await Promise.all([
        import('./api'),
        import('./api'),
        import('./api'),
      ]);

      const [upcomingResult, resultsResult, liveResult] = await Promise.allSettled([
        getUpcomingMatchesCached('WC'),
        getWCResultsCached(),
        getWCLiveMatches(),
      ]);

      const upcoming = upcomingResult.status === 'fulfilled' ? upcomingResult.value.matches : [];
      const results  = resultsResult.status  === 'fulfilled' ? resultsResult.value.matches  : [];
      const live     = liveResult.status     === 'fulfilled' ? liveResult.value.matches     : [];

      // Merge FD feeds by STATE_RANK (mirrors getWCAuthorityMatchesCached).
      const byId = new Map<number, Match>();
      for (const m of upcoming) byId.set(m.id, m);
      for (const m of results) {
        const existing = byId.get(m.id);
        if (!existing || (STATE_RANK[m.status] ?? 0) >= (STATE_RANK[existing.status] ?? 0)) {
          byId.set(m.id, m);
        }
      }
      const fdMatches = [...byId.values()];

      // Build live map (live cache is separate — IN_PLAY/PAUSED only).
      const liveMap = new Map<number, LiveEntry>();
      for (const m of live) {
        if (m.status === 'IN_PLAY' || m.status === 'PAUSED') {
          liveMap.set(m.id, { status: m.status, minute: m.minute ?? undefined });
        }
      }

      // Batch-read snapshots + ESPN IDs from KV.
      const [snapshotMap, espnIdMap] = await Promise.all([
        readSnapshotMap(fdMatches),
        readEspnIdMap(fdMatches),
      ]);

      const matches = buildAllCanonicalMatches(fdMatches, liveMap, snapshotMap, espnIdMap, builtAt);
      telemetry.lastBuildMs = Date.now() - start;
      console.log(
        `[Authority] REBUILT | ${matches.length} matches in ${telemetry.lastBuildMs}ms` +
        ` | snapshots=${snapshotMap.size} | espnIds=${espnIdMap.size} | live=${liveMap.size}`,
      );
      return matches;
    } finally {
      _rebuildInflight = null;
    }
  })();

  return _rebuildInflight;
}

// ---------------------------------------------------------------------------
// writeAuthorityCache
// ---------------------------------------------------------------------------

/**
 * Build the full authority cache and write it to KV.
 * Called from the cron orchestrator after bulk feed refresh (DATA-18C.1+).
 *
 * Writes:
 *   goalradar:wc:authority:v1       — TTL based on live/today/normal tier
 *   goalradar:dr:wc:authority:v1    — 7-day DR copy
 *   goalradar:authority:last-write  — audit record (10-day TTL)
 *
 * @param builtAt   ISO-8601 timestamp — passed in by caller for determinism.
 * @param source    Identifies the caller (e.g. 'cron:orchestrator').
 */
export async function writeAuthorityCache(
  builtAt: string,
  source = 'unknown',
): Promise<AuthorityCacheEnvelope> {
  const writeStart = Date.now();
  const matches    = await coldRebuild(builtAt);

  const todayUTC   = builtAt.split('T')[0];
  const liveCount  = matches.filter(m => m.state === 'live').length;
  const ttlTier    = deriveTtlTier(matches, todayUTC);
  const ttlSec     = ttlSecForTier(ttlTier);

  const envelope: AuthorityCacheEnvelope = {
    version:    1,
    builtAt,
    matchCount: matches.length,
    liveCount,
    ttlTier,
    matches,
  };

  if (KV_ENABLED) {
    const record: AuthorityWriteRecord = {
      builtAt,
      matchCount: matches.length,
      liveCount,
      ttlTier,
      durationMs: 0, // filled below after write completes
      source,
    };

    await Promise.all([
      kv.set(AUTHORITY_KEY, envelope, { ex: ttlSec }).catch((err) =>
        console.error(`[Authority] WRITE error on primary key:`, err instanceof Error ? err.message : String(err)),
      ),
      kv.set(AUTHORITY_DR_KEY, envelope, { ex: DR_TTL_SEC }).catch((err) =>
        console.error(`[Authority] WRITE error on DR key:`, err instanceof Error ? err.message : String(err)),
      ),
    ]);

    record.durationMs = Date.now() - writeStart;
    kv.set(AUTHORITY_WRITE_RECORD_KEY, record, { ex: 10 * 24 * 3_600 }).catch((err) =>
      console.error(`[Authority] WRITE error on audit record:`, err instanceof Error ? err.message : String(err)),
    );
  }

  telemetry.writeCount++;
  telemetry.lastWriteMs = Date.now() - writeStart;
  logSet(envelope, telemetry.lastWriteMs, ttlSec);

  return envelope;
}

// ---------------------------------------------------------------------------
// readAuthorityCache
// ---------------------------------------------------------------------------

/**
 * Read the authority cache from KV.
 * Fall-back chain: primary → DR → cold rebuild.
 *
 * Called by getWCAuthorityMatchesV2() in api.ts and directly by debug endpoints.
 *
 * @param builtAt      ISO-8601 timestamp passed through to cold rebuild if needed.
 * @param attribution  DATA-18C.6: optional caller identity for source attribution.
 */
export async function readAuthorityCache(
  builtAt:      string,
  attribution?: import('./authority-telemetry').AuthorityReadAttribution,
): Promise<CanonicalMatch[]> {
  const _readStart = Date.now();

  if (KV_ENABLED) {
    // ── 1. Primary key ────────────────────────────────────────────────────
    try {
      const envelope = await kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY);
      if (envelope !== null && envelope.version === 1 && Array.isArray(envelope.matches)) {
        telemetry.hits++;
        logHit('primary', envelope);
        recordAuthorityRead('primary', Date.now() - _readStart, builtAt, attribution); // fire-and-forget
        return envelope.matches;
      }
    } catch (err) {
      console.error(
        `[Authority] primary read error:`,
        err instanceof Error ? err.message : String(err),
      );
    }

    // ── 2. DR key ─────────────────────────────────────────────────────────
    try {
      const drEnvelope = await kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY);
      if (drEnvelope !== null && drEnvelope.version === 1 && Array.isArray(drEnvelope.matches)) {
        // WC-LIVE-STATE: if the DR cache has live matches and is older than
        // DR_LIVE_STALE_MAX_MS, fall through to cold rebuild. Returning stale
        // 'live' state would cause the hub to show finished matches as LIVE
        // during orchestrator cron gaps.
        if (drEnvelope.liveCount > 0) {
          const drAgeMs = Date.now() - new Date(drEnvelope.builtAt).getTime();
          if (drAgeMs > DR_LIVE_STALE_MAX_MS) {
            console.warn(
              `[Authority] DR stale for live tier | age=${Math.ceil(drAgeMs / 1000)}s | liveCount=${drEnvelope.liveCount}` +
              ` | forcing cold rebuild to avoid stale live-state`,
            );
            // fall through to cold rebuild
          } else {
            telemetry.drHits++;
            logHit('dr', drEnvelope);
            recordAuthorityRead('dr', Date.now() - _readStart, builtAt, attribution); // fire-and-forget
            return drEnvelope.matches;
          }
        } else {
          telemetry.drHits++;
          logHit('dr', drEnvelope);
          recordAuthorityRead('dr', Date.now() - _readStart, builtAt, attribution); // fire-and-forget
          return drEnvelope.matches;
        }
      }
    } catch (err) {
      console.error(
        `[Authority] DR read error:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ── 3. Cold rebuild ────────────────────────────────────────────────────
  const matches = await coldRebuild(builtAt);
  recordAuthorityRead('cold', Date.now() - _readStart, builtAt, attribution); // fire-and-forget
  return matches;
}
