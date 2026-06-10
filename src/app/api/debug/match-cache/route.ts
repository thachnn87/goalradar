/**
 * GET /api/debug/match-cache
 *
 * PERF-4 Phase 8 — Match cache coverage dashboard.
 *
 * Reports:
 *   • totalSeeded      — match IDs in the prewarm manifest
 *   • snapshotCoverage — % of seeded IDs that have a live KV snapshot
 *   • detailCoverage   — % of seeded IDs that have a live KV detail entry
 *   • missingSnapshots — IDs missing from snapshot KV (sampled, max 20)
 *   • missingDetails   — IDs missing from detail KV (sampled, max 20)
 *   • sampleFreshPct   — % of snapshot sample that is still within freshUntil
 *   • hitRate          — from in-process kv-cache stats (current process)
 *   • tierBreakdown    — counts per tier from snapshot metadata
 *
 * Protected by ADMIN_SECRET (Bearer token).
 *
 * Usage:
 *   curl -s -H "Authorization: Bearer <ADMIN_SECRET>" \
 *        https://goalradar.org/api/debug/match-cache | jq
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                         from '@vercel/kv';
import { SEEDED_IDS_KEY }             from '@/lib/prewarm/worldcup';
import { getKVCacheStats }            from '@/lib/kv-cache';
import type { MatchSnapshot }         from '@/lib/match-snapshot';

export const dynamic = 'force-dynamic';

// ─── constants ────────────────────────────────────────────────────────────────

/** Max IDs to spot-check in a single request (avoids KV quota burn). */
const SAMPLE_SIZE = 20;

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

// ─── auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth   = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return bearer === secret;
}

// ─── KV entry wrapper (mirrors kv-cache.ts) ───────────────────────────────────

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

// ─── handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!KV_ENABLED) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now = Date.now();

  // ── 1. Read seeded ID manifest ─────────────────────────────────────────────
  let seededIds: number[] = [];
  try {
    const manifest = await kv.get<number[]>(SEEDED_IDS_KEY);
    seededIds = manifest ?? [];
  } catch (err) {
    return NextResponse.json({
      error: 'Failed to read prewarm manifest',
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }

  const totalSeeded = seededIds.length;

  if (totalSeeded === 0) {
    return NextResponse.json({
      totalSeeded: 0,
      snapshotCoverage: 0,
      detailCoverage: 0,
      sampleFreshPct: 0,
      missingSnapshots: [],
      missingDetails: [],
      hitRate: getKVCacheStats().hitRatio,
      note: 'Prewarm manifest is empty — run /api/cron/orchestrator first',
      generatedAt: new Date().toISOString(),
    });
  }

  // ── 2. Sample — pick evenly-spaced IDs ────────────────────────────────────
  const step     = Math.max(1, Math.floor(totalSeeded / SAMPLE_SIZE));
  const sampleIds: number[] = [];
  for (let i = 0; i < totalSeeded && sampleIds.length < SAMPLE_SIZE; i += step) {
    sampleIds.push(seededIds[i]);
  }

  // ── 3. Batch-read snapshot and detail KV keys ──────────────────────────────
  // `kv.mget` is more efficient than N individual reads.
  const snapshotKeys = sampleIds.map((id) => `goalradar:match:${id}`);
  const detailKeys   = sampleIds.map((id) => `goalradar:/matches/${id}`);

  let snapshotRaws: (MatchSnapshot | null)[]            = [];
  let detailRaws:   (KVEntry<unknown> | null)[]         = [];

  try {
    // Vercel KV client accepts spread for mget
    snapshotRaws = await kv.mget<(MatchSnapshot | null)[]>(...snapshotKeys);
  } catch {
    snapshotRaws = new Array(sampleIds.length).fill(null);
  }

  try {
    detailRaws = await kv.mget<(KVEntry<unknown> | null)[]>(...detailKeys);
  } catch {
    detailRaws = new Array(sampleIds.length).fill(null);
  }

  // ── 4. Analyse results ─────────────────────────────────────────────────────
  let snapshotHits  = 0;
  let detailHits    = 0;
  let freshCount    = 0;
  const missingSnapshots: number[] = [];
  const missingDetails:   number[] = [];

  // Tier breakdown from snapshot metadata
  const tierCounts: Record<string, number> = {
    live: 0, today: 0, 'next-3d': 0, future: 0, finished: 0,
  };

  for (let i = 0; i < sampleIds.length; i++) {
    const id   = sampleIds[i];
    const snap = snapshotRaws[i];
    const det  = detailRaws[i];

    if (snap) {
      snapshotHits++;
      const ageSec = Math.ceil((now - snap.generatedAt) / 1000);

      // Classify tier by status
      const status = snap.match?.status ?? '';
      if (status === 'IN_PLAY' || status === 'PAUSED') tierCounts.live++;
      else if (status === 'FINISHED')                  tierCounts.finished++;
      else {
        const msUntil = new Date(snap.match?.utcDate ?? 0).getTime() - now;
        if (msUntil <= 0)                              tierCounts.today++;        // past kickoff
        else if (msUntil <= 24 * 3_600_000)            tierCounts.today++;
        else if (msUntil <= 3 * 24 * 3_600_000)        tierCounts['next-3d']++;
        else                                           tierCounts.future++;
      }

      // Is snapshot still fresh (generatedAt < tier TTL ago)?
      const isFresh = ageSec < 7 * 24 * 3_600; // crude: at least within 7d
      if (isFresh) freshCount++;
    } else {
      missingSnapshots.push(id);
    }

    if (det) {
      detailHits++;
    } else {
      missingDetails.push(id);
    }
  }

  const sampleCount        = sampleIds.length;
  const snapshotCoverage   = Math.round((snapshotHits  / sampleCount) * 100);
  const detailCoverage     = Math.round((detailHits    / sampleCount) * 100);
  const sampleFreshPct     = Math.round((freshCount    / sampleCount) * 100);

  // ── 5. Process-level KV cache stats ───────────────────────────────────────
  const kvStats = getKVCacheStats();

  return NextResponse.json({
    totalSeeded,
    sampleSize:        sampleCount,
    snapshotCoverage:  `${snapshotCoverage}%`,
    detailCoverage:    `${detailCoverage}%`,
    sampleFreshPct:    `${sampleFreshPct}%`,
    missingSnapshots,
    missingDetails,
    tierBreakdown:     tierCounts,
    processHitRate:    `${kvStats.hitRatio}%`,
    processStats: {
      hits:          kvStats.hits,
      stale:         kvStats.stale,
      misses:        kvStats.misses,
      queueBypassed: kvStats.queueBypassed,
    },
    note: missingSnapshots.length > 0
      ? `${missingSnapshots.length} of ${sampleCount} sampled matches are missing snapshots — run prewarmWorldCup()`
      : `All ${sampleCount} sampled matches have KV snapshots`,
    generatedAt: new Date().toISOString(),
  });
}
