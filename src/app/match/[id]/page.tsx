import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getMatchDetail } from '@/lib/api';
import { Goal, Booking, MatchDetail } from '@/lib/types';

export const revalidate = 60;

export async function generateMetadata(
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
): Promise<Metadata> {
  const { id } = await params;

  try {
    const match = await getMatchDetail(id);

    const home =
      match.homeTeam.shortName ||
      match.homeTeam.name;

    const away =
      match.awayTeam.shortName ||
      match.awayTeam.name;

    const title =
      `${home} vs ${away} Live Score | GoalRadar`;

    const description =
      `${home} vs ${away} live score, goals, cards, statistics and full match result.`;

    return {
      title,
      description,

      openGraph: {
        title,
        description,
        type: 'website',
      },

      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return {
      title: 'Match Details | GoalRadar',
      description:
        'Football live scores and match details.',
    };
  }
}

function formatMatchDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString(
    'en-GB',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }
  );
}

function StatusPill({
  status,
}: {
  status: MatchDetail['status'];
}) {
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

  if (
    status === 'SCHEDULED' ||
    status === 'TIMED'
  ) {
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

  const {
    score,
    homeTeam,
    awayTeam,
    status,
  } = match;

  const showScore = [
    'IN_PLAY',
    'PAUSED',
    'FINISHED',
  ].includes(status);

  const homeGoals =
    match.goals?.filter(
      (g) => g.team?.id === homeTeam.id
    ) ?? [];

  const awayGoals =
    match.goals?.filter(
      (g) => g.team?.id === awayTeam.id
    ) ?? [];

  const allGoals = [
    ...(match.goals ?? []),
  ].sort((a, b) => a.minute - b.minute);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',

    name: `${homeTeam.name} vs ${awayTeam.name}`,

    sport: 'Football',

    startDate: match.utcDate,

    competitor: [
      {
        '@type': 'SportsTeam',
        name: homeTeam.name,
      },
      {
        '@type': 'SportsTeam',
        name: awayTeam.name,
      },
    ],

    location: {
      '@type': 'Place',
      name:
        match.competition?.name ??
        'Football Stadium',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            structuredData
          ),
        }}
      />

      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href="/schedule"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors w-fit"
        >
          ← Back to Schedule
        </Link>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
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
                {homeTeam.shortName ||
                  homeTeam.name}
              </p>
            </div>

            <div className="text-center">
              {showScore ? (
                <>
                  <div className="text-5xl font-black text-white tabular-nums">
                    {score.fullTime.home ?? 0}
                    <span className="text-gray-600 mx-1">
                      –
                    </span>
                    {score.fullTime.away ?? 0}
                  </div>

                  {score.halfTime.home !==
                    null && (
                    <p className="text-xs text-gray-500 mt-2">
                      HT {score.halfTime.home} –{' '}
                      {score.halfTime.away}
                    </p>
                  )}
                </>
              ) : (
                <div className="text-3xl font-bold text-gray-600">
                  vs
                </div>
              )}
            </div>

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
                {awayTeam.shortName ||
                  awayTeam.name}
              </p>
            </div>
          </div>
        </div>

        {allGoals.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Goals
            </h2>

            <div className="space-y-3">
              {allGoals.map(
                (goal: Goal, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3"
                  >
                    <span className="text-xs text-gray-500 w-8 text-right shrink-0">
                      {goal.minute}'
                    </span>

                    <span>⚽</span>

                    <span className="text-white flex-1">
                      {goal.scorer?.name}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {match.bookings?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Bookings
            </h2>

            <div className="space-y-3">
              {match.bookings.map(
                (
                  booking: Booking,
                  i
                ) => (
                  <div
                    key={i}
                    className="flex items-center gap-3"
                  >
                    <span className="text-xs text-gray-500 w-8">
                      {booking.minute}'
                    </span>

                    <span>
                      {booking.card ===
                      'YELLOW'
                        ? '🟨'
                        : '🟥'}
                    </span>

                    <span className="text-white">
                      {
                        booking.player
                          ?.name
                      }
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}