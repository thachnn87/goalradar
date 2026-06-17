/**
 * match-classify.ts
 *
 * Shared match-state classifier — DATA-16D.
 *
 * Single source of truth for: "which display bucket does this match belong to?"
 * Replaces duplicated inline status checks in Hub, Results, Schedule, and Live pages.
 *
 * Bucket rules (forward-only, matches STATE_RANK in match-state-overlay.ts):
 *   live     — IN_PLAY | PAUSED
 *   finished — FINISHED
 *   today    — SCHEDULED | TIMED  AND  utcDate starts with todayUTC
 *   upcoming — SCHEDULED | TIMED  AND  utcDate > todayUTC
 *   other    — everything else (POSTPONED, SUSPENDED, CANCELLED, unknown)
 */

export type MatchBucket = 'live' | 'finished' | 'today' | 'upcoming' | 'other';

/**
 * Classify a match into a display bucket.
 *
 * @param match    — any object with `status` and `utcDate` fields
 * @param todayUTC — ISO date string in 'YYYY-MM-DD' format, e.g. new Date().toISOString().split('T')[0]
 */
export function classifyMatchState(
  match: { status?: string | null; utcDate: string },
  todayUTC: string,
): MatchBucket {
  const s = match.status ?? '';

  if (s === 'IN_PLAY' || s === 'PAUSED') return 'live';
  if (s === 'FINISHED') return 'finished';

  if (s === 'SCHEDULED' || s === 'TIMED') {
    const matchDay = match.utcDate.split('T')[0];
    if (matchDay === todayUTC) return 'today';
    if (matchDay > todayUTC) return 'upcoming';
    // Date in the past but still SCHEDULED/TIMED → treat as today so it's not hidden
    return 'today';
  }

  return 'other';
}
