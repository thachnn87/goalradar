import Link from 'next/link';
import type { Metadata } from 'next';

import { getWCResults } from '@/lib/api';
import type { Match } from '@/lib/types';
import { matchPath } from '@/lib/url';
import Breadcrumb from '@/components/Breadcrumb';
import MatchCard from '@/components/MatchCard';
import AdSlot from '@/components/AdSlot';

export const revalidate = 60;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/results`;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

const META_TITLE = 'FIFA World Cup 2026 Results | GoalRadar';
const META_DESC  = 'Latest FIFA World Cup 2026 results, scores and completed matches.';

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    type: 'website',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: META_TITLE,
    description: META_DESC,
  },
};

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ results }: { results: Match[] }) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',            item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',  item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Results',         item: PAGE_URL },
    ],
  };

  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: META_TITLE,
    description: META_DESC,
    url: PAGE_URL,
    isPartOf: { '@type': 'WebSite', name: 'GoalRadar', url: BASE_URL },
    hasPart: results.map((m) => ({
      '@type': 'SportsEvent',
      name: `${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}`,
      sport: 'Football',
      startDate: m.utcDate,
      url: `${BASE_URL}${matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}`,
      description: `Full-time: ${m.score.fullTime.home ?? '–'} – ${m.score.fullTime.away ?? '–'}`,
      superEvent: {
        '@type': 'SportsEvent',
        name: 'FIFA World Cup 2026',
        url: `${BASE_URL}/world-cup-2026`,
      },
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
// Helpers
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE:    'Group Stage',
  LAST_32:        'Round of 32',
  LAST_16:        'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS:    'Semi-finals',
  THIRD_PLACE:    'Third Place Play-off',
  FINAL:          'Final',
};

/** Stage ordering weight — lower = earlier in the tournament */
const STAGE_ORDER: Record<string, number> = {
  GROUP_STAGE: 0, LAST_32: 1, LAST_16: 2,
  QUARTER_FINALS: 3, SEMI_FINALS: 4, THIRD_PLACE: 5, FINAL: 6,
};

function formatDayHeading(isoDate: string) {
  return new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  });
}

function groupByDate(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((acc, m) => {
    const d = m.utcDate.split('T')[0];
    (acc[d] ??= []).push(m);
    return acc;
  }, {});
}

function topStageLabel(dayMatches: Match[]) {
  const stages = [...new Set(dayMatches.map((m) => m.stage))];
  stages.sort((a, b) => (STAGE_ORDER[b] ?? 0) - (STAGE_ORDER[a] ?? 0));
  return stages
    .map((s) => STAGE_LABELS[s] ?? s.replace(/_/g, ' '))
    .join(' · ');
}

// ---------------------------------------------------------------------------
// Stats summary
// ---------------------------------------------------------------------------

function StatsSummary({ results }: { results: Match[] }) {
  const played    = results.length;
  const goals     = results.reduce((s, m) => s + (m.score.fullTime.home ?? 0) + (m.score.fullTime.away ?? 0), 0);
  const homeWins  = results.filter((m) => m.score.winner === 'HOME_TEAM').length;
  const draws     = results.filter((m) => m.score.winner === 'DRAW').length;
  const awayWins  = results.filter((m) => m.score.winner === 'AWAY_TEAM').length;
  const avgGoals  = played > 0 ? (goals / played).toFixed(1) : '–';
  const cleanShts = results.filter(
    (m) => (m.score.fullTime.home ?? 1) === 0 || (m.score.fullTime.away ?? 1) === 0
  ).length;

  const stats = [
    { label: 'Matches',      value: String(played),    sub: 'played' },
    { label: 'Goals',        value: String(goals),     sub: `${avgGoals} per match` },
    { label: 'Home Wins',    value: String(homeWins),  sub: 'home advantage' },
    { label: 'Draws',        value: String(draws),     sub: 'shared points' },
    { label: 'Away Wins',    value: String(awayWins),  sub: 'on the road' },
    { label: 'Clean Sheets', value: String(cleanShts), sub: 'shutouts' },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
      {stats.map(({ label, value, sub }) => (
        <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">{label}</p>
          <p className="text-lg sm:text-xl font-black text-white leading-none">{value}</p>
          <p className="text-[10px] text-gray-600 mt-1 hidden sm:block">{sub}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCResultsPage() {
  let results: Match[] = [];
  try {
    const data = await getWCResults();
    results = [...data.matches].sort(
      (a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
    );
  } catch {
    // graceful degradation
  }

  const byDate = groupByDate(results);
  const dates  = Object.keys(byDate).sort((a, b) => b.localeCompare(a)); // newest first

  return (
    <>
      <JsonLd results={results} />

      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Home',           href: '/' },
            { label: 'World Cup 2026', href: '/world-cup-2026' },
            { label: 'Results' },
          ]}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">🏁</span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                World Cup Results
                {results.length > 0 && (
                  <span className="ml-2 text-base font-normal text-gray-500">
                    ({results.length} matches)
                  </span>
                )}
              </h1>
            </div>
            <p className="text-gray-500 text-sm">
              FIFA World Cup 2026 · All full-time scores
            </p>
          </div>
          <Link
            href="/world-cup-2026"
            className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium shrink-0 mt-1"
          >
            ← WC Hub
          </Link>
        </div>

        {/* Internal navigation */}
        <nav aria-label="World Cup navigation" className="flex flex-wrap gap-2">
          {[
            { href: '/world-cup-2026',          label: '🏆 Hub' },
            { href: '/schedule?competition=WC', label: '📅 Fixtures' },
            { href: '/world-cup-2026/bracket',  label: '🔗 Bracket' },
            { href: '/world-cup-2026/group-a',  label: '📊 Group A' },
            { href: '/world-cup-2026/group-b',  label: 'Group B' },
            { href: '/world-cup-2026/group-c',  label: 'Group C' },
            { href: '/live',                    label: '🔴 Live' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Stats summary */}
        {results.length > 0 && <StatsSummary results={results} />}

        {/* Ad: below stats */}
        <AdSlot slotId="results-top" variant="banner" />

        {/* Results grouped by date — MatchCard grid */}
        {results.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-4">🏁</div>
            <h2 className="text-gray-200 font-bold text-xl mb-2">No results yet</h2>
            <p className="text-gray-500 text-sm mb-4">
              Results will appear here once the tournament kicks off on 11 June 2026.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/schedule?competition=WC"
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                📅 View Fixtures
              </Link>
              <Link
                href="/world-cup-2026"
                className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-gray-700"
              >
                🏆 World Cup Hub
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {dates.map((date) => {
              const dayMatches = byDate[date];
              const stagesLabel = topStageLabel(dayMatches);

              return (
                <section key={date} aria-labelledby={`date-${date}`}>
                  {/* Date + stage heading */}
                  <div className="flex items-center gap-3 mb-3">
                    <h2
                      id={`date-${date}`}
                      className="text-sm font-bold text-gray-200"
                    >
                      {formatDayHeading(date)}
                    </h2>
                    <span className="text-gray-600 text-xs hidden sm:inline">{stagesLabel}</span>
                    <span className="text-gray-700 text-xs ml-auto shrink-0">
                      {dayMatches.length} match{dayMatches.length !== 1 ? 'es' : ''}
                    </span>
                  </div>

                  {/* Stage label — mobile only */}
                  <p className="text-gray-600 text-xs mb-3 sm:hidden">{stagesLabel}</p>

                  {/* Match cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dayMatches.map((m) => (
                      <MatchCard key={m.id} match={m} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Ad: bottom of results */}
        <AdSlot slotId="results-bottom" variant="banner" />

        {/* Footer internal links */}
        <div className="border-t border-gray-800 pt-6 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <Link href="/world-cup-2026"           className="hover:text-white transition-colors">🏆 Tournament Hub</Link>
          <Link href="/world-cup-2026/bracket"   className="hover:text-white transition-colors">🔗 Knockout Bracket</Link>
          <Link href="/schedule?competition=WC"  className="hover:text-white transition-colors">📅 Upcoming Fixtures</Link>
          <Link href="/world-cup-2026/group-a"   className="hover:text-white transition-colors">📊 Group Standings</Link>
          <Link href="/live"                     className="hover:text-white transition-colors">🔴 Live Scores</Link>
        </div>
      </div>
    </>
  );
}
