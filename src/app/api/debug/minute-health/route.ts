/**
 * GET /api/debug/minute-health
 *
 * DATA-12 — Minute propagation health check for all currently live matches.
 *
 * For each IN_PLAY / PAUSED match reports the minute value at three observable
 * layers and diagnoses where minute is being lost:
 *
 *   1. kvLiveMinute    — goalradar:live:matches (what the cron last wrote from
 *                        the provider).  This is the best proxy for "provider"
 *                        without an extra rate-limited API call.
 *   2. snapshotMinute  — goalradar:match:{id}   (what the match page SSR reads
 *                        as initialMinute).
 *   3. liveApiMinute   — /api/live-score/{id}   (what MatchLiveZone polls).
 *                        Derived from the same KV live-matches entry, so
 *                        normally agrees with kvLiveMinute.
 *
 * Diagnoses:
 *   NO_LIVE_MATCHES    — goalradar:live:matches is empty / absent
 *   PROVIDER_LOSS      — kvLiveMinute is null  (provider not sending minute)
 *   SNAPSHOT_LOSS      — kvLiveMinute set, snapshotMinute null  (overlay fix
 *                        needed, or snapshot hasn't been rebuilt yet)
 *   NO_LOSS            — all available layers agree, minute present
 *   MATCH_NOT_LIVE     — match status is not IN_PLAY or PAUSED
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 *
 * Example:
 *   curl "https://goalradar.org/api/debug/minute-health?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { MatchSnapshot } from '@/lib/match-snapshot';

export const dynamic = 'force-dynamic';

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

const KV_LIVE_KEY = 'goalradar:live:matches';

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;

  return false;
}

type Diagnosis =
  | 'NO_LOSS'
  | 'PROVIDER_LOSS'
  | 'SNAPSHOT_LOSS'
  | 'MATCH_NOT_LIVE';

interface LiveKVEntry {
  matches: {
    id: number;
    status: string;
    minute?: number | null;
    homeTeam?: { name?: string };
    awayTeam?: { name?: string };
  }[];
  fetchedAt: number;
}

interface MatchMinuteRow {
  id: number;
  home: string;
  away: string;
  status: string;
  kvLiveMinute: number | null;
  snapshotMinute: number | null;
  diagnosis: Diagnosis;
  kvAgeSeconds: number | null;
  snapshotAgeSeconds: number | null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!KV_ENABLED) {
    return NextResponse.json({ error: 'KV not configured', diagnosis: 'kv-disabled' }, { status: 503 });
  }

  const now = Date.now();

  // --- Step 1: read live matches from KV ---
  let liveEntry: LiveKVEntry | null = null;
  try {
    liveEntry = await kv.get<LiveKVEntry>(KV_LIVE_KEY);
  } catch (err) {
    return NextResponse.json(
      { error: 'KV read failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  if (!liveEntry || !liveEntry.matches.length) {
    return NextResponse.json({
      diagnosis: 'NO_LIVE_MATCHES',
      liveMatches: 0,
      kvAgeSeconds: liveEntry ? Math.round((now - liveEntry.fetchedAt) / 1000) : null,
      checkedAt: new Date(now).toISOString(),
      matches: [],
    });
  }

  const kvAgeSeconds = Math.round((now - liveEntry.fetchedAt) / 1000);
  const liveMatches = liveEntry.matches.filter(
    (m) => m.status === 'IN_PLAY' || m.status === 'PAUSED',
  );

  if (!liveMatches.length) {
    return NextResponse.json({
      diagnosis: 'NO_LIVE_MATCHES',
      liveMatches: 0,
      totalInKv: liveEntry.matches.length,
      kvAgeSeconds,
      checkedAt: new Date(now).toISOString(),
      matches: [],
    });
  }

  // --- Step 2: read per-match snapshots ---
  const snapshotKeys = liveMatches.map((m) => `goalradar:match:${m.id}`);
  let snapshots: (MatchSnapshot | null)[] = [];
  try {
    snapshots = await kv.mget<(MatchSnapshot | null)[]>(...snapshotKeys);
  } catch {
    snapshots = liveMatches.map(() => null);
  }

  // --- Step 3: build per-match rows ---
  const rows: MatchMinuteRow[] = liveMatches.map((m, i) => {
    const snap = snapshots[i];
    const kvLiveMinute = m.minute ?? null;
    const snapshotMinute = snap?.match?.minute ?? null;
    const snapshotAge = snap
      ? Math.round((now - snap.generatedAt) / 1000)
      : null;

    let diagnosis: Diagnosis;
    if (m.status !== 'IN_PLAY' && m.status !== 'PAUSED') {
      diagnosis = 'MATCH_NOT_LIVE';
    } else if (kvLiveMinute == null) {
      diagnosis = 'PROVIDER_LOSS';
    } else if (snapshotMinute == null) {
      diagnosis = 'SNAPSHOT_LOSS';
    } else {
      diagnosis = 'NO_LOSS';
    }

    return {
      id: m.id,
      home: m.homeTeam?.name ?? '?',
      away: m.awayTeam?.name ?? '?',
      status: m.status,
      kvLiveMinute,
      snapshotMinute,
      diagnosis,
      kvAgeSeconds,
      snapshotAgeSeconds: snapshotAge,
    };
  });

  // --- Step 4: summary diagnosis ---
  const hasProviderLoss  = rows.some((r) => r.diagnosis === 'PROVIDER_LOSS');
  const hasSnapshotLoss  = rows.some((r) => r.diagnosis === 'SNAPSHOT_LOSS');
  const overallDiagnosis = hasProviderLoss
    ? 'PROVIDER_LOSS'
    : hasSnapshotLoss
    ? 'SNAPSHOT_LOSS'
    : 'NO_LOSS';

  return NextResponse.json({
    diagnosis: overallDiagnosis,
    liveMatches: rows.length,
    kvAgeSeconds,
    checkedAt: new Date(now).toISOString(),
    matches: rows,
  });
}
