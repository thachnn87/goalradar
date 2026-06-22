/**
 * GET /api/debug/live-consistency
 *
 * WC-LIVE-SSOT-HARDENING — Validates that all WC live-state surfaces agree.
 *
 * Compares:
 *   1. SSOT (getCurrentLiveMatches / wc-live-ssot.ts) — canonical live count
 *   2. Authority cache live filter — what Hub page used to derive from
 *   3. Live page subset — getLiveMatches() WC-filtered (same KV key)
 *
 * Returns pass/fail + per-surface counts and match ID sets.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentLiveMatches }      from '@/lib/wc-live-ssot';
import { getWCAuthorityMatchesV2, getLiveMatches } from '@/lib/api';
import { classifyMatchState }         from '@/lib/match-classify';

export const dynamic     = 'force-dynamic';
export const maxDuration = 15;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const today     = checkedAt.split('T')[0];
  const builtAt   = checkedAt;

  // Fetch all three sources in parallel
  const [ssotResult, authorityResult, liveAllResult] = await Promise.allSettled([
    getCurrentLiveMatches(),
    getWCAuthorityMatchesV2(builtAt, { source: '/api/debug/live-consistency', sourceType: 'debug' }),
    getLiveMatches(),
  ]);

  // ── Source A: SSOT (live-cache KV, WC-filtered) ────────────────────────────
  const ssotMatches   = ssotResult.status === 'fulfilled' ? ssotResult.value : [];
  const ssotCount     = ssotMatches.length;
  const ssotIds       = ssotMatches.map(m => m.id).sort((a, b) => a - b);
  const ssotError     = ssotResult.status === 'rejected' ? String(ssotResult.reason) : null;

  // ── Source B: Authority-cache live filter ──────────────────────────────────
  const authorityMatches = authorityResult.status === 'fulfilled'
    ? authorityResult.value.matches.filter(m => classifyMatchState(m, today) === 'live')
    : [];
  const authorityCount   = authorityMatches.length;
  const authorityIds     = authorityMatches.map(m => m.id).sort((a, b) => a - b);
  const authorityError   = authorityResult.status === 'rejected' ? String(authorityResult.reason) : null;

  // ── Source C: getLiveMatches (all competitions) filtered to WC ─────────────
  const liveAllMatches   = liveAllResult.status === 'fulfilled' ? liveAllResult.value.matches : [];
  const liveWCMatches    = liveAllMatches.filter(m => m.competition?.code === 'WC');
  const livePageCount    = liveWCMatches.length;
  const livePageIds      = liveWCMatches.map(m => m.id).sort((a, b) => a - b);
  const livePageError    = liveAllResult.status === 'rejected' ? String(liveAllResult.reason) : null;

  // ── Consistency checks ─────────────────────────────────────────────────────
  const ssotVsAuthority   = ssotCount === authorityCount && JSON.stringify(ssotIds) === JSON.stringify(authorityIds);
  const ssotVsLivePage    = ssotCount === livePageCount  && JSON.stringify(ssotIds) === JSON.stringify(livePageIds);
  const pass = ssotVsAuthority && ssotVsLivePage && !ssotError && !authorityError && !livePageError;

  // IDs only in SSOT (not in authority)
  const ssotOnlyIds       = ssotIds.filter(id => !authorityIds.includes(id));
  // IDs only in authority (not in SSOT)
  const authorityOnlyIds  = authorityIds.filter(id => !ssotIds.includes(id));
  // IDs only in live page (not in SSOT)
  const livePageOnlyIds   = livePageIds.filter(id => !ssotIds.includes(id));

  return NextResponse.json(
    {
      checkedAt,
      verdict: pass ? 'CONSISTENT' : 'DIVERGED',
      pass,

      sources: {
        ssot: {
          name:       'getCurrentLiveMatches() — wc-live-ssot.ts',
          kvKey:      'goalradar:live:matches (WC-filtered)',
          count:      ssotCount,
          matchIds:   ssotIds,
          error:      ssotError,
        },
        authorityCache: {
          name:       'getWCAuthorityMatchesV2() filtered state=live',
          kvKey:      'goalradar:wc:authority:v1',
          count:      authorityCount,
          matchIds:   authorityIds,
          error:      authorityError,
        },
        livePage: {
          name:       'getLiveMatches() filtered competition=WC',
          kvKey:      'goalradar:live:matches (all, WC subset)',
          count:      livePageCount,
          matchIds:   livePageIds,
          error:      livePageError,
        },
      },

      consistency: {
        ssotVsAuthority:  { pass: ssotVsAuthority,  diff: { ssotOnly: ssotOnlyIds, authorityOnly: authorityOnlyIds } },
        ssotVsLivePage:   { pass: ssotVsLivePage,   diff: { ssotOnly: ssotIds.filter(id => !livePageIds.includes(id)), livePageOnly: livePageOnlyIds } },
      },
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
