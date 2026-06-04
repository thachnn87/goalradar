import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getMatchDetail } from '@/lib/api';
import type { Goal, Booking, Substitution, MatchDetail } from '@/lib/types';

export const revalidate = 60;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;

  try {
    const match = await getMatchDetail(id);
    const home = match.homeTeam.name;
    const away = match.awayTeam.name;

    const title = `${home} vs ${away} Live Score | GoalRadar`;
    const description = `Follow ${home} vs ${away} live score, lineups, stats and match events.`;

    return {
      title,
      description,
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary_large_image', title, description },
    };
  } catch {
    return {
      title: 'Match Details | GoalRadar',
      description: 'Football live scores and match details.',
    };
  }
}

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

function GoalRow({ goal, homeTeamId }: { goal: Goal; homeTeamId: number }) {
  const isHome = goal.team?.id === homeTeamId;
  return (
    <div className={`flex items-start gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
      <span className="text-xs text-gray-500 w-8 shrink-0 mt-0.5 text-center">
        {goal.minute}{goal.injuryTime ? `+${goal.injuryTime}` : ''}'
      </span>
      <span className="text-lg leading-none">⚽</span>
      <div className={`flex flex-col ${isHome ? '' : 'items-end'}`}>
        <span className="text-white text-sm font-medium">{goal.scorer?.name}</span>
        {goal.assist && (
          <span className="text-gray-500 text-xs">assist: {goal.assist.name}</span>
        )}
      </div>
    </div>
  );
}

function BookingRow({ booking, homeTeamId }: { booking: Booking; homeTeamId: number }) {
  const isHome = booking.team?.id === homeTeamId;
  const icon = booking.card === 'YELLOW' ? '🟨' : booking.card === 'YELLOW_RED' ? '🟧' : '🟥';
  return (
    <div className={`flex items-center gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
      <span className="text-xs text-gray-500 w-8 shrink-0 text-center">{booking.minute}'</span>
      <span>{icon}</span>
      <span className="text-white text-sm">{booking.player?.name}</span>
    </div>
  );
}

function SubRow({ sub, homeTeamId }: { sub: Substitution; homeTeamId: number }) {
  const isHome = sub.team?.id === homeTeamId;
  return (
    <div className={`flex items-start gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
      <span className="text-xs text-gray-500 w-8 shrink-0 mt-0.5 text-center">{sub.minute}'</span>
      <span className="text-lg leading-none">🔄</span>
      <div className={`flex flex-col text-sm ${isHome ? '' : 'items-end'}`}>
        <span className="text-green-400">{sub.playerIn?.name}</span>
        <span className="text-gray-500">{sub.playerOut?.name}</span>
      </div>
    </div>
  );
}

export default async function MatchDetailPage({ params }: Params) {
  const { id } = await params;

  let match: MatchDetail;
  try {
    match = await getMatchDetail(id);
  } catch {
    notFound();
  }

  const { score, homeTeam, awayTeam, status } = match;

  const showScore = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(status);

  const allGoals = [...(match.goals ?? [])].sort((a, b) => a.minute - b.minute);
  const allBookings = [...(match.bookings ?? [])].sort((a, b) => a.minute - b.minute);
  const allSubs = [...(match.substitutions ?? [])].sort((a, b) => a.minute - b.minute);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${homeTeam.name} vs ${awayTeam.name}`,
    sport: 'Football',
    startDate: match.utcDate,
    eventStatus: status === 'FINISHED'
      ? 'https://schema.org/EventScheduled'
      : 'https://schema.org/EventScheduled',
    competitor: [
      { '@type': 'SportsTeam', name: homeTeam.name, image: homeTeam.crest },
      { '@type': 'SportsTeam', name: awayTeam.name, image: awayTeam.crest },
    ],
    location: {
      '@type': 'Place',
      name: match.competition?.name ?? 'Football Stadium',
    },
    organizer: {
      '@type': 'Organization',
      name: match.competition?.name ?? 'Football',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="max-w-2xl mx-auto space-y-4 pb-8">
        <Link
          href="/schedule"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors w-fit"
        >
          ← Back to Schedule
        </Link>

        {/* Score card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              {match.competition?.name}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatMatchDate(match.utcDate)}
            </p>
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
                  alt={homeTeam.name}
                  width={64}
                  height={64}
                  className="object-contain mx-auto mb-3"
                />
              )}
              <p className="font-bold text-white text-sm sm:text-base leading-tight">
                {homeTeam.shortName || homeTeam.name}
              </p>
            </div>

            {/* Score */}
            <div className="text-center">
              {showScore ? (
                <>
                  <div className="text-4xl sm:text-5xl font-black text-white tabular-nums">
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
                  alt={awayTeam.name}
                  width={64}
                  height={64}
                  className="object-contain mx-auto mb-3"
                />
              )}
              <p className="font-bold text-white text-sm sm:text-base leading-tight">
                {awayTeam.shortName || awayTeam.name}
              </p>
            </div>
          </div>
        </div>

        {/* Team labels for events */}
        {(allGoals.length > 0 || allBookings.length > 0 || allSubs.length > 0) && (
          <div className="grid grid-cols-2 text-xs text-gray-500 font-medium uppercase tracking-wider px-1">
            <span>{homeTeam.shortName || homeTeam.name}</span>
            <span className="text-right">{awayTeam.shortName || awayTeam.name}</span>
          </div>
        )}

        {/* Goals */}
        {allGoals.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Goals
            </h2>
            <div className="space-y-3">
              {allGoals.map((goal: Goal, i) => (
                <GoalRow key={i} goal={goal} homeTeamId={homeTeam.id} />
              ))}
            </div>
          </div>
        )}

        {/* Bookings */}
        {allBookings.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Bookings
            </h2>
            <div className="space-y-3">
              {allBookings.map((booking: Booking, i) => (
                <BookingRow key={i} booking={booking} homeTeamId={homeTeam.id} />
              ))}
            </div>
          </div>
        )}

        {/* Substitutions */}
        {allSubs.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Substitutions
            </h2>
            <div className="space-y-3">
              {allSubs.map((sub: Substitution, i) => (
                <SubRow key={i} sub={sub} homeTeamId={homeTeam.id} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
