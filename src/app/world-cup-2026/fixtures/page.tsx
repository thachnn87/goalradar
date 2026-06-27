import Link from 'next/link';
import type { Metadata } from 'next';

import { getWCAuthorityMatchesV2 } from '@/lib/api';
import { enrichKnockoutSlots } from '@/lib/knockout-vm';
import { classifyMatchState } from '@/lib/match-classify';
import type { CanonicalMatch } from '@/lib/canonical-match';
import { canonicalToMatch } from '@/lib/canonical-match';
import { deriveMatchDisplay } from '@/lib/match-display';
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
  title: 'FIFA World Cup 2026 Fixtures & Results | GoalRadar',
  description:
    'FIFA World Cup 2026 fixtures and results. Group stage scores, upcoming matches, kick-off times and knockout bracket for every round.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Fixtures & Results | GoalRadar',
    description: 'Group stage results and upcoming knockout fixtures for FIFA World Cup 2026.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: { card: 'summary_large_image', title: 'World Cup 2026 Fixtures & Results | GoalRadar',
    description: 'FIFA World Cup 2026 group stage results and upcoming knockout fixtures.' },
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

function groupByDate(matches: CanonicalMatch[]): Record<string, CanonicalMatch[]> {
  return matches.reduce<Record<string, CanonicalMatch[]>>((acc, m) => {
    const d = m.utcDate.split('T')[0];
    (acc[d] ??= []).push(m);
    return acc;
  }, {});
}

function topStageLabel(day: CanonicalMatch[]) {
  const ORDER: Record<string,number> = { GROUP_STAGE:0,LAST_32:1,LAST_16:2,QUARTER_FINALS:3,SEMI_FINALS:4,THIRD_PLACE:5,FINAL:6 };
  const stages = [...new Set(day.map(m => m.stage))].sort((a,b)=>(ORDER[b]??0)-(ORDER[a]??0));
  return stages.map(s => STAGE_LABELS[s] ?? s.replace(/_/g,' ')).join(' · ');
}

// ---------------------------------------------------------------------------
// Shared match list renderer
// ---------------------------------------------------------------------------

function MatchDateList({
  byDate,
  dates,
  today,
}: {
  byDate: Record<string, CanonicalMatch[]>;
  dates: string[];
  today: string;
}) {
  return (
    <div className="space-y-8">
      {dates.map(date => {
        const day = byDate[date];
        return (
          <section key={date} aria-labelledby={`date-${date}`}>
            <div className="flex items-center gap-3 mb-3">
              <h3 id={`date-${date}`} className="text-sm font-bold text-gray-200">
                {formatDayHeading(date)}
              </h3>
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
                    {(() => {
                      const md = deriveMatchDisplay(canonicalToMatch(m));
                      if (md.badgeStyle === 'finished') return (
                        <div className="flex flex-col items-center shrink-0 gap-0">
                          <span className="text-white font-bold text-sm font-mono leading-tight">
                            {md.homeScore ?? '–'}&nbsp;–&nbsp;{md.awayScore ?? '–'}
                          </span>
                          <span className="text-gray-600 text-[10px] leading-tight">FT</span>
                        </div>
                      );
                      if (md.showLiveBadge) return (
                        <div className="flex flex-col items-center shrink-0 gap-0">
                          <span className="text-red-400 font-bold text-sm font-mono leading-tight">
                            {md.homeScore ?? '–'}&nbsp;–&nbsp;{md.awayScore ?? '–'}
                          </span>
                          <span className="text-red-500 text-[10px] leading-tight">LIVE</span>
                        </div>
                      );
                      return <span className="text-gray-600 text-xs shrink-0 font-mono">vs</span>;
                    })()}
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
  );
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ matches }: { matches: CanonicalMatch[] }) {
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
  const builtAt = new Date().toISOString();
  let fixtures: CanonicalMatch[] = [];
  try {
    const data = await getWCAuthorityMatchesV2(builtAt, { source: '/world-cup-2026/fixtures', sourceType: 'page' });
    const sorted = [...data.matches].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
    fixtures = await enrichKnockoutSlots(sorted);
  } catch { /* graceful degradation */ }
  const today = new Date().toISOString().split('T')[0];

  const upcoming = fixtures.filter(m => classifyMatchState(m, today) !== 'finished');
  const results  = fixtures.filter(m => classifyMatchState(m, today) === 'finished');

  const upcomingByDate = groupByDate(upcoming);
  const upcomingDates  = Object.keys(upcomingByDate).sort();

  const resultsByDate  = groupByDate(results);
  const resultsDates   = Object.keys(resultsByDate).sort().reverse(); // newest first

  return (
    <>
      <JsonLd matches={upcoming.length > 0 ? upcoming : results} />

      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Fixtures & Results' },
        ]} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">📅</span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                WC 2026 Fixtures & Results
              </h1>
            </div>
            <p className="text-gray-500 text-sm">
              FIFA World Cup 2026 · Group stage results{upcoming.length > 0 ? ' & upcoming matches' : ' · Knockout bracket starts 2 July'}
            </p>
          </div>
          <Link href="/world-cup-2026" className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium shrink-0 mt-1">
            ← WC Hub
          </Link>
        </div>

        {/* Cross-page navigation */}
        <WCPageNav />

        {/* Timezone banner */}
        <TimezoneBanner />

        {/* ── Section A: Upcoming Fixtures ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Upcoming Fixtures</h2>
            <Link
              href="/world-cup-2026/bracket"
              className="text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              View Knockout Bracket →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="text-5xl shrink-0">🔗</div>
                <div className="text-center sm:text-left">
                  <p className="text-white font-semibold text-base mb-1">Group stage complete — knockout round next</p>
                  <p className="text-gray-400 text-sm mb-4">
                    All group stage matches have been played. The Round of 32 begins on <strong className="text-white">2 July 2026</strong>.
                    View confirmed matchups and kick-off times in the knockout bracket.
                  </p>
                  <Link
                    href="/world-cup-2026/bracket"
                    className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    View Knockout Bracket →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <MatchDateList byDate={upcomingByDate} dates={upcomingDates} today={today} />
          )}
        </section>

        {/* ── Section B: Recent Results ────────────────────────────────── */}
        {results.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold text-white">Recent Results</h2>
              <span className="text-gray-600 text-xs">
                {results.length} match{results.length !== 1 ? 'es' : ''}
              </span>
            </div>
            <MatchDateList byDate={resultsByDate} dates={resultsDates} today={today} />
          </section>
        )}

        {fixtures.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-gray-300 font-semibold">No fixtures found</p>
            <p className="text-gray-500 text-sm mt-1">Check back soon for match data.</p>
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
