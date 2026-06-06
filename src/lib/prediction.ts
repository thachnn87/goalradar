/**
 * Deterministic match prediction engine.
 *
 * All exported functions are pure — given the same inputs they return the
 * same outputs. No API calls, no randomness, no side effects.
 *
 * ── Algorithm overview ────────────────────────────────────────────────────
 *
 * WIN PROBABILITY
 *   Three evidence sources, blended by weight:
 *
 *   1. Football baseline (40%)
 *      Historical long-run averages across top-flight football:
 *      Home win 44% · Draw 26% · Away win 30%
 *
 *   2. Recent form (35% per side)
 *      Last 5 completed matches for each team converted to a
 *      points-per-game ratio [0, 1]. Positive home form shifts
 *      probability toward HOME; positive away form shifts toward AWAY.
 *      Maximum swing: ±15 percentage points.
 *
 *   3. Head-to-head record (25%, only when ≥ 3 meetings exist)
 *      Replaces the baseline proportionally so the historical matchup
 *      record exerts real influence over the final output.
 *
 *   All three components are clamped and re-normalised to sum to 100.
 *
 * SCORE PREDICTION
 *   Expected goals per side = geometric mean of each team's scoring rate
 *   and the opponent's concession rate over the last 5 matches.
 *   Blended 70 / 30 with H2H goals-per-match if ≥ 3 meetings exist.
 *   Clipped to [0.5, 3.5] and rounded to the nearest integer.
 *
 * IMPLIED ODDS
 *   Decimal odds = 100 / probability_percentage
 *   These are model-derived estimates, not bookmaker prices.
 */

import type { HeadToHead, Match } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WinProbabilities {
  /** 0–100, one decimal place. All three values sum to 100. */
  home: number;
  draw: number;
  away: number;
}

export interface FormRecord {
  played:        number;
  won:           number;
  drawn:         number;
  lost:          number;
  goalsFor:      number;
  goalsAgainst:  number;
  /** Last ≤ 5 finished matches, sorted newest first. */
  matches:       Match[];
}

export interface ScorePrediction {
  home: number;
  away: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ---------------------------------------------------------------------------
// Form extraction
// ---------------------------------------------------------------------------

/**
 * Build a FormRecord for `teamId` from an arbitrary array of Match objects.
 * Filters to FINISHED matches involving the team, takes the 5 most recent.
 */
export function extractForm(matches: Match[], teamId: number): FormRecord {
  const finished = matches
    .filter(
      (m) =>
        m.status === 'FINISHED' &&
        (m.homeTeam?.id === teamId || m.awayTeam?.id === teamId),
    )
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 5);

  let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;

  for (const m of finished) {
    const isHome = m.homeTeam?.id === teamId;
    const gf = (isHome ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
    const ga = (isHome ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
    goalsFor     += gf;
    goalsAgainst += ga;

    const winner = m.score.winner;
    if (winner === 'DRAW') {
      drawn++;
    } else if ((winner === 'HOME_TEAM' && isHome) || (winner === 'AWAY_TEAM' && !isHome)) {
      won++;
    } else {
      lost++;
    }
  }

  return { played: finished.length, won, drawn, lost, goalsFor, goalsAgainst, matches: finished };
}

// ---------------------------------------------------------------------------
// Win probability
// ---------------------------------------------------------------------------

// Statistical baseline from long-run top-flight football averages
const BASE_HOME = 44;
const BASE_DRAW = 26;
const BASE_AWAY = 30;

/** Points-per-game ratio → [0, 1]. Returns 0.5 when no data is available. */
function ppgRatio(won: number, drawn: number, played: number): number {
  if (played === 0) return 0.5;
  return (won * 3 + drawn) / (played * 3);
}

/**
 * Compute win probabilities.
 *
 * @param h2h  - Head-to-head data (null if unavailable or < 3 meetings)
 * @param homeForm - FormRecord for the home team
 * @param awayForm - FormRecord for the away team
 */
export function computeProbabilities(
  h2h: HeadToHead | null,
  homeForm: FormRecord,
  awayForm: FormRecord,
): WinProbabilities {
  let pHome = BASE_HOME;
  let pDraw  = BASE_DRAW;
  let pAway  = BASE_AWAY;

  // ── Component 2: recent form adjustment ────────────────────────────────────
  const homePpg = ppgRatio(homeForm.won, homeForm.drawn, homeForm.played);
  const awayPpg = ppgRatio(awayForm.won, awayForm.drawn, awayForm.played);
  const totalPpg = homePpg + awayPpg;

  if (totalPpg > 0) {
    // Shift scales from -1 (all-away domination) to +1 (all-home domination)
    const formBalance = (homePpg - awayPpg) / totalPpg; // [-1, +1]
    const maxSwing = 15; // percentage points
    const swing = formBalance * maxSwing;
    pHome += swing;
    pAway -= swing;
    // Draw is pulled toward the mean when form is balanced
    pDraw += Math.abs(swing) * -0.3;
  }

  // ── Component 3: H2H record blend (when ≥ 3 meetings) ────────────────────
  if (h2h && h2h.aggregates.numberOfMatches >= 3) {
    const total         = h2h.aggregates.numberOfMatches;
    const h2hHomeWinPct = (h2h.aggregates.homeTeam.wins  / total) * 100;
    const h2hAwayWinPct = (h2h.aggregates.awayTeam.wins  / total) * 100;
    const h2hDrawPct    = 100 - h2hHomeWinPct - h2hAwayWinPct;

    const w = 0.25; // H2H weight
    pHome = pHome * (1 - w) + h2hHomeWinPct * w;
    pDraw = pDraw * (1 - w) + h2hDrawPct    * w;
    pAway = pAway * (1 - w) + h2hAwayWinPct * w;
  }

  // ── Clamp to realistic ranges ─────────────────────────────────────────────
  pHome = Math.max(8,  Math.min(82, pHome));
  pDraw = Math.max(8,  Math.min(55, pDraw));
  pAway = Math.max(8,  Math.min(82, pAway));

  // ── Normalise to 100 ──────────────────────────────────────────────────────
  const sum = pHome + pDraw + pAway;
  const home = Math.round((pHome / sum) * 1000) / 10;
  const draw = Math.round((pDraw / sum) * 1000) / 10;
  // Ensure exact sum = 100.0 by computing away as remainder
  const away = Math.round((100 - home - draw) * 10) / 10;

  return { home, draw, away };
}

// ---------------------------------------------------------------------------
// Score prediction
// ---------------------------------------------------------------------------

function safeAvg(num: number, denom: number, fallback: number): number {
  return denom > 0 ? num / denom : fallback;
}

/**
 * Predict a scoreline using attack/defence strength and H2H goals.
 *
 * Expected goals per side = geometric mean of:
 *   - attacker's average goals scored (last 5)
 *   - defender's average goals conceded (last 5)
 *
 * Blended 70/30 with H2H goals-per-match when ≥ 3 meetings available.
 */
export function predictScore(
  h2h: HeadToHead | null,
  homeForm: FormRecord,
  awayForm: FormRecord,
): ScorePrediction {
  const homeGf = safeAvg(homeForm.goalsFor,      homeForm.played, 1.3);
  const homeGa = safeAvg(homeForm.goalsAgainst,  homeForm.played, 1.1);
  const awayGf = safeAvg(awayForm.goalsFor,      awayForm.played, 1.1);
  const awayGa = safeAvg(awayForm.goalsAgainst,  awayForm.played, 1.3);

  // Geometric mean: balances attack strength vs opponent defence weakness
  let homeXg = Math.sqrt(homeGf * awayGa);
  let awayXg = Math.sqrt(awayGf * homeGa);

  // Blend with H2H average
  if (h2h && h2h.aggregates.numberOfMatches >= 3) {
    const gpm = h2h.aggregates.totalGoals / h2h.aggregates.numberOfMatches;
    // Home teams historically score slightly more (≈52 / 48 split)
    const h2hHome = gpm * 0.52;
    const h2hAway = gpm * 0.48;
    homeXg = homeXg * 0.7 + h2hHome * 0.3;
    awayXg = awayXg * 0.7 + h2hAway * 0.3;
  }

  return {
    home: Math.round(Math.max(0.5, Math.min(3.5, homeXg))),
    away: Math.round(Math.max(0.5, Math.min(3.5, awayXg))),
  };
}

// ---------------------------------------------------------------------------
// Implied odds
// ---------------------------------------------------------------------------

/**
 * Convert a win probability percentage to decimal betting odds.
 * e.g. 45% → "2.22"
 */
export function toDecimalOdds(probability: number): string {
  if (probability <= 0) return '–';
  return (100 / probability).toFixed(2);
}

// ---------------------------------------------------------------------------
// Confidence level
// ---------------------------------------------------------------------------

/**
 * Estimate how confident the prediction is based on data availability.
 * High: ≥8 form matches + ≥5 H2H meetings
 * Medium: ≥4 form matches OR ≥3 H2H meetings
 * Low: insufficient data
 */
export function confidenceLevel(
  homeForm: FormRecord,
  awayForm: FormRecord,
  h2h: HeadToHead | null,
): ConfidenceLevel {
  const formData = homeForm.played + awayForm.played;
  const h2hCount = h2h?.aggregates.numberOfMatches ?? 0;
  if (formData >= 8 && h2hCount >= 5) return 'high';
  if (formData >= 4 || h2hCount >= 3) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Match result from a team's perspective
// ---------------------------------------------------------------------------

/** Returns W / D / L from `teamId`'s point of view for a finished match. */
export function teamResult(match: Match, teamId: number): 'W' | 'D' | 'L' {
  const winner = match.score.winner;
  if (!winner || winner === 'DRAW') return 'D';
  const isHome = match.homeTeam?.id === teamId;
  return (winner === 'HOME_TEAM') === isHome ? 'W' : 'L';
}
