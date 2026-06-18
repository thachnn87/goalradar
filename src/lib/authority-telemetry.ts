/**
 * DATA-18C.3: Authority Cache Telemetry — persistent read-path metrics.
 *
 * Collects per-day counters for every readAuthorityCache() call:
 *   primaryHits, drHits, coldRebuilds, totalReads, latency sums
 *
 * Design:
 *   - KV key per day: goalradar:authority:telemetry:daily:YYYY-MM-DD (Hash)
 *   - Retention: 30 days (TTL refreshed on every write)
 *   - Write strategy: fire-and-forget atomic HINCRBY — never blocks the caller
 *   - No write per full-record; aggregate counters only
 *
 * Called from authority-cache.ts readAuthorityCache() at each return point.
 * Does NOT modify any cache decision logic.
 *
 * Must pass: npx tsc --noEmit
 */

import { kv } from '@vercel/kv';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

const RETENTION_SEC = 30 * 24 * 3_600; // 30 days

/** Prefix for daily telemetry hash keys. */
export const TELEMETRY_KEY_PREFIX = 'goalradar:authority:telemetry:daily:';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthorityReadPath = 'primary' | 'dr' | 'cold';

export interface DailyMetrics {
  date:             string;
  primaryHits:      number;
  drHits:           number;
  coldRebuilds:     number;
  totalReads:       number;
  /** % of reads served from primary or DR (no cold rebuild required). */
  availability:     number;
  primaryHitRatio:  number;
  drHitRatio:       number;
  coldRebuildRatio: number;
  avgLatencyMs:     number | null;
  lastPrimaryHitAt:  string | null;
  lastDrHitAt:       string | null;
  lastColdRebuildAt: string | null;
}

export interface TelemetryReport {
  today:    DailyMetrics;
  last7d:   DailyMetrics;
  last30d:  DailyMetrics;
  /** Most recent daily records (newest first, up to 30 entries). */
  daily:    DailyMetrics[];
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

function dailyKey(isoDate: string): string {
  return `${TELEMETRY_KEY_PREFIX}${isoDate}`;
}

// ---------------------------------------------------------------------------
// Write — fire-and-forget
// ---------------------------------------------------------------------------

/**
 * Record one authority cache read result.
 *
 * NEVER throws. NEVER awaited by the caller.
 * Uses atomic HINCRBY so concurrent serverless instances don't race.
 *
 * @param path       Which fallback tier served this read.
 * @param latencyMs  Wall-clock ms from readAuthorityCache() entry to return.
 * @param timestamp  ISO-8601 timestamp of the read (passed in — no Date.now() here).
 */
export function recordAuthorityRead(
  path:       AuthorityReadPath,
  latencyMs:  number,
  timestamp:  string,
): void {
  if (!KV_ENABLED) return;

  const date = timestamp.split('T')[0];
  const key  = dailyKey(date);

  const hitField  = path === 'primary' ? 'primaryHits'
                  : path === 'dr'      ? 'drHits'
                  : 'coldRebuilds';

  const lastField = path === 'primary' ? 'lastPrimaryHitAt'
                  : path === 'dr'      ? 'lastDrHitAt'
                  : 'lastColdRebuildAt';

  // All writes fire-and-forget — caller must NOT await this function.
  Promise.all([
    kv.hincrby(key, hitField,         1),
    kv.hincrby(key, 'totalReads',     1),
    kv.hincrby(key, 'totalLatencyMs', Math.round(latencyMs)),
    kv.hincrby(key, 'latencyCount',   1),
    kv.hset(key, { [lastField]: timestamp }),
    kv.expire(key, RETENTION_SEC),
  ]).catch((err: unknown) =>
    console.error(
      '[AuthorityTelemetry] write error:',
      err instanceof Error ? err.message : String(err),
    ),
  );
}

// ---------------------------------------------------------------------------
// Read — aggregate
// ---------------------------------------------------------------------------

function parseDailyRecord(
  date: string,
  raw:  Record<string, string> | null,
): DailyMetrics {
  const empty: DailyMetrics = {
    date,
    primaryHits:      0,
    drHits:           0,
    coldRebuilds:     0,
    totalReads:       0,
    availability:     100,
    primaryHitRatio:  0,
    drHitRatio:       0,
    coldRebuildRatio: 0,
    avgLatencyMs:     null,
    lastPrimaryHitAt:  null,
    lastDrHitAt:       null,
    lastColdRebuildAt: null,
  };

  if (!raw) return empty;

  const n = (field: string) => parseInt(raw[field] ?? '0', 10) || 0;

  const primaryHits   = n('primaryHits');
  const drHits        = n('drHits');
  const coldRebuilds  = n('coldRebuilds');
  const totalReads    = n('totalReads');
  const totalLatency  = n('totalLatencyMs');
  const latencyCount  = n('latencyCount');

  const pct = (v: number) =>
    totalReads > 0 ? Math.round((v / totalReads) * 10_000) / 100 : 0;

  return {
    date,
    primaryHits,
    drHits,
    coldRebuilds,
    totalReads,
    availability:     totalReads > 0
      ? Math.round(((primaryHits + drHits) / totalReads) * 10_000) / 100
      : 100,
    primaryHitRatio:  pct(primaryHits),
    drHitRatio:       pct(drHits),
    coldRebuildRatio: pct(coldRebuilds),
    avgLatencyMs:     latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
    lastPrimaryHitAt:  raw['lastPrimaryHitAt']  ?? null,
    lastDrHitAt:       raw['lastDrHitAt']       ?? null,
    lastColdRebuildAt: raw['lastColdRebuildAt'] ?? null,
  };
}

function aggregate(days: DailyMetrics[], label: string): DailyMetrics {
  const totals = days.reduce(
    (acc, d) => ({
      primaryHits:   acc.primaryHits   + d.primaryHits,
      drHits:        acc.drHits        + d.drHits,
      coldRebuilds:  acc.coldRebuilds  + d.coldRebuilds,
      totalReads:    acc.totalReads    + d.totalReads,
      totalLatency:  acc.totalLatency  + (d.avgLatencyMs ?? 0) * (d.totalReads > 0 ? d.totalReads : 0),
      latencyCount:  acc.latencyCount  + (d.avgLatencyMs !== null ? d.totalReads : 0),
      lastPrimaryHitAt:  acc.lastPrimaryHitAt  ?? d.lastPrimaryHitAt,
      lastDrHitAt:       acc.lastDrHitAt       ?? d.lastDrHitAt,
      lastColdRebuildAt: acc.lastColdRebuildAt ?? d.lastColdRebuildAt,
    }),
    { primaryHits: 0, drHits: 0, coldRebuilds: 0, totalReads: 0, totalLatency: 0, latencyCount: 0, lastPrimaryHitAt: null as string | null, lastDrHitAt: null as string | null, lastColdRebuildAt: null as string | null },
  );

  const tr = totals.totalReads;
  const pct = (v: number) => tr > 0 ? Math.round((v / tr) * 10_000) / 100 : 0;

  return {
    date:             label,
    primaryHits:      totals.primaryHits,
    drHits:           totals.drHits,
    coldRebuilds:     totals.coldRebuilds,
    totalReads:       tr,
    availability:     tr > 0 ? Math.round(((totals.primaryHits + totals.drHits) / tr) * 10_000) / 100 : 100,
    primaryHitRatio:  pct(totals.primaryHits),
    drHitRatio:       pct(totals.drHits),
    coldRebuildRatio: pct(totals.coldRebuilds),
    avgLatencyMs:     totals.latencyCount > 0 ? Math.round(totals.totalLatency / totals.latencyCount) : null,
    lastPrimaryHitAt:  totals.lastPrimaryHitAt,
    lastDrHitAt:       totals.lastDrHitAt,
    lastColdRebuildAt: totals.lastColdRebuildAt,
  };
}

/**
 * Read and aggregate telemetry for the last N days.
 * Returns today, last7d, last30d aggregates plus per-day array (newest first).
 */
export async function getAuthorityTelemetry(): Promise<TelemetryReport> {
  const now = Date.now();

  // Build date strings: [today, yesterday, ..., 29 days ago]
  const dates: string[] = Array.from({ length: 30 }, (_, i) =>
    new Date(now - i * 86_400_000).toISOString().split('T')[0],
  );

  // Fetch all 30 daily hash keys in parallel
  const results = await Promise.allSettled(
    dates.map(d => kv.hgetall<Record<string, string>>(dailyKey(d))),
  );

  const daily: DailyMetrics[] = results.map((r, i) => {
    const raw = r.status === 'fulfilled' ? r.value : null;
    return parseDailyRecord(dates[i], raw);
  });

  return {
    today:   daily[0],
    last7d:  aggregate(daily.slice(0, 7),  'last7d'),
    last30d: aggregate(daily,              'last30d'),
    daily,
  };
}
