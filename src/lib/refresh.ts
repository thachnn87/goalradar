/**
 * Background cache refresh helpers.
 *
 * Used by externally-triggered cron route handlers to proactively populate
 * KV so that user requests always read from cache (never block on a live
 * API call).
 *
 * Key format mirrors kv-cache.ts ("goalradar:<endpoint>") so the same
 * cache entries are served to users by the existing fetchWithKV() flow.
 */

import { kv }                from '@vercel/kv';
import { providerManager }  from './providers/manager';
import { ApiUnavailableError } from './errors';
import { isRateSafeModeActive, logRateSafeSkip } from './rate-safe';

const KV_PREFIX  = 'goalradar:';

// ---------------------------------------------------------------------------
// Prewarm run record — persisted in KV after each prewarm execution
// ---------------------------------------------------------------------------

/** Result of a single warmed endpoint within a prewarm run. */
export interface PrewarmTaskResult {
  label:     string;
  status:    'ok' | 'fail' | 'skip';
  elapsedMs: number;
  error?:    string;
}

/** Full record of one prewarm run, stored in KV for the status endpoint. */
export interface PrewarmRecord {
  timestamp:   string;  // ISO 8601
  elapsedMs:   number;
  ok:          number;
  failed:      number;
  total:       number;
  results:     PrewarmTaskResult[];
  triggeredBy: 'header' | 'queryparam' | 'unknown';
  // PERF-3 enrichment — populated when worldcup seeding runs
  seededMatches?:    number;
  seededStandings?:  boolean;
  seededGroups?:     boolean;
  seededResults?:    boolean;
  coveragePercent?:  number;
  seedErrors?:       string[];
  seedDurationMs?:   number;
  priorityMatches?:  number;
}

/** KV key where the last prewarm run result is stored. TTL: 7 days. */
export const PREWARM_RECORD_KEY = 'goalradar:prewarm:last-run';
const PREWARM_RECORD_TTL = 7 * 24 * 3_600; // 604 800 s

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

/** Persist a prewarm run record to KV. Fire-and-forget — never throws. */
export function savePrewarmRecord(record: PrewarmRecord): void {
  if (!KV_ENABLED) return;
  kv.set(PREWARM_RECORD_KEY, record, { ex: PREWARM_RECORD_TTL }).catch((err) =>
    console.error('[Prewarm] KV write failed for run record:', err instanceof Error ? err.message : String(err)),
  );
}

/** Read the last prewarm run record from KV. Returns null on miss or KV unavailable. */
export async function loadPrewarmRecord(): Promise<PrewarmRecord | null> {
  if (!KV_ENABLED) return null;
  try {
    return await kv.get<PrewarmRecord>(PREWARM_RECORD_KEY);
  } catch {
    return null;
  }
}

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

export interface RefreshResult {
  endpoint:    string;
  status:      'ok' | 'error' | 'skipped';
  fetchedAt:   string;
  freshUntil:  string;
  error?:      string;
}

// ---------------------------------------------------------------------------
// Endpoint → ProviderManager method dispatch
// ---------------------------------------------------------------------------

/**
 * Maps a football-data.org endpoint path to the correct providerManager
 * method so the refresh layer benefits from the same failover as page routes.
 *
 * Matched patterns (longest-match order):
 *   /competitions/{code}/matches?status=SCHEDULED,TIMED  → getFixtures(code)
 *   /competitions/{code}/matches?status=FINISHED          → getResults(code)  ← best-effort
 *   /competitions/{code}/matches                          → getAllMatches(code)
 *   /competitions/{code}/standings                        → getStandings(code)
 *   /matches?status=IN_PLAY,PAUSED                        → getLiveMatches()
 *   /matches?dateFrom=…&dateTo=…                          → getTodayMatches()
 *   (fallback)                                            → throws Error
 */
async function dispatchToProvider(endpoint: string): Promise<unknown> {
  // Standings
  const standingsM = endpoint.match(/^\/competitions\/([^/]+)\/standings/);
  if (standingsM) return providerManager.getStandings(standingsM[1]);

  // Fixtures (scheduled/timed)
  if (endpoint.includes('/matches') && endpoint.includes('SCHEDULED,TIMED')) {
    const m = endpoint.match(/^\/competitions\/([^/]+)\/matches/);
    if (m) return providerManager.getFixtures(m[1]);
  }

  // Finished results
  if (endpoint.includes('/matches') && endpoint.includes('FINISHED')) {
    const m = endpoint.match(/^\/competitions\/([^/]+)\/matches/);
    if (m) return providerManager.getResults(m[1]);
  }

  // All competition matches (bracket / knockout)
  const allMatchesM = endpoint.match(/^\/competitions\/([^/]+)\/matches(\?.*)?$/);
  if (allMatchesM) return providerManager.getAllMatches(allMatchesM[1]);

  // Live matches
  if (endpoint.includes('/matches') && endpoint.includes('IN_PLAY')) {
    return providerManager.getLiveMatches();
  }

  // Today's matches
  if (endpoint.includes('/matches') && endpoint.includes('dateFrom')) {
    return providerManager.getTodayMatches();
  }

  // Unknown — throw so the caller records an error
  throw new Error(`[Refresh] No providerManager mapping for endpoint: ${endpoint}`);
}

// ---------------------------------------------------------------------------
// Core: fetch one endpoint and write to KV
// ---------------------------------------------------------------------------

/**
 * Fetches fresh data via ProviderManager (with failover) and stores it in Vercel KV.
 * Maps endpoint paths to the appropriate providerManager method.
 *
 * @param endpoint        API path, e.g. "/competitions/WC/matches?status=SCHEDULED,TIMED"
 * @param freshSec        How long (seconds) the entry is considered fully fresh.
 * @param staleSec        KV TTL — entry auto-expires after this many seconds.
 * @param options.minIntervalSec  Skip the provider call if the existing KV entry
 *                                was fetched less than this many seconds ago.
 *                                Prevents redundant refreshes when cron fires more
 *                                often than data actually changes.
 * @param options.caller  Logical caller name for logging (e.g. 'cron/orchestrator').
 */
export async function refreshEndpoint(
  endpoint: string,
  freshSec: number,
  staleSec: number,
  options?: { minIntervalSec?: number; caller?: string },
): Promise<RefreshResult> {
  const start  = Date.now();
  const caller = options?.caller ?? 'cron';
  const minIntervalSec = options?.minIntervalSec;

  // ── Rate-safe mode guard ────────────────────────────────────────────────
  // If football-data.org returned 429/403/timeout in this process (or another
  // instance set the KV flag), skip the provider call entirely.
  if (isRateSafeModeActive()) {
    logRateSafeSkip(endpoint);
    return {
      endpoint,
      status:    'skipped',
      fetchedAt: new Date(start).toISOString(),
      freshUntil: '',
      error:     'rate-safe mode active',
    };
  }

  // ── Skip-if-fresh guard ─────────────────────────────────────────────────
  // When a minimum refresh interval is specified, check the existing KV entry.
  // If the data is younger than minIntervalSec, skip the provider call to avoid
  // redundant fetches that inflate queue depth.
  if (minIntervalSec !== undefined && KV_ENABLED) {
    try {
      const existing = await kv.get<KVEntry<unknown>>(`${KV_PREFIX}${endpoint}`);
      if (existing?.fetchedAt) {
        const ageMs  = start - existing.fetchedAt;
        const ageSec = Math.round(ageMs / 1000);
        if (ageMs < minIntervalSec * 1_000) {
          console.log(
            `[Refresh] SKIP-FRESH ${endpoint}` +
            ` | age=${ageSec}s < minInterval=${minIntervalSec}s | caller=${caller}`,
          );
          return {
            endpoint,
            status:     'skipped',
            fetchedAt:  new Date(existing.fetchedAt).toISOString(),
            freshUntil: new Date(existing.freshUntil).toISOString(),
          };
        }
      }
    } catch {
      // KV error — proceed with the provider refresh rather than blocking
    }
  }

  console.log(`[Refresh] START ${endpoint} | caller=${caller}`);

  let data: unknown;
  try {
    // Route through ProviderManager so failover to api-football is active
    // when football-data.org is down. Endpoint → method mapping mirrors api.ts.
    data = await dispatchToProvider(endpoint);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Refresh] FAIL  ${endpoint} | caller=${caller}: ${msg}${err instanceof ApiUnavailableError ? ' [both providers failed]' : ''}`);
    return { endpoint, status: 'error', fetchedAt: new Date(start).toISOString(), freshUntil: '', error: msg };
  }

  const now        = Date.now();
  const freshUntil = now + freshSec * 1000;
  const entry: KVEntry<unknown> = { data, fetchedAt: now, freshUntil };

  try {
    await kv.set(`${KV_PREFIX}${endpoint}`, entry, { ex: staleSec });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Refresh] KV-WRITE-FAIL ${endpoint}: ${msg}`);
    return { endpoint, status: 'error', fetchedAt: new Date(now).toISOString(), freshUntil: '', error: msg };
  }

  const elapsed = Date.now() - start;
  console.log(`[Refresh] OK    ${endpoint} | fresh ${freshSec}s | stale ${staleSec}s | caller=${caller} | ${elapsed}ms`);

  return {
    endpoint,
    status:    'ok',
    fetchedAt: new Date(now).toISOString(),
    freshUntil: new Date(freshUntil).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Refresh live matches — writes to the canonical live-cache KV key
// ---------------------------------------------------------------------------

/**
 * Fetches live match data via ProviderManager and writes directly to the
 * canonical KV key used by live-cache.ts (goalradar:live:matches).
 *
 * Bypasses live-cache.ts's L1/freshness checks on purpose — cron jobs must
 * always push fresh data regardless of whether the in-process cache is warm.
 *
 * Also updates the disaster-recovery key (7-day TTL) on every successful fetch.
 */
export async function refreshLiveMatches(): Promise<RefreshResult> {
  const start    = Date.now();
  const endpoint = '/matches?status=IN_PLAY,PAUSED';

  // Live matches bypass rate-safe mode: even during a rate-limit event we
  // still want the cached live data served.  But we must not call the
  // provider when we're throttled — return immediately if active.
  if (isRateSafeModeActive()) {
    logRateSafeSkip(endpoint);
    return { endpoint, status: 'skipped', fetchedAt: new Date(start).toISOString(), freshUntil: '', error: 'rate-safe mode active' };
  }

  let result: Awaited<ReturnType<typeof providerManager.getLiveMatches>>;
  try {
    result = await providerManager.getLiveMatches();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Refresh] FAIL  ${endpoint}: ${msg}${err instanceof ApiUnavailableError ? ' [both providers failed]' : ''}`);
    return { endpoint, status: 'error', fetchedAt: new Date(start).toISOString(), freshUntil: '', error: msg };
  }

  const now   = Date.now();
  const entry = { matches: result.matches, fetchedAt: now };

  if (KV_ENABLED) {
    // Mirror the exact KVEntry format and TTLs used by live-cache.ts
    kv.set('goalradar:live:matches', entry, { ex: 30 }).catch((err) =>
      console.error('[Refresh] KV live write failed:', err instanceof Error ? err.message : String(err)),
    );
    // Disaster-recovery key: 7-day TTL, fire-and-forget
    kv.set('goalradar:dr:live:matches', entry, { ex: 7 * 24 * 3_600 }).catch(() => {});
  }

  const elapsed = Date.now() - start;
  console.log(`[Refresh] OK    ${endpoint} | live | count=${result.matches.length} | ${elapsed}ms`);

  return {
    endpoint,
    status:     'ok',
    fetchedAt:  new Date(now).toISOString(),
    freshUntil: new Date(now + 30_000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Auth helpers — shared by all cron / refresh route handlers
// ---------------------------------------------------------------------------

/**
 * Returns true if the request carries a valid CRON_SECRET.
 *
 * Checks the `Authorization: Bearer <secret>` header only.
 * Used by the existing /api/refresh/* routes which receive the header
 * from GitHub Actions / EasyCron / etc.
 *
 * Fails CLOSED: if CRON_SECRET is not set, always returns false.
 * An absent secret must never be treated as "allow all" — these routes
 * trigger real football-data.org API calls and unauthenticated access
 * would allow rate-limit exhaustion attacks.
 */
export function isAuthorizedCronRequest(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Auth] CRON_SECRET is not set — cron endpoint denied.');
    return false;
  }
  return authHeader === `Bearer ${secret}`;
}

/**
 * Flexible auth check for externally-triggered endpoints.
 *
 * Accepts the CRON_SECRET via EITHER:
 *   1. Authorization: Bearer <secret>  header  — EasyCron, GitHub Actions, curl
 *   2. ?secret=<secret>                query param — UptimeRobot (free plan cannot
 *                                                    set custom headers; URL param
 *                                                    is the only option)
 *
 * The query-param path is intentional and not a security downgrade: the
 * transport is HTTPS so the secret is not exposed in plaintext, and the
 * endpoint only triggers read operations against football-data.org.
 *
 * Usage: replace isAuthorizedCronRequest on any route that external
 * schedulers need to call without header support.
 */
export function isAuthorizedExternalRequest(req: {
  headers: { get(name: string): string | null };
  url: string;
}): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Auth] CRON_SECRET is not set — external endpoint denied.');
    return false;
  }

  // 1. Header check (preferred)
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;

  // 2. Query param check (UptimeRobot free plan, simple curl)
  try {
    const url    = new URL(req.url);
    const qParam = url.searchParams.get('secret');
    if (qParam === secret) return true;
  } catch {
    // Malformed URL — deny
  }

  return false;
}
