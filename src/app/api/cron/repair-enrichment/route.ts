/**
 * GET /api/cron/repair-enrichment
 *
 * DATA-16 Objective 4: daily repair job.
 *
 * Scans all finished WC 2026 matches. For each match where score > 0 and
 * goals.length === 0, invalidates the snapshot so the next page load triggers
 * a fresh enrichment attempt.
 *
 * Match list is read dynamically from the FINISHED feed KV key so this job
 * stays current as the tournament progresses without manual ID list updates.
 * (DATA-18D: migrated from hardcoded array — was missing 537397 and future matches)
 *
 * Schedule: run daily via an external cron scheduler or Vercel Cron.
 * Add to your cron configuration:
 *   Path: /api/cron/repair-enrichment
 *   Schedule: 0 4 * * *  (04:00 UTC daily — outside peak hours)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 *
 * NOTE: vercel.json is not modified per project constraint. Wire the cron
 *       schedule manually in Vercel dashboard or external scheduler.
 */

import { NextRequest, NextResponse }      from 'next/server';
import { kv }                             from '@vercel/kv';
import { espnEventKvKey }                 from '@/lib/espn-id-map';
import { invalidateMatchSnapshot }        from '@/lib/match-snapshot';
import type { MatchSnapshot }             from '@/lib/match-snapshot';
import type { Match }                     from '@/lib/types';

export const dynamic = 'force-dynamic';

const FINISHED_FEED_KEY = 'goalradar:/competitions/WC/matches?status=FINISHED';

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  // ── Read finished match IDs from dynamic KV feed ─────────────────────────
  const feedEntry = await kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY);
  if (!feedEntry) {
    return NextResponse.json({
      error:   'FINISHED feed not in KV — cannot determine which matches to repair',
      kvKey:   FINISHED_FEED_KEY,
      hint:    'Run the WC orchestrator cron to populate the feed',
    }, { status: 503 });
  }

  const finishedMatches = (feedEntry.data?.matches ?? []).filter((m) => m.status === 'FINISHED');
  const WC_FINISHED_IDS = finishedMatches.map((m) => m.id);

  // Identify degraded matches: score > 0 but goals.length === 0
  const snapshots = await Promise.allSettled(
    WC_FINISHED_IDS.map((id) => kv.get<MatchSnapshot>(`goalradar:match:${id}`)),
  );

  const degraded: number[] = [];
  const missing:  number[] = [];

  for (let i = 0; i < WC_FINISHED_IDS.length; i++) {
    const id  = WC_FINISHED_IDS[i];
    const res = snapshots[i];

    if (res.status === 'rejected' || !res.value) {
      missing.push(id);
      continue;
    }

    const match  = res.value.match;
    const ftH    = match.score?.fullTime?.home ?? 0;
    const ftA    = match.score?.fullTime?.away ?? 0;
    const goals  = match.goals?.length ?? 0;

    if (ftH + ftA > 0 && goals === 0) {
      degraded.push(id);
    }
  }

  const toRepair = [...degraded, ...missing];

  if (!toRepair.length) {
    return NextResponse.json({
      repairedAt: new Date().toISOString(),
      checked:    WC_FINISHED_IDS.length,
      repaired:   0,
      degraded:   0,
      missing:    0,
      message:    'All finished WC matches are enriched.',
    });
  }

  // Invalidate snapshot + event cache for each degraded match.
  // invalidateMatchSnapshot already clears both keys (DATA-14B).
  // Also clear the ESPN event cache directly as a belt-and-suspenders measure.
  const repairResults = await Promise.allSettled(
    toRepair.map(async (id) => {
      await invalidateMatchSnapshot(String(id));
      // belt-and-suspenders: event cache clear (no-op if already gone)
      await kv.del(espnEventKvKey(String(id)));
      return id;
    }),
  );

  const succeeded = repairResults
    .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
    .map((r) => r.value);

  const failed = repairResults
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((_, i) => toRepair[i]);

  console.log(
    `[RepairEnrichment] repaired=${succeeded.length} failed=${failed.length}` +
    ` degraded=${degraded.length} missing=${missing.length}`,
    { succeeded, failed },
  );

  return NextResponse.json({
    repairedAt:  new Date().toISOString(),
    checked:     WC_FINISHED_IDS.length,
    feedAgeHours: Math.round((Date.now() - feedEntry.fetchedAt) / 3_600_000 * 10) / 10,
    repaired:    succeeded.length,
    degraded:    degraded.length,
    missing:     missing.length,
    succeeded,
    failed,
    message:     `Invalidated ${succeeded.length} degraded match(es). Next page load will re-enrich.`,
  });
}
