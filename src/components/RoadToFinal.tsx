/**
 * RoadToFinal — DATA-18WC.EXPERIENCE.V2
 *
 * Shows the remaining path to the World Cup Final from the current match's stage.
 * Used on WC knockout match pages to answer: "If they win this, what's next?"
 *
 * Example (Round of 32 winner):
 *   R32 [current] → R16 → QF → SF → Final
 *
 * Data: match.stage, match.score.winner, team names — all from MatchDetail (snapshot).
 * Does NOT fetch. Receives MatchDetail as prop.
 *
 * Only renders for WC knockout matches (WC_KNOCKOUT matchType).
 * Completely absent for group stage, non-WC matches, or cancelled matches.
 */

import Link from 'next/link';
import type { MatchDetail } from '@/lib/types';

// ---------------------------------------------------------------------------
// Stage sequence
// ---------------------------------------------------------------------------

const KNOCKOUT_PATH: Array<{ stage: string; label: string; short: string; href: string }> = [
  { stage: 'LAST_32',        label: 'Round of 32',  short: 'R32',   href: '/world-cup-2026/round-of-32' },
  { stage: 'LAST_16',        label: 'Round of 16',  short: 'R16',   href: '/world-cup-2026/round-of-16' },
  { stage: 'QUARTER_FINALS', label: 'Quarter-final', short: 'QF',  href: '/world-cup-2026/quarter-finals' },
  { stage: 'SEMI_FINALS',    label: 'Semi-final',   short: 'SF',    href: '/world-cup-2026/semi-finals' },
  { stage: 'FINAL',          label: 'Final',        short: 'Final', href: '/world-cup-2026/final' },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function RoadToFinal({ match }: { match: MatchDetail }) {
  const isWC       = match.competition?.code === 'WC';
  const hasGroup   = !!match.group;
  const stageKey   = match.stage ?? '';
  const isGroupStage = hasGroup || stageKey === 'GROUP_STAGE';
  const isKnockout = isWC && !isGroupStage && !!stageKey;

  if (!isKnockout || match.status === 'CANCELLED') return null;
  if (stageKey === 'THIRD_PLACE') return null;

  const currentIdx = KNOCKOUT_PATH.findIndex((s) => s.stage === stageKey);
  if (currentIdx === -1) return null;

  const isFinished = match.status === 'FINISHED';
  const winner =
    match.score.winner === 'HOME_TEAM' ? match.homeTeam
    : match.score.winner === 'AWAY_TEAM' ? match.awayTeam
    : null;

  const advancingTeam = isFinished ? winner : null;
  const homeShort = match.homeTeam.shortName || match.homeTeam.name;
  const awayShort = match.awayTeam.shortName || match.awayTeam.name;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
        Road to the Final
      </h2>

      {advancingTeam && (
        <p className="text-sm text-green-400 font-semibold mb-4">
          {advancingTeam.shortName || advancingTeam.name} advance
          {currentIdx < KNOCKOUT_PATH.length - 1
            ? ` to the ${KNOCKOUT_PATH[currentIdx + 1].label}`
            : ' — World Cup champions!'}
        </p>
      )}

      {!isFinished && (
        <p className="text-sm text-gray-400 mb-4">
          {homeShort} vs {awayShort} —{' '}
          {stageKey === 'FINAL'
            ? 'One match decides the World Cup champion.'
            : `Winner advances to the ${KNOCKOUT_PATH[currentIdx + 1]?.label ?? 'next round'}.`}
        </p>
      )}

      {/* Stage path */}
      <div className="flex items-center gap-1 flex-wrap">
        {KNOCKOUT_PATH.map((step, i) => {
          const isCurrent  = i === currentIdx;
          const isCompleted = i < currentIdx;
          const isFuture   = i > currentIdx;

          const node = (
            <span
              className={`
                px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap
                ${isCurrent
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : isCompleted
                    ? 'bg-green-500/15 border-green-500/30 text-green-400'
                    : 'bg-gray-800/60 border-gray-700 text-gray-600'}
              `}
            >
              {step.short}
              {isCurrent && ' ←'}
            </span>
          );

          return (
            <span key={step.stage} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-gray-700 text-xs" aria-hidden="true">→</span>
              )}
              {!isFuture ? (
                <Link href={step.href} className="hover:opacity-80 transition-opacity">
                  {node}
                </Link>
              ) : node}
            </span>
          );
        })}
      </div>
    </div>
  );
}
