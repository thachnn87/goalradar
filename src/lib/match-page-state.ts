/**
 * match-page-state.ts
 * DATA-18WC.RUNTIME.TRUTH — Phase 2
 *
 * Single derivation of MatchPageState from a MatchDetail.
 * Exported so MatchRuntimeState and page.tsx share the same type.
 */

import type { MatchDetail } from '@/lib/types';

export type MatchPageState =
  | 'PROJECTED'   // knockout, teams TBD (homeTeam.id === 0) — slot labels shown
  | 'QUALIFIED'   // teams confirmed, >24h to kickoff
  | 'PRE_MATCH'   // teams confirmed, ≤24h to kickoff
  | 'LIVE'        // IN_PLAY or PAUSED
  | 'FINISHED'    // match completed
  | 'CANCELLED';  // CANCELLED | SUSPENDED | POSTPONED

export function deriveMatchPageState(match: MatchDetail): MatchPageState {
  const { status, homeTeam, awayTeam, utcDate } = match;
  if (status === 'IN_PLAY' || status === 'PAUSED')                         return 'LIVE';
  if (status === 'FINISHED')                                                return 'FINISHED';
  if (status === 'CANCELLED' || status === 'SUSPENDED' || status === 'POSTPONED') return 'CANCELLED';
  // SCHEDULED / TIMED — TBD check: id === 0 means slot not yet resolved
  if (!homeTeam?.id || homeTeam.id === 0 || !awayTeam?.id || awayTeam.id === 0) return 'PROJECTED';
  const msToKO = new Date(utcDate).getTime() - Date.now();
  return msToKO <= 24 * 60 * 60 * 1000 ? 'PRE_MATCH' : 'QUALIFIED';
}
