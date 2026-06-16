/**
 * POST /api/revalidate/match/[id]
 *
 * Invalidates the KV snapshot for a single match, forcing the next page
 * request to rebuild it via buildSnapshot() (which includes AF enrichment
 * if ENABLE_AF_ENRICHMENT=true).
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development.
 *
 * Example:
 *   curl -X POST "https://goalradar.org/api/revalidate/match/537358?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse }    from 'next/server';
import { revalidatePath }               from 'next/cache';
import { invalidateMatchSnapshot }      from '@/lib/match-snapshot';

export const dynamic = 'force-dynamic';

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

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: `Invalid match id: ${id}` }, { status: 400 });
  }

  await invalidateMatchSnapshot(id);
  revalidatePath(`/match/${id}`, 'page');

  return NextResponse.json({
    ok:          true,
    matchId:     id,
    invalidated: [`goalradar:match:${id}`, `/match/${id}`],
    timestamp:   new Date().toISOString(),
  });
}
