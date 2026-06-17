/**
 * GET /api/debug/data18c0-audit
 *
 * DATA-18C.0 comprehensive KV integrity audit.
 * READ-ONLY — no writes, no side effects, no cache activation.
 *
 * Inspects for all FINISHED WC matches:
 *   - primary snapshot (goalradar:match:{id})
 *   - DR snapshot (goalradar:dr:match:{id})
 *   - ESPN ID lookup (goalradar:espn:lookup:{id})
 *   - bulk FINISHED feed (goalradar:/competitions/WC/matches?status=FINISHED)
 *   - bulk SCHEDULED feed (goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED)
 *
 * Auth: CRON_SECRET (Bearer or ?secret=)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                        from '@vercel/kv';
import type { MatchSnapshot }        from '@/lib/match-snapshot';
import type { Match }                from '@/lib/types';

export const dynamic = 'force-dynamic';

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
// KV entry wrapper (mirrors kv-cache.ts)
// ---------------------------------------------------------------------------

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

interface MatchAuditRow {
  matchId:          number;
  home:             string;
  away:             string;
  utcDate:          string;
  fdStatus:         string;
  scoreHome:        number | null;
  scoreAway:        number | null;
  scoreTotal:       number;
  // Primary snapshot
  snapshotExists:   boolean;
  snapshotAgeHours: number | null;
  snapshotGoals:    number;
  snapshotCards:    number;
  snapshotSubs:     number;
  snapshotHasLineup:boolean;
  snapshotStatus:   string | null;
  snapshotTtlSec:   number | null;
  // DR snapshot
  drExists:         boolean;
  drAgeHours:       number | null;
  drGoals:          number;
  drStatus:         string | null;
  // ESPN lookup
  espnIdPresent:    boolean;
  espnId:           string | null;
  // Derived flags
  poisonedDr:       boolean;  // score>0 AND dr.goals===0
  missingEnrichment:boolean;  // score>0 AND snapshot.goals===0
  repairability:    'self-heal' | 'needs-repair' | 'unvisited' | 'ok';
}

interface FeedAuditRow {
  key:         string;
  exists:      boolean;
  matchCount:  number;
  ageHours:    number | null;
  freshUntil:  number | null;
  isFresh:     boolean;
  drExists:    boolean;
  drMatchCount:number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ageHours(generatedAt: number | undefined): number | null {
  if (!generatedAt) return null;
  return Math.round((Date.now() - generatedAt) / 3_600_000 * 10) / 10;
}

function determineRepairability(row: Omit<MatchAuditRow, 'repairability'>): MatchAuditRow['repairability'] {
  if (!row.snapshotExists && !row.drExists) return 'unvisited';
  if (!row.missingEnrichment) return 'ok';
  // has enrichment problem
  if (row.drExists && row.drGoals > 0) return 'self-heal'; // DR has goals → downgrade guard will fix on next rebuild
  return 'needs-repair'; // DR is poisoned or missing — requires manual repair
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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

  const now = Date.now();

  // ── 1. Read bulk feeds ───────────────────────────────────────────────────

  const FINISHED_KEY   = 'goalradar:/competitions/WC/matches?status=FINISHED';
  const UPCOMING_KEY   = 'goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED';
  const FINISHED_DR    = 'goalradar:dr:/competitions/WC/matches?status=FINISHED';
  const UPCOMING_DR    = 'goalradar:dr:/competitions/WC/matches?status=SCHEDULED,TIMED';

  const [finishedEntry, upcomingEntry, finishedDr, upcomingDr] = await Promise.all([
    kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_KEY),
    kv.get<KVEntry<{ matches: Match[] }>>(UPCOMING_KEY),
    kv.get<KVEntry<{ matches: Match[] }>>(FINISHED_DR),
    kv.get<KVEntry<{ matches: Match[] }>>(UPCOMING_DR),
  ]);

  const finishedMatches = finishedEntry?.data?.matches ?? [];
  const upcomingMatches = upcomingEntry?.data?.matches ?? [];

  const feedAudit: FeedAuditRow[] = [
    {
      key:          FINISHED_KEY,
      exists:       !!finishedEntry,
      matchCount:   finishedMatches.length,
      ageHours:     finishedEntry ? ageHours(finishedEntry.fetchedAt) : null,
      freshUntil:   finishedEntry?.freshUntil ?? null,
      isFresh:      finishedEntry ? finishedEntry.freshUntil > now : false,
      drExists:     !!finishedDr,
      drMatchCount: finishedDr?.data?.matches?.length ?? 0,
    },
    {
      key:          UPCOMING_KEY,
      exists:       !!upcomingEntry,
      matchCount:   upcomingMatches.length,
      ageHours:     upcomingEntry ? ageHours(upcomingEntry.fetchedAt) : null,
      freshUntil:   upcomingEntry?.freshUntil ?? null,
      isFresh:      upcomingEntry ? upcomingEntry.freshUntil > now : false,
      drExists:     !!upcomingDr,
      drMatchCount: upcomingDr?.data?.matches?.length ?? 0,
    },
  ];

  // ── 2. Audit per-match KV state for all FINISHED matches ─────────────────

  const matchRows: MatchAuditRow[] = [];

  if (finishedMatches.length === 0) {
    return NextResponse.json({
      generatedAt:  new Date(now).toISOString(),
      feedAudit,
      matchAudit:   [],
      summary: {
        totalFinished:       0,
        snapshotCount:       0,
        drCount:             0,
        enrichedCount:       0,
        poisonedDrCount:     0,
        missingEnrichCount:  0,
        unvisitedCount:      0,
        espnIdCount:         0,
        note: 'FINISHED feed is empty — no matches to audit',
      },
    });
  }

  // Batch-read all snapshots and DR keys (chunked at 100)
  const ids = finishedMatches.map(m => m.id);

  const CHUNK = 100;
  const snapshotChunks = await Promise.all(
    chunk(ids, CHUNK).map(ch =>
      kv.mget<(MatchSnapshot | null)[]>(...ch.map(id => `goalradar:match:${id}`))
    )
  );
  const drChunks = await Promise.all(
    chunk(ids, CHUNK).map(ch =>
      kv.mget<(MatchSnapshot | null)[]>(...ch.map(id => `goalradar:dr:match:${id}`))
    )
  );
  const espnChunks = await Promise.all(
    chunk(ids, CHUNK).map(ch =>
      kv.mget<(string | null)[]>(...ch.map(id => `goalradar:espn:lookup:${id}`))
    )
  );

  const snapshots = snapshotChunks.flat();
  const drSnaps   = drChunks.flat();
  const espnIds   = espnChunks.flat();

  for (let i = 0; i < finishedMatches.length; i++) {
    const m    = finishedMatches[i];
    const snap = snapshots[i];
    const dr   = drSnaps[i];
    const espn = espnIds[i];

    const scoreHome  = m.score?.fullTime?.home ?? null;
    const scoreAway  = m.score?.fullTime?.away ?? null;
    const scoreTotal = (scoreHome ?? 0) + (scoreAway ?? 0);

    const snapshotGoals = snap?.match?.goals?.length   ?? 0;
    const snapshotCards = snap?.match?.bookings?.length ?? 0;
    const snapshotSubs  = snap?.match?.substitutions?.length ?? 0;
    const drGoals       = dr?.match?.goals?.length ?? 0;

    const missingEnrichment = scoreTotal > 0 && snapshotGoals === 0 && !!snap;
    const poisonedDr        = scoreTotal > 0 && drGoals === 0 && !!dr;

    const partial: Omit<MatchAuditRow, 'repairability'> = {
      matchId:           m.id,
      home:              m.homeTeam?.name ?? '?',
      away:              m.awayTeam?.name ?? '?',
      utcDate:           m.utcDate?.split('T')[0] ?? '?',
      fdStatus:          m.status,
      scoreHome,
      scoreAway,
      scoreTotal,
      snapshotExists:    !!snap,
      snapshotAgeHours:  snap?.generatedAt ? ageHours(snap.generatedAt) : null,
      snapshotGoals,
      snapshotCards,
      snapshotSubs,
      snapshotHasLineup: !!(snap?.match?.lineups?.home?.players?.length),
      snapshotStatus:    snap?.match?.status ?? null,
      snapshotTtlSec:    null, // KV doesn't expose remaining TTL in mget
      drExists:          !!dr,
      drAgeHours:        dr?.generatedAt ? ageHours(dr.generatedAt) : null,
      drGoals,
      drStatus:          dr?.match?.status ?? null,
      espnIdPresent:     !!espn && typeof espn === 'string',
      espnId:            typeof espn === 'string' ? espn : null,
      poisonedDr,
      missingEnrichment,
    };

    matchRows.push({ ...partial, repairability: determineRepairability(partial) });
  }

  // ── 3. Compute summary ───────────────────────────────────────────────────

  const summary = {
    totalFinished:      matchRows.length,
    snapshotCount:      matchRows.filter(r => r.snapshotExists).length,
    drCount:            matchRows.filter(r => r.drExists).length,
    enrichedCount:      matchRows.filter(r => r.snapshotGoals > 0).length,
    partialEnriched:    matchRows.filter(r => r.snapshotGoals === 0 && (r.snapshotCards > 0 || r.snapshotSubs > 0)).length,
    missingEnrichCount: matchRows.filter(r => r.missingEnrichment).length,
    poisonedDrCount:    matchRows.filter(r => r.poisonedDr).length,
    unvisitedCount:     matchRows.filter(r => !r.snapshotExists && !r.drExists).length,
    espnIdCount:        matchRows.filter(r => r.espnIdPresent).length,
    selfHealCount:      matchRows.filter(r => r.repairability === 'self-heal').length,
    needsRepairCount:   matchRows.filter(r => r.repairability === 'needs-repair').length,
    upcomingCount:      upcomingMatches.length,
    // Stale SCHEDULED entries that should be FINISHED
    staleScheduledCount: upcomingMatches.filter(m => {
      const matchDay = m.utcDate?.split('T')[0] ?? '9999';
      const today    = new Date(now).toISOString().split('T')[0];
      return (m.status === 'SCHEDULED' || m.status === 'TIMED') && matchDay < today;
    }).length,
  };

  return NextResponse.json(
    {
      generatedAt: new Date(now).toISOString(),
      feedAudit,
      matchAudit:  matchRows,
      summary,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
