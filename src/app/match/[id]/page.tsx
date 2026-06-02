import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMatchDetail } from '@/lib/api';
import { Goal, Booking, MatchDetail } from '@/lib/types';

export const revalidate = 60;

function formatMatchDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function StatusPill({ status }: { status: MatchDetail['status'] }) {
  if (status === 'IN_PLAY') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-sm font-bold">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        LIVE
      </span>
    );
  }
  if (status === 'PAUSED') {
    return (
      <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-sm font-bold">
        HALF TIME
      </span>
    );
  }
  if (status === 'FINISHED') {
    return (
      <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm font-bold">
        FULL TIME
      </span>
    );
  }
  if (status === 'SCHEDULED' || status === 'TIMED') {
    return (
      <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-sm font-bold">
        UPCOMING
      </span>
    );
  }
  return null;
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let match: MatchDetail;

  try {
    match = await getMatchDetail(id);
  } catch {
    notFound();
  }

  const { score, homeTeam, awayTeam, status } = match;
  const showScore = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(status);
  const homeGoals = match.goals?.filter((g) => g.team?.id === homeTeam.id) ?? [];
  const awayGoals = match.goals?.filter((g) => g.team?.id === awayTeam.id) ?? [];
  const allGoals = [...(match.goals ?? [])].sort((a, b) => a.minute - b.minute);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/schedule"
        className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors w-fit"
      >
        ← Back to Schedule
      </Link>

      {/* Score card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
        <div className="text-center mb-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            {match.competition?.name}
          </p>
          <p className="text-xs text-gray-500 mt-1">{formatMatchDate(match.utcDate)}</p>
        </div>

        <div className="flex justify-center mb-6">
          <StatusPill status={status} />
        </div>

        <div className="grid grid-cols-3 items-center gap-4">
          {/* Home */}
          <div className="text-center">
            {homeTeam.crest && (
              <img
                src={homeTeam.crest}
                alt=""
                width={64}
                height={64}
                className="object-contain mx-auto mb-2"
              />
            )}
            <p className="font-bold text-white text-sm sm:text-base">
              {homeTeam.shortName || homeTeam.name}
            </p>
            {homeGoals.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {homeGoals.map((g) => g.scorer?.name?.split(' ').pop()).join(', ')}
              </p>
            )}
          </div>

          {/* Score */}
          <div className="text-center">
            {showScore ? (
              <>
                <div className="text-5xl font-black text-white tabular-nums">
                  {score.fullTime.home ?? 0}
                  <span className="text-gray-600 mx-1">–</span>
                  {score.fullTime.away ?? 0}
                </div>
                {score.halfTime.home !== null && (
                  <p className="text-xs text-gray-500 mt-2">
                    HT {score.halfTime.home} – {score.halfTime.away}
                  </p>
                )}
              </>
            ) : (
              <div className="text-3xl font-bold text-gray-600">vs</div>
            )}
          </div>

          {/* Away */}
          <div className="text-center">
            {awayTeam.crest && (
              <img
                src={awayTeam.crest}
                alt=""
                width={64}
                height={64}
                className="object-contain mx-auto mb-2"
              />
            )}
            <p className="font-bold text-white text-sm sm:text-base">
              {awayTeam.shortName || awayTeam.name}
            </p>
            {awayGoals.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {awayGoals.map((g) => g.scorer?.name?.split(' ').pop()).join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Goals */}
      {allGoals.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Goals
          </h2>
          <div className="space-y-3">
            {allGoals.map((goal: Goal, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-8 text-right shrink-0">
                  {goal.minute}&apos;
                </span>
                <span className="text-base">⚽</span>
                <div className="flex-1 min-w-0">
                  <span className="text-white font-medium">{goal.scorer?.name}</span>
                  {goal.assist && (
                    <span className="text-gray-500 text-xs ml-2">
                      (assist: {goal.assist.name})
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {goal.team?.shortName || goal.team?.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookings */}
      {match.bookings?.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Bookings
          </h2>
          <div className="space-y-3">
            {match.bookings.map((booking: Booking, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-8 text-right shrink-0">
                  {booking.minute}&apos;
                </span>
                <span className="text-base">
                  {booking.card === 'YELLOW' ? '🟨' : '🟥'}
                </span>
                <span className="text-white flex-1">{booking.player?.name}</span>
                <span className="text-xs text-gray-500 shrink-0">
                  {booking.team?.shortName || booking.team?.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match info */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Match Info
        </h2>
        <dl className="space-y-2 text-sm">
          {match.matchday && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Matchday</dt>
              <dd className="text-white">{match.matchday}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">Stage</dt>
            <dd className="text-white capitalize">{match.stage.replace(/_/g, ' ').toLowerCase()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Competition</dt>
            <dd className="text-white">{match.competition?.name}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
