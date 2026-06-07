/**
 * api-audit.ts
 *
 * Sprint API-1 — lightweight per-process audit logger for football-data.org API calls.
 *
 * How it works
 * ────────────
 * Every call to withCache() and every actual HTTP request in fetchFromAPI() records
 * a CallRecord into a rolling in-memory buffer (MAX_ENTRIES, ~500).  Because Vercel
 * serverless functions handle exactly ONE request per invocation, "recent calls" in
 * the buffer equate to "calls made during this render" — giving effective per-request
 * isolation without needing AsyncLocalStorage.
 *
 * On a long-running Node.js server the RENDER_WINDOW_MS (3 s) window groups concurrent
 * page renders separately; each Next.js ISR revalidation runs within its own async
 * tick and completes well within that window.
 *
 * Key outputs
 * ───────────
 *   • [API-AUDIT] HIT / MISS / NETWORK / DEDUP  — one line per call
 *   • [API-AUDIT] ⚠️  DUPLICATE — same endpoint called > 1x in window (any source)
 *   • [API-AUDIT] ⚠️  WASTED NETWORK — same endpoint fetched from network > 1x
 *   • [API-AUDIT] ⚠️  N+1 — same base pattern with ≥ 3 different IDs
 *   • GET /api/debug/api-audit — JSON report for the last 60 s
 *
 * Enable verbose per-call logging:  API_AUDIT=true  (server env var)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CallSource = 'hit' | 'miss' | 'network' | 'dedup' | 'stale';

export interface CallRecord {
  id:         number;      // monotonic, unique per process
  ts:         number;      // Date.now()
  endpoint:   string;      // e.g. /matches/537327
  source:     CallSource;
  durationMs: number;      // 0 for cache hits
}

export interface EndpointSummary {
  endpoint:    string;
  calls:       number;
  hits:        number;
  misses:      number;
  networkHits: number;
  avgMs:       number;
  isDuplicate: boolean;    // called > 1x in the window
}

export interface AuditReport {
  generatedAt:      string;
  windowMs:         number;
  totalCalls:       number;
  networkCalls:     number;   // actual HTTP fetches
  cacheHits:        number;
  uniqueEndpoints:  number;
  hitRatioPct:      number;
  duplicates:       EndpointSummary[];
  nPlusOnePatterns: string[];
  endpoints:        EndpointSummary[];
  recentCalls:      CallRecord[];
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Group calls within this window as "same render" */
const RENDER_WINDOW_MS = 3_000;
const MAX_ENTRIES      = 500;

let _counter = 0;
const _log: CallRecord[] = [];

const AUDIT_VERBOSE = process.env.API_AUDIT === 'true';

// ---------------------------------------------------------------------------
// Core recording function
// ---------------------------------------------------------------------------

/**
 * Record one cache/API call.  Called from withCache() (hits, misses, dedup)
 * and from fetchFromAPI() (network calls).
 *
 * Side-effects:
 *   • Appends to rolling log
 *   • Console-warns on duplicates and wasted network calls
 */
export function recordAuditCall(
  record: Omit<CallRecord, 'id' | 'ts'>,
): CallRecord {
  const entry: CallRecord = { id: ++_counter, ts: Date.now(), ...record };

  _log.push(entry);
  if (_log.length > MAX_ENTRIES) _log.shift();

  // Verbose per-call line
  if (AUDIT_VERBOSE) {
    const src = entry.source.toUpperCase().padEnd(7);
    console.log(
      `[API-AUDIT] ${src} ${entry.endpoint} | ${entry.durationMs}ms`,
    );
  }

  // Duplicate detection within the render window
  const windowStart  = entry.ts - RENDER_WINDOW_MS;
  const windowSiblings = _log.filter(
    (c) => c.ts >= windowStart && c.endpoint === entry.endpoint && c.id !== entry.id,
  );

  if (windowSiblings.length >= 1) {
    const allForEndpoint  = [...windowSiblings, entry];
    const networkCount    = allForEndpoint.filter((c) => c.source === 'network').length;
    const missCount       = allForEndpoint.filter((c) => c.source === 'miss').length;
    const hitCount        = allForEndpoint.filter((c) => c.source === 'hit' || c.source === 'dedup').length;

    // Normal sequence: exactly 1 miss + 1 network = same logical call flowing
    // through withCache → fetchFromAPI.  This is expected — NOT a duplicate.
    // Suppress the warning for this case.
    const isNormalCacheMissFlow =
      networkCount === 1 &&
      missCount    === 1 &&
      hitCount     === 0 &&
      allForEndpoint.length === 2;

    if (!isNormalCacheMissFlow) {
      console.warn(
        `[API-AUDIT] ⚠️  DUPLICATE "${entry.endpoint}" — ` +
        `called ${allForEndpoint.length}x in last ${RENDER_WINDOW_MS}ms ` +
        `(sources: ${allForEndpoint.map((c) => c.source).join(', ')})`,
      );

      // Escalate: multiple actual network fetches for the same endpoint
      if (entry.source === 'network' && networkCount >= 2) {
        console.error(
          `[API-AUDIT] 🔴 WASTED NETWORK CALL "${entry.endpoint}" — ` +
          `fetched from network ${networkCount}x this render. This costs API quota!`,
        );
      }
    }
  }

  return entry;
}

// ---------------------------------------------------------------------------
// N+1 detection
// ---------------------------------------------------------------------------

/**
 * Normalise an endpoint by replacing numeric ID segments with {id}.
 * /matches/537327 → /matches/{id}
 * /teams/73/matches → /teams/{id}/matches
 */
export function normaliseEndpoint(ep: string): string {
  return ep.replace(/\/\d{2,}/g, '/{id}');
}

function detectNPlusOne(calls: CallRecord[]): string[] {
  const patterns: string[] = [];

  // Group endpoints by their normalised base pattern
  const grouped = new Map<string, Set<string>>();
  for (const c of calls) {
    const base = normaliseEndpoint(c.endpoint);
    if (!grouped.has(base)) grouped.set(base, new Set());
    grouped.get(base)!.add(c.endpoint);
  }

  for (const [base, uniqueEndpoints] of grouped) {
    if (uniqueEndpoints.size >= 3 && base.includes('{id}')) {
      const count = uniqueEndpoints.size;
      const sample = [...uniqueEndpoints].slice(0, 3).join(', ');
      patterns.push(
        `N+1 likely: "${base}" called with ${count} unique IDs ` +
        `(e.g. ${sample}${count > 3 ? ', …' : ''})`,
      );
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Return all calls from the last `windowMs` milliseconds. */
export function getRecentCalls(windowMs = 60_000): CallRecord[] {
  const cutoff = Date.now() - windowMs;
  return _log.filter((c) => c.ts >= cutoff);
}

/** Return the full rolling log (up to MAX_ENTRIES). */
export function getAllCalls(): readonly CallRecord[] {
  return _log;
}

/**
 * Generate a structured audit report for the last `windowMs` milliseconds.
 *
 * Intended for the /api/debug/api-audit endpoint and for per-render
 * console summaries.
 */
export function generateReport(windowMs = 60_000): AuditReport {
  const recent = getRecentCalls(windowMs);

  // Build per-endpoint summaries
  const byEndpoint = new Map<string, CallRecord[]>();
  for (const c of recent) {
    if (!byEndpoint.has(c.endpoint)) byEndpoint.set(c.endpoint, []);
    byEndpoint.get(c.endpoint)!.push(c);
  }

  const endpoints: EndpointSummary[] = [...byEndpoint.entries()].map(([ep, calls]) => {
    const networkHits = calls.filter((c) => c.source === 'network').length;
    const hits        = calls.filter((c) => c.source === 'hit' || c.source === 'dedup').length;
    const misses      = calls.filter((c) => c.source === 'miss' || c.source === 'stale').length;
    const totalMs     = calls.reduce((s, c) => s + c.durationMs, 0);

    // A "true duplicate" is when the logical API data was fetched more than once:
    //   • multiple network calls (wasted quota)
    //   • a cache HIT alongside a network call (shouldn't have bypassed cache)
    //   • multiple cache hits (redundant component data fetching)
    //
    // The normal miss + 1 network pair is NOT a duplicate (it's one logical call).
    const isNormalMissNetworkPair = networkHits === 1 && misses === 1 && hits === 0;
    const isDuplicate = calls.length > 1 && !isNormalMissNetworkPair;

    return {
      endpoint:    ep,
      calls:       calls.length,
      hits,
      misses,
      networkHits,
      avgMs:       calls.length > 0 ? Math.round(totalMs / calls.length) : 0,
      isDuplicate,
    };
  });

  // Sort by most-called first
  endpoints.sort((a, b) => b.calls - a.calls);

  const networkCalls = recent.filter((c) => c.source === 'network').length;
  const cacheHits    = recent.filter((c) => c.source === 'hit' || c.source === 'dedup').length;

  return {
    generatedAt:      new Date().toISOString(),
    windowMs,
    totalCalls:       recent.length,
    networkCalls,
    cacheHits,
    uniqueEndpoints:  byEndpoint.size,
    hitRatioPct:      recent.length > 0 ? Math.round((cacheHits / recent.length) * 100) : 0,
    duplicates:       endpoints.filter((e) => e.isDuplicate),
    nPlusOnePatterns: detectNPlusOne(recent),
    endpoints,
    recentCalls:      recent,
  };
}

/**
 * Print a compact human-readable summary to stdout.
 * Call this at the END of a page render (after all awaits).
 */
export function printRenderSummary(page: string, renderMs: number): void {
  const recent  = getRecentCalls(RENDER_WINDOW_MS);
  const network = recent.filter((c) => c.source === 'network').length;
  const hits    = recent.filter((c) => c.source === 'hit').length;
  const total   = recent.length;
  const ratio   = total > 0 ? Math.round((hits / total) * 100) : 0;
  const dupes   = recent
    .map((c) => c.endpoint)
    .filter((ep, i, arr) => arr.indexOf(ep) !== i);

  const nPlus1 = detectNPlusOne(recent);

  console.log(
    `[API-AUDIT] ─── ${page} | render ${renderMs}ms | ` +
    `${total} calls (${network} network, ${hits} hit) | hit ratio ${ratio}%` +
    (dupes.length ? ` | ⚠️  ${dupes.length} duplicate(s)` : '') +
    (nPlus1.length ? ` | 🔴 N+1 detected` : ''),
  );

  if (nPlus1.length) {
    for (const p of nPlus1) console.warn(`[API-AUDIT]   ${p}`);
  }
}
