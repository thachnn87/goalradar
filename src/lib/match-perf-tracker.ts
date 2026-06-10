/**
 * match-perf-tracker.ts
 *
 * Per-process performance counters for /match/[id] pages.
 * Incremented by the page component; read by /api/debug/performance.
 *
 * Tracks the data-source tier that served the match detail for the score-hero
 * fast path:
 *   l1           — L1 in-memory cache (sub-millisecond)
 *   kv           — L2 Vercel KV (FRESH or STALE, ~10 ms)
 *   football-data — L3 primary provider (network + rate-limiter wait)
 *   api-football  — L3 secondary provider (failover path)
 *
 * Resets on cold start / process restart.
 */

export type MatchRenderSource  = 'l1' | 'kv' | 'football-data' | 'api-football';
export type SnapshotFetchSource = 'kv' | 'build-kv' | 'build-provider' | 'dr';

// ---------------------------------------------------------------------------
// In-process counters
// ---------------------------------------------------------------------------

let _renders     = 0;
let _totalMs     = 0;
let _l1Hits      = 0;
let _kvHits      = 0;
let _fdHits      = 0; // football-data.org
let _afHits      = 0; // api-football
let _retryCount  = 0; // 429 retries (incremented by football-data provider)

const _recentLatencies: number[] = [];
const MAX_RECENT = 100;

// ---------------------------------------------------------------------------
// Snapshot-level latency counters (accurate: recorded inside getOrBuildMatchSnapshot)
// ---------------------------------------------------------------------------

let _snapTotal          = 0;
let _snapKvHits         = 0;
let _snapBuildKv        = 0;
let _snapBuildProvider  = 0;
let _snapDrHits         = 0;

const _snapLatencies: number[] = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function recordMatchRender(source: MatchRenderSource, latencyMs: number): void {
  _renders++;
  _totalMs += latencyMs;

  switch (source) {
    case 'l1':            _l1Hits++; break;
    case 'kv':            _kvHits++; break;
    case 'football-data': _fdHits++; break;
    case 'api-football':  _afHits++; break;
  }

  _recentLatencies.push(latencyMs);
  if (_recentLatencies.length > MAX_RECENT) _recentLatencies.shift();
}

/** Called by football-data.ts on each 429 → Retry-After wait. */
export function recordRetry(): void {
  _retryCount++;
}

/**
 * Record a snapshot fetch inside getOrBuildMatchSnapshot.
 * This is the accurate latency measurement — called on the first (real) invocation
 * of the React.cache()-wrapped function, not the deduplicated second call from the
 * page component.
 */
export function recordSnapshotFetch(latencyMs: number, source: SnapshotFetchSource): void {
  _snapTotal++;
  _snapLatencies.push(latencyMs);
  if (_snapLatencies.length > MAX_RECENT) _snapLatencies.shift();
  switch (source) {
    case 'kv':             _snapKvHits++;        break;
    case 'build-kv':       _snapBuildKv++;       break;
    case 'build-provider': _snapBuildProvider++; break;
    case 'dr':             _snapDrHits++;        break;
  }
}

export function getSnapshotPerfStats() {
  const sorted = [..._snapLatencies].sort((a, b) => a - b);
  const n = sorted.length;
  const p = (pct: number) =>
    n > 0 ? (sorted[Math.floor(n * pct)] ?? sorted[n - 1]) : 0;
  return {
    total:           _snapTotal,
    kvHits:          _snapKvHits,
    buildKvHits:     _snapBuildKv,
    buildProvHits:   _snapBuildProvider,
    drHits:          _snapDrHits,
    kvHitRate:       _snapTotal > 0 ? Math.round((_snapKvHits / _snapTotal) * 100) : 0,
    p50:             p(0.50),
    p95:             p(0.95),
    p99:             p(0.99),
    recentLatencies: _snapLatencies.slice(-20),
  };
}

export function getMatchPerfStats() {
  const avgLatency  = _renders > 0 ? Math.round(_totalMs / _renders) : 0;
  const cacheHits   = _l1Hits + _kvHits;
  const cacheRate   = _renders > 0 ? Math.round((cacheHits / _renders) * 100) : 0;

  const sorted = [..._recentLatencies].sort((a, b) => a - b);
  const pct = (p: number) =>
    sorted.length > 0 ? (sorted[Math.floor(sorted.length * p)] ?? sorted[sorted.length - 1]) : 0;

  return {
    renders:           _renders,
    avgMatchLatency:   avgLatency,
    p50MatchLatency:   pct(0.50),
    p95MatchLatency:   pct(0.95),
    p99MatchLatency:   pct(0.99),
    // per-source breakdown
    l1Hits:            _l1Hits,
    kvHits:            _kvHits,
    footballDataHits:  _fdHits,
    apiFootballHits:   _afHits,
    // rates
    cacheHitRate:      cacheRate,
    providerHitRate:   _renders > 0 ? Math.round(((_fdHits + _afHits) / _renders) * 100) : 0,
    goalMet:           cacheRate >= 90,
    // retries
    retryCount:        _retryCount,
    // recent latencies (last 20)
    recentLatencies:   _recentLatencies.slice(-20),
  };
}

/** Exposed for testing — resets all counters. */
export function _resetMatchPerfStats(): void {
  _renders    = 0;
  _totalMs    = 0;
  _l1Hits     = 0;
  _kvHits     = 0;
  _fdHits     = 0;
  _afHits     = 0;
  _retryCount = 0;
  _recentLatencies.length  = 0;
  _snapTotal         = 0;
  _snapKvHits        = 0;
  _snapBuildKv       = 0;
  _snapBuildProvider = 0;
  _snapDrHits        = 0;
  _snapLatencies.length    = 0;
}
