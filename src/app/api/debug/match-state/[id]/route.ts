/**
 * GET /api/debug/match-state/[id]
 *
 * LIVE-2B diagnostic: compares the live-cache and snapshot KV entries for a
 * given match ID to expose the "detail SCHEDULED while live cache IN_PLAY" race.
 *
 * Auth: CRON_SECRET (same as /api/debug/revalidation)
 *       or NODE_ENV=development
 *
 * Example:
 *   curl https://goalradar.org/api/debug/match-state/537364?secret=$CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                         from '@vercel/kv';
import { readKVLiveMatches }          from '@/lib/live-cache';
import type { MatchSnapshot }         from '@/lib/match-snapshot';

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

  const url = new URL(req.url);
  if (url.searchParams.get('secret') === secret) return true;

  return false;
}

// ---------------------------------------------------------------------------
// KV entry wrapper
// ---------------------------------------------------------------------------

interface KVEntry<T> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: rawId } = await params;
  const matchId = /^\d+$/.test(rawId) ? rawId : (/^(\d+)/.exec(rawId)?.[1] ?? null);
  if (!matchId) {
    return NextResponse.json({ error: `Invalid match id: ${rawId}` }, { status: 400 });
  }

  const numId = parseInt(matchId, 10);
  const now   = Date.now();

  // ── 1. Live cache ──────────────────────────────────────────────────────────
  let liveKVStatus:  string | null = null;
  let liveKVScore:   unknown       = null;
  let liveKVAgeMs:   number | null = null;
  let overlayMatchFound = false;

  try {
    const liveMatches = await readKVLiveMatches();
    if (liveMatches) {
      const live = liveMatches.find((m) => m.id === numId);
      if (live) {
        overlayMatchFound = true;
        liveKVStatus = live.status;
        liveKVScore  = live.score;
      } else {
        liveKVStatus = 'NOT_IN_LIVE_CACHE';
      }
    } else {
      liveKVStatus = 'LIVE_CACHE_EMPTY_OR_EXPIRED';
    }
  } catch (err) {
    liveKVStatus = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  // ── 2. Detail KV entry  goalradar:/matches/{id} ───────────────────────────
  let detailStatus:  string | null = null;
  let detailScore:   unknown       = null;
  let detailAgeMs:   number | null = null;
  let detailFreshMs: number | null = null;

  try {
    const raw = await kv.get<KVEntry<{ status: string; score: unknown; utcDate: string }>>(
      `goalradar:/matches/${matchId}`,
    );
    if (raw) {
      detailStatus  = raw.data?.status ?? null;
      detailScore   = raw.data?.score  ?? null;
      detailAgeMs   = now - raw.fetchedAt;
      detailFreshMs = raw.freshUntil - now; // negative = stale
    } else {
      detailStatus = 'DETAIL_KEY_MISSING';
    }
  } catch (err) {
    detailStatus = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  // ── 3. Snapshot KV entry  goalradar:match:{id} ────────────────────────────
  let snapshotStatus:  string | null = null;
  let snapshotScore:   unknown       = null;
  let snapshotAgeMs:   number | null = null;

  try {
    const snap = await kv.get<MatchSnapshot>(`goalradar:match:${matchId}`);
    if (snap) {
      snapshotStatus = snap.match?.status ?? null;
      snapshotScore  = snap.match?.score  ?? null;
      snapshotAgeMs  = now - snap.generatedAt;
    } else {
      snapshotStatus = 'SNAPSHOT_KEY_MISSING';
    }
  } catch (err) {
    snapshotStatus = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  // ── 4. Overlay analysis ────────────────────────────────────────────────────
  const liveIsLive  = liveKVStatus === 'IN_PLAY' || liveKVStatus === 'PAUSED';
  const detailIsLive = detailStatus === 'IN_PLAY' || detailStatus === 'PAUSED';

  // LIVE-2B race: live cache says IN_PLAY but detail says SCHEDULED
  const live2bRaceActive = liveIsLive && !detailIsLive;

  // Whether the LIVE-2 overlay guard (isLiveStatus(match.status)) would fire
  const overlayGuardWouldFire = detailIsLive;

  // Whether LIVE-2B fix (isLiveStatus(live.status)) would fire
  const overlayWouldFireWithFix = overlayMatchFound && liveIsLive;

  const buildSnapshotCalled =
    snapshotStatus === 'SNAPSHOT_KEY_MISSING' ||
    snapshotStatus === 'SCHEDULED' ||
    snapshotStatus === 'TIMED';

  return NextResponse.json({
    matchId,
    checkedAt:     new Date(now).toISOString(),

    // Layer 1: goalradar:live:matches
    liveKVStatus,
    liveKVScore,
    liveKVAgeMs,

    // Layer 2: goalradar:/matches/{id}
    detailStatus,
    detailScore,
    detailAgeMs,
    detailFreshMs,  // negative = stale; positive = ms until SWR fires

    // Layer 3: goalradar:match:{id}
    snapshotStatus,
    snapshotScore,
    snapshotAgeMs,

    // Overlay analysis
    overlayMatchFound,
    overlayGuardWouldFire,    // current code: fires only if detail is IN_PLAY/PAUSED
    overlayWouldFireWithFix,  // LIVE-2B fix: fires when live cache is IN_PLAY/PAUSED
    buildSnapshotCalled,

    // Diagnosis
    live2bRaceActive,
    diagnosis: live2bRaceActive
      ? `LIVE-2B RACE CONFIRMED: live cache says ${liveKVStatus} but detail says ${detailStatus}. Overlay would NOT fire with current code. Would fire with LIVE-2B fix.`
      : liveIsLive && detailIsLive
        ? `No race: both live cache and detail agree (${liveKVStatus}). Overlay fires correctly.`
        : !liveIsLive
          ? `Match is not in live cache (status=${liveKVStatus}). No overlay needed.`
          : `Unexpected state — review all layers above.`,
  });
}
