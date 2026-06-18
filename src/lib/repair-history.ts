/**
 * repair-history.ts — DATA-18P Phase 4
 *
 * Persistence layer for auto-remediation repair events.
 *
 * Mirrors the health-archive.ts pattern: Redis sorted set scored by epoch ms,
 * 90-day retention, read-only queries for telemetry.
 *
 * KV key: goalradar:repair:history  (ZSET, score = epoch ms)
 *
 * This module is additive — no changes to existing archive or snapshot logic.
 * Writes are fire-and-forget; read path is used by /api/debug/repair-telemetry.
 *
 * Feature-gated: only appendRepairRecord() should be called when
 * AUTONOMOUS_RELIABILITY_ENABLED=true. Reading is always allowed.
 */

import { kv } from '@vercel/kv';
import type { RemediationActionType } from './auto-remediation';

export const REPAIR_HISTORY_KEY = 'goalradar:repair:history';

/** 90-day retention window. */
export const REPAIR_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type RepairResult = 'success' | 'failure' | 'skipped' | 'dry-run';

export interface RepairRecord {
  ts:         number;          // epoch ms — ZSET score
  recordedAt: string;          // ISO timestamp

  matchId:    number | null;   // null for system-wide actions (RF-6, RF-5, RF-8)
  home:       string | null;
  away:       string | null;

  action:     RemediationActionType;
  reason:     string;
  result:     RepairResult;
  durationMs: number;

  /** Risk factor that triggered this repair. */
  triggeredBy: string;         // e.g. 'RF-1', 'RF-1+RF-5' for compound
  /** Whether AUTONOMOUS_RELIABILITY_ENABLED was true at execution time. */
  featureEnabled: boolean;
  /** Error message if result=failure. */
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Append a repair record to the history archive.
 * Prunes records older than REPAIR_RETENTION_MS on each write.
 * Fire-and-forget — caller should not await in the critical path.
 */
export async function appendRepairRecord(rec: RepairRecord): Promise<{ pruned: number }> {
  await kv.zadd(REPAIR_HISTORY_KEY, { score: rec.ts, member: JSON.stringify(rec) });
  const cutoff = rec.ts - REPAIR_RETENTION_MS;
  const pruned = await kv.zremrangebyscore(REPAIR_HISTORY_KEY, 0, cutoff);
  return { pruned: pruned ?? 0 };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read repair records within [sinceMs, nowMs], sorted oldest → newest.
 */
export async function readRepairRecords(sinceMs: number, nowMs: number): Promise<RepairRecord[]> {
  const raw = await kv.zrange<(string | RepairRecord)[]>(
    REPAIR_HISTORY_KEY,
    sinceMs,
    nowMs,
    { byScore: true },
  );
  if (!raw || raw.length === 0) return [];

  const out: RepairRecord[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      try { out.push(JSON.parse(entry) as RepairRecord); } catch { /* skip corrupt */ }
    } else if (entry && typeof entry === 'object') {
      out.push(entry as RepairRecord);
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

// ---------------------------------------------------------------------------
// Aggregate helpers
// ---------------------------------------------------------------------------

export interface RepairTelemetryStats {
  total:           number;
  success:         number;
  failure:         number;
  skipped:         number;
  dryRun:          number;
  successRatePct:  number;
  avgDurationMs:   number | null;
  /** Action type breakdown. */
  byAction:        Record<string, { total: number; success: number; successRatePct: number }>;
  /** Top 5 most-repaired matchIds. */
  topMatchIds:     Array<{ matchId: number | null; repairCount: number }>;
}

export function computeRepairTelemetry(records: RepairRecord[]): RepairTelemetryStats {
  const total   = records.length;
  const success = records.filter(r => r.result === 'success').length;
  const failure = records.filter(r => r.result === 'failure').length;
  const skipped = records.filter(r => r.result === 'skipped').length;
  const dryRun  = records.filter(r => r.result === 'dry-run').length;

  const nonDryRun = records.filter(r => r.result !== 'dry-run');
  const successRatePct = nonDryRun.length > 0
    ? Math.round((success / nonDryRun.length) * 1000) / 10
    : 100;

  const durRecords = records.filter(r => r.durationMs > 0);
  const avgDurationMs = durRecords.length > 0
    ? Math.round(durRecords.reduce((a, r) => a + r.durationMs, 0) / durRecords.length)
    : null;

  // By-action breakdown
  const actionMap: Record<string, { total: number; success: number }> = {};
  for (const r of records) {
    if (!actionMap[r.action]) actionMap[r.action] = { total: 0, success: 0 };
    actionMap[r.action].total++;
    if (r.result === 'success') actionMap[r.action].success++;
  }
  const byAction: RepairTelemetryStats['byAction'] = {};
  for (const [action, counts] of Object.entries(actionMap)) {
    byAction[action] = {
      total:          counts.total,
      success:        counts.success,
      successRatePct: counts.total > 0
        ? Math.round((counts.success / counts.total) * 1000) / 10
        : 100,
    };
  }

  // Top repaired matchIds
  const matchCount: Record<string, number> = {};
  for (const r of records) {
    const key = String(r.matchId ?? 'system');
    matchCount[key] = (matchCount[key] ?? 0) + 1;
  }
  const topMatchIds = Object.entries(matchCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({
      matchId:     id === 'system' ? null : Number(id),
      repairCount: count,
    }));

  return { total, success, failure, skipped, dryRun, successRatePct, avgDurationMs, byAction, topMatchIds };
}
