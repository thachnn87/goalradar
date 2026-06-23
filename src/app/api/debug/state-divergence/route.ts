/**
 * GET /api/debug/state-divergence
 *
 * DATA-18B.3D — three-source state divergence audit.
 *
 * For EVERY WC match, compares the display state across the three stores that
 * can independently decide whether a match is live / finished / scheduled:
 *
 *   A. Authority cache   goalradar:wc:authority:v1   CanonicalMatch.state
 *   B. Snapshot KV       goalradar:match:{id}        snapshot.match.status → bucket
 *   C. Live cache        goalradar:live:matches      presence + status → live/not-live
 *
 * Emits a per-match matrix plus a divergence list flagging the patterns that
 * produce user-visible "this page says LIVE, that page says FT" bugs:
 *
 *   authority=live      snapshot=finished     (RED — page shows LIVE after FT)
 *   authority=finished  snapshot=live         (RED — page shows FT mid-match)
 *   authority=scheduled snapshot=live         (RED — page shows kickoff while live)
 *   authority=live      live-cache=not-live    (live-source split — SSOT risk)
 *   live-cache=live     authority!=live        (live-source split — SSOT risk)
 *
 * Each divergence carries the updatedAt of every source + age deltas so the
 * staler source can be identified (Phase 3).
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development.
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/state-divergence?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse }         from 'next/server';
import { kv }                                from '@vercel/kv';
import { AUTHORITY_KEY, AUTHORITY_DR_KEY }   from '@/lib/authority-cache';
import type { AuthorityCacheEnvelope }       from '@/lib/authority-cache';
import type { CanonicalMatch }               from '@/lib/canonical-match';
import type { MatchSnapshot }                from '@/lib/match-snapshot';
import type { Match }                        from '@/lib/types';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

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
// Types
// ---------------------------------------------------------------------------

type StateBucket = 'live' | 'finished' | 'scheduled' | 'cancelled' | 'missing';

interface LiveCacheKVEntry {
  matches:   Match[];
  fetchedAt: number;
}

interface MatchRow {
  matchId:   number;
  home:      string;
  away:      string;
  utcDate:   string;

  authorityState:  StateBucket;
  snapshotState:   StateBucket;
  liveCacheState:  'live' | 'not-live';

  authorityUpdatedAt: string | null;   // CanonicalMatch.lastUpdated
  snapshotUpdatedAt:  string | null;   // snapshot.generatedAt → ISO
  liveCacheUpdatedAt: string | null;   // live-cache batch fetchedAt → ISO

  // Age of each source relative to checkedAt, in seconds (null if source absent)
  authorityAgeSec:  number | null;
  snapshotAgeSec:   number | null;
  liveCacheAgeSec:  number | null;

  divergent: boolean;
  patterns:  string[];      // named divergence patterns this row triggers
  severity:  'GREEN' | 'YELLOW' | 'RED';
}

// ---------------------------------------------------------------------------
// State normalisers
// ---------------------------------------------------------------------------

function bucketFromStatus(status: string | null | undefined): StateBucket {
  if (status === 'IN_PLAY' || status === 'PAUSED')   return 'live';
  if (status === 'FINISHED')                          return 'finished';
  if (status === 'SCHEDULED' || status === 'TIMED')   return 'scheduled';
  if (status === 'CANCELLED' || status === 'POSTPONED' || status === 'SUSPENDED') return 'cancelled';
  return 'missing';
}

// ---------------------------------------------------------------------------
// Handler
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

  const now       = Date.now();
  const checkedAt = new Date(now).toISOString();

  // ── 1. Authority cache (read envelope directly for builtAt) ────────────────
  let authEnvelope: AuthorityCacheEnvelope | null = null;
  let authSource: 'primary' | 'dr' | 'none' = 'none';
  try {
    authEnvelope = await kv.get<AuthorityCacheEnvelope>(AUTHORITY_KEY);
    if (authEnvelope) authSource = 'primary';
    else {
      authEnvelope = await kv.get<AuthorityCacheEnvelope>(AUTHORITY_DR_KEY);
      if (authEnvelope) authSource = 'dr';
    }
  } catch (err) {
    return NextResponse.json({
      error: `Authority cache read failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 503 });
  }
  if (!authEnvelope) {
    return NextResponse.json({ error: 'Authority cache empty (primary + DR both missing)' }, { status: 503 });
  }

  const authMatches    = authEnvelope.matches ?? [];
  const authBuiltMs    = new Date(authEnvelope.builtAt).getTime();
  const authBuiltAgeSec = Math.round((now - authBuiltMs) / 1000);

  // ── 2. Snapshot KV (batch) ─────────────────────────────────────────────────
  const snapResults = await Promise.allSettled(
    authMatches.map((m) => kv.get<MatchSnapshot>(`goalradar:match:${m.id}`)),
  );

  // ── 3. Live cache (single batch read, exposes fetchedAt) ───────────────────
  let liveEntry: LiveCacheKVEntry | null = null;
  try {
    liveEntry = await kv.get<LiveCacheKVEntry>('goalradar:live:matches');
  } catch {
    liveEntry = null;
  }
  const liveFetchedMs  = liveEntry ? liveEntry.fetchedAt : null;
  const liveAgeSec     = liveFetchedMs != null ? Math.round((now - liveFetchedMs) / 1000) : null;
  const liveFresh      = liveAgeSec != null && liveAgeSec < 30; // 30s TTL
  const liveIds        = new Set(
    (liveEntry?.matches ?? [])
      .filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED')
      .map((m) => m.id),
  );

  // ── 4. Build per-match rows ─────────────────────────────────────────────────
  const rows: MatchRow[] = authMatches.map((auth: CanonicalMatch, i) => {
    const snapRes  = snapResults[i];
    const snap     = snapRes.status === 'fulfilled' ? snapRes.value : null;

    const authorityState: StateBucket = auth.state;
    const snapshotState:  StateBucket = snap ? bucketFromStatus(snap.match?.status) : 'missing';
    const liveCacheState: 'live' | 'not-live' = liveIds.has(auth.id) ? 'live' : 'not-live';

    const authorityUpdatedAt = auth.lastUpdated ?? authEnvelope!.builtAt;
    const snapshotUpdatedAt  = snap ? new Date(snap.generatedAt).toISOString() : null;
    const liveCacheUpdatedAt = liveFetchedMs != null ? new Date(liveFetchedMs).toISOString() : null;

    const authorityAgeSec = authorityUpdatedAt
      ? Math.round((now - new Date(authorityUpdatedAt).getTime()) / 1000) : null;
    const snapshotAgeSec  = snap ? Math.round((now - snap.generatedAt) / 1000) : null;
    const liveCacheAgeSec = liveAgeSec;

    // ── Divergence detection ─────────────────────────────────────────────────
    const patterns: string[] = [];

    // A vs B — only meaningful when a snapshot exists.
    if (snapshotState !== 'missing') {
      if (authorityState === 'live'      && snapshotState === 'finished') patterns.push('AUTH_LIVE__SNAP_FINISHED');
      if (authorityState === 'finished'  && snapshotState === 'live')     patterns.push('AUTH_FINISHED__SNAP_LIVE');
      if (authorityState === 'scheduled' && snapshotState === 'live')     patterns.push('AUTH_SCHEDULED__SNAP_LIVE');
      if (authorityState === 'live'      && snapshotState === 'scheduled') patterns.push('AUTH_LIVE__SNAP_SCHEDULED');
      if (authorityState === 'finished'  && snapshotState === 'scheduled') patterns.push('AUTH_FINISHED__SNAP_SCHEDULED');
      if (authorityState === 'scheduled' && snapshotState === 'finished') patterns.push('AUTH_SCHEDULED__SNAP_FINISHED');
    } else if (authorityState === 'live' || authorityState === 'finished') {
      // A live/finished match SHOULD have a snapshot; absence is a data gap.
      patterns.push('SNAP_MISSING_FOR_ACTIVE');
    }

    // A vs C — live-source split (the SSOT risk).
    if (authorityState === 'live' && liveCacheState === 'not-live' && liveFresh) {
      patterns.push('AUTH_LIVE__LIVECACHE_NOT_LIVE');
    }
    if (liveCacheState === 'live' && authorityState !== 'live') {
      patterns.push('LIVECACHE_LIVE__AUTH_NOT_LIVE');
    }

    // Severity: state-flip patterns are RED; snapshot-missing / live-source split YELLOW.
    const redPatterns = patterns.filter((p) =>
      p === 'AUTH_LIVE__SNAP_FINISHED' ||
      p === 'AUTH_FINISHED__SNAP_LIVE' ||
      p === 'AUTH_SCHEDULED__SNAP_LIVE' ||
      p === 'AUTH_LIVE__SNAP_SCHEDULED' ||
      p === 'LIVECACHE_LIVE__AUTH_NOT_LIVE',
    );
    const severity: MatchRow['severity'] =
      redPatterns.length > 0 ? 'RED' : patterns.length > 0 ? 'YELLOW' : 'GREEN';

    return {
      matchId: auth.id,
      home:    auth.homeTeam?.name ?? '?',
      away:    auth.awayTeam?.name ?? '?',
      utcDate: auth.utcDate,
      authorityState,
      snapshotState,
      liveCacheState,
      authorityUpdatedAt,
      snapshotUpdatedAt,
      liveCacheUpdatedAt,
      authorityAgeSec,
      snapshotAgeSec,
      liveCacheAgeSec,
      divergent: patterns.length > 0,
      patterns,
      severity,
    };
  });

  // ── 5. Aggregate ────────────────────────────────────────────────────────────
  const divergences = rows.filter((r) => r.divergent);
  const red    = rows.filter((r) => r.severity === 'RED').length;
  const yellow = rows.filter((r) => r.severity === 'YELLOW').length;
  const green  = rows.filter((r) => r.severity === 'GREEN').length;

  // Pattern frequency
  const patternCounts: Record<string, number> = {};
  for (const r of rows) for (const p of r.patterns) patternCounts[p] = (patternCounts[p] ?? 0) + 1;

  // State-distribution per source
  const dist = (sel: (r: MatchRow) => string) => {
    const out: Record<string, number> = {};
    for (const r of rows) { const k = sel(r); out[k] = (out[k] ?? 0) + 1; }
    return out;
  };

  return NextResponse.json(
    {
      checkedAt,
      sources: {
        authority: {
          key: AUTHORITY_KEY, source: authSource, builtAt: authEnvelope.builtAt,
          builtAgeSec: authBuiltAgeSec, matchCount: authMatches.length,
          liveCount: authEnvelope.liveCount, ttlTier: authEnvelope.ttlTier,
        },
        liveCache: {
          key: 'goalradar:live:matches', present: liveEntry != null,
          fetchedAt: liveFetchedMs != null ? new Date(liveFetchedMs).toISOString() : null,
          ageSec: liveAgeSec, fresh: liveFresh, liveCount: liveIds.size,
        },
        snapshot: {
          keyPattern: 'goalradar:match:{id}',
          present: snapResults.filter((r) => r.status === 'fulfilled' && r.value).length,
          missing: snapResults.filter((r) => r.status === 'fulfilled' && !r.value).length,
        },
      },
      distribution: {
        authority: dist((r) => r.authorityState),
        snapshot:  dist((r) => r.snapshotState),
        liveCache: dist((r) => r.liveCacheState),
      },
      summary: { total: rows.length, green, yellow, red, divergent: divergences.length },
      verdict: red > 0 ? 'RED' : yellow > 0 ? 'YELLOW' : 'GREEN',
      patternCounts,
      divergences: divergences.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'RED' ? -1 : 1)),
      note:
        red > 0    ? `${red} RED state-flip divergence(s) — user-visible LIVE/FT mismatch.`
        : yellow > 0 ? `${yellow} YELLOW divergence(s) — snapshot gap or live-source split, not state-flip.`
        : `All ${green} matches consistent across authority / snapshot / live-cache.`,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
