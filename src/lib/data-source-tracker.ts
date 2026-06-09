/**
 * data-source-tracker.ts
 *
 * Per-process counters for each data-source tier.  Incremented by the cache
 * layers and provider manager; read by /api/debug/data-sources.
 *
 * Resets on cold start / process restart — the values are a running total for
 * the lifetime of this Node.js process, useful for measuring KV hit-rate in
 * production.
 *
 * Sources:
 *   kv            — Vercel KV (L2 SWR cache), either FRESH or STALE hit.
 *   snapshot      — match-snapshot KV composite (goalradar:match:{id}).
 *   football-data — football-data.org provider (L3, primary).
 *   api-football  — api-football provider (L3, secondary / failover).
 *   static        — bundled static WC fixtures dataset (last-resort fallback
 *                   when provider + KV + DR are all unavailable).
 */

export type DataSource = 'kv' | 'snapshot' | 'football-data' | 'api-football' | 'static';

// ---------------------------------------------------------------------------
// In-process counters (module-level singletons)
// ---------------------------------------------------------------------------

let _kvHits           = 0;
let _snapshotHits     = 0;
let _footballDataHits = 0;
let _apiFootballHits  = 0;
let _staticHits       = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Increment the counter for the given data source and emit a structured log
 * line so server logs can be searched / grepped per source:
 *
 *   [DATA_SOURCE] kv
 *   [DATA_SOURCE] snapshot
 *   [DATA_SOURCE] football-data
 *   [DATA_SOURCE] api-football
 *   [DATA_SOURCE] static
 */
export function recordDataSource(source: DataSource): void {
  switch (source) {
    case 'kv':            _kvHits++;           break;
    case 'snapshot':      _snapshotHits++;     break;
    case 'football-data': _footballDataHits++; break;
    case 'api-football':  _apiFootballHits++;  break;
    case 'static':        _staticHits++;       break;
  }
  console.log(`[DATA_SOURCE] ${source}`);
}

/**
 * Returns a snapshot of the current per-process counters.
 * Exposed by /api/debug/data-sources.
 */
export function getDataSourceStats() {
  const kvTotal       = _kvHits + _snapshotHits;
  const providerTotal = _footballDataHits + _apiFootballHits;
  const total         = kvTotal + providerTotal + _staticHits;
  const kvRatio       = total > 0 ? Math.round((kvTotal / total) * 100) : 0;

  return {
    kvHits:           _kvHits,
    snapshotHits:     _snapshotHits,
    footballDataHits: _footballDataHits,
    apiFootballHits:  _apiFootballHits,
    staticHits:       _staticHits,
    // Derived
    kvTotal,
    providerTotal,
    total,
    /** Percentage of requests served from KV or Snapshot (goal: >90%). */
    kvHitRatioPercent: kvRatio,
    goalMet:           kvRatio >= 90,
  };
}

/** Exposed for testing — resets all counters. */
export function _resetDataSourceStats(): void {
  _kvHits           = 0;
  _snapshotHits     = 0;
  _footballDataHits = 0;
  _apiFootballHits  = 0;
  _staticHits       = 0;
}
