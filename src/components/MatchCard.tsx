import type { Match } from '@/lib/types';
import type { CanonicalMatch } from '@/lib/canonical-match';
import { deriveMatchDisplay, type MatchDisplay } from '@/lib/match-display';
import { matchPath } from '@/lib/url';
import LocalTime from '@/components/LocalTime';
import MatchLink from '@/components/MatchLink';

type MatchInput = Match | CanonicalMatch;

export type MatchCardVariant = 'medium' | 'bracket' | 'result';

export interface MatchCardProps {
  match: MatchInput;
  variant?: MatchCardVariant;
  theme?: 'default' | 'gold' | 'bronze';
  className?: string;
}

/** Normalize MatchInput → Match for deriveMatchDisplay.
 *  CanonicalMatch uses `state` instead of `status` — we coerce to the Match shape. */
function toMatch(m: MatchInput): Match {
  if ('status' in m && m.status) return m as Match;
  // CanonicalMatch: map `state` → `status`
  const stateMap = { live: 'IN_PLAY', finished: 'FINISHED', scheduled: 'SCHEDULED', cancelled: 'POSTPONED' } as const;
  const state = (m as CanonicalMatch).state;
  return { ...m, status: stateMap[state] ?? 'SCHEDULED' } as unknown as Match;
}

function effectiveCompName(m: MatchInput): string {
  if ('competition' in m && (m as Match).competition?.name) return (m as Match).competition.name;
  if ('competitionCode' in m) {
    const cm = m as CanonicalMatch;
    return cm.competitionCode === 'WC' ? 'FIFA World Cup' : cm.competitionCode;
  }
  return '';
}

function matchProgressLabel(display: MatchDisplay): string | null {
  if (display.clockLabel === 'HT') return 'Half Time';
  if (!display.showLiveBadge || display.clockLabel == null) return null;
  const min = parseInt(display.clockLabel, 10);
  if (isNaN(min)) return null;
  if (min <= 45) return 'First Half';
  if (min <= 90) return 'Second Half';
  return 'Stoppage Time';
}

function StatusBadge({ display }: { display: MatchDisplay }) {
  const { badgeStyle, statusLabel } = display;
  if (!badgeStyle) return null;

  if (badgeStyle === 'live') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        {statusLabel}
      </span>
    );
  }

  const clsMap: Record<NonNullable<typeof badgeStyle>, string> = {
    finished:  'bg-gray-700 text-gray-400',
    paused:    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    postponed: 'bg-orange-500/20 text-orange-400',
    cancelled: 'bg-gray-700 text-gray-500',
    suspended: 'bg-orange-500/20 text-orange-400',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${clsMap[badgeStyle]}`}>
      {statusLabel}
    </span>
  );
}

function TeamRow({ crest, name, score, bold }: {
  crest: string; name: string; score: number | null; bold: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'text-white' : 'text-gray-400'}`}>
      <div className="flex items-center gap-2 min-w-0">
        {crest && (
          <img src={crest} alt="" width={20} height={20} className="object-contain shrink-0" />
        )}
        <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-[160px]">{name}</span>
      </div>
      <span className={`font-bold text-base w-5 text-right shrink-0 ${bold ? 'text-white' : 'text-gray-400'}`}>
        {score ?? '–'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — for Suspense fallbacks
// ---------------------------------------------------------------------------

export function MatchCardSkeleton() {
  return (
    <div className="bg-gray-950 border border-gray-800/60 rounded-xl p-4 h-full animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 bg-gray-800 rounded" />
        <div className="h-5 w-10 bg-gray-800 rounded" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-gray-800 rounded" />
          <div className="h-4 w-5 bg-gray-800 rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-gray-800 rounded" />
          <div className="h-4 w-5 bg-gray-800 rounded" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function MatchCard({
  match,
  variant = 'medium',
  theme = 'default',
  className = '',
}: MatchCardProps) {
  const display   = deriveMatchDisplay(toMatch(match));
  const compName  = effectiveCompName(match);
  const isLinkable = Number.isFinite(match.id) && match.id > 0;
  const { showScore, showLiveBadge: isLive, winner } = display;

  // ──────────────────────────────────────────────────────────
  // bracket variant  (replaces BracketMatchCard in WCBracket)
  // ──────────────────────────────────────────────────────────
  if (variant === 'bracket') {
    const isGold = theme === 'gold';
    const isTbd = !match.homeTeam?.name && !match.awayTeam?.name;
    const hn = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
    const an = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';
    const hWins = winner === 'home';
    const aWins = winner === 'away';

    const bracketCls = [
      'flex flex-col justify-between rounded-lg border overflow-hidden h-[68px] w-full',
      isLinkable ? 'transition-[border-color,background-color] duration-150' : 'cursor-default',
      isGold
        ? `bg-gradient-to-br from-yellow-950/60 to-gray-900 border-yellow-700/40${isLinkable ? ' hover:border-yellow-600/60' : ''}`
        : `bg-gray-900 border-gray-700${isLinkable ? ' hover:border-gray-500' : ''}`,
      isLive ? '!border-red-500/60' : '',
      className,
    ].filter(Boolean).join(' ');

    const bracketInner = (
      <>
        <div className={`flex items-center justify-between px-2.5 py-1.5 ${hWins ? 'bg-gray-800/60' : ''}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            {match.homeTeam?.crest && (
              <img src={match.homeTeam.crest} alt="" width={14} height={14} className="object-contain shrink-0" />
            )}
            <span className={`text-xs truncate font-medium ${isTbd ? 'text-gray-500 italic' : hWins ? 'text-white font-bold' : 'text-gray-300'}`}>
              {hn}
            </span>
          </div>
          <span className={`text-xs font-bold tabular-nums ml-1 ${hWins ? 'text-white' : 'text-gray-500'}`}>
            {showScore ? (display.homeScore ?? '–') : '–'}
          </span>
        </div>

        <div className="flex items-center px-2.5">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-500 text-xs px-1.5">
            {isLive
              ? <span className="text-red-400 font-bold">LIVE</span>
              : display.badgeStyle === 'finished' ? 'FT'
              : display.displayDate}
          </span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className={`flex items-center justify-between px-2.5 py-1.5 ${aWins ? 'bg-gray-800/60' : ''}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            {match.awayTeam?.crest && (
              <img src={match.awayTeam.crest} alt="" width={14} height={14} className="object-contain shrink-0" />
            )}
            <span className={`text-xs truncate font-medium ${isTbd ? 'text-gray-500 italic' : aWins ? 'text-white font-bold' : 'text-gray-300'}`}>
              {an}
            </span>
          </div>
          <span className={`text-xs font-bold tabular-nums ml-1 ${aWins ? 'text-white' : 'text-gray-500'}`}>
            {showScore ? (display.awayScore ?? '–') : '–'}
          </span>
        </div>
      </>
    );

    if (isLinkable) {
      return (
        <MatchLink
          href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
          matchId={match.id}
          className={`${bracketCls} focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none`}
        >
          {bracketInner}
        </MatchLink>
      );
    }
    return <div className={bracketCls}>{bracketInner}</div>;
  }

  // ──────────────────────────────────────────────────────────
  // result variant  (replaces ResultRow in Hub)
  // ──────────────────────────────────────────────────────────
  if (variant === 'result') {
    const hn = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
    const an = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';

    const resultInner = (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${className}`}>
        <span className="text-xs text-gray-500 w-16 shrink-0">{display.displayDate}</span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="text-white text-sm font-medium truncate text-right">{hn}</span>
          {match.homeTeam?.crest && (
            <img src={match.homeTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />
          )}
        </div>
        <div className="text-center shrink-0 w-16">
          <span className="text-white font-black tabular-nums text-sm">
            {display.homeScore ?? '–'} – {display.awayScore ?? '–'}
          </span>
          {winner !== null && (
            <p className="text-xs text-gray-500">FT</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {match.awayTeam?.crest && (
            <img src={match.awayTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />
          )}
          <span className="text-white text-sm font-medium truncate">{an}</span>
        </div>
      </div>
    );

    if (isLinkable) {
      return (
        <MatchLink
          href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
          matchId={match.id}
          className="block rounded-xl hover:bg-gray-800/60 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none"
        >
          {resultInner}
        </MatchLink>
      );
    }
    return resultInner;
  }

  // ──────────────────────────────────────────────────────────
  // medium variant  (default)
  // ──────────────────────────────────────────────────────────
  const cardInner = (
    <div
      className={[
        'bg-gray-950 border rounded-xl p-4 h-full',
        'transition-[border-color,background-color,box-shadow,transform] duration-150',
        isLive ? 'border-red-500/30 shadow-wc-live' : 'border-gray-800/60',
        isLinkable ? 'hover:border-gray-700 hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-wc-raised' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 truncate mr-2">{compName}</span>
        <div className="flex items-center gap-2 shrink-0">
          {!showScore && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-gray-400">{display.displayTime} UTC</span>
              <LocalTime utcDate={match.utcDate} variant="badge" />
            </div>
          )}
          <StatusBadge display={display} />
        </div>
      </div>
      <div className="space-y-2">
        <TeamRow
          crest={match.homeTeam?.crest ?? ''}
          name={match.homeTeam?.shortName || match.homeTeam?.name || 'TBD'}
          score={display.homeScore}
          bold={display.badgeStyle === 'finished' ? winner === 'home' : true}
        />
        <TeamRow
          crest={match.awayTeam?.crest ?? ''}
          name={match.awayTeam?.shortName || match.awayTeam?.name || 'TBD'}
          score={display.awayScore}
          bold={display.badgeStyle === 'finished' ? winner === 'away' : true}
        />
      </div>
      {matchProgressLabel(display) && (
        <p className="text-xs text-gray-500 mt-2 text-right">
          {matchProgressLabel(display)}
        </p>
      )}
    </div>
  );

  if (!isLinkable) return cardInner;

  return (
    <MatchLink
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
      matchId={match.id}
      className="block rounded-xl focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none"
    >
      {cardInner}
    </MatchLink>
  );
}
