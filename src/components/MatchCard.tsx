import Link from 'next/link';
import { Match } from '@/lib/types';
import { matchPath } from '@/lib/url';
import LocalTime from '@/components/LocalTime';

function formatTime(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function StatusBadge({
  status,
  duration,
}: {
  status:    Match['status'];
  duration?: string;
}) {
  const map: Partial<Record<Match['status'], { text: string; className: string }>> = {
    IN_PLAY:   { text: 'LIVE', className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
    PAUSED:    { text: 'HT',   className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
    POSTPONED: { text: 'PST',  className: 'bg-orange-500/20 text-orange-400' },
    CANCELLED: { text: 'CANC', className: 'bg-gray-700 text-gray-500' },
    SUSPENDED: { text: 'SUSP', className: 'bg-orange-500/20 text-orange-400' },
  };

  if (status === 'FINISHED') {
    // Show match duration suffix when the game went beyond 90 minutes.
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

  return (
    <Link href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 hover:bg-gray-800/50 transition-all h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 truncate mr-2">{match.competition.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            {!showScore && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-xs text-gray-400">{formatTime(match.utcDate)} UTC</span>
                <LocalTime utcDate={match.utcDate} variant="badge" />
              </div>
            )}
            <StatusBadge status={status} duration={score.duration} />
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
      </div>
    </Link>
  );
}
