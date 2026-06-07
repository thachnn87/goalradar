import Link from 'next/link';
import type { Metadata } from 'next';

import { getUpcomingMatches } from '@/lib/api';
import type { Match } from '@/lib/types';
import { matchPath } from '@/lib/url';
import Breadcrumb from '@/components/Breadcrumb';
import MatchCard from '@/components/MatchCard';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import TimezoneBanner from '@/components/TimezoneBanner';
import LocalTime from '@/components/LocalTime';

export const revalidate = 900; // align with FIXTURES TTL (15 min)

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/fixtures`;

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Fixtures & Schedule | GoalRadar',
  description:
    'Complete FIFA World Cup 2026 fixture list. All upcoming matches, kick-off times, dates and venues for every group stage and knockout round.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Fixtures | GoalRadar',
    description: 'All upcoming FIFA World Cup 2026 matches — kick-off times, teams and dates.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: { card: 'summary_large_image', title: 'World Cup 2026 Fixtures | GoalRadar',
    description: 'Full FIFA World Cup 2026 schedule with kick-off times for every match.' },
};

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

function formatDayHeading(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function formatKickoff(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

function groupByDate(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((acc, m) => {
    const d = m.utcDate.split('T')[0];
    (acc[d] ??= []).push(m);
    return acc;
  }, {});
}

function topStageLabel(day: Match[]) {
  const ORDER: Record<string,number> = { GROUP_STAGE:0,LAST_32:1,LAST_16:2,QUARTER_FINALS:3,SEMI_FINALS:4,THIRD_PLACE:5,FINAL:6 };
  const stages = [...new Set(day.map(m => m.stage))].sort((a,b)=>(ORDER[b]??0)-(ORDER[a]??0));
  return stages.map(s => STAGE_LABELS[s] ?? s.replace(/_/g,' ')).join(' · ');
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ matches }: { matches: Match[] }) {
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',            item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',  item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Fixtures',        item: PAGE_URL },
    ],
  };

  const collection = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'FIFA World Cup 2026 Fixtures',
    description: 'All upcoming FIFA World Cup 2026 matches and kick-off times.',
    url: PAGE_URL,
    isPartOf: { '@type': 'WebSite', name: 'GoalRadar', url: BASE_URL },
    hasPart: matches.slice(0, 50).map(m => ({
      '@type': 'SportsEvent',
      name: `${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}`,
      sport: 'Association football',
      startDate: m.utcDate,
      url: `${BASE_URL}${matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}`,
      superEvent: { '@type': 'SportsEvent', name: 'FIFA World Cup 2026', url: `${BASE_URL}/world-cup-2026` },
    })),
  };

  // ItemList for Google rich results — top 24 upcoming fixtures
  const itemList = matches.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'FIFA World Cup 2026 Fixtures',
    description: 'Upcoming FIFA World Cup 2026 match fixtures and kick-off times',
    url: PAGE_URL,
    numberOfItems: matches.length,
    itemListElement: matches.slice(0, 24).map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SportsEvent',
        name: `${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}`,
        startDate: m.utcDate,
        sport: 'Association football',
        url: `${BASE_URL}${matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}`,
        homeTeam: { '@type': 'SportsTeam', name: m.homeTeam?.name ?? 'TBD' },
        awayTeam: { '@type': 'SportsTeam', name: m.awayTeam?.name ?? 'TBD' },
        location: {
          '@type': 'SportsActivityLocation',
          name: 'FIFA World Cup 2026 Venue',
        },
        organizer: { '@type': 'Organization', name: 'FIFA' },
      },
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      {itemList && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCFixturesPage() {
  let fixtures: Match[] = [];
  try {
    const data = await getUpcomingMatches('WC');
    fixtures = [...data.matches].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
  } catch { /* graceful degradation */ }

  const byDate = groupByDate(fixtures);
  const dates  = Object.keys(byDate).sort();

  return (
    <>
      <JsonLd matches={fixtures} />

      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Fixtures' },
        ]} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">📅</span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                WC 2026 Fixtures
                {fixtures.length > 0 && (
                  <span className="ml-2 text-base font-normal text-gray-500">
                    ({fixtures.length} matches)
                  </span>
                )}
              </h1>
            </div>
            <p className="text-gray-500 text-sm">FIFA World Cup 2026 · Upcoming matches & kick-off times</p>
          </div>
          <Link href="/world-cup-2026" className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium shrink-0 mt-1">
            ← WC Hub
          </Link>
        </div>

        {/* Cross-page navigation */}
        <WCPageNav />

        {/* Timezone banner */}
        <TimezoneBanner />

        {/* Fixture list */}
        {fixtures.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-gray-300 font-semibold">No upcoming fixtures found</p>
            <p className="text-gray-500 text-sm mt-1">
              The World Cup 2026 kicks off on <strong className="text-white">11 June 2026</strong>. Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {dates.map(date => {
              const day = byDate[date];
              return (
                <section key={date} aria-labelledby={`date-${date}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 id={`date-${date}`} className="text-sm font-bold text-gray-200">
                      {formatDayHeading(date)}
                    </h2>
                    <span className="text-gray-600 text-xs hidden sm:inline">{topStageLabel(day)}</span>
                    <span className="text-gray-700 text-xs ml-auto shrink-0">
                      {day.length} match{day.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  {/* Kickoff time list */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50 mb-3">
                    {day.map(m => {
                      const hn = m.homeTeam?.shortName || m.homeTeam?.name || 'TBD';
                      const an = m.awayTeam?.shortName || m.awayTeam?.name || 'TBD';
                      return (
                        <Link
                          key={m.id}
                          href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors group"
                        >
                          <div className="flex flex-col items-start gap-0.5 w-20 shrink-0">
                            <span className="text-white font-mono text-xs">{formatKickoff(m.utcDate)}</span>
                            <LocalTime utcDate={m.utcDate} variant="badge" />
                          </div>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                            {m.homeTeam?.crest && <img src={m.homeTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />}
                            <span className="text-gray-200 text-sm font-medium truncate text-right group-hover:text-white">{hn}</span>
                          </div>
                          <span className="text-gray-600 text-xs shrink-0 font-mono">vs</span>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-gray-200 text-sm font-medium truncate group-hover:text-white">{an}</span>
                            {m.awayTeam?.crest && <img src={m.awayTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />}
                          </div>
                          <span className="text-yellow-600 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        </Link>
                      );
                    })}
                  </div>
                  {/* Card grid for visual context */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {day.map(m => <MatchCard key={m.id} match={m} />)}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <WCRelatedLinks links={[
          { href: '/world-cup-2026-schedule',   icon: '📅', label: 'WC 2026 Schedule',    desc: 'Timezone-first view with day-by-day breakdown' },
          { href: '/world-cup-2026-results',    icon: '🏁', label: 'WC 2026 Results',     desc: 'Full-time and live scores for every match' },
          { href: '/world-cup-2026-standings',  icon: '📊', label: 'Group Standings',     desc: 'Points tables for all 12 groups updated live' },
          { href: '/world-cup-2026-groups',     icon: '🗂️', label: 'Group Stage Guide',   desc: 'All 12 draws with tiebreaker rules explained' },
          { href: '/world-cup-2026-bracket',    icon: '🔗', label: 'Knockout Bracket',    desc: 'Round of 32 path to the Final at MetLife' },
          { href: '/world-cup-2026-live-stream',icon: '📡', label: 'Watch Live',          desc: 'Stream every match free or cheaply online' },
        ]} />
      </div>
    </>
  );
}
