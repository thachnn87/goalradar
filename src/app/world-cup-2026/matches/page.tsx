/**
 * /world-cup-2026/matches
 *
 * SEO landing page for all FIFA World Cup 2026 matches.
 * Targets: "world cup 2026 matches", "wc 2026 fixture list", "world cup 2026 games"
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 3600;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/matches`;

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Matches – All 104 Fixtures & Results | GoalRadar',
  description:
    'Complete FIFA World Cup 2026 match list — all 104 games from the Group Stage through to the Final. Live scores, results, upcoming fixtures and match details for every World Cup 2026 game.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Matches | GoalRadar',
    description:
      'All 104 FIFA World Cup 2026 matches — live scores, results and fixtures for every game from Group Stage to Final.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIFA World Cup 2026 Matches | GoalRadar',
    description: 'All 104 World Cup 2026 matches — live scores, results and fixtures.',
  },
};

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
      { '@type': 'ListItem', position: 3, name: 'Matches',         item: PAGE_URL },
    ],
  };

  const event = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: 'FIFA World Cup 2026',
    startDate: '2026-06-11',
    endDate: '2026-07-19',
    eventStatus: 'https://schema.org/EventScheduled',
    sport: 'Association football',
    url: PAGE_URL,
    location: {
      '@type': 'Place',
      name: 'United States, Canada and Mexico',
    },
    organizer: {
      '@type': 'Organization',
      name: 'FIFA',
      url: 'https://www.fifa.com',
    },
    description:
      'The FIFA World Cup 2026 features 104 matches across 12 group stage games per group, a Round of 32, Round of 16, Quarter-finals, Semi-finals, Third Place play-off and Final.',
    superEvent: {
      '@type': 'SportsEvent',
      name: 'FIFA World Cup',
      organizer: { '@type': 'Organization', name: 'FIFA' },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(event) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tournament structure data
// ---------------------------------------------------------------------------

const TOURNAMENT_PHASES = [
  {
    phase: 'Group Stage',
    icon: '🗂️',
    dates: '11 June – 2 July 2026',
    matchCount: 72,
    description:
      '48 teams split into 12 groups of 4. Each team plays 3 matches; the top 2 from each group plus the 8 best third-placed teams advance.',
    link: '/world-cup-2026/groups',
    linkLabel: 'View group standings →',
  },
  {
    phase: 'Round of 32',
    icon: '🔗',
    dates: '4–7 July 2026',
    matchCount: 16,
    description:
      '32 teams compete in knock-out fixtures. Win or go home — with extra time and penalties if level after 90 minutes.',
    link: '/world-cup-2026/bracket',
    linkLabel: 'View knockout bracket →',
  },
  {
    phase: 'Round of 16',
    icon: '⚽',
    dates: '9–12 July 2026',
    matchCount: 8,
    description:
      'The last 16 nations fight for a quarter-final spot in what is historically the most dramatic round of the tournament.',
    link: '/world-cup-2026/bracket',
    linkLabel: 'View knockout bracket →',
  },
  {
    phase: 'Quarter-finals',
    icon: '🏅',
    dates: '14–15 July 2026',
    matchCount: 4,
    description:
      'Four matches to determine the semi-finalists. Upsets are common — no team is safe at this stage.',
    link: '/world-cup-2026/bracket',
    linkLabel: 'View knockout bracket →',
  },
  {
    phase: 'Semi-finals',
    icon: '🥈',
    dates: '17–18 July 2026',
    matchCount: 2,
    description:
      'Two matches at the biggest venues — the winners meet in the Final; the losers contest the Third Place play-off.',
    link: '/world-cup-2026/bracket',
    linkLabel: 'View knockout bracket →',
  },
  {
    phase: 'Third Place Play-off',
    icon: '🥉',
    dates: '18 July 2026',
    matchCount: 1,
    description:
      'The two semi-final losers compete for the bronze medal.',
    link: '/world-cup-2026/bracket',
    linkLabel: 'View bracket →',
  },
  {
    phase: 'Final',
    icon: '🏆',
    dates: '19 July 2026',
    matchCount: 1,
    description:
      'The World Cup Final at MetLife Stadium, East Rutherford, New Jersey — the biggest single sporting event on the planet.',
    link: '/world-cup-2026/bracket',
    linkLabel: 'View bracket →',
  },
];

const QUICK_LINKS = [
  { href: '/world-cup-2026/matches-today',    icon: '🔴', label: 'Today\'s Matches',  desc: 'Live scores and today\'s fixtures' },
  { href: '/world-cup-2026/matches-tomorrow', icon: '📅', label: 'Tomorrow\'s Matches', desc: 'Upcoming fixtures for tomorrow' },
  { href: '/world-cup-2026/fixtures',         icon: '📋', label: 'Full Schedule',      desc: 'All 104 matches with kickoff times' },
  { href: '/world-cup-2026/results',          icon: '🏁', label: 'Results',            desc: 'Completed match scores and reports' },
  { href: '/world-cup-2026/groups',           icon: '📊', label: 'Group Standings',    desc: 'Points tables for all 12 groups' },
  { href: '/world-cup-2026/bracket',          icon: '🔗', label: 'Knockout Bracket',   desc: 'Round of 32 to the Final' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WCMatchesPage() {
  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Matches' },
        ]} />

        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-4 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">⚽ FIFA World Cup 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Matches
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
            The FIFA World Cup 2026 features <strong className="text-white">104 matches</strong> played from{' '}
            <strong className="text-white">11 June</strong> to{' '}
            <strong className="text-white">19 July 2026</strong> across 16 stadiums in the United States,
            Canada and Mexico. Find live scores, upcoming fixtures and completed results below.
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mt-5">
            {[
              { label: '104', sublabel: 'Total Matches' },
              { label: '48', sublabel: 'Teams' },
              { label: '39', sublabel: 'Days' },
              { label: '16', sublabel: 'Stadiums' },
            ].map(({ label, sublabel }) => (
              <div key={sublabel} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center min-w-[80px]">
                <p className="text-white font-black text-xl leading-none">{label}</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-1">{sublabel}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live match quick links */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">Find Matches</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {QUICK_LINKS.map(({ href, icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-2xl p-4 transition-all group"
              >
                <div className="text-2xl mb-2">{icon}</div>
                <p className="text-white font-bold text-sm group-hover:text-yellow-400 transition-colors leading-tight mb-1">
                  {label}
                </p>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Tournament structure */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">Tournament Structure</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-2xl">
            The expanded 48-team format introduces a <strong className="text-white">Round of 32</strong> for the first time,
            making World Cup 2026 the largest in history with 104 total matches.
          </p>

          <div className="space-y-3">
            {TOURNAMENT_PHASES.map(({ phase, icon, dates, matchCount, description, link, linkLabel }) => (
              <div
                key={phase}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5"
              >
                <div className="flex items-start gap-4">
                  <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-white font-bold text-base">{phase}</h3>
                      <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                        {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mb-2">{dates}</p>
                    <p className="text-gray-400 text-sm leading-relaxed mb-2">{description}</p>
                    <Link href={link} className="text-xs text-green-400 hover:text-green-300 transition-colors">
                      {linkLabel}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Group links */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Browse by Group
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
            {['A','B','C','D','E','F','G','H','I','J','K','L'].map((g) => (
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
          { href: '/world-cup-2026/teams',         icon: '👥', label: 'All 48 Teams',      desc: 'Squads and stats for every nation' },
          { href: '/world-cup-2026/groups',        icon: '📊', label: 'Group Standings',   desc: 'Live tables for all 12 groups' },
          { href: '/world-cup-2026/bracket',       icon: '🔗', label: 'Knockout Bracket',  desc: 'Round of 32 path to the Final' },
          { href: '/world-cup-2026/venues',        icon: '🏟️', label: 'Stadiums & Venues', desc: 'All 16 host stadiums' },
          { href: '/world-cup-2026/host-cities',   icon: '🌆', label: 'Host Cities',       desc: '13 cities hosting World Cup games' },
          { href: '/world-cup-2026-tv-guide',      icon: '📺', label: 'TV Guide',          desc: 'Where to watch in your country' },
          { href: '/world-cup-2026/teams/usa',     icon: '🇺🇸', label: 'USA Fixtures',     desc: 'USMNT match schedule' },
        ]} heading="More World Cup 2026" />
      </div>
    </>
  );
}
