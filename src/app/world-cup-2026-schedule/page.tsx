/**
 * /world-cup-2026-schedule
 *
 * Programmatic SEO landing page targeting:
 * "world cup 2026 schedule" | "2026 world cup schedule" | "fifa world cup 2026 schedule"
 *
 * Unique angle vs /world-cup-2026/fixtures: timezone-first schedule view
 * with day-by-day breakdown and local kickoff conversion table.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
// PERF-4.5
import { getUpcomingMatchesCached } from '@/lib/api';
import type { Match } from '@/lib/types';
import { getUpcomingGroupFixtures, type WCGroupFixture } from '@/lib/wc-fixtures';
import { isStaticMode, getStaticGroupFixtures } from '@/data/worldcup/loader';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import NewsletterSignup from '@/components/NewsletterSignup';
import { matchPath } from '@/lib/url';

export const revalidate = 3600;

const BASE_URL = 'https://goalradar.org';
const CANONICAL = `${BASE_URL}/world-cup-2026-schedule`;

export const metadata: Metadata = {
  title: 'World Cup 2026 Schedule — All 104 Matches & Kickoff Times | GoalRadar',
  description:
    'Complete FIFA World Cup 2026 schedule with kickoff times in UTC, ET, BST, CET and ICT. All 104 matches from group stage to the Final at MetLife Stadium on 19 July 2026.',
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'World Cup 2026 Schedule | GoalRadar',
    description:
      'All 104 FIFA World Cup 2026 matches with kickoff times. Group stage, Round of 32, quarter-finals, semi-finals and final.',
    type: 'website',
    url: CANONICAL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Schedule | GoalRadar',
    description:
      'Complete FIFA World Cup 2026 schedule — all 104 matches with kickoff times in your timezone.',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIMEZONE_OFFSETS: { label: string; offset: number }[] = [
  { label: 'UTC',  offset: 0 },
  { label: 'ET',   offset: -4 },
  { label: 'CT',   offset: -5 },
  { label: 'MT',   offset: -6 },
  { label: 'PT',   offset: -7 },
  { label: 'BST',  offset: 1 },
  { label: 'CET',  offset: 2 },
  { label: 'ICT',  offset: 7 },
];

function utcToLocal(utcDate: string, offsetHours: number): string {
  const d = new Date(utcDate);
  d.setHours(d.getHours() + offsetHours);
  return d.toISOString().slice(11, 16);
}

function formatDay(utcDate: string): string {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function groupByDay(matches: Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const day = (m.utcDate ?? '').slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(m);
  }
  return map;
}

const STAGE_LABELS: Record<string, string> = {
  'GROUP_STAGE': 'Group Stage',
  'LAST_32': 'Round of 32',
  'LAST_16': 'Round of 16',
  'QUARTER_FINALS': 'Quarter-Finals',
  'SEMI_FINALS': 'Semi-Finals',
  'THIRD_PLACE': 'Third-Place Play-off',
  'FINAL': 'Final',
};

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------

const FAQ = [
  {
    q: 'When does the 2026 World Cup start?',
    a: 'The FIFA World Cup 2026 kicks off on Thursday, 11 June 2026 in Mexico City at Azteca Stadium, with the host nation Mexico taking on the opening match.',
  },
  {
    q: 'How many matches are in the 2026 World Cup schedule?',
    a: 'There are 104 matches in the FIFA World Cup 2026, up from 64 at the previous tournament. The expanded format features 48 teams across 12 groups, plus a new Round of 32.',
  },
  {
    q: 'When is the 2026 World Cup Final?',
    a: 'The FIFA World Cup 2026 Final takes place on Sunday, 19 July 2026 at MetLife Stadium in East Rutherford, New Jersey (near New York City).',
  },
  {
    q: 'What time zone are World Cup 2026 kickoffs in?',
    a: 'Most group-stage matches kick off between 17:00–21:00 ET (22:00–02:00 UTC). The schedule is designed to suit North American prime-time viewing while remaining watchable in Europe and Asia.',
  },
  {
    q: 'How many groups are in World Cup 2026?',
    a: 'There are 12 groups (A through L) of four teams each. The top two from each group advance automatically, and the eight best third-placed teams also qualify for the Round of 32.',
  },
  {
    q: 'Where can I watch the World Cup 2026 schedule live?',
    a: 'In the USA, Fox Sports and Telemundo hold broadcast rights. In the UK, ITV and BBC share rights. Streaming options vary by country — see our Watch Live guide for details.',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Group local WCGroupFixtures by calendar date (YYYY-MM-DD). */
function groupLocalByDay(fixtures: WCGroupFixture[]): Map<string, WCGroupFixture[]> {
  const map = new Map<string, WCGroupFixture[]>();
  for (const f of fixtures) {
    const day = f.utcDate.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(f);
  }
  return map;
}

export default async function WC2026SchedulePage() {
  let upcoming: Match[] = [];
  let localUpcoming: WCGroupFixture[] = [];

  if (isStaticMode()) {
    // WORLD_CUP_DATA_SOURCE=static — bypass API, use JSON dataset directly
    localUpcoming = getStaticGroupFixtures().slice(0, 48);
  } else {
    try {
      const data = await getUpcomingMatchesCached('WC');
      upcoming = data.matches.slice(0, 48); // first 48 upcoming
    } catch { /* show static FAQ only */ }

    // If API returned nothing, serve local group-stage schedule
    if (upcoming.length === 0) {
      localUpcoming = getUpcomingGroupFixtures().slice(0, 48);
    }
  }

  const byDay = groupByDay(upcoming);
  const days = Array.from(byDay.keys()).sort().slice(0, 14); // next 14 days

  const localByDay = groupLocalByDay(localUpcoming);
  const localDays  = Array.from(localByDay.keys()).sort().slice(0, 14);

  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',                  item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026 Schedule', item: CANONICAL },
    ],
  };

  // ItemList — up to 24 upcoming matches for Google rich results
  const jsonLdItemList = upcoming.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'FIFA World Cup 2026 Schedule',
    description: 'Upcoming FIFA World Cup 2026 matches with kickoff times',
    url: CANONICAL,
    numberOfItems: upcoming.length,
    itemListElement: upcoming.slice(0, 24).map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SportsEvent',
        name: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
        startDate: m.utcDate,
        sport: 'Association football',
        url: `${BASE_URL}${matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}`,
        location: {
          '@type': 'SportsActivityLocation',
          name: 'FIFA World Cup 2026 Venue',
        },
        organizer: { '@type': 'Organization', name: 'FIFA' },
        homeTeam: { '@type': 'SportsTeam', name: m.homeTeam.name },
        awayTeam: { '@type': 'SportsTeam', name: m.awayTeam.name },
      },
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      {jsonLdItemList && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItemList) }} />
      )}

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026 Schedule' },
        ]} />
        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
            📅 FIFA World Cup 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Schedule
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Complete FIFA World Cup 2026 schedule with kickoff times in every timezone.
            104 matches across 16 cities in USA, Canada and Mexico — from group stage to the Final at MetLife Stadium on 19 July 2026.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {['104 Matches', '48 Teams', '12 Groups', '16 Host Cities', '39 Days'].map((stat) => (
              <span key={stat} className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">
                {stat}
              </span>
            ))}
          </div>
        </div>

        <AdSlot slotId="wc-schedule-top" variant="banner" />

        {/* Timezone Quick Reference */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Kickoff Time Converter</h2>
          <p className="text-gray-400 text-sm mb-4">
            Most group-stage matches kick off at 17:00, 20:00 or 21:00 ET. Use this table to find your local time.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase">ET Kickoff</th>
                  {['UTC','BST','CET','ICT'].map((tz) => (
                    <th key={tz} className="px-4 py-3 text-gray-500 text-xs font-semibold uppercase">{tz}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { et: '14:00', utc: '18:00', bst: '19:00', cet: '20:00', ict: '01:00*' },
                  { et: '17:00', utc: '21:00', bst: '22:00', cet: '23:00', ict: '04:00*' },
                  { et: '20:00', utc: '00:00*', bst: '01:00*', cet: '02:00*', ict: '07:00' },
                  { et: '21:00', utc: '01:00*', bst: '02:00*', cet: '03:00*', ict: '08:00' },
                ].map((row) => (
                  <tr key={row.et} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3 text-white font-semibold">{row.et} ET</td>
                    <td className="px-4 py-3 text-gray-300 text-center">{row.utc}</td>
                    <td className="px-4 py-3 text-gray-300 text-center">{row.bst}</td>
                    <td className="px-4 py-3 text-gray-300 text-center">{row.cet}</td>
                    <td className="px-4 py-3 text-gray-300 text-center">{row.ict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 pb-3 text-[10px] text-gray-600">* Next day</p>
          </div>
        </section>

        {/* Live upcoming schedule — from API */}
        {days.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Upcoming Fixtures</h2>
            {days.map((day) => {
              const dayMatches = byDay.get(day) ?? [];
              return (
                <div key={day} className="mb-6">
                  <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3">
                    {formatDay(day + 'T00:00:00Z')}
                  </p>
                  <div className="space-y-2">
                    {dayMatches.map((m) => (
                      <Link key={m.id} href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
                        className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-yellow-700/40 rounded-xl px-4 py-3 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] text-gray-600 font-mono shrink-0">
                            {utcToLocal(m.utcDate, -4)} ET
                          </span>
                          <span className="text-sm text-white font-semibold truncate group-hover:text-yellow-400 transition-colors">
                            {m.homeTeam?.name ?? '?'} vs {m.awayTeam?.name ?? '?'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-gray-600">
                            {STAGE_LABELS[m.stage ?? ''] ?? m.stage ?? ''}
                          </span>
                          <span className="text-yellow-600 text-xs">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Local static schedule — shown when API is unavailable */}
        {days.length === 0 && localDays.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-1">Group Stage Schedule</h2>
            <p className="text-xs text-gray-600 mb-4">
              ℹ️ Showing scheduled kickoff times. Live match links will appear once the tournament begins.
            </p>
            {localDays.map((day) => {
              const dayFixtures = localByDay.get(day) ?? [];
              return (
                <div key={day} className="mb-6">
                  <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3">
                    {formatDay(day + 'T00:00:00Z')}
                  </p>
                  <div className="space-y-2">
                    {dayFixtures.map((f) => (
                      <div key={f.localId}
                        className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] text-gray-600 font-mono shrink-0">
                            {utcToLocal(f.utcDate, -4)} ET
                          </span>
                          <span className="text-sm text-white font-semibold truncate">
                            {f.homeFlag} {f.homeLabel} <span className="text-gray-500 font-normal">vs</span> {f.awayLabel} {f.awayFlag}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-gray-600">Group {f.group} · MD{f.matchday}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Schedule key dates */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Key Dates — World Cup 2026 Schedule</h2>
          <div className="space-y-3">
            {[
              { date: '11 Jun 2026', event: 'Opening Match', detail: 'Mexico vs South Africa · Azteca Stadium, Mexico City', badge: 'bg-green-500/10 text-green-400 border-green-500/20' },
              { date: '11–26 Jun',   event: 'Group Stage',   detail: 'All 12 groups play — 72 matches total', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
              { date: '27 Jun–3 Jul',event: 'Round of 32',   detail: '16 matches — first knockout round (new in 2026)', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
              { date: '4–7 Jul',     event: 'Round of 16',   detail: '8 matches — last 16 compete', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
              { date: '9–12 Jul',    event: 'Quarter-Finals',detail: '4 matches at major stadiums', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
              { date: '15–16 Jul',   event: 'Semi-Finals',   detail: '2 matches determining finalists', badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
              { date: '19 Jul 2026', event: '🏆 World Cup Final', detail: 'MetLife Stadium, East Rutherford NJ', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
            ].map(({ date, event, detail, badge }) => (
              <div key={event} className="flex gap-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border self-start mt-0.5 ${badge}`}>
                  {date}
                </span>
                <div>
                  <p className="text-sm font-bold text-white">{event}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <AdSlot slotId="wc-schedule-mid" variant="rectangle" className="mx-auto mb-8" />

        {/* Host cities */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Host Cities & Venues</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { city: 'New York / NJ', venue: 'MetLife Stadium', matches: 'Final + 7 matches', flag: '🇺🇸' },
              { city: 'Los Angeles',    venue: 'SoFi Stadium',    matches: 'SF + 7 matches',    flag: '🇺🇸' },
              { city: 'Dallas',         venue: 'AT&T Stadium',    matches: 'QF + 6 matches',     flag: '🇺🇸' },
              { city: 'Mexico City',    venue: 'Azteca Stadium',  matches: 'Opening + 5 matches',flag: '🇲🇽' },
              { city: 'Miami',          venue: 'Hard Rock Stadium',matches: 'QF + 6 matches',    flag: '🇺🇸' },
              { city: 'San Francisco',  venue: 'Levi\'s Stadium', matches: '6 matches',          flag: '🇺🇸' },
            ].map(({ city, venue, matches, flag }) => (
              <div key={city} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <p className="text-base mb-1">{flag}</p>
                <p className="text-xs font-bold text-white">{city}</p>
                <p className="text-[10px] text-gray-500">{venue}</p>
                <p className="text-[10px] text-yellow-600 mt-1">{matches}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">World Cup 2026 Schedule — FAQ</h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
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

        <AdSlot slotId="wc-schedule-bottom" variant="banner" />

        <NewsletterSignup
          source="wc-schedule"
          heading="Never miss a World Cup 2026 match"
          description="Free email alerts delivered straight to your inbox."
          features={['Match reminders', 'Live score alerts', 'World Cup predictions']}
        />

        <WCRelatedLinks links={[
          { href: '/world-cup-2026/fixtures',       icon: '📋', label: 'Live Fixture List',     desc: 'Real-time match cards for every WC game' },
          { href: '/world-cup-2026-results',        icon: '🏁', label: 'WC 2026 Results',       desc: 'Full-time scores and scorers, updated live' },
          { href: '/world-cup-2026-standings',      icon: '📊', label: 'Group Standings',       desc: 'Live points tables for all 12 groups' },
          { href: '/world-cup-2026-groups',         icon: '🗂️', label: 'Group Stage Guide',     desc: 'All 12 draws, fixtures, tiebreaker rules' },
          { href: '/world-cup-2026-bracket',        icon: '🔗', label: 'Knockout Bracket',      desc: 'Round of 32 to the Final at MetLife' },
          { href: '/world-cup-2026-live-stream',    icon: '📡', label: 'Live Stream Guide',     desc: 'Stream every match free or legally online' },
          { href: '/world-cup-2026-tv-guide',       icon: '📺', label: 'TV Channel Guide',      desc: 'What channel is World Cup 2026 on near you?' },
          { href: '/world-cup-2026/teams',          icon: '👥', label: 'All 48 Teams',          desc: 'Squads, form and stats for every WC nation' },
          { href: '/world-cup-2026/venues',         icon: '🏟️', label: 'WC Venues',           desc: '16 stadiums across USA, Canada and Mexico' },
        ]} />
      </div>
    </>
  );
}
