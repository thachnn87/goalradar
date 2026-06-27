/**
 * KnockoutJourney — DATA-18WC.EXPERIENCE.V2
 *
 * Shows a team's progression through the WC 2026 knockout stages:
 *   Group → R32 → R16 → QF → SF → Final
 *
 * Each completed stage shows the score and opponent.
 * Future stages are shown as grayed-out slots.
 * Clicking a completed match navigates to its match page.
 *
 * Data: KnockoutViewModel via getTeamKnockoutPath() — no new fetches.
 * Receives matches[] and teamId as props.
 *
 * Reuses: matchPath from @/lib/url, Match from @/lib/types
 *         getTeamKnockoutPath from @/lib/knockout-vm (caller responsibility)
 */

import Link from 'next/link';
import type { Match } from '@/lib/types';
import { matchPath } from '@/lib/url';
import type { KnockoutStage } from '@/lib/knockout-vm';
import { ALL_KNOCKOUT_STAGES } from '@/lib/knockout-vm';

// ---------------------------------------------------------------------------
// Stage config
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  LAST_32:        'R32',
  LAST_16:        'R16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS:    'SF',
  THIRD_PLACE:    '3rd',
  FINAL:          'Final',
};

const STAGE_FULL: Record<string, string> = {
  LAST_32:        'Round of 32',
  LAST_16:        'Round of 16',
  QUARTER_FINALS: 'Quarter-final',
  SEMI_FINALS:    'Semi-final',
  THIRD_PLACE:    'Third Place',
  FINAL:          'Final',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isWinner(match: Match, teamId: number): boolean {
  if (match.status !== 'FINISHED') return false;
  if (match.score.winner === 'HOME_TEAM') return match.homeTeam?.id === teamId;
  if (match.score.winner === 'AWAY_TEAM') return match.awayTeam?.id === teamId;
  return false;
}

function opponent(match: Match, teamId: number): string {
  const opp = match.homeTeam?.id === teamId ? match.awayTeam : match.homeTeam;
  return opp?.shortName || opp?.name || 'TBD';
}

function scoreFor(match: Match, teamId: number): string {
  const isHome = match.homeTeam?.id === teamId;
  const h = match.score.fullTime.home ?? 0;
  const a = match.score.fullTime.away ?? 0;
  return isHome ? `${h}–${a}` : `${a}–${h}`;
}

// ---------------------------------------------------------------------------
// Stage node
// ---------------------------------------------------------------------------

function StageNode({
  stage,
  match,
  teamId,
  isLast,
}: {
  stage:  KnockoutStage;
  match:  Match | null;
  teamId: number;
  isLast: boolean;
}) {
  const label = STAGE_LABELS[stage] ?? stage;
  const full  = STAGE_FULL[stage]  ?? stage;

  const isFinished = match?.status === 'FINISHED';
  const isLive     = match?.status === 'IN_PLAY' || match?.status === 'PAUSED';
  const won        = match ? isWinner(match, teamId) : false;
  const opp        = match ? opponent(match, teamId) : null;
  const score      = isFinished && match ? scoreFor(match, teamId) : null;

  const nodeBase = `
    flex flex-col items-center gap-1 relative
    ${isLast ? '' : 'flex-1'}
  `;

  // Connector line (after node, except last)
  const connector = !isLast ? (
    <div className={`absolute top-4 left-1/2 w-full h-px ${
      isFinished ? (won ? 'bg-green-600/60' : 'bg-red-600/40') : 'bg-gray-700'
    }`} style={{ transform: 'translateX(50%)' }} aria-hidden="true" />
  ) : null;

  const dot = (
    <div className={`
      relative z-10 w-8 h-8 rounded-full flex items-center justify-center
      text-[10px] font-black border
      ${!match
        ? 'bg-gray-900 border-gray-700 text-gray-600'
        : isLive
          ? 'bg-red-500/20 border-red-500/60 text-red-400 animate-pulse'
          : won
            ? 'bg-green-500/20 border-green-500/50 text-green-400'
            : 'bg-red-950/30 border-red-600/40 text-red-500'}
    `}>
      {isLive ? '⚡' : match ? (won ? '✓' : '✗') : label}
    </div>
  );

  const body = (
    <div className="text-center min-w-0">
      <p className={`text-[10px] font-semibold ${!match ? 'text-gray-600' : 'text-gray-400'}`}>
        {full}
      </p>
      {opp && (
        <p className="text-[10px] text-gray-500 leading-tight truncate max-w-[60px]">{opp}</p>
      )}
      {score && (
        <p className={`text-xs font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>{score}</p>
      )}
    </div>
  );

  if (match && (isFinished || isLive)) {
    return (
      <div className={nodeBase}>
        {connector}
        <Link
          href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
          className="flex flex-col items-center gap-1 group focus-visible:outline-none"
          title={`${full}: ${opp} ${score ?? ''}`}
        >
          <div className="group-hover:scale-110 transition-transform duration-150">{dot}</div>
          {body}
        </Link>
      </div>
    );
  }

  return (
    <div className={nodeBase}>
      {connector}
      {dot}
      {body}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function KnockoutJourney({
  matches,
  teamId,
  teamName,
}: {
  /** Result of getTeamKnockoutPath(vm, teamId) — pass from server component */
  matches:  Match[];
  teamId:   number;
  teamName: string;
}) {
  if (!teamId) return null;

  // Map stage → match (if team played it)
  const byStage = new Map<string, Match>();
  for (const m of matches) {
    byStage.set(m.stage, m);
  }

  // Only show THIRD_PLACE if team is actually in that match; always show main path
  const stages: KnockoutStage[] = ALL_KNOCKOUT_STAGES.filter((s) => {
    if (s === 'THIRD_PLACE') return byStage.has('THIRD_PLACE');
    return true;
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
        {teamName}'s World Cup Journey
      </h2>
      <div className="flex items-start gap-2 overflow-x-auto pb-1">
        {stages.map((stage, i) => (
          <StageNode
            key={stage}
            stage={stage}
            match={byStage.get(stage) ?? null}
            teamId={teamId}
            isLast={i === stages.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
