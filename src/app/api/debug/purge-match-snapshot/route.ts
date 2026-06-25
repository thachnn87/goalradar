/**
 * GET /api/debug/purge-match-snapshot?id=<matchId>
 *
 * DATA-18WC.8E — targeted purge and rebuild for a specific match snapshot.
 *
 * Use case: match 537412 (Panama vs Croatia) has a poisoned DR snapshot
 * with status=FINISHED. This endpoint deletes both primary and DR keys,
 * then triggers a rebuild from the authority cache / FD provider, which
 * returns the correct status=CANCELLED.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/purge-match-snapshot?id=537412&secret=<CRON_SECRET>"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { getOrBuildMatchSnapshot }   from '@/lib/match-snapshot';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

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

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'id must be a numeric match ID' }, { status: 400 });
  }

  const primaryKey = `goalradar:match:${id}`;
  const drKey      = `goalradar:dr:match:${id}`;

  const [prePrimary, preDr] = await Promise.all([
    kv.get(primaryKey),
    kv.get(drKey),
  ]);

  await Promise.all([
    kv.del(primaryKey),
    kv.del(drKey),
  ]);

  const [afterPrimary, afterDr] = await Promise.all([
    kv.get(primaryKey),
    kv.get(drKey),
  ]);

  if (afterPrimary || afterDr) {
    return NextResponse.json({
      error:        'KV delete did not take effect',
      primaryStill: !!afterPrimary,
      drStill:      !!afterDr,
    }, { status: 500 });
  }

  const t0 = Date.now();
  let rebuilt: Awaited<ReturnType<typeof getOrBuildMatchSnapshot>>;
  try {
    rebuilt = await getOrBuildMatchSnapshot(id);
  } catch (err) {
    return NextResponse.json({
      matchId: id,
      deleted: { primary: !!prePrimary, dr: !!preDr },
      error:   err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }

  return NextResponse.json({
    matchId:    id,
    deletedAt:  new Date().toISOString(),
    deleted:    { primary: !!prePrimary, dr: !!preDr },
    rebuildMs:  Date.now() - t0,
    rebuilt: {
      status:    rebuilt.match.status,
      scoreHome: rebuilt.match.score?.fullTime?.home ?? null,
      scoreAway: rebuilt.match.score?.fullTime?.away ?? null,
      goals:     rebuilt.match.goals?.length ?? 0,
    },
  });
}
