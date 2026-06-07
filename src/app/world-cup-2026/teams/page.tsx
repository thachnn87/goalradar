/**
 * /world-cup-2026/teams
 *
 * SEO landing page listing all 48 FIFA World Cup 2026 teams.
 * Targets: "world cup 2026 teams", "wc 2026 squads", "world cup 2026 countries"
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { WC_ALL_TEAMS } from '@/lib/wc-all-teams';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/teams`;

export const metadata: Metadata = {
  title: 'All 48 FIFA World Cup 2026 Teams – Groups, Squads & Fixtures | GoalRadar',
  description:
    'Complete list of all 48 FIFA World Cup 2026 teams across Groups A–L. Browse squads, fixtures, results and group standings for every nation competing in USA, Canada and Mexico.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'All 48 FIFA World Cup 2026 Teams | GoalRadar',
    description:
      'Every nation at World Cup 2026 — squads, fixtures and group standings for all 48 teams across Groups A–L.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIFA World Cup 2026 Teams | GoalRadar',
    description: 'All 48 teams at World Cup 2026 — squads, fixtures and group standings.',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFEDERATION_LABELS: Record<string, string> = {
  UEFA:     'UEFA – Europe',
  CONMEBOL: 'CONMEBOL – South America',
  CONCACAF: 'CONCACAF – North & Central America',
  CAF:      'CAF – Africa',
  AFC:      'AFC – Asia',
  OFC:      'OFC – Oceania',
};

const CONFEDERATION_ORDER = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',            item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',  item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Teams',           item: PAGE_URL },
    ],
  };

  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'FIFA World Cup 2026 Teams',
    description: 'All 48 national teams competing at the FIFA World Cup 2026 in USA, Canada and Mexico.',
    url: PAGE_URL,
    isPartOf: { '@type': 'WebSite', name: 'GoalRadar', url: BASE_URL },
    numberOfItems: WC_ALL_TEAMS.length,
    hasPart: WC_ALL_TEAMS.map((t) => ({
      '@type': 'SportsTeam',
      name: t.displayName,
      url: `${BASE_URL}/world-cup-2026/teams/${t.slug}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WCTeamsPage() {
  const byConfederation = CONFEDERATION_ORDER.map((conf) => ({
    conf,
    label: CONFEDERATION_LABELS[conf] ?? conf,
    teams: WC_ALL_TEAMS.filter((t) => t.confederation === conf),
  })).filter((c) => c.teams.length > 0);

  const byGroup = GROUPS.map((g) => ({
    group: g,
    teams: WC_ALL_TEAMS.filter((t) => t.group === g),
  })).filter((g) => g.teams.length > 0);

  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Teams' },
        ]} />

        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-4 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">👥 FIFA World Cup 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Teams
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
            <strong className="text-white">48 nations</strong> compete at the FIFA World Cup 2026 across{' '}
            <strong className="text-white">12 groups</strong> (A–L), playing{' '}
            <strong className="text-white">104 matches</strong> in the United States, Canada and Mexico.
            Browse every team&apos;s fixtures, results, squad and group standing below.
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mt-5">
            {[
              { label: '48', sublabel: 'Nations' },
              { label: '12', sublabel: 'Groups' },
              { label: '104', sublabel: 'Matches' },
              { label: '6', sublabel: 'Confederations' },
            ].map(({ label, sublabel }) => (
              <div key={sublabel} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center min-w-[80px]">
                <p className="text-white font-black text-xl leading-none">{label}</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-1">{sublabel}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Browse by Group */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">
            Browse by Group
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byGroup.map(({ group, teams }) => (
              <div
                key={group}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <Link
                    href={`/world-cup-2026/group-${group.toLowerCase()}`}
                    className="text-white font-black text-lg hover:text-yellow-400 transition-colors"
                  >
                    Group {group}
                  </Link>
                  <Link
                    href={`/world-cup-2026/group-${group.toLowerCase()}`}
                    className="text-xs text-gray-600 hover:text-yellow-400 transition-colors"
                  >
                    Standings →
                  </Link>
                </div>
                <div className="space-y-1.5">
                  {teams.map((team) => (
                    <Link
                      key={team.slug}
                      href={`/world-cup-2026/teams/${team.slug}`}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors group"
                    >
                      <span className="text-lg leading-none">{team.flag}</span>
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">
                        {team.displayName}
                      </span>
                      <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition-colors">
                        #{team.fifaRanking}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Browse by Confederation */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4">
            Browse by Confederation
          </h2>
          <div className="space-y-6">
            {byConfederation.map(({ conf, label, teams }) => (
              <div key={conf}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  {label} <span className="text-gray-600 font-normal normal-case tracking-normal">({teams.length} teams)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {teams.map((team) => (
                    <Link
                      key={team.slug}
                      href={`/world-cup-2026/teams/${team.slug}`}
                      className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-xl px-3 py-2.5 transition-all group"
                    >
                      <span className="text-xl leading-none shrink-0">{team.flag}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200 group-hover:text-white transition-colors truncate leading-tight">
                          {team.shortName || team.displayName}
                        </p>
                        <p className="text-[10px] text-gray-600 leading-tight">
                          Group {team.group !== 'TBD' ? team.group : '—'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* All groups quick nav */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Group Standings
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
            {GROUPS.map((g) => (
              <Link
                key={g}
                href={`/world-cup-2026/group-${g.toLowerCase()}`}
                className="bg-gray-900 hover:bg-yellow-500/10 border border-gray-800 hover:border-yellow-700/40 rounded-xl p-2.5 text-center transition-all"
              >
                <span className="text-white font-black text-base">{g}</span>
              </Link>
            ))}
          </div>
        </section>

        <WCRelatedLinks links={[
          { href: '/world-cup-2026',              icon: '🏆', label: 'WC 2026 Hub',       desc: 'Full tournament overview' },
          { href: '/world-cup-2026/groups',        icon: '📊', label: 'Group Standings',   desc: 'Live points tables for all 12 groups' },
          { href: '/world-cup-2026/venues',        icon: '🏟️', label: 'Stadiums & Venues', desc: 'All 16 host stadiums across 3 countries' },
          { href: '/world-cup-2026/host-cities',   icon: '🌆', label: 'Host Cities',       desc: '16 cities hosting World Cup 2026 matches' },
          { href: '/world-cup-2026/matches',       icon: '⚽', label: 'All Matches',       desc: 'Fixtures, results and live scores' },
          { href: '/world-cup-2026-schedule',      icon: '📅', label: 'Match Schedule',    desc: 'All 104 fixtures with kickoff times' },
        ]} heading="More World Cup 2026" />
      </div>
    </>
  );
}
