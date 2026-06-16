/**
 * match-state-overlay.ts — DATA-1 Live State Consistency
 *
 * Problem: list surfaces (schedule, WC hub, homepage) render from bulk KV
 * list entries that only the cron orchestrator refreshes. Match pages build
 * per-match snapshots on demand, so a match can show FULL TIME on its own
 * page while the schedule still renders it as upcoming ("Mexico –") from a
 * stale list payload — observed in production for Mexico vs South Africa.
 *
 * Fix: before rendering, overlay each listed match with its KV snapshot
 * (goalradar:match:{id}) when the snapshot's state is AHEAD of the list's
 * (SCHEDULED → LIVE → FINISHED never goes backwards). One kv.mget per ISR
 * regeneration — KV-only, zero provider calls, no ISR change.
 *
 * Result: as soon as ANY user (or the prewarm cron) produces a fresh
 * snapshot, every list surface converges within its ISR window (30–300 s),
 * even if the bulk list entry is stale.
 */

import { kv } from '@vercel/kv';
import type { Match } from './types';
import type { MatchSnapshot } from './match-snapshot';

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL === 'string' &&
  process.env.KV_REST_API_URL !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' &&
  process.env.KV_REST_API_TOKEN !== '';

/** Forward-only state machine rank: SCHEDULED/TIMED → LIVE → FINISHED.
 *  Exported (DATA-4) so the prewarm can refuse to regress snapshot state. */
export const STATE_RANK: Record<string, number> = {
  SCHEDULED: 0,
  TIMED:     0,
  POSTPONED: 1,
  SUSPENDED: 1,
  CANCELLED: 1,
  IN_PLAY:   2,
  PAUSED:    2,
  FINISHED:  3,
};

/** Bound the mget size — list pages never display more than this. */
const MAX_OVERLAY = 120;

/**
 * DATA-2 — canonical merge rule: the snapshot is the single source of truth
 * for match STATE. It wins whenever it is ahead in the forward-only state
 * machine (SCHEDULED → LIVE → FINISHED — never backwards), and supplies the
 * fresher score while both sides agree the match is live.
 * Returns the input `listMatch` unchanged when the snapshot adds nothing.
 */
export function mergeSnapshotState(listMatch: Match, snapMatch: Match | undefined | null): Match {
  if (!snapMatch || snapMatch.id !== listMatch.id) return listMatch;

  const listRank = STATE_RANK[listMatch.status] ?? 0;
  const snapRank = STATE_RANK[snapMatch.status] ?? 0;

  // Snapshot ahead in the state machine → adopt status + score + minute.
  if (snapRank > listRank) {
    return { ...listMatch, status: snapMatch.status, score: snapMatch.score, minute: snapMatch.minute, lastUpdated: snapMatch.lastUpdated };
  }
  // Same live state → snapshot usually has the fresher score/minute.
  if (snapRank === listRank && (snapMatch.status === 'IN_PLAY' || snapMatch.status === 'PAUSED')) {
    return { ...listMatch, score: snapMatch.score, minute: snapMatch.minute, lastUpdated: snapMatch.lastUpdated };
  }
  return listMatch;
}

/**
 * Overlay stale list entries with fresher per-match snapshot state.
 * Forward transitions only (a snapshot can never demote FINISHED → upcoming).
 * Best-effort: any KV failure returns the input unchanged.
 */
export async function overlayMatchStates(matches: Match[]): Promise<Match[]> {
  if (!KV_ENABLED || matches.length === 0) return matches;

  const subject = matches.slice(0, MAX_OVERLAY);
  try {
    const snaps = await kv.mget<(MatchSnapshot | null)[]>(
      ...subject.map((m) => `goalradar:match:${m.id}`),
    );

    let overlaid = 0;
    const merged = subject.map((m, i) => {
      const out = mergeSnapshotState(m, snaps[i]?.match);
      if (out.status !== m.status) overlaid++;
      return out;
    });

    if (overlaid > 0) {
      console.log(`[StateOverlay] advanced ${overlaid}/${subject.length} matches from snapshots`);
    }
    return matches.length > MAX_OVERLAY ? [...merged, ...matches.slice(MAX_OVERLAY)] : merged;
  } catch {
    return matches; // overlay is best-effort — never break the page
  }
}
