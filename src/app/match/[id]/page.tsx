import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getMatchDetail, getHeadToHead } from '@/lib/api';
import type {
  Goal,
  Booking,
  Substitution,
  MatchDetail,
  HeadToHead,
  Match,
} from '@/lib/types';

export const revalidate = 60;

type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatShortDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function minuteLabel(minute: number, injuryTime?: number | null) {
  return `${minute}${injuryTime ? `+${injuryTime}` : ''}'`;
}

function sectionTitle(label: string) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
      {label}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

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
  if (status === 'PAUSED')
    return (
      <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-sm font-bold">
        HALF TIME
      </span>
    );
  if (status === 'FINISHED')
    return (
      <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm font-bold">
        FULL TIME
      </span>
    );
  if (status === 'SCHEDULED' || status === 'TIMED')
    return (
      <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-sm font-bold">
        UPCOMING
      </span>
    );
  return (
    <span className="bg-gray-700 text-gray-400 px-3 py-1 rounded-full text-sm font-bold">
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Score hero
// ---------------------------------------------------------------------------

function ScoreHero({ match }: { match: MatchDetail }) {
  const { score, homeTeam, awayTeam, status } = match;
  const showScore = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(status);
  const mainRef = match.referees?.find((r) => r.type === 'REFEREE') ?? match.referees?.[0];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
      <div className="text-center mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
          {match.competition?.name}
          {match.matchday ? ` · Matchday ${match.matchday}` : ''}
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

      {/* Venue / referee meta */}
      {(match.venue || mainRef) && (
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-gray-500">
          {match.venue && <span>📍 {match.venue}</span>}
          {mainRef && <span>🟡 Referee: {mainRef.name}</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match summary
// ---------------------------------------------------------------------------

function MatchSummary({ match }: { match: MatchDetail }) {
  const goals = match.goals ?? [];
  const bookings = match.bookings ?? [];
  const subs = match.substitutions ?? [];
  const yellows = bookings.filter((b) => b.card === 'YELLOW').length;
  const reds = bookings.filter((b) => b.card === 'RED' || b.card === 'YELLOW_RED').length;

  const homeGoals = goals.filter((g) => g.team?.id === match.homeTeam.id).length;
  const awayGoals = goals.filter((g) => g.team?.id === match.awayTeam.id).length;

  let resultText = '';
  if (match.status === 'FINISHED') {
    if (match.score.winner === 'HOME_TEAM')
      resultText = `${match.homeTeam.shortName || match.homeTeam.name} win`;
    else if (match.score.winner === 'AWAY_TEAM')
      resultText = `${match.awayTeam.shortName || match.awayTeam.name} win`;
    else resultText = 'Draw';
  }

  const stats = [
    { label: 'Goals', value: `${homeGoals} – ${awayGoals}` },
    { label: 'Yellow Cards', value: String(yellows) },
    { label: 'Red Cards', value: String(reds) },
    { label: 'Substitutions', value: String(subs.length) },
    ...(match.score.duration !== 'REGULAR'
      ? [{ label: 'Duration', value: match.score.duration.replace('_', ' ') }]
      : []),
    ...(resultText ? [{ label: 'Result', value: resultText }] : []),
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Match Summary')}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-gray-800/50 rounded-xl p-3 text-center">
            <dt className="text-xs text-gray-500 mb-1">{label}</dt>
            <dd className="text-white font-bold text-base">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

function GoalsSection({ match }: { match: MatchDetail }) {
  const goals = [...(match.goals ?? [])].sort((a, b) => a.minute - b.minute);
  if (!goals.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Goals')}
      <div className="grid grid-cols-2 text-xs text-gray-500 font-medium uppercase tracking-wider px-1 mb-3">
        <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
        <span className="text-right">{match.awayTeam.shortName || match.awayTeam.name}</span>
      </div>
      <div className="space-y-3">
        {goals.map((goal: Goal, i) => {
          const isHome = goal.team?.id === match.homeTeam.id;
          return (
            <div
              key={i}
              className={`flex items-start gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <span className="text-xs text-gray-500 w-10 shrink-0 mt-0.5 text-center">
                {minuteLabel(goal.minute, goal.injuryTime)}
              </span>
              <span className="text-lg leading-none">⚽</span>
              <div className={`flex flex-col ${isHome ? '' : 'items-end'}`}>
                <span className="text-white text-sm font-medium">{goal.scorer?.name}</span>
                {goal.assist && (
                  <span className="text-gray-500 text-xs">assist: {goal.assist.name}</span>
                )}
                {goal.type && goal.type !== 'REGULAR' && (
                  <span className="text-gray-600 text-xs capitalize">
                    {goal.type.toLowerCase().replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

function BookingsSection({ match }: { match: MatchDetail }) {
  const bookings = [...(match.bookings ?? [])].sort((a, b) => a.minute - b.minute);
  if (!bookings.length) return null;

  const cardIcon = (card: Booking['card']) =>
    card === 'YELLOW' ? '🟨' : card === 'YELLOW_RED' ? '🟧' : '🟥';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Bookings')}
      <div className="grid grid-cols-2 text-xs text-gray-500 font-medium uppercase tracking-wider px-1 mb-3">
        <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
        <span className="text-right">{match.awayTeam.shortName || match.awayTeam.name}</span>
      </div>
      <div className="space-y-3">
        {bookings.map((b: Booking, i) => {
          const isHome = b.team?.id === match.homeTeam.id;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <span className="text-xs text-gray-500 w-10 shrink-0 text-center">
                {minuteLabel(b.minute)}
              </span>
              <span>{cardIcon(b.card)}</span>
              <span className="text-white text-sm">{b.player?.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Substitutions
// ---------------------------------------------------------------------------

function SubstitutionsSection({ match }: { match: MatchDetail }) {
  const subs = [...(match.substitutions ?? [])].sort((a, b) => a.minute - b.minute);
  if (!subs.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Substitutions')}
      <div className="grid grid-cols-2 text-xs text-gray-500 font-medium uppercase tracking-wider px-1 mb-3">
        <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
        <span className="text-right">{match.awayTeam.shortName || match.awayTeam.name}</span>
      </div>
      <div className="space-y-3">
        {subs.map((s: Substitution, i) => {
          const isHome = s.team?.id === match.homeTeam.id;
          return (
            <div
              key={i}
              className={`flex items-start gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <span className="text-xs text-gray-500 w-10 shrink-0 mt-0.5 text-center">
                {minuteLabel(s.minute)}
              </span>
              <span className="text-base leading-none">🔄</span>
              <div className={`flex flex-col text-sm ${isHome ? '' : 'items-end'}`}>
                <span className="text-green-400">{s.playerIn?.name}</span>
                <span className="text-gray-500">{s.playerOut?.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match statistics (computed from events — API free tier only)
// ---------------------------------------------------------------------------

function MatchStatistics({ match }: { match: MatchDetail }) {
  const goals = match.goals ?? [];
  const bookings = match.bookings ?? [];
  const subs = match.substitutions ?? [];

  const homeGoals = goals.filter((g) => g.team?.id === match.homeTeam.id).length;
  const awayGoals = goals.filter((g) => g.team?.id === match.awayTeam.id).length;
  const homeYellows = bookings.filter(
    (b) => b.team?.id === match.homeTeam.id && b.card === 'YELLOW'
  ).length;
  const awayYellows = bookings.filter(
    (b) => b.team?.id === match.awayTeam.id && b.card === 'YELLOW'
  ).length;
  const homeReds = bookings.filter(
    (b) => b.team?.id === match.homeTeam.id && (b.card === 'RED' || b.card === 'YELLOW_RED')
  ).length;
  const awayReds = bookings.filter(
    (b) => b.team?.id === match.awayTeam.id && (b.card === 'RED' || b.card === 'YELLOW_RED')
  ).length;
  const homeSubs = subs.filter((s) => s.team?.id === match.homeTeam.id).length;
  const awaySubs = subs.filter((s) => s.team?.id === match.awayTeam.id).length;

  const rows = [
    { label: 'Goals', home: homeGoals, away: awayGoals },
    { label: 'Yellow Cards', home: homeYellows, away: awayYellows },
    { label: 'Red Cards', home: homeReds, away: awayReds },
    { label: 'Substitutions', home: homeSubs, away: awaySubs },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Match Statistics')}
      <div className="space-y-3">
        {rows.map(({ label, home, away }) => {
          const total = home + away;
          const homePct = total === 0 ? 50 : Math.round((home / total) * 100);
          const awayPct = 100 - homePct;
          return (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white font-medium w-8 text-left">{home}</span>
                <span className="text-gray-400 text-xs">{label}</span>
                <span className="text-white font-medium w-8 text-right">{away}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800">
                <div
                  className="bg-blue-500 transition-all"
                  style={{ width: `${homePct}%` }}
                />
                <div
                  className="bg-orange-500 transition-all"
                  style={{ width: `${awayPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-600 mt-4 text-center">
        Statistics computed from match events. Possession and shot data not available on this plan.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------

function LineupsSection() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Lineups')}
      <p className="text-sm text-gray-500 text-center py-4">
        Lineup data is not available on the current API plan.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Head to head
// ---------------------------------------------------------------------------

function HeadToHeadSection({
  h2h,
  match,
}: {
  h2h: HeadToHead;
  match: MatchDetail;
}) {
  const { aggregates, matches } = h2h;
  if (!aggregates || !aggregates.numberOfMatches) return null;

  // aggregates.homeTeam refers to the home side of the h2h query (same as match.homeTeam)
  const homeStat = aggregates.homeTeam;
  const awayStat = aggregates.awayTeam;
  const total = aggregates.numberOfMatches;

  const recentMatches = [...matches]
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 5);

  function resultFor(m: Match) {
    const isHome = m.homeTeam.id === match.homeTeam.id;
    const winner = m.score.winner;
    if (!winner) return 'D';
    if (winner === 'DRAW') return 'D';
    if ((winner === 'HOME_TEAM' && isHome) || (winner === 'AWAY_TEAM' && !isHome)) return 'W';
    return 'L';
  }

  const resultColor: Record<string, string> = {
    W: 'bg-green-500/20 text-green-400 border-green-500/30',
    D: 'bg-gray-700 text-gray-300 border-gray-600',
    L: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      {sectionTitle('Head to Head')}

      {/* Win/draw/loss bar */}
      <div className="flex justify-between text-sm mb-2">
        <span className="text-white font-bold">{homeStat.wins}W</span>
        <span className="text-gray-400 text-xs self-center">
          {total} meetings · {aggregates.totalGoals} goals
        </span>
        <span className="text-white font-bold">{awayStat.wins}W</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden mb-1">
        {homeStat.wins > 0 && (
          <div
            className="bg-blue-500"
            style={{ width: `${(homeStat.wins / total) * 100}%` }}
          />
        )}
        {homeStat.draws > 0 && (
          <div
            className="bg-gray-600"
            style={{ width: `${(homeStat.draws / total) * 100}%` }}
          />
        )}
        {awayStat.wins > 0 && (
          <div
            className="bg-orange-500"
            style={{ width: `${(awayStat.wins / total) * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mb-5">
        <span>{match.homeTeam.shortName || match.homeTeam.name}</span>
        <span>{homeStat.draws}D</span>
        <span>{match.awayTeam.shortName || match.awayTeam.name}</span>
      </div>

      {/* Recent meetings */}
      {recentMatches.length > 0 && (
        <>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Recent Meetings</p>
          <div className="space-y-2">
            {recentMatches.map((m: Match) => {
              const res = resultFor(m);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="text-gray-600 text-xs w-20 shrink-0">
                    {formatShortDate(m.utcDate)}
                  </span>
                  <span className="text-gray-300 flex-1 truncate text-xs">
                    {m.homeTeam.shortName || m.homeTeam.name}
                    {' '}
                    <span className="text-white font-bold">
                      {m.score.fullTime.home ?? '–'} – {m.score.fullTime.away ?? '–'}
                    </span>
                    {' '}
                    {m.awayTeam.shortName || m.awayTeam.name}
                  </span>
                  <span
                    className={`text-xs font-bold border px-1.5 py-0.5 rounded ${resultColor[res]}`}
                  >
                    {res}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ match }: { match: MatchDetail }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    sport: 'Football',
    startDate: match.utcDate,
    eventStatus:
      match.status === 'FINISHED'
        ? 'https://schema.org/EventScheduled'
        : 'https://schema.org/EventScheduled',
    competitor: [
      { '@type': 'SportsTeam', name: match.homeTeam.name, image: match.homeTeam.crest },
      { '@type': 'SportsTeam', name: match.awayTeam.name, image: match.awayTeam.crest },
    ],
    location: {
      '@type': 'Place',
      name: match.venue ?? match.competition?.name ?? 'Football Stadium',
    },
    organizer: {
      '@type': 'Organization',
      name: match.competition?.name ?? 'Football',
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MatchDetailPage({ params }: Params) {
  const { id } = await params;

  let match: MatchDetail;
  try {
    match = await getMatchDetail(id);
  } catch {
    notFound();
  }

  // Fetch h2h in parallel, silently ignore failure
  let h2h: HeadToHead | null = null;
  try {
    h2h = await getHeadToHead(id);
  } catch {
    // not critical
  }

  const hasEvents =
    (match.goals?.length ?? 0) > 0 ||
    (match.bookings?.length ?? 0) > 0 ||
    (match.substitutions?.length ?? 0) > 0;

  const showStats = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status);

  return (
    <>
      <JsonLd match={match} />

      <div className="max-w-2xl mx-auto space-y-4 pb-10">
        <Link
          href="/schedule"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors w-fit"
        >
          ← Back to Schedule
        </Link>

        <ScoreHero match={match} />

        {showStats && <MatchSummary match={match} />}

        {showStats && hasEvents && <MatchStatistics match={match} />}

        <GoalsSection match={match} />

        <BookingsSection match={match} />

        <SubstitutionsSection match={match} />

        <LineupsSection />

        {h2h && <HeadToHeadSection h2h={h2h} match={match} />}
      </div>
    </>
  );
}
