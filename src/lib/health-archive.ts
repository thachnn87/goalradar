/**
 * health-archive.ts — DATA-18H Phase 1
 *
 * Persistence layer for World Cup health snapshots.
 *
 * Every health-archive cron run captures a structured record of the four
 * monitoring subsystems and appends it to a Redis sorted set scored by epoch
 * milliseconds. Records older than 30 days are pruned on each write.
 *
 * KV key: goalradar:health:archive  (ZSET, score = epoch ms)
 *
 * This module is read/write plumbing only — it contains no monitoring logic
 * and never touches the authority cache, snapshots, or enrichment.
 */

import { kv } from '@vercel/kv';

export const HEALTH_ARCHIVE_KEY = 'goalradar:health:archive';

/** 30-day retention window in milliseconds. */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type Verdict = 'GREEN' | 'YELLOW' | 'RED';
export type SubsystemVerdict = Verdict | 'ERROR';

/**
 * One captured health snapshot. All fields are flat scalars so the record can
 * be reduced over time windows without re-fetching the source endpoints.
 */
export interface HealthArchiveRecord {
  ts:          number;   // epoch ms — also the ZSET score
  capturedAt:  string;   // ISO timestamp

  overall:     Verdict;  // aggregate verdict at capture time

  // worldcup-health aggregate
  worldcupHealth: SubsystemVerdict;

  // authority-drift
  drift: {
    verdict: SubsystemVerdict;
    total:   number;
    green:   number;
    yellow:  number;
    red:     number;
  };

  // feed-integrity
  feed: {
    verdict:     SubsystemVerdict;
    redCount:    number;
    yellowCount: number;
  };

  // authority-freshness
  freshness: {
    verdict: SubsystemVerdict;
    source:  string;   // 'primary' | 'dr' | 'absent'
    ageSec:  number | null;
    stale:   boolean;
  };

  // enrichment-health
  enrichment: {
    verdict:        SubsystemVerdict;
    totalFinished:  number | null;
    unenriched:     number | null;
    rate:           number | null;   // 0..1
  };
}

/**
 * Append a record to the archive and prune anything older than the retention
 * window. Returns the count of records pruned.
 */
export async function appendHealthRecord(rec: HealthArchiveRecord): Promise<{ pruned: number }> {
  await kv.zadd(HEALTH_ARCHIVE_KEY, { score: rec.ts, member: JSON.stringify(rec) });
  const cutoff = rec.ts - RETENTION_MS;
  const pruned = await kv.zremrangebyscore(HEALTH_ARCHIVE_KEY, 0, cutoff);
  return { pruned: pruned ?? 0 };
}

/**
 * Read all archive records whose timestamp falls within [sinceMs, nowMs].
 * Returns records sorted oldest → newest.
 */
export async function readHealthRecords(sinceMs: number, nowMs: number): Promise<HealthArchiveRecord[]> {
  const raw = await kv.zrange<(string | HealthArchiveRecord)[]>(
    HEALTH_ARCHIVE_KEY,
    sinceMs,
    nowMs,
    { byScore: true },
  );
  if (!raw || raw.length === 0) return [];

  const out: HealthArchiveRecord[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      try {
        out.push(JSON.parse(entry) as HealthArchiveRecord);
      } catch {
        // skip corrupt member
      }
    } else if (entry && typeof entry === 'object') {
      // @vercel/kv may auto-deserialize JSON members
      out.push(entry as HealthArchiveRecord);
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}
