/**
 * match-display.ts
 * DATA-18WC.DISPLAY.CONTRACT — ONE DERIVATION for list views.
 *
 * MatchDisplay is the lightweight display contract for all listing pages.
 * It is derived from a Match (or CanonicalMatch) and carries every field
 * a list component needs — no raw score/status/date access required.
 *
 * TWO CONTRACTS:
 *   MatchRuntimeState  → deriveRuntimeState()    → match detail page (needs MatchSnapshot)
 *   MatchDisplay       → deriveMatchDisplay()     → all list pages    (needs Match only)
 *
 * ONE DERIVATION rule:
 *   Every list page/component must call deriveMatchDisplay() and read from
 *   the returned object — never access score.fullTime, score.winner, status,
 *   minute, or utcDate directly for display purposes.
 *
 * Flow:
 *   Match[] → deriveMatchDisplay() → MatchDisplay → list UI
 */

import type { Match } from '@/lib/types';
import { versionFromTimestamp } from '@/lib/match-runtime-state';

// ---------------------------------------------------------------------------
// MatchDisplay — the single display contract for list views
// ---------------------------------------------------------------------------

/**
 * Badge render style — drives the visual treatment of the status badge.
 * null = scheduled/timed match (show kickoff time, no badge).
 */
export type MatchBadgeStyle =
  | 'finished'   // gray    — FT / AET / FT (P)
  | 'live'       // red     — animated dot + minute
  | 'paused'     // yellow  — HT
  | 'postponed'  // orange  — PST
  | 'cancelled'  // muted   — CANC
  | 'suspended'  // orange  — SUSP
  | null;        // scheduled / timed — no badge

export interface MatchDisplay {
  // ── Scores ──────────────────────────────────────────────────────────────────
  /** null when the match has not yet started (showScore=false). */
  homeScore: number | null;
  awayScore: number | null;
  /** true for FINISHED / IN_PLAY / PAUSED — show scores rather than kickoff time. */
  showScore: boolean;

  // ── Status ──────────────────────────────────────────────────────────────────
  /** Human-readable status label: 'FT', 'AET', 'FT (P)', 'HT', '45\'', 'LIVE',
   *  'PST', 'CANC', 'SUSP', or kickoff time '20:00'. */
  statusLabel: string;
  /** Visual badge style for the status chip. null = no badge (show kickoff time). */
  badgeStyle: MatchBadgeStyle;
  /** true when the match is actively in progress (IN_PLAY or PAUSED). */
  showLiveBadge: boolean;
  /** Minute string for live display: '45\'', 'LIVE', 'HT'. null when not in progress. */
  clockLabel: string | null;

  // ── Outcome ─────────────────────────────────────────────────────────────────
  /** Winning side when match is decided. null = no winner yet, draw is explicit. */
  winner: 'home' | 'away' | 'draw' | null;
  /** true when match went to a penalty shootout (score.duration === 'PENALTY_SHOOTOUT'). */
  showPenalty: boolean;
  /** true when match went to extra time (score.duration === 'EXTRA_TIME'). */
  showET: boolean;
  /** true when match was cancelled. */
  showCancelled: boolean;

  // ── Date / time ─────────────────────────────────────────────────────────────
  /** Short date for display: '14 Jun'. */
  displayDate: string;
  /** Kickoff time in UTC: '20:00'. */
  displayTime: string;

  // ── Versioning ──────────────────────────────────────────────────────────────
  /** Unix-seconds version derived from match.lastUpdated. Used for staleness checks. */
  version: number;
}

// ---------------------------------------------------------------------------
// deriveMatchDisplay — the single public entry point for list view derivation
// ---------------------------------------------------------------------------

/**
 * Derive a MatchDisplay from a Match (or any object that satisfies the
 * Match shape — including CanonicalMatch converted via canonicalToMatch()).
 *
 * This is the ONLY approved way to obtain display fields for list pages.
 * Never access match.score.fullTime, match.score.winner, match.status,
 * match.minute, or match.utcDate directly in JSX rendering.
 *
 * Called at rendering time (RSC or client component) for each Match in a list.
 * Pure — no KV reads, no network calls, no side effects.
 */
export function deriveMatchDisplay(match: Match): MatchDisplay {
  const { status, score, minute, utcDate, lastUpdated } = match;

  // ── Derived booleans ───────────────────────────────────────────────────────
  const isLive     = status === 'IN_PLAY' || status === 'PAUSED';
  const isFinished = status === 'FINISHED';
  const showScore  = isFinished || isLive;
  const showPenalty = score.duration === 'PENALTY_SHOOTOUT';
  const showET      = score.duration === 'EXTRA_TIME';

  // ── Scores ────────────────────────────────────────────────────────────────
  const homeScore = showScore ? (score.fullTime.home ?? null) : null;
  const awayScore = showScore ? (score.fullTime.away ?? null) : null;

  // ── Winner ────────────────────────────────────────────────────────────────
  let winner: MatchDisplay['winner'] = null;
  if (score.winner === 'HOME_TEAM')  winner = 'home';
  else if (score.winner === 'AWAY_TEAM') winner = 'away';
  else if (score.winner === 'DRAW')  winner = 'draw';

  // ── Badge style ───────────────────────────────────────────────────────────
  const badgeStyle: MatchBadgeStyle =
    isFinished           ? 'finished'
    : status === 'IN_PLAY'  ? 'live'
    : status === 'PAUSED'   ? 'paused'
    : status === 'POSTPONED'? 'postponed'
    : status === 'CANCELLED'? 'cancelled'
    : status === 'SUSPENDED'? 'suspended'
    : null;

  // ── Status label ──────────────────────────────────────────────────────────
  let statusLabel: string;
  if (isFinished) {
    statusLabel = showPenalty ? 'FT (P)' : showET ? 'AET' : 'FT';
  } else if (status === 'IN_PLAY') {
    statusLabel = minute != null ? `${minute}'` : 'LIVE';
  } else if (status === 'PAUSED') {
    statusLabel = 'HT';
  } else if (status === 'POSTPONED') {
    statusLabel = 'PST';
  } else if (status === 'CANCELLED') {
    statusLabel = 'CANC';
  } else if (status === 'SUSPENDED') {
    statusLabel = 'SUSP';
  } else {
    // SCHEDULED / TIMED — show kickoff time
    statusLabel = new Date(utcDate).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    });
  }

  // ── Clock label (in-progress display) ─────────────────────────────────────
  const clockLabel =
    status === 'IN_PLAY'  ? (minute != null ? `${minute}'` : 'LIVE')
    : status === 'PAUSED' ? 'HT'
    : null;

  // ── Date / time ───────────────────────────────────────────────────────────
  const displayDate = new Date(utcDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
  const displayTime = new Date(utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  return {
    homeScore,
    awayScore,
    showScore,
    statusLabel,
    badgeStyle,
    showLiveBadge: isLive,
    clockLabel,
    winner,
    showPenalty,
    showET,
    showCancelled: status === 'CANCELLED',
    displayDate,
    displayTime,
    version: versionFromTimestamp(lastUpdated),
  };
}
