import type { Match } from '@/lib/types';
import type { CanonicalMatch } from '@/lib/canonical-match';
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

function effectiveStatus(m: MatchInput): Match['status'] {
  if ('status' in m && m.status) return m.status as Match['status'];
  if ('state' in m) {
    if (m.state === 'live')      return 'IN_PLAY';
    if (m.state === 'finished')  return 'FINISHED';
    if (m.state === 'cancelled') return 'CANCELLED';
  }
  return 'SCHEDULED';
}

function effectiveCompName(m: MatchInput): string {
  if ('competition' in m && (m as Match).competition?.name) return (m as Match).competition.name;
  if ('competitionCode' in m) {
    const cm = m as CanonicalMatch;
    return cm.competitionCode === 'WC' ? 'FIFA World Cup' : cm.competitionCode;
  }
  return '';
}

function formatTime(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
}

function formatDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function matchProgress(status: Match['status'], minute: number | null | undefined): string | null {
  if (status === 'PAUSED') return 'Half Time';
  if (status !== 'IN_PLAY' || minute == null) return null;
  if (minute <= 45) return 'First Half';
  if (minute <= 90) return 'Second Half';
  return 'Stoppage Time';
}

function StatusBadge({ status, duration, minute }: {
  status: Match['status']; duration?: string; minute?: number | null;
}) {
  if (status === 'FINISHED') {
    const suffix =
      duration === 'PENALTY_SHOOTOUT' ? ' (P)'
      : duration === 'EXTRA_TIME'     ? ' AET'
      : '';
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-700 text-gray-400">
        FT{suffix}
      </span>
    );
  }

  if (status === 'IN_PLAY') {
    const label = minute != null ? `${minute}'` : 'LIVE';
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        {label}
      </span>
    );
  }

  const statusMap: Partial<Record<Match['status'], { text: string; cls: string }>> = {
    PAUSED:    { text: 'HT',   cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
    POSTPONED: { text: 'PST',  cls: 'bg-orange-500/20 text-orange-400' },
    CANCELLED: { text: 'CANC', cls: 'bg-gray-700 text-gray-500' },
    SUSPENDED: { text: 'SUSP', cls: 'bg-orange-500/20 text-orange-400' },
  };
  const cfg = statusMap[status];
  if (!cfg) return null;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.cls}`}>{cfg.text}</span>;
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
  const { score } = match;
  const status = effectiveStatus(match);
  const compName = effectiveCompName(match);
  const showScore = status === 'FINISHED' || status === 'IN_PLAY' || status === 'PAUSED';
  const homeWins = score.winner === 'HOME_TEAM';
  const awayWins = score.winner === 'AWAY_TEAM';
  const isLinkable = Number.isFinite(match.id) && match.id > 0;
  const isLive = status === 'IN_PLAY' || status === 'PAUSED';

  // ──────────────────────────────────────────────────────────
  // bracket variant  (replaces BracketMatchCard in WCBracket)
  // ──────────────────────────────────────────────────────────
  if (variant === 'bracket') {
    const isGold = theme === 'gold';
    const isTbd = !match.homeTeam?.name && !match.awayTeam?.name;
    const hn = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
    const an = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';
    const hWins = score.winner === 'HOME_TEAM';
    const aWins = score.winner === 'AWAY_TEAM';

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
            {showScore ? (score.fullTime.home ?? 0) : '–'}
          </span>
        </div>

        <div className="flex items-center px-2.5">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-500 text-xs px-1.5">
            {isLive
              ? <span className="text-red-400 font-bold">LIVE</span>
              : status === 'FINISHED' ? 'FT'
              : formatDate(match.utcDate)}
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
            {showScore ? (score.fullTime.away ?? 0) : '–'}
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
        <span className="text-xs text-gray-500 w-16 shrink-0">{formatDate(match.utcDate)}</span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="text-white text-sm font-medium truncate text-right">{hn}</span>
          {match.homeTeam?.crest && (
            <img src={match.homeTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />
          )}
        </div>
        <div className="text-center shrink-0 w-16">
          <span className="text-white font-black tabular-nums text-sm">
            {score.fullTime.home ?? '–'} – {score.fullTime.away ?? '–'}
          </span>
          {(score.winner === 'HOME_TEAM' || score.winner === 'AWAY_TEAM' || score.winner === 'DRAW') && (
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
              <span className="text-xs text-gray-400">{formatTime(match.utcDate)} UTC</span>
              <LocalTime utcDate={match.utcDate} variant="badge" />
            </div>
          )}
          <StatusBadge status={status} duration={score.duration} minute={match.minute} />
        </div>
      </div>
      <div className="space-y-2">
        <TeamRow
          crest={match.homeTeam?.crest ?? ''}
          name={match.homeTeam?.shortName || match.homeTeam?.name || 'TBD'}
          score={showScore ? score.fullTime.home : null}
          bold={status === 'FINISHED' ? homeWins : true}
        />
        <TeamRow
          crest={match.awayTeam?.crest ?? ''}
          name={match.awayTeam?.shortName || match.awayTeam?.name || 'TBD'}
          score={showScore ? score.fullTime.away : null}
          bold={status === 'FINISHED' ? awayWins : true}
        />
      </div>
      {matchProgress(status, match.minute) && (
        <p className="text-xs text-gray-500 mt-2 text-right">
          {matchProgress(status, match.minute)}
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
