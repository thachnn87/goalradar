/**
 * /world-cup-2026/teams/[slug]
 *
 * Programmatic SEO pages for ALL 48 World Cup 2026 teams.
 * Static generation at build time via generateStaticParams.
 * ISR 3600 — team data updates hourly during the tournament.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WC_ALL_TEAM_SLUGS, getWCTeam } from '@/lib/wc-all-teams';
import { getTeamFixtures, type WCGroupFixture } from '@/lib/wc-fixtures';
import { getUpcomingMatches, getRecentMatches, getStandings } from '@/lib/api';
import type { Match, StandingTable, StandingEntry } from '@/lib/types';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import { matchPath } from '@/lib/url';

export const revalidate = 3600;

const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Static params & metadata
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return WC_ALL_TEAM_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = getWCTeam(slug);
  if (!team) return {};

  const canonicalUrl = `${BASE_URL}/world-cup-2026/teams/${slug}`;
  return {
    title: team.metaTitle,
    description: team.metaDesc,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: team.metaTitle,
      description: team.metaDesc,
      type: 'website',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: team.metaTitle,
      description: team.metaDesc,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKickoff(utcDate: string): string {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

function formatScore(m: Match): string {
  const h = m.score?.fullTime?.home;
  const a = m.score?.fullTime?.away;
  if (h === null || h === undefined || a === null || a === undefined) return 'vs';
  return `${h} – ${a}`;
}

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  LAST_32:     'Round of 32',
  LAST_16:     'Round of 16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS: 'SF',
  FINAL:       'Final',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = getWCTeam(slug);
  if (!team) notFound();

  const canonicalUrl = `${BASE_URL}/world-cup-2026/teams/${slug}`;

  // Fetch all WC match data — filter by team name client side (no dedicated endpoint)
  let upcoming: Match[] = [];
  let recent: Match[]   = [];
  let standingEntry: StandingEntry | null = null;
  let standingGroupLabel = '';

  // Local fallback fixtures — used when API returns nothing (pre-tournament or API down)
  let localTeamFixtures: WCGroupFixture[] = [];

  try {
    const [upcomingData, recentData, standingsData] = await Promise.allSettled([
      getUpcomingMatches('WC'),
      getRecentMatches('WC'),
      getStandings('WC'),
    ]);

    if (upcomingData.status === 'fulfilled') {
      upcoming = upcomingData.value.matches.filter(
        (m) =>
          m.homeTeam?.name?.toLowerCase().includes(team.apiName.toLowerCase()) ||
          m.awayTeam?.name?.toLowerCase().includes(team.apiName.toLowerCase()) ||
          m.homeTeam?.name?.toLowerCase() === team.displayName.toLowerCase() ||
          m.awayTeam?.name?.toLowerCase() === team.displayName.toLowerCase()
      );
    }

    if (recentData.status === 'fulfilled') {
      recent = recentData.value.matches.filter(
        (m) =>
          m.homeTeam?.name?.toLowerCase().includes(team.apiName.toLowerCase()) ||
          m.awayTeam?.name?.toLowerCase().includes(team.apiName.toLowerCase()) ||
          m.homeTeam?.name?.toLowerCase() === team.displayName.toLowerCase() ||
          m.awayTeam?.name?.toLowerCase() === team.displayName.toLowerCase()
      );
    }

    if (standingsData.status === 'fulfilled') {
      const tables: StandingTable[] = (standingsData.value.standings ?? []).filter(
        (s) => s.type === 'TOTAL'
      );
      for (let i = 0; i < tables.length; i++) {
        const entry = tables[i].table.find(
          (e) =>
            e.team?.name?.toLowerCase().includes(team.apiName.toLowerCase()) ||
            e.team?.name?.toLowerCase() === team.displayName.toLowerCase()
        );
        if (entry) {
          standingEntry = entry;
          standingGroupLabel = String.fromCharCode(65 + i);
          break;
        }
      }
    }
  } catch { /* render with static content */ }

  // If API returned nothing, load local scheduled fixtures for this team
  if (upcoming.length === 0 && recent.length === 0) {
    localTeamFixtures = getTeamFixtures(slug);
  }

  // Form helper
  const recentForm: string[] = (recent.slice(0, 5).map((m) => {
    const isHome = m.homeTeam?.name?.toLowerCase().includes(team.apiName.toLowerCase()) ||
                   m.homeTeam?.name?.toLowerCase() === team.displayName.toLowerCase();
    const hg = m.score?.fullTime?.home ?? 0;
    const ag = m.score?.fullTime?.away ?? 0;
    if (hg === ag) return 'D';
    const teamWon = isHome ? hg > ag : ag > hg;
    return teamWon ? 'W' : 'L';
  })).filter(Boolean);

  const groupSlug = team.group !== 'TBD' ? `group-${team.group.toLowerCase()}` : null;

  const jsonLdTeam = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.displayName,
    memberOf: {
      '@type': 'SportsOrganization',
      name: 'FIFA',
    },
    sport: 'Football (Soccer)',
    url: canonicalUrl,
  };

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',                    item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',          item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: `${team.displayName} — WC 2026`, item: canonicalUrl },
    ],
  };

  const faq = [
    {
      q: `Is ${team.displayName} in the World Cup 2026?`,
      a: `Yes. ${team.displayName} (${team.confederation}) qualified for the FIFA World Cup 2026, which takes place in USA, Canada and Mexico from 11 June to 19 July 2026.`,
    },
    {
      q: `What group is ${team.displayName} in at World Cup 2026?`,
      a: team.group !== 'TBD'
        ? `${team.displayName} are in Group ${team.group} at the FIFA World Cup 2026. The top two teams from each group advance to the Round of 32.`
        : `${team.displayName}'s group at the FIFA World Cup 2026 will be confirmed after the official draw.`,
    },
    {
      q: `When does ${team.displayName} play at World Cup 2026?`,
      a: upcoming.length > 0
        ? `${team.displayName}'s next match is ${upcoming[0].homeTeam?.name} vs ${upcoming[0].awayTeam?.name} on ${formatKickoff(upcoming[0].utcDate)}.`
        : `Check the full FIFA World Cup 2026 schedule on GoalRadar for ${team.displayName}'s upcoming fixtures.`,
    },
    {
      q: `How can I watch ${team.displayName} at World Cup 2026?`,
      a: `World Cup 2026 is broadcast in the USA on Fox Sports and Telemundo. In the UK on ITV and BBC. In Australia on SBS. Check our Watch Live guide for all country broadcasters.`,
    },
  ];

  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdTeam) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: team.displayName },
        ]} />
        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">
              {team.flag} FIFA World Cup 2026 · {team.confederation}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">
            {team.displayName} at World Cup 2026
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">{team.intro}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {team.group !== 'TBD' && (
              <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">
                Group {team.group}
              </span>
            )}
            <span className="bg-white/5 border border-white/10 text-gray-300 text-xs px-3 py-1 rounded-full">
              FIFA #{team.fifaRanking}
            </span>
            <span className="bg-white/5 border border-white/10 text-gray-300 text-xs px-3 py-1 rounded-full">
              {team.confederation}
            </span>
          </div>
        </div>

        <AdSlot slotId={`team-${slug}-top`} variant="banner" />

        {/* Current standing */}
        {standingEntry && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">
              Group {standingGroupLabel} Standing
            </h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-8 text-xs text-gray-500 font-semibold uppercase px-4 py-2 border-b border-gray-800">
                <span>#</span>
                <span className="col-span-3">Team</span>
                <span className="text-center">P</span>
                <span className="text-center">GD</span>
                <span className="text-center">W-D-L</span>
                <span className="text-center font-bold text-white">Pts</span>
              </div>
              <div className="bg-yellow-500/5 border-l-2 border-yellow-400 px-4 py-3 grid grid-cols-8 items-center text-sm">
                <span className="text-gray-400">{standingEntry.position}</span>
                <span className="col-span-3 text-white font-bold flex items-center gap-2">
                  {team.flag} {team.shortName}
                </span>
                <span className="text-center text-gray-400">{standingEntry.playedGames}</span>
                <span className="text-center text-gray-400">
                  {standingEntry.goalDifference > 0 ? `+${standingEntry.goalDifference}` : standingEntry.goalDifference}
                </span>
                <span className="text-center text-gray-400 text-xs">
                  {standingEntry.won}-{standingEntry.draw}-{standingEntry.lost}
                </span>
                <span className="text-center text-white font-black">{standingEntry.points}</span>
              </div>
            </div>
            {groupSlug && (
              <Link href={`/world-cup-2026/${groupSlug}`}
                className="inline-block mt-2 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
                Full Group {standingGroupLabel} standings →
              </Link>
            )}
          </section>
        )}

        {/* Recent form */}
        {recentForm.length > 0 && (
          <div className="flex items-center gap-3 mb-8">
            <span className="text-xs text-gray-500 font-semibold">Recent form:</span>
            <div className="flex gap-1.5">
              {recentForm.map((r, i) => (
                <span key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                  r === 'W' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  r === 'D' ? 'bg-gray-700 text-gray-300 border border-gray-600' :
                  'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming fixtures */}
        {upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">Upcoming Fixtures</h2>
            <div className="space-y-2">
              {upcoming.slice(0, 5).map((m) => (
                <Link key={m.id} href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
                  className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-yellow-700/40 rounded-xl px-4 py-3 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-yellow-400 transition-colors truncate">
                      {m.homeTeam?.name} vs {m.awayTeam?.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatKickoff(m.utcDate)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-600">{STAGE_LABELS[m.stage ?? ''] ?? ''}</span>
                    <span className="text-yellow-600 text-xs">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent results */}
        {recent.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">Recent Results</h2>
            <div className="space-y-2">
              {recent.slice(0, 5).map((m) => {
                const isHome = m.homeTeam?.name?.toLowerCase().includes(team.apiName.toLowerCase()) ||
                               m.homeTeam?.name?.toLowerCase() === team.displayName.toLowerCase();
                const hg = m.score?.fullTime?.home ?? 0;
                const ag = m.score?.fullTime?.away ?? 0;
                const result = hg === ag ? 'D' : (isHome ? hg > ag : ag > hg) ? 'W' : 'L';
                return (
                  <Link key={m.id} href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
                    className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-yellow-700/40 rounded-xl px-4 py-3 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                        result === 'W' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                        result === 'D' ? 'bg-gray-700 text-gray-300 border-gray-600' :
                        'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}>{result}</span>
                      <p className="text-sm font-semibold text-white group-hover:text-yellow-400 transition-colors truncate">
                        {m.homeTeam?.name} vs {m.awayTeam?.name}
                      </p>
                    </div>
                    <span className="text-white font-bold font-mono text-sm shrink-0">{formatScore(m)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Scheduled fixtures from local dataset — shown when API is empty */}
        {upcoming.length === 0 && recent.length === 0 && localTeamFixtures.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">
              Group {team.group} Schedule
            </h2>
            <div className="space-y-2">
              {localTeamFixtures.map((f) => {
                const isHome = f.homeSlug === slug;
                return (
                  <div key={f.localId}
                    className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        <span className={isHome ? 'text-yellow-400' : ''}>{f.homeFlag} {f.homeLabel}</span>
                        <span className="text-gray-500 font-normal mx-2">vs</span>
                        <span className={!isHome ? 'text-yellow-400' : ''}>{f.awayLabel} {f.awayFlag}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(f.utcDate).toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
                        })} UTC · {f.venueCity}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-600 shrink-0">MD{f.matchday}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-600 mt-2 px-1">
              ℹ️ Scheduled kickoff times — live match links appear once the tournament begins.
            </p>
          </section>
        )}

        {/* No data state — only if API empty AND no local fixtures found */}
        {upcoming.length === 0 && recent.length === 0 && localTeamFixtures.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center mb-8">
            <p className="text-3xl mb-3">{team.flag}</p>
            <p className="text-gray-300 font-semibold">Fixtures load once the tournament begins</p>
            <p className="text-gray-500 text-sm mt-1">Check back from 11 June 2026</p>
            <Link href="/world-cup-2026/fixtures"
              className="inline-block mt-4 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
              View full schedule →
            </Link>
          </div>
        )}

        <AdSlot slotId={`team-${slug}-mid`} variant="rectangle" className="mx-auto mb-8" />

        {/* Watch Live CTA */}
        <div className="bg-gradient-to-br from-yellow-950/30 to-gray-900 border border-yellow-800/30 rounded-2xl p-5 mb-8">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1">
            📺 Watch {team.displayName} Live
          </p>
          <p className="text-white font-bold text-base mb-1">Stream every {team.displayName} match</p>
          <p className="text-gray-400 text-sm mb-4">
            Find your official broadcaster and streaming options for every {team.displayName} match at World Cup 2026.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/world-cup-2026/watch-live"
              className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              Watch Live Guide →
            </Link>
            <Link href="/world-cup-2026/tv-schedule"
              className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-700 transition-colors">
              TV Schedule
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">{team.displayName} at World Cup 2026 — FAQ</h2>
          <div className="space-y-3">
            {faq.map(({ q, a }) => (
              <details key={q} className="bg-gray-900 border border-gray-800 rounded-xl group">
                <summary className="px-5 py-4 cursor-pointer text-white font-semibold text-sm list-none flex items-center justify-between gap-3">
                  {q}
                  <span className="text-gray-600 group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        <AdSlot slotId={`team-${slug}-bottom`} variant="banner" />

        <WCRelatedLinks links={[
          ...(groupSlug ? [{ href: `/world-cup-2026/${groupSlug}`, icon: '🗂️', label: `Group ${team.group} Standings`, desc: `Table, fixtures and results for Group ${team.group}` }] : []),
          { href: '/world-cup-2026-schedule',       icon: '📅', label: 'WC 2026 Schedule',    desc: 'All 104 fixtures with kickoff times and dates' },
          { href: '/world-cup-2026-results',        icon: '🏁', label: 'WC 2026 Results',     desc: 'Live and full-time scores for every match' },
          { href: '/world-cup-2026-standings',      icon: '📊', label: 'Group Standings',     desc: 'Points tables for all 12 groups' },
          { href: '/world-cup-2026-live-stream',    icon: '📡', label: 'Watch Live',          desc: 'Free streaming options for every country' },
          { href: '/world-cup-2026/teams/argentina',icon: '👥', label: 'All 48 Teams',        desc: 'Browse squads for all WC 2026 nations' },
        ]} />
      </div>
    </>
  );
}
