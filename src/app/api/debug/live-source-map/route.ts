/**
 * GET /api/debug/live-source-map
 *
 * DATA-18B.3E LIVE-SOURCE-UNIFICATION manifest.
 *
 * Declares, for every WC page that can render a match as live, which source it
 * uses to make the LIVE decision after unification. The target state is that
 * every page derives liveness ONLY from the live SSOT
 * (getCurrentLiveMatches / getLiveMatchIdSet → KV goalradar:live:matches) and
 * never from authority `state === 'live'`, `classifyMatchState() === 'live'`,
 * or raw `status === 'IN_PLAY' | 'PAUSED'`.
 *
 * Also returns the current SSOT live-match id set so a validator can confirm
 * every page agrees with it.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development.
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/live-source-map?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentLiveMatches }     from '@/lib/wc-live-ssot';

export const dynamic     = 'force-dynamic';
export const maxDuration = 30;

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

interface PageLiveSource {
  page:          string;
  route:         string;
  /** Human description of how the page decides which matches are live. */
  liveSource:    string;
  /** Does the LIVE decision flow from the live SSOT? */
  usesSSOT:      boolean;
  /** Does the LIVE decision derive from authority state/status/classify? */
  usesAuthority: boolean;
  /** Does the LIVE decision require a snapshot? */
  usesSnapshot:  boolean;
  /** True when the page never renders a live badge at all (e.g. tomorrow). */
  rendersLive:   boolean;
}

// Post-DATA-18B.3E manifest. Authority is still used for the fixture LIST and
// finished/scheduled buckets — but never for the LIVE decision.
const PAGES: PageLiveSource[] = [
  {
    page: 'Hub', route: '/world-cup-2026',
    liveSource: 'getCurrentLiveMatches() → allLive grid; liveMatchIds gates effectiveBucket',
    usesSSOT: true, usesAuthority: false, usesSnapshot: false, rendersLive: true,
  },
  {
    page: 'Schedule', route: '/schedule?competition=WC',
    liveSource: 'getLiveMatchIdSet() normalises status before MatchCard; WCCountdown uses getCurrentLiveMatches()',
    usesSSOT: true, usesAuthority: false, usesSnapshot: false, rendersLive: true,
  },
  {
    page: 'Today', route: '/world-cup-2026/matches-today',
    liveSource: 'getLiveMatchIdSet() → liveMatches = filter(liveMatchIds.has(id)); resolveLive normalises m.state',
    usesSSOT: true, usesAuthority: false, usesSnapshot: false, rendersLive: true,
  },
  {
    page: 'Tomorrow', route: '/world-cup-2026/matches-tomorrow',
    liveSource: 'N/A — kickoff is tomorrow; never renders a live badge',
    usesSSOT: false, usesAuthority: false, usesSnapshot: false, rendersLive: false,
  },
  {
    page: 'Results', route: '/world-cup-2026/results',
    liveSource: 'getLiveMatchIdSet() resolves entry.state; live = filter(state==="live") after SSOT resolution',
    usesSSOT: true, usesAuthority: false, usesSnapshot: false, rendersLive: true,
  },
  {
    page: 'WC Results', route: '/world-cup-2026-results',
    liveSource: 'getLiveMatchIdSet() → live = filter(liveMatchIds.has(id)); status normalised for badges',
    usesSSOT: true, usesAuthority: false, usesSnapshot: false, rendersLive: true,
  },
  {
    page: 'Live', route: '/live',
    liveSource: 'getLiveMatches() (all competitions) — same KV goalradar:live:matches as the SSOT',
    usesSSOT: true, usesAuthority: false, usesSnapshot: false, rendersLive: true,
  },
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let liveMatchIds: number[] = [];
  let ssotError: string | null = null;
  try {
    const live = await getCurrentLiveMatches();
    liveMatchIds = live.map((m) => m.id);
  } catch (err) {
    ssotError = err instanceof Error ? err.message : String(err);
  }

  const livePages       = PAGES.filter((p) => p.rendersLive);
  const allUseSSOT      = livePages.every((p) => p.usesSSOT);
  const anyUsesAuthority = livePages.some((p) => p.usesAuthority);
  const anyUsesSnapshot  = livePages.some((p) => p.usesSnapshot);

  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      ssot: {
        provider: 'getCurrentLiveMatches() / getLiveMatchIdSet()',
        kvKey:    'goalradar:live:matches',
        currentLiveMatchIds: liveMatchIds,
        currentLiveCount:    liveMatchIds.length,
        error: ssotError,
      },
      pages: PAGES,
      verdict: allUseSSOT && !anyUsesAuthority && !anyUsesSnapshot
        ? 'LIVE_SOURCE_UNIFIED'
        : 'LIVE_SOURCE_NOT_UNIFIED',
      checks: {
        allLivePagesUseSSOT: allUseSSOT,
        anyPageUsesAuthorityForLive: anyUsesAuthority,
        anyPageRequiresSnapshotForLive: anyUsesSnapshot,
      },
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
