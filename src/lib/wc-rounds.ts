/**
 * wc-rounds.ts — GROWTH-2A Feature 1
 *
 * Config for the six knockout round landing pages:
 *   /world-cup-2026/round-of-32 … /world-cup-2026/final
 *
 * Date ranges are derived from the bundled WC_KNOCKOUT_SLOTS schedule
 * (single source of truth — no hardcoded dates that can drift).
 */

import { WC_KNOCKOUT_SLOTS, type WCKnockoutSlot } from './wc-fixtures';

export type WCRoundStage =
  | 'LAST_32' | 'LAST_16' | 'QUARTER_FINALS'
  | 'SEMI_FINALS' | 'THIRD_PLACE' | 'FINAL';

export interface WCRoundConfig {
  slug:       string;      // URL segment under /world-cup-2026/
  stage:      WCRoundStage; // football-data.org match.stage value
  label:      string;      // display name
  short:      string;      // compact label (pills)
  icon:       string;      // emoji for hero / nav
  matchCount: number;      // expected fixtures in this round
  /** Hook line used in meta description + intro paragraph. */
  blurb:      string;
}

export const WC_ROUNDS: WCRoundConfig[] = [
  {
    slug: 'round-of-32', stage: 'LAST_32', label: 'Round of 32', short: 'R32', icon: '🎯',
    matchCount: 16,
    blurb: 'The knockout stage begins — 32 teams, one chance. Group winners, runners-up and the best third-placed sides enter single-elimination play.',
  },
  {
    slug: 'round-of-16', stage: 'LAST_16', label: 'Round of 16', short: 'R16', icon: '⚔️',
    matchCount: 8,
    blurb: 'Sixteen survivors battle for a quarter-final place. Every match is win or go home.',
  },
  {
    slug: 'quarter-finals', stage: 'QUARTER_FINALS', label: 'Quarter-finals', short: 'QF', icon: '🔥',
    matchCount: 4,
    blurb: 'Eight teams, four matches, and a place in the World Cup semi-finals on the line.',
  },
  {
    slug: 'semi-finals', stage: 'SEMI_FINALS', label: 'Semi-finals', short: 'SF', icon: '🌟',
    matchCount: 2,
    blurb: 'The last four. Two matches decide who plays for the trophy at MetLife Stadium.',
  },
  {
    slug: 'third-place', stage: 'THIRD_PLACE', label: 'Third Place Play-off', short: '3rd', icon: '🥉',
    matchCount: 1,
    blurb: 'The bronze-medal match — the semi-final losers meet for third place.',
  },
  {
    slug: 'final', stage: 'FINAL', label: 'Final', short: 'F', icon: '🏆',
    matchCount: 1,
    blurb: 'The FIFA World Cup 2026 Final at MetLife Stadium, New Jersey — the biggest match in football.',
  },
];

export function getRoundBySlug(slug: string): WCRoundConfig | undefined {
  return WC_ROUNDS.find((r) => r.slug === slug);
}

/** Static schedule slots for a round (offline fallback + date derivation). */
export function getRoundSlots(stage: WCRoundStage): WCKnockoutSlot[] {
  return WC_KNOCKOUT_SLOTS.filter((s) => s.round === stage);
}

/** Human-readable UTC date range for a round, e.g. "28 June – 3 July 2026". */
export function getRoundDateRange(stage: WCRoundStage): string {
  const dates = getRoundSlots(stage).map((s) => s.utcDate).sort();
  if (dates.length === 0) return 'Summer 2026';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const first = fmt(dates[0]);
  const last  = fmt(dates[dates.length - 1]);
  return first === last ? `${first} 2026` : `${first} – ${last} 2026`;
}

/** ISO start/end dates for JSON-LD. */
export function getRoundIsoRange(stage: WCRoundStage): { start: string; end: string } {
  const dates = getRoundSlots(stage).map((s) => s.utcDate).sort();
  return {
    start: dates[0] ?? '2026-06-28T00:00:00Z',
    end:   dates[dates.length - 1] ?? '2026-07-19T00:00:00Z',
  };
}
