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
 * Accepts both FD Match (`status`) and CanonicalMatch (`state`) shapes.
 *
 * @param match    — any object with `status`/`state` and `utcDate` fields
 * @param todayUTC — ISO date string in 'YYYY-MM-DD' format, e.g. new Date().toISOString().split('T')[0]
 */
export function classifyMatchState(
  match: { status?: string | null; state?: string | null; utcDate: string },
  todayUTC: string,
): MatchBucket {
  // CanonicalMatch.state — checked first (V2 authority path).
  if (match.state === 'live')      return 'live';
  if (match.state === 'finished')  return 'finished';
  if (match.state === 'cancelled') return 'other';
  if (match.state === 'scheduled') {
    const matchDay = match.utcDate.split('T')[0];
    if (matchDay === todayUTC) return 'today';
    if (matchDay > todayUTC)  return 'upcoming';
    return 'today'; // past kickoff but still scheduled
  }

  // Legacy Match.status — FD raw feed.
  const s = match.status ?? '';
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'live';
  if (s === 'FINISHED') return 'finished';
  if (s === 'SCHEDULED' || s === 'TIMED') {
    const matchDay = match.utcDate.split('T')[0];
    if (matchDay === todayUTC) return 'today';
    if (matchDay > todayUTC)  return 'upcoming';
    return 'today';
  }

  return 'other';
}
