/**
 * GET /api/debug/feed-integrity
 *
 * DATA-18G Phase 3 — KV feed cross-validation.
 *
 * Validates the raw FD KV feed entries for consistency anomalies:
 *   1. TIMED/SCHEDULED matches inside the FINISHED feed  (should never happen)
 *   2. FINISHED matches inside the UPCOMING feed          (stale — should have moved)
 *   3. Duplicate IDs across feeds
 *   4. Matches present in one feed but missing from authority cache
 *   5. Invalid state transitions (e.g. FINISHED → SCHEDULED in authority)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/feed-integrity?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import { readAuthorityCache }        from '@/lib/authority-cache';
import type { Match }                from '@/lib/types';
import type { CanonicalMatch }       from '@/lib/canonical-match';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// KV feed keys
// ---------------------------------------------------------------------------

const FINISHED_FEED_KEY  = 'goalradar:/competitions/WC/matches?status=FINISHED';
const UPCOMING_FEED_KEY  = 'goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED';

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

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
// Issue types
// ---------------------------------------------------------------------------

type IssueSeverity = 'RED' | 'YELLOW';

interface FeedIssue {
  check:     string;
  severity:  IssueSeverity;
  matchId?:  number;
  detail:    string;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kvEnabled =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  if (!kvEnabled) {
    return NextResponse.json({ error: 'KV not configured' }, { status: 503 });
  }

  const now     = Date.now();
  const builtAt = new Date(now).toISOString();
  const issues: FeedIssue[] = [];

  // ── 1. Read all three sources in parallel ─────────────────────────────────
  const [finishedResult, upcomingResult, authorityResult] = await Promise.allSettled([
    kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_FEED_KEY),
    kv.get<KVEntry<{ matches: Match[] }>>(UPCOMING_FEED_KEY),
    readAuthorityCache(builtAt, { source: '/api/debug/feed-integrity', sourceType: 'debug' }),
  ]);

  // Feed availability
  const finishedFeed = finishedResult.status === 'fulfilled' ? finishedResult.value : null;
  const upcomingFeed = upcomingResult.status === 'fulfilled' ? upcomingResult.value : null;
  const authority: CanonicalMatch[] = authorityResult.status === 'fulfilled' ? authorityResult.value : [];

  if (!finishedFeed) {
    issues.push({ check: 'feed-present', severity: 'RED', detail: 'FINISHED feed absent from KV — orchestrator cron may be down' });
  }
  if (!upcomingFeed) {
    issues.push({ check: 'feed-present', severity: 'YELLOW', detail: 'UPCOMING feed absent from KV' });
  }
  if (authorityResult.status === 'rejected') {
    issues.push({ check: 'authority-read', severity: 'RED', detail: `Authority cache read failed: ${authorityResult.reason}` });
  }

  const finishedMatches: Match[] = finishedFeed?.data?.matches ?? [];
  const upcomingMatches: Match[] = upcomingFeed?.data?.matches ?? [];

  // ── 2. Check 1: TIMED/SCHEDULED inside FINISHED feed ─────────────────────
  for (const m of finishedMatches) {
    if (m.status === 'SCHEDULED' || m.status === 'TIMED') {
      issues.push({
        check:    'timed-in-finished',
        severity: 'YELLOW',
        matchId:  m.id,
        detail:   `Match ${m.id} (${m.homeTeam?.name} vs ${m.awayTeam?.name}) has status=${m.status} in FINISHED feed`,
      });
    }
  }

  // ── 3. Check 2: FINISHED inside UPCOMING feed ─────────────────────────────
  for (const m of upcomingMatches) {
    if (m.status === 'FINISHED') {
      issues.push({
        check:    'finished-in-upcoming',
        severity: 'YELLOW',
        matchId:  m.id,
        detail:   `Match ${m.id} (${m.homeTeam?.name} vs ${m.awayTeam?.name}) is FINISHED but still in UPCOMING feed`,
      });
    }
  }

  // ── 4. Check 3: Duplicate IDs across finished + upcoming feeds ────────────
  const finishedIds = new Set(finishedMatches.map(m => m.id));
  const upcomingIds = new Set(upcomingMatches.map(m => m.id));
  for (const id of finishedIds) {
    if (upcomingIds.has(id)) {
      const m = finishedMatches.find(x => x.id === id);
      issues.push({
        check:    'duplicate-id',
        severity: 'YELLOW',
        matchId:  id,
        detail:   `Match ${id} (${m?.homeTeam?.name} vs ${m?.awayTeam?.name}) present in both FINISHED and UPCOMING feeds`,
      });
    }
  }

  // Duplicates within each feed
  const finishedIdArr = finishedMatches.map(m => m.id);
  const finishedDups  = finishedIdArr.filter((id, i) => finishedIdArr.indexOf(id) !== i);
  for (const id of [...new Set(finishedDups)]) {
    issues.push({ check: 'internal-duplicate', severity: 'RED', matchId: id, detail: `Match ${id} appears >1 time in FINISHED feed` });
  }

  const upcomingIdArr = upcomingMatches.map(m => m.id);
  const upcomingDups  = upcomingIdArr.filter((id, i) => upcomingIdArr.indexOf(id) !== i);
  for (const id of [...new Set(upcomingDups)]) {
    issues.push({ check: 'internal-duplicate', severity: 'RED', matchId: id, detail: `Match ${id} appears >1 time in UPCOMING feed` });
  }

  // ── 5. Check 4: Finished matches missing from authority ───────────────────
  const authorityById = new Map(authority.map(m => [m.id, m]));
  for (const m of finishedMatches.filter(x => x.status === 'FINISHED')) {
    if (!authorityById.has(m.id)) {
      issues.push({
        check:    'missing-from-authority',
        severity: 'YELLOW',
        matchId:  m.id,
        detail:   `Match ${m.id} (${m.homeTeam?.name} vs ${m.awayTeam?.name}) in FINISHED feed but absent from authority cache`,
      });
    }
  }

  // ── 6. Check 5: Invalid state transitions in authority ────────────────────
  // A FINISHED match in the feed should never be 'scheduled' in authority
  for (const m of finishedMatches.filter(x => x.status === 'FINISHED')) {
    const auth = authorityById.get(m.id);
    if (auth && auth.state === 'scheduled') {
      issues.push({
        check:    'invalid-state-transition',
        severity: 'RED',
        matchId:  m.id,
        detail:   `Match ${m.id} is FINISHED in FD feed but state=scheduled in authority cache — authority cache stale or corrupt`,
      });
    }
  }

  // ── 7. Feed age checks ────────────────────────────────────────────────────
  const finishedAgeHours = finishedFeed
    ? Math.round((now - finishedFeed.fetchedAt) / 3_600_000 * 10) / 10
    : null;
  const upcomingAgeHours = upcomingFeed
    ? Math.round((now - upcomingFeed.fetchedAt) / 3_600_000 * 10) / 10
    : null;

  if (finishedAgeHours !== null && finishedAgeHours > 1) {
    issues.push({
      check:    'feed-stale',
      severity: finishedAgeHours > 6 ? 'RED' : 'YELLOW',
      detail:   `FINISHED feed is ${finishedAgeHours}h old — orchestrator cron may be stalled`,
    });
  }
  if (upcomingAgeHours !== null && upcomingAgeHours > 1) {
    issues.push({
      check:    'feed-stale',
      severity: upcomingAgeHours > 6 ? 'RED' : 'YELLOW',
      detail:   `UPCOMING feed is ${upcomingAgeHours}h old`,
    });
  }

  // ── 8. Aggregate ─────────────────────────────────────────────────────────
  const redCount    = issues.filter(i => i.severity === 'RED').length;
  const yellowCount = issues.filter(i => i.severity === 'YELLOW').length;
  const verdict: 'GREEN' | 'YELLOW' | 'RED' =
    redCount > 0 ? 'RED' : yellowCount > 0 ? 'YELLOW' : 'GREEN';

  return NextResponse.json(
    {
      checkedAt:        builtAt,
      verdict,
      redCount,
      yellowCount,
      issueCount:       issues.length,
      feeds: {
        finished: {
          present:    !!finishedFeed,
          count:      finishedMatches.length,
          ageHours:   finishedAgeHours,
        },
        upcoming: {
          present:    !!upcomingFeed,
          count:      upcomingMatches.length,
          ageHours:   upcomingAgeHours,
        },
        authority: {
          present:    authority.length > 0,
          count:      authority.length,
        },
      },
      issues,
      note: verdict === 'GREEN'
        ? 'All feed integrity checks passed.'
        : `${redCount} RED + ${yellowCount} YELLOW issues detected.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
