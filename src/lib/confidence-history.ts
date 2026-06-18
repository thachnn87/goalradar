/**
 * confidence-history.ts — DATA-18U.2 Phase 2
 *
 * Confidence History Archive.
 *
 * Append-only log of every confidence calibration event, stored in a Redis
 * sorted set (score = epoch ms) with 90-day retention.
 *
 * Mirrors the repair-history.ts / health-archive.ts pattern exactly.
 * No destructive writes. Backward compatible.
 *
 * KV key: goalradar:confidence-history  (ZSET, score = epoch ms)
 */

import { kv }                        from '@vercel/kv';
import type { RemediationActionType } from './auto-remediation';
import type { CalibrationSource }     from './confidence-calibration';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CONFIDENCE_HISTORY_KEY  = 'goalradar:confidence-history';
export const CONFIDENCE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Record shape
// ---------------------------------------------------------------------------

export interface ConfidenceRecord {
  /** Epoch ms — used as ZSET score. */
  ts:                   number;
  /** ISO timestamp for human readability. */
  recordedAt:           string;

  action:               RemediationActionType;

  oldConfidence:        number;
  adjustment:           number;
  newConfidence:        number;

  reason:               string;

  evidenceCount:        number;
  verificationPassRate: number | null;
  productionCoverage:   number;          // 0–1 fraction of required coverage met

  calibrationSource:    CalibrationSource;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Append one calibration record to the confidence-history archive.
 * Prunes records older than CONFIDENCE_RETENTION_MS on each write.
 * The caller must not await in the hot path — fire-and-forget safe.
 */
export async function appendConfidenceRecord(
  rec: ConfidenceRecord,
): Promise<{ pruned: number }> {
  await kv.zadd(CONFIDENCE_HISTORY_KEY, {
    score:  rec.ts,
    member: JSON.stringify(rec),
  });

  const cutoff = rec.ts - CONFIDENCE_RETENTION_MS;
  const pruned = await kv.zremrangebyscore(CONFIDENCE_HISTORY_KEY, 0, cutoff);
  return { pruned: typeof pruned === 'number' ? pruned : 0 };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read confidence records within a time window.
 * Returns records sorted by ts ascending.
 */
export async function getConfidenceHistory(
  sinceMs: number,
  nowMs:   number,
): Promise<ConfidenceRecord[]> {
  const raw = await kv.zrange<(string | ConfidenceRecord)[]>(
    CONFIDENCE_HISTORY_KEY,
    sinceMs,
    nowMs,
    { byScore: true },
  );

  return raw
    .map(entry => {
      if (typeof entry === 'string') {
        try { return JSON.parse(entry) as ConfidenceRecord; } catch { return null; }
      }
      return entry as ConfidenceRecord;
    })
    .filter((r): r is ConfidenceRecord => r !== null && typeof r.ts === 'number');
}

/**
 * Read all confidence records for a specific action within a window.
 */
export async function getConfidenceHistoryForAction(
  action:  RemediationActionType,
  sinceMs: number,
  nowMs:   number,
): Promise<ConfidenceRecord[]> {
  const all = await getConfidenceHistory(sinceMs, nowMs);
  return all.filter(r => r.action === action);
}
