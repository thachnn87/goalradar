/**
 * WCTeamPageContent
 *
 * Async server component — the shared template for all six WC 2026 team pages.
 * Receives static team config, fetches live/upcoming/results/standings data,
 * and renders a complete, SEO-rich team hub page.
 *
 * Placements at page.tsx level:
 *   /world-cup-2026/usa        /world-cup-2026/england
 *   /world-cup-2026/brazil     /world-cup-2026/argentina
 *   /world-cup-2026/mexico     /world-cup-2026/canada
 */

import Link from 'next/link';
import type { WCTeam } from '@/lib/wc-teams';
import { findTeamGroupFromMatches } from '@/lib/wc-teams';
import {
  getUpcomingMatchesCached,
  getRecentMatchesCached,
  getWCLiveMatchesCached,
  getStandingsCached,
} from '@/lib/api';
import type { Match, StandingEntry, StandingTable } from '@/lib/types';
import { matchPath } from '@/lib/url';
import MatchCard from '@/components/MatchCard';
import Breadcrumb from '@/components/Breadcrumb';
import NewsletterSignup from '@/components/NewsletterSignup';
import AffiliateBlock from '@/components/AffiliateBlock';
import AdSlot from '@/components/AdSlot';

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

function filterByTeam(matches: Match[], apiName: string): Match[] {
  return matches.filter(
    (m) => m.homeTeam?.name === apiName || m.awayTeam?.name === apiName,
  );
}

function findGroupStandings(
  standings: StandingTable[],
  apiName: string,
): { group: string; table: StandingEntry[] } | null {
  for (const s of standings) {
    if (s.type !== 'TOTAL') continue;
    const hasTeam = s.table.some((e) => e.team.name === apiName);
    if (hasTeam) return { group: s.group ?? '', table: s.table };
  }
  return null;
}

function groupSlug(apiGroup: string): string {
  return apiGroup.toLowerCase().replace(/[\s_]+/g, '-'); // GROUP_A / "Group A" → group-a
}

function groupLabel(apiGroup: string): string {
  return apiGroup.replace('GROUP_', 'Group '); // GROUP_A → Group A
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Hero({ team, group }: { team: WCTeam; group: string | null }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-yellow-700/30">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-950/70 via-gray-900 to-gray-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_left,_rgba(234,179,8,0.10),_transparent)]" />

      <div className="relative px-6 py-8 sm:px-10 sm:py-10 space-y-4">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/25
                           rounded-full px-3 py-1 text-yellow-400 text-xs font-semibold">
            🏆 FIFA World Cup 2026
          </span>
          {team.hostNation && (
            <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/25
                             rounded-full px-3 py-1 text-blue-400 text-xs font-semibold">
              🏟 Co-Host Nation
            </span>
          )}
          {group && (
            <Link
              href={`/world-cup-2026/${groupSlug(group)}`}
              className="inline-flex items-center gap-1 bg-gray-800 border border-gray-700
                         rounded-full px-3 py-1 text-gray-300 text-xs font-semibold hover:border-yellow-700/50
                         hover:text-yellow-400 transition-colors"
            >
              📊 {groupLabel(group)}
            </Link>
          )}
          <span className="inline-flex items-center gap-1 bg-gray-800 border border-gray-700
                           rounded-full px-3 py-1 text-gray-400 text-xs">
            FIFA Rank #{team.fifaRanking}
          </span>
        </div>

        {/* Name + flag */}
        <div className="flex items-center gap-4">
          <span className="text-5xl sm:text-6xl" role="img" aria-label={`${team.displayName} flag`}>
            {team.flag}
          </span>
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
              {team.displayName}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Coach: <span className="text-gray-300 font-medium">{team.manager}</span>
              &nbsp;·&nbsp; USA · Canada · Mexico 2026
            </p>
          </div>
        </div>

        {/* Intro text */}
        <p className="text-gray-300 text-sm sm:text-base leading-relaxed max-w-2xl">
          {team.intro.slice(0, 220)}…
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/world-cup-2026/watch-live"
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-5 py-2.5
                       rounded-xl transition-colors text-sm"
          >
            📺 {team.watchCtaLabel}
          </Link>
          {group && (
            <Link
              href={`/world-cup-2026/${groupSlug(group)}`}
              className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700
                         font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
            >
              📊 {groupLabel(group)} Standings
            </Link>
          )}
          <Link
            href="/world-cup-2026"
            className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700
                       font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            🏆 WC Hub
          </Link>
        </div>
      </div>
    </div>
  );
}

// Quick navigation strip
function QuickNav({ group, slug }: { group: string | null; slug: string }) {
  const links = [
    { href: `#fixtures`,  label: '📅 Fixtures' },
    { href: `#results`,   label: '🏁 Results'  },
    { href: `#group`,     label: '📊 Group'    },
    { href: `#watch`,     label: '📺 Watch'    },
    { href: `#squad`,     label: '👥 Squad'    },
  ];

  if (!group) {
    // Remove group link if we don't know the group yet
    links.splice(2, 1);
  }

  return (
    <nav aria-label={`${slug} team navigation`} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {links.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className="shrink-0 bg-gray-900 border border-gray-800 hover:border-yellow-700/40
                     hover:bg-yellow-500/5 text-gray-300 hover:text-yellow-400
                     px-4 py-2 rounded-xl text-xs font-medium transition-colors"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

// Live match banner
function LiveBanner({ match }: { match: Match }) {
  return (
    <div className="bg-red-950/30 border border-red-800/40 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <h2 className="text-red-400 text-sm font-bold uppercase tracking-wide">Playing Now</h2>
      </div>
      <MatchCard match={match} />
    </div>
  );
}

// Fixtures section
function FixturesSection({ matches, teamName }: { matches: Match[]; teamName: string }) {
  const upcoming = matches.filter(
    (m) => !['FINISHED'].includes(m.status),
  ).slice(0, 6);

  return (
    <section id="fixtures" aria-labelledby="fixtures-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="fixtures-heading" className="text-lg font-bold text-white">
          📅 Upcoming Fixtures
        </h2>
        <Link
          href="/world-cup-2026/fixtures"
          className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
        >
          All fixtures →
        </Link>
      </div>

      {upcoming.length > 0 ? (
        <div className="space-y-3">
          {upcoming.map((m) => (
            <Link
              key={m.id}
              href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
              className="flex items-center gap-4 bg-gray-900 border border-gray-800
                         hover:border-gray-700 rounded-xl p-4 transition-colors group"
            >
              {/* Date */}
              <div className="shrink-0 text-center min-w-[72px]">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">
                  {new Date(m.utcDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </p>
                <p className="text-white font-bold text-sm tabular-nums">
                  {new Date(m.utcDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                  <span className="text-gray-600 text-[10px] ml-0.5">UTC</span>
                </p>
              </div>

              {/* Teams */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold group-hover:text-yellow-400 transition-colors truncate">
                  {m.homeTeam?.name ?? 'TBD'}
                  <span className="text-gray-500 font-normal mx-1">vs</span>
                  {m.awayTeam?.name ?? 'TBD'}
                </p>
                {m.group && (
                  <p className="text-gray-600 text-[10px] mt-0.5">{groupLabel(m.group)}</p>
                )}
              </div>

              {/* Stage */}
              <span className="text-gray-600 text-[10px] shrink-0 hidden sm:inline">
                {m.stage?.replace(/_/g, ' ').replace('LAST 16', 'R16') ?? ''}
              </span>

              <span className="text-gray-700 group-hover:text-yellow-600 transition-colors text-sm shrink-0">→</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-300 font-semibold">Fixtures coming soon</p>
          <p className="text-gray-500 text-sm mt-1">
            {teamName}&apos;s World Cup fixtures will appear here once confirmed.
          </p>
        </div>
      )}
    </section>
  );
}

// Results section
function ResultsSection({ matches }: { matches: Match[] }) {
  const results = matches
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 5);

  if (results.length === 0) {
    return (
      <section id="results" aria-labelledby="results-heading">
        <h2 id="results-heading" className="text-lg font-bold text-white mb-4">🏁 Results</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🏁</div>
          <p className="text-gray-300 font-semibold">No results yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Results will appear here once the tournament begins on 11 June 2026.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="results" aria-labelledby="results-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="results-heading" className="text-lg font-bold text-white">🏁 Results</h2>
        <Link href="/world-cup-2026/results" className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium">
          All results →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {results.map((m) => <MatchCard key={m.id} match={m} />)}
      </div>
    </section>
  );
}

// Group standings section (with team highlight)
function GroupSection({
  groupData,
  teamApiName,
  group,
}: {
  groupData: { group: string; table: StandingEntry[] } | null;
  teamApiName: string;
  group: string | null;
}) {
  const derivedGroup = groupData?.group ?? group;
  const table = groupData?.table ?? [];

  return (
    <section id="group" aria-labelledby="group-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="group-heading" className="text-lg font-bold text-white">
          📊 {derivedGroup ? groupLabel(derivedGroup) : 'Group'} Standings
        </h2>
        {derivedGroup && (
          <Link
            href={`/world-cup-2026/${groupSlug(derivedGroup)}`}
            className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
          >
            Full group →
          </Link>
        )}
      </div>

      {table.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600 border-b border-gray-800">
                <th className="px-4 py-2.5 text-left w-7">#</th>
                <th className="px-4 py-2.5 text-left">Team</th>
                <th className="px-3 py-2.5 text-center w-8">P</th>
                <th className="px-3 py-2.5 text-center w-8">W</th>
                <th className="px-3 py-2.5 text-center w-8">D</th>
                <th className="px-3 py-2.5 text-center w-8">L</th>
                <th className="px-3 py-2.5 text-center w-10 text-white font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((entry, i) => {
                const isThisTeam = entry.team.name === teamApiName;
                const advances = i < 2;
                return (
                  <tr
                    key={entry.team.id}
                    className={`border-t border-gray-800/40 border-l-2 transition-colors
                      ${isThisTeam ? 'bg-yellow-500/10 border-l-yellow-500' : advances ? 'border-l-green-500 hover:bg-gray-800/30' : 'border-l-transparent hover:bg-gray-800/30'}
                    `}
                  >
                    <td className="px-4 py-2.5 text-gray-500 text-center">{entry.position}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {entry.team.crest && (
                          <img src={entry.team.crest} alt="" width={14} height={14} className="object-contain shrink-0" />
                        )}
                        <span className={`font-medium truncate ${isThisTeam ? 'text-yellow-400' : 'text-white'}`}>
                          {entry.team.shortName || entry.team.name}
                        </span>
                        {isThisTeam && (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-500 rounded px-1 font-semibold shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{entry.playedGames}</td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{entry.won}</td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{entry.draw}</td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{entry.lost}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-white">{entry.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-gray-800 flex items-center gap-4 text-[10px] text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-green-500 shrink-0" /> Top 2 advance
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-yellow-500 shrink-0" /> Highlighted team
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-300 font-semibold">Standings not yet available</p>
          <p className="text-gray-500 text-sm mt-1">
            Group standings update once matches are played (from 11 June 2026).
          </p>
          {derivedGroup && (
            <Link
              href={`/world-cup-2026/${groupSlug(derivedGroup)}`}
              className="inline-block mt-3 text-sm text-yellow-500 hover:text-yellow-300 transition-colors"
            >
              View {groupLabel(derivedGroup)} page →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

// How to Watch section
function WatchSection({ team }: { team: WCTeam }) {
  return (
    <section id="watch" aria-labelledby="watch-heading" className="space-y-4">
      <h2 id="watch-heading" className="text-lg font-bold text-white">
        📺 How to Watch {team.displayName}
      </h2>

      {/* Broadcast table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            Official broadcasters by country
          </p>
        </div>
        <div className="divide-y divide-gray-800">
          {team.broadcasts.map(({ country, flag, channels, streaming }) => (
            <div key={country} className="flex items-start gap-3 px-4 py-3">
              <span className="text-lg shrink-0 mt-0.5" aria-hidden>{flag}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{country}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  <span className="font-medium text-gray-300">TV:</span> {channels}
                </p>
                <p className="text-gray-400 text-xs">
                  <span className="font-medium text-gray-300">Stream:</span> {streaming}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/world-cup-2026/watch-live"
          className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-700/30
                     hover:bg-yellow-500/20 rounded-xl p-4 transition-colors group"
        >
          <span className="text-2xl" aria-hidden>📺</span>
          <div>
            <p className="text-yellow-400 font-bold text-sm group-hover:text-yellow-300 transition-colors">
              Watch Live Guide
            </p>
            <p className="text-gray-500 text-xs">Find where to watch every match</p>
          </div>
        </Link>
        <Link
          href="/world-cup-2026/streaming-guide"
          className="flex items-center gap-3 bg-gray-900 border border-gray-800
                     hover:border-gray-700 rounded-xl p-4 transition-colors group"
        >
          <span className="text-2xl" aria-hidden>📡</span>
          <div>
            <p className="text-white font-bold text-sm group-hover:text-yellow-400 transition-colors">
              Streaming Guide
            </p>
            <p className="text-gray-500 text-xs">Stream online from any device</p>
          </div>
        </Link>
      </div>

      {/* Affiliate placeholder */}
      <AffiliateBlock
        title={team.watchCtaLabel}
        description={`Stream every ${team.displayName} match live at FIFA World Cup 2026. Official broadcasts — legal, HD quality.`}
        cta="Find Streaming Options"
        url="#"
        tag={`team-${team.slug}`}
        variant="yellow"
      />
    </section>
  );
}

// Squad / team profile section
function SquadSection({ team }: { team: WCTeam }) {
  return (
    <section id="squad" aria-labelledby="squad-heading" className="space-y-4">
      <h2 id="squad-heading" className="text-lg font-bold text-white">👥 Team Profile</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Key players */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Key Players
          </h3>
          <ul className="space-y-2">
            {team.keyPlayers.map((player) => (
              <li key={player} className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-yellow-500 text-xs" aria-hidden>⚽</span>
                {player}
              </li>
            ))}
          </ul>
        </div>

        {/* Team info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Management
            </h3>
            <p className="text-white text-sm font-semibold">{team.manager}</p>
            <p className="text-gray-500 text-xs">Head Coach</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Playing Style
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">{team.style}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              FIFA Ranking
            </h3>
            <p className="text-white text-sm font-bold">#{team.fifaRanking}</p>
          </div>
        </div>
      </div>

      {/* Tournament history */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          World Cup History
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">{team.history}</p>
      </div>

      {/* Full intro article */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {team.displayName} at World Cup 2026
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">{team.intro}</p>
      </div>
    </section>
  );
}

// Internal navigation links
function InternalLinks({ team, group }: { team: WCTeam; group: string | null }) {
  const links = [
    { href: '/world-cup-2026',            icon: '🏆', label: 'WC Hub',          desc: 'Tournament overview' },
    { href: '/world-cup-2026/fixtures',   icon: '📅', label: 'All Fixtures',     desc: 'Upcoming matches' },
    { href: '/world-cup-2026/results',    icon: '🏁', label: 'Results',          desc: 'All scores' },
    { href: '/world-cup-2026/watch-live', icon: '📺', label: 'Watch Live',       desc: 'How to watch' },
    { href: '/world-cup-2026/streaming-guide', icon: '📡', label: 'Streaming Guide', desc: 'Online streaming' },
    { href: '/world-cup-2026/bracket',    icon: '🔗', label: 'Bracket',          desc: 'Knockout stage' },
    ...(group
      ? [{ href: `/world-cup-2026/${groupSlug(group)}`, icon: '📊', label: groupLabel(group), desc: 'Group standings' }]
      : [{ href: '/world-cup-2026/groups', icon: '📊', label: 'Groups', desc: 'All group standings' }]
    ),
    { href: '/live',                      icon: '🔴', label: 'Live Scores',      desc: 'All live matches' },
  ];

  return (
    <section aria-label="World Cup navigation">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
        More from FIFA World Cup 2026
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {links.map(({ href, icon, label, desc }) => (
          <Link
            key={href + label}
            href={href}
            className="flex flex-col gap-0.5 bg-gray-900 hover:bg-yellow-500/5 border border-gray-800
                       hover:border-yellow-700/40 rounded-xl p-3 transition-all group"
          >
            <span className="text-base leading-none mb-1" aria-hidden>{icon}</span>
            <span className="text-white text-xs font-semibold group-hover:text-yellow-400 transition-colors leading-tight">
              {label}
            </span>
            <span className="text-gray-600 text-[10px] leading-tight">{desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ team, group }: { team: WCTeam; group: string | null }) {
  const BASE_URL = 'https://goalradar.org';
  const pageUrl = `${BASE_URL}/world-cup-2026/${team.slug}`;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',            item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',  item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: team.displayName,  item: pageUrl },
    ],
  };

  const sportsTeam = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.displayName,
    sport: 'Football',
    url: pageUrl,
    memberOf: {
      '@type': 'SportsOrganization',
      name: 'FIFA World Cup 2026',
      url: `${BASE_URL}/world-cup-2026`,
    },
    coach: {
      '@type': 'Person',
      name: team.manager,
    },
    ...(group ? { description: `${team.displayName} compete in ${groupLabel(group)} of FIFA World Cup 2026.` } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsTeam) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export default async function WCTeamPageContent({ team }: { team: WCTeam }) {
  // Parallel fetches — gracefully degrade on error
  const [upcomingRes, recentRes, standingsRes, liveRes] = await Promise.allSettled([
    getUpcomingMatchesCached('WC'),
    getRecentMatchesCached('WC'),
    getStandingsCached('WC'),
    getWCLiveMatchesCached(),
  ]);

  const allUpcoming: Match[] =
    upcomingRes.status === 'fulfilled' ? upcomingRes.value.matches : [];
  const allRecent: Match[] =
    recentRes.status === 'fulfilled' ? recentRes.value.matches : [];
  const allLive: Match[] =
    liveRes.status === 'fulfilled' ? liveRes.value.matches : [];
  const allStandings: StandingTable[] =
    standingsRes.status === 'fulfilled'
      ? standingsRes.value.standings.filter((s) => s.type === 'TOTAL')
      : [];

  // Filter by team
  const teamUpcoming = filterByTeam(allUpcoming, team.apiName);
  const teamResults  = filterByTeam(allRecent, team.apiName);
  const teamLive     = filterByTeam(allLive, team.apiName);

  // Derive group from match data (API group field is most reliable)
  const allMatches = [...allUpcoming, ...allRecent];
  const derivedGroup = findTeamGroupFromMatches(allMatches, team.apiName);

  // Find group standings for this team
  const groupData = findGroupStandings(allStandings, team.apiName);

  return (
    <>
      <JsonLd team={team} group={derivedGroup} />

      <div className="max-w-5xl mx-auto space-y-10 pb-16">
        {/* Breadcrumb */}
        <Breadcrumb items={[
          { label: 'Home',           href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: team.displayName },
        ]} />

        {/* Hero */}
        <Hero team={team} group={derivedGroup} />

        {/* Quick navigation */}
        <QuickNav group={derivedGroup} slug={team.slug} />

        {/* Live match (if playing right now) */}
        {teamLive.length > 0 && <LiveBanner match={teamLive[0]} />}

        {/* Ad: top placement */}
        <AdSlot slotId={`team-${team.slug}-top`} variant="banner" />

        {/* Fixtures */}
        <FixturesSection matches={teamUpcoming} teamName={team.displayName} />

        {/* Results */}
        <ResultsSection matches={teamResults} />

        {/* Ad: mid placement */}
        <AdSlot slotId={`team-${team.slug}-mid`} variant="rectangle" className="mx-auto" />

        {/* Group standings */}
        <GroupSection
          groupData={groupData}
          teamApiName={team.apiName}
          group={derivedGroup}
        />

        {/* How to Watch */}
        <WatchSection team={team} />

        {/* Team profile + squad */}
        <SquadSection team={team} />

        {/* Newsletter */}
        <NewsletterSignup
          source={`team-${team.slug}`}
          heading={`Get ${team.displayName} World Cup 2026 alerts`}
          description={`Follow every ${team.displayName} match — fixture reminders, live scores and result roundups delivered free.`}
        />

        {/* Internal links */}
        <InternalLinks team={team} group={derivedGroup} />
      </div>
    </>
  );
}
