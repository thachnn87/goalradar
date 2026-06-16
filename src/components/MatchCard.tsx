import { Match } from '@/lib/types';
import { matchPath } from '@/lib/url';
import LocalTime from '@/components/LocalTime';
// PERF-8: MatchLink = Link with prefetch + hover/touch/viewport snapshot prewarm
import MatchLink from '@/components/MatchLink';

function formatTime(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

/** Returns a short phase label for the bottom of a live card. */
function matchProgress(status: Match['status'], minute: number | null | undefined): string | null {
  if (status === 'PAUSED') return 'Half Time';
  if (status !== 'IN_PLAY' || minute == null) return null;
  if (minute <= 45) return 'First Half';
  if (minute <= 90) return 'Second Half';
  return 'Stoppage Time';
}

function StatusBadge({
  status,
  duration,
  minute,
}: {
  status:    Match['status'];
  duration?: string;
  minute?:   number | null;
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

  const map: Partial<Record<Match['status'], { text: string; className: string }>> = {
    PAUSED:    { text: 'HT',   className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
    POSTPONED: { text: 'PST',  className: 'bg-orange-500/20 text-orange-400' },
    CANCELLED: { text: 'CANC', className: 'bg-gray-700 text-gray-500' },
    SUSPENDED: { text: 'SUSP', className: 'bg-orange-500/20 text-orange-400' },
  };

  const config = map[status];
  if (!config) return null;

  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.className}`}>
      {config.text}
    </span>
  );
}

function TeamRow({
  crest,
  name,
  score,
  bold,
}: {
  crest: string;
  name: string;
  score: number | null;
  bold: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'text-white' : 'text-gray-400'}`}>
      <div className="flex items-center gap-2 min-w-0">
        {crest && (
          <img src={crest} alt="" width={20} height={20} className="object-contain shrink-0" />
        )}
        <span className="font-medium text-sm truncate">{name}</span>
      </div>
      <span className={`font-bold text-base w-5 text-right shrink-0 ${bold ? 'text-white' : 'text-gray-400'}`}>
        {score ?? '–'}
      </span>
    </div>
  );
}

export default function MatchCard({ match }: { match: Match }) {
  const { score, status } = match;
  const showScore = status === 'FINISHED' || status === 'IN_PLAY' || status === 'PAUSED';
  const homeWins = score.winner === 'HOME_TEAM';
  const awayWins = score.winner === 'AWAY_TEAM';

  // Static pre-tournament fixtures carry negative IDs (no real API record exists yet).
  // Guard: only render a navigable link when the ID is a valid positive integer.
  const isLinkable = Number.isFinite(match.id) && match.id > 0;

  const cardInner = (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all h-full${
        isLinkable ? ' hover:border-gray-700 hover:bg-gray-800/50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 truncate mr-2">{match.competition.name}</span>
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
        <p className="text-[10px] text-gray-500 mt-2 text-right">
          {matchProgress(status, match.minute)}
        </p>
      )}
    </div>
  );

  if (!isLinkable) {
    return cardInner;
  }

  return (
    <MatchLink href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)} matchId={match.id}>
      {cardInner}
    </MatchLink>
  );
}
