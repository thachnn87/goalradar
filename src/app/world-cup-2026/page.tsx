import Link from 'next/link';
import type { Metadata } from 'next';

import {
  getWCLiveMatches,
  getUpcomingMatches,
  getRecentMatches,
  getStandings,
} from '@/lib/api';
import type { Match, StandingEntry, StandingTable } from '@/lib/types';
import MatchCard from '@/components/MatchCard';
import Breadcrumb from '@/components/Breadcrumb';

// Live page revalidates fastest because live matches can start at any moment
export const revalidate = 30;

const WC_START = '2026-06-11';
const WC_END = '2026-07-19';
const BASE_URL = 'https://goalradar.org';

const GROUP_STAGES = new Set(['GROUP_STAGE', 'FIRST_STAGE']);

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 – Live Scores, Groups & Fixtures | GoalRadar',
  description:
    'Follow FIFA World Cup 2026 live scores, group standings, match results and knockout fixtures on GoalRadar. USA · Canada · Mexico.',
  openGraph: {
    title: 'FIFA World Cup 2026 – Live Scores, Groups & Fixtures | GoalRadar',
    description:
      'FIFA World Cup 2026 live scores, group standings, results and knockout bracket — all in one place.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIFA World Cup 2026 | GoalRadar',
    description: 'Live scores, group standings, and fixtures for the 2026 World Cup.',
  },
};

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd() {
  const event = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: 'FIFA World Cup 2026',
    sport: 'Football',
    startDate: WC_START,
    endDate: WC_END,
    url: `${BASE_URL}/world-cup-2026`,
    location: {
      '@type': 'Place',
      name: 'United States, Canada & Mexico',
      address: { '@type': 'PostalAddress', addressCountry: 'US' },
    },
    organizer: { '@type': 'Organization', name: 'FIFA' },
    eventStatus: 'https://schema.org/EventScheduled',
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(event) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sectionTitle(label: string) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
      {label}
    </h2>
  );
}

function groupLabel(raw: string | null) {
  if (!raw) return '';
  return raw.replace(/_/g, ' ').replace(/\bGroup\b/i, 'Group').replace(/GROUP /, 'Group ');
}

function formatKickoff(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function groupMatchesByDate(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((acc, m) => {
    const d = m.utcDate.split('T')[0];
    (acc[d] ??= []).push(m);
    return acc;
  }, {});
}

// ---------------------------------------------------------------------------
// Group table — compact, one group
// ---------------------------------------------------------------------------

function GroupTable({ group, table }: { group: string; table: StandingEntry[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="bg-gray-800 px-4 py-2">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
          {groupLabel(group)}
        </h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 uppercase tracking-wider border-b border-gray-800">
            <th className="px-3 py-1.5 text-left w-6">#</th>
            <th className="px-3 py-1.5 text-left">Team</th>
            <th className="px-2 py-1.5 text-center w-7">P</th>
            <th className="px-2 py-1.5 text-center w-7">W</th>
            <th className="px-2 py-1.5 text-center w-7">D</th>
            <th className="px-2 py-1.5 text-center w-7">L</th>
            <th className="px-2 py-1.5 text-center w-8 text-white font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((entry, i) => {
            // Top 2 advance from each group in WC 2026 (top 3 in 12-group format — check later)
            const advances = i < 2;
            return (
              <tr
                key={entry.team.id}
                className={`border-t border-gray-800/50 border-l-2 ${
                  advances ? 'border-l-green-500' : 'border-l-transparent'
                } hover:bg-gray-800/40 transition-colors`}
              >
                <td className="px-3 py-2 text-gray-500 text-center">{entry.position}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/team/${entry.team.id}`}
                    className="flex items-center gap-1.5 hover:text-green-400 transition-colors group"
                  >
                    {entry.team.crest && (
                      <img
                        src={entry.team.crest}
                        alt=""
                        width={16}
                        height={16}
                        className="object-contain shrink-0"
                      />
                    )}
                    <span className="text-white font-medium truncate group-hover:text-green-400 text-xs">
                      {entry.team.shortName || entry.team.name}
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-2 text-center text-gray-400">{entry.playedGames}</td>
                <td className="px-2 py-2 text-center text-gray-400">{entry.won}</td>
                <td className="px-2 py-2 text-center text-gray-400">{entry.draw}</td>
                <td className="px-2 py-2 text-center text-gray-400">{entry.lost}</td>
                <td className="px-2 py-2 text-center font-bold text-white">{entry.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knockout match row (compact)
// ---------------------------------------------------------------------------

function KnockoutMatchRow({ match }: { match: Match }) {
  const { score, status } = match;
  const showScore = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(status);

  return (
    <Link
      href={`/match/${match.id}`}
      className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-700 hover:bg-gray-800/50 transition-all"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {match.homeTeam?.crest && (
          <img src={match.homeTeam.crest} alt="" width={20} height={20} className="object-contain shrink-0" />
        )}
        <span className="text-white text-sm font-medium truncate">
          {match.homeTeam?.shortName || match.homeTeam?.name || 'TBD'}
        </span>
      </div>

      <div className="mx-3 text-center shrink-0">
        {showScore ? (
          <span className="text-white font-black tabular-nums">
            {score.fullTime.home ?? 0} – {score.fullTime.away ?? 0}
          </span>
        ) : (
          <span className="text-gray-500 text-xs">{formatKickoff(match.utcDate)}</span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-white text-sm font-medium truncate text-right">
          {match.awayTeam?.shortName || match.awayTeam?.name || 'TBD'}
        </span>
        {match.awayTeam?.crest && (
          <img src={match.awayTeam.crest} alt="" width={20} height={20} className="object-contain shrink-0" />
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WorldCup2026Page() {
  const [liveResult, upcomingResult, recentResult, standingsResult] = await Promise.allSettled([
    getWCLiveMatches(),
    getUpcomingMatches('WC'),
    getRecentMatches('WC'),
    getStandings('WC'),
  ]);

  // Live
  const liveMatches: Match[] =
    liveResult.status === 'fulfilled' ? liveResult.value.matches : [];

  // Upcoming — split group vs knockout
  const allUpcoming: Match[] =
    upcomingResult.status === 'fulfilled'
      ? [...upcomingResult.value.matches].sort(
          (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
        )
      : [];
  const upcomingGroup = allUpcoming.filter((m) => GROUP_STAGES.has(m.stage));
  const upcomingKnockout = allUpcoming.filter((m) => !GROUP_STAGES.has(m.stage));

  // Recent — split group vs knockout
  const allRecent: Match[] =
    recentResult.status === 'fulfilled'
      ? [...recentResult.value.matches]
          .filter((m) => m.status === 'FINISHED')
          .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
      : [];
  const recentKnockout = allRecent.filter((m) => !GROUP_STAGES.has(m.stage));

  // Standings — all groups
  const groupTables: StandingTable[] =
    standingsResult.status === 'fulfilled'
      ? standingsResult.value.standings.filter((s) => s.type === 'TOTAL')
      : [];

  const hasKnockout = upcomingKnockout.length > 0 || recentKnockout.length > 0;
  const upcomingGroupByDate = groupMatchesByDate(upcomingGroup.slice(0, 24));

  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto space-y-10 pb-12">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'World Cup 2026' },
          ]}
        />

        {/* Hero */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="text-5xl sm:text-6xl shrink-0">🏆</span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                FIFA World Cup 2026
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                United States · Canada · Mexico
              </p>
              <p className="text-gray-500 text-xs mt-1">
                11 June – 19 July 2026 · 48 Teams · 104 Matches
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs font-semibold">
                  48 Nations
                </span>
                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-semibold">
                  16 Cities
                </span>
                <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-full text-xs font-semibold">
                  3 Countries
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live now */}
        {liveMatches.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <h2 className="text-xs font-semibold text-red-400 uppercase tracking-widest">
                Live Now
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming group stage */}
        {upcomingGroup.length > 0 && (
          <section>
            {sectionTitle('Upcoming Group Stage Fixtures')}
            <div className="space-y-8">
              {Object.keys(upcomingGroupByDate)
                .sort()
                .map((date) => (
                  <div key={date}>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                      {new Date(date).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        timeZone: 'UTC',
                      })}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {upcomingGroupByDate[date].map((m) => (
                        <MatchCard key={m.id} match={m} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Group standings */}
        <section>
          {sectionTitle('Group Standings')}
          {groupTables.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupTables.map((t) => (
                  <GroupTable
                    key={t.group ?? t.stage}
                    group={t.group ?? t.stage}
                    table={t.table}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" />
                Advances to knockout stage
              </p>
            </>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400 text-sm font-medium">Group stage hasn't started yet</p>
              <p className="text-gray-600 text-xs mt-1">Standings will appear once matches begin</p>
            </div>
          )}
        </section>

        {/* Knockout stage */}
        <section>
          {sectionTitle('Knockout Stage')}
          {hasKnockout ? (
            <div className="space-y-3">
              {[...recentKnockout, ...upcomingKnockout].map((m) => (
                <div key={m.id}>
                  <p className="text-xs text-gray-600 mb-1.5 px-1 capitalize">
                    {m.stage.replace(/_/g, ' ').toLowerCase()}
                  </p>
                  <KnockoutMatchRow match={m} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400 text-sm font-medium">Knockout stage not yet available</p>
              <p className="text-gray-600 text-xs mt-1">
                The knockout bracket will appear once the group stage is complete
              </p>
            </div>
          )}
        </section>

        {/* Footer link */}
        <div className="text-center">
          <Link
            href="/competition/WC"
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            View full competition page →
          </Link>
        </div>
      </div>
    </>
  );
}
