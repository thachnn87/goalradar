import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getTeam, getTeamMatches, getStandings, NotFoundError } from '@/lib/api';
import { matchPath } from '@/lib/url';
import { COMPETITIONS } from '@/lib/types';
import Breadcrumb from '@/components/Breadcrumb';
import type { TeamDetail, Match, StandingEntry } from '@/lib/types';

export const revalidate = 300;

type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  try {
    const team = await getTeam(id);
    const title = `${team.name} – Squad, Fixtures & Standings | GoalRadar`;
    const description = `${team.name} latest results, league standing, and match history on GoalRadar.`;
    return {
      title,
      description,
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary_large_image', title, description },
    };
  } catch {
    return { title: 'Team | GoalRadar' };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMatchDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function MatchResult({
  match,
  teamId,
}: {
  match: Match;
  teamId: number;
}) {
  const isHome = match.homeTeam.id === teamId;
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const ftHome = match.score.fullTime.home ?? 0;
  const ftAway = match.score.fullTime.away ?? 0;
  const scored = isHome ? ftHome : ftAway;
  const conceded = isHome ? ftAway : ftHome;

  let outcome = 'D';
  let outcomeStyle = 'bg-gray-700 text-gray-300';
  if (match.score.winner === (isHome ? 'HOME_TEAM' : 'AWAY_TEAM')) {
    outcome = 'W';
    outcomeStyle = 'bg-green-500/20 text-green-400 border border-green-500/30';
  } else if (match.score.winner && match.score.winner !== 'DRAW') {
    outcome = 'L';
    outcomeStyle = 'bg-red-500/20 text-red-400 border border-red-500/30';
  }

  return (
    <Link
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/60 transition-colors"
    >
      {/* W/D/L badge */}
      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded ${outcomeStyle}`}>
        {outcome}
      </span>

      {/* Opponent crest + name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {opponent.crest && (
          <img
            src={opponent.crest}
            alt=""
            width={20}
            height={20}
            className="object-contain shrink-0"
          />
        )}
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">
            {isHome ? 'vs' : '@'} {opponent.shortName || opponent.name}
          </p>
          <p className="text-gray-500 text-xs">{formatMatchDate(match.utcDate)}</p>
        </div>
      </div>

      {/* Score */}
      <span className="text-white font-bold tabular-nums text-sm shrink-0">
        {scored}–{conceded}
      </span>

      {/* Competition */}
      <span className="text-gray-600 text-xs shrink-0 hidden sm:block">
        {match.competition.code}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Standing row for this team
// ---------------------------------------------------------------------------

function StandingRow({
  entry,
  total,
}: {
  entry: StandingEntry;
  total: number;
}) {
  const i = entry.position - 1;
  const zoneLabel =
    i < 4
      ? { label: 'Champions League', color: 'text-blue-400' }
      : i === 4
      ? { label: 'Europa League', color: 'text-orange-400' }
      : i >= total - 3
      ? { label: 'Relegation zone', color: 'text-red-400' }
      : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-2.5 text-left w-10">#</th>
              <th className="px-4 py-2.5 text-center w-10">P</th>
              <th className="px-4 py-2.5 text-center w-10">W</th>
              <th className="px-4 py-2.5 text-center w-10">D</th>
              <th className="px-4 py-2.5 text-center w-10">L</th>
              <th className="px-4 py-2.5 text-center w-12">GD</th>
              <th className="px-4 py-2.5 text-center w-12 text-white font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-800 bg-gray-800/30">
              <td className="px-4 py-3 text-white font-bold">{entry.position}</td>
              <td className="px-4 py-3 text-center text-gray-400">{entry.playedGames}</td>
              <td className="px-4 py-3 text-center text-gray-400">{entry.won}</td>
              <td className="px-4 py-3 text-center text-gray-400">{entry.draw}</td>
              <td className="px-4 py-3 text-center text-gray-400">{entry.lost}</td>
              <td
                className={`px-4 py-3 text-center ${
                  entry.goalDifference > 0
                    ? 'text-green-400'
                    : entry.goalDifference < 0
                    ? 'text-red-400'
                    : 'text-gray-400'
                }`}
              >
                {entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
              </td>
              <td className="px-4 py-3 text-center font-bold text-white">{entry.points}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {zoneLabel && (
        <p className={`text-xs px-1 ${zoneLabel.color}`}>
          ● {zoneLabel.label}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ team, leagueName }: { team: TeamDetail; leagueName: string }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.name,
    sport: 'Football',
    image: team.crest,
    url: `https://goalradar.org/team/${team.id}`,
    location: {
      '@type': 'Place',
      name: team.venue ?? team.area.name,
      address: { '@type': 'PostalAddress', addressCountry: team.area.code },
    },
    memberOf: leagueName ? [{ '@type': 'SportsOrganization', name: leagueName }] : undefined,
    foundingDate: team.founded ? String(team.founded) : undefined,
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

export default async function TeamPage({ params }: Params) {
  const { id } = await params;

  let team: TeamDetail | null = null;

  try {
    team = await getTeam(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    console.error(`[TeamPage] Could not load team ${id}:`, err instanceof Error ? err.message : String(err));
  }

  if (!team) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-10">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Standings', href: '/standings' }, { label: 'Team' }]} />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl">🏟️</div>
          <h1 className="text-white font-bold text-lg">Team Data Unavailable</h1>
          <p className="text-gray-400 text-sm">
            Team information is temporarily unavailable. Please try again in a few moments.
          </p>
          <Link href="/standings" className="inline-block text-sm text-green-400 hover:text-green-300 transition-colors pt-2">
            ← Back to Standings
          </Link>
        </div>
      </div>
    );
  }

  // Run recent matches + standings in parallel
  const leagueComp = team.runningCompetitions.find(
    (c) => c.type === 'LEAGUE' && COMPETITIONS.some((k) => k.code === c.code)
  );

  const [matchesResult, standingsResult] = await Promise.allSettled([
    getTeamMatches(id),
    leagueComp ? getStandings(leagueComp.code) : Promise.reject('no league'),
  ]);

  const recentMatches: Match[] =
    matchesResult.status === 'fulfilled'
      ? [...matchesResult.value.matches]
          .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
          .slice(0, 10)
      : [];

  let standingEntry: StandingEntry | null = null;
  let standingTotal = 0;
  let leagueName = leagueComp?.name ?? '';

  if (standingsResult.status === 'fulfilled') {
    const data = standingsResult.value;
    leagueName = data.competition.name;
    const totalTable = data.standings.find((s) => s.type === 'TOTAL');
    if (totalTable) {
      standingTotal = totalTable.table.length;
      standingEntry = totalTable.table.find((e) => e.team.id === team.id) ?? null;
    }
  }

  return (
    <>
      <JsonLd team={team} leagueName={leagueName} />

      <div className="max-w-2xl mx-auto space-y-4 pb-10">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            {
              label: leagueName || 'Leagues',
              href: leagueComp
                ? `/competition/${leagueComp.code}`
                : '/standings',
            },
            { label: team.name },
          ]}
        />

        {/* Team header */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-5">
            {team.crest && (
              <img
                src={team.crest}
                alt={team.name}
                width={80}
                height={80}
                className="object-contain shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-white leading-tight">{team.name}</h1>
              {team.tla && (
                <p className="text-gray-500 text-sm font-mono mt-0.5">{team.tla}</p>
              )}
              {leagueName && (
                <p className="text-gray-400 text-sm mt-1">{leagueName}</p>
              )}
            </div>
          </div>

          {/* Meta info */}
          {(team.founded || team.venue || team.clubColors || team.area) && (
            <dl className="mt-5 pt-5 border-t border-gray-800 grid grid-cols-2 gap-3 text-sm">
              {team.area?.name && (
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">Country</dt>
                  <dd className="text-white">
                    {team.area.flag ? (
                      <img
                        src={team.area.flag}
                        alt=""
                        width={16}
                        height={16}
                        className="inline object-contain mr-1.5 -mt-0.5"
                      />
                    ) : null}
                    {team.area.name}
                  </dd>
                </div>
              )}
              {team.founded && (
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">Founded</dt>
                  <dd className="text-white">{team.founded}</dd>
                </div>
              )}
              {team.venue && (
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">Venue</dt>
                  <dd className="text-white">{team.venue}</dd>
                </div>
              )}
              {team.clubColors && (
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">Colors</dt>
                  <dd className="text-white">{team.clubColors}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* League standing */}
        {standingEntry && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                {leagueName} Standing
              </h2>
              <Link
                href={`/standings?competition=${leagueComp?.code}`}
                className="text-xs text-gray-500 hover:text-white transition-colors"
              >
                Full table →
              </Link>
            </div>
            <StandingRow entry={standingEntry} total={standingTotal} />
          </div>
        )}

        {/* Recent matches */}
        {recentMatches.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Recent Matches
            </h2>
            <div className="divide-y divide-gray-800/60">
              {recentMatches.map((match) => (
                <MatchResult key={match.id} match={match} teamId={team.id} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
