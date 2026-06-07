/**
 * /world-cup-2026/host-cities
 *
 * SEO landing page for all FIFA World Cup 2026 host cities.
 * Targets: "world cup 2026 host cities", "wc 2026 cities", "where is world cup 2026 played"
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { WC_VENUES, WC_VENUE_SLUGS } from '@/lib/wc-venues';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/host-cities`;

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Host Cities – USA, Canada & Mexico | GoalRadar',
  description:
    'All host cities for the FIFA World Cup 2026. Sixteen venues across 13 cities in the United States, Canada and Mexico — stadium details, match counts and travel information for every host city.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Host Cities | GoalRadar',
    description:
      '13 host cities, 16 stadiums — where is the World Cup 2026 played? Full guide to every host city across USA, Canada and Mexico.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIFA World Cup 2026 Host Cities | GoalRadar',
    description: '13 host cities, 16 stadiums — full guide to where World Cup 2026 is played.',
  },
};

// ---------------------------------------------------------------------------
// Static city data (derived from WC_VENUES)
// ---------------------------------------------------------------------------

interface HostCity {
  name: string;
  country: 'USA' | 'Mexico' | 'Canada';
  flag: string;
  region: string;
  venueSlugs: string[];
  highlight: string; // one-line city note
}

const HOST_CITIES: HostCity[] = [
  // USA
  {
    name: 'New York / New Jersey',
    country: 'USA', flag: '🇺🇸', region: 'East Coast',
    venueSlugs: ['metlife-stadium'],
    highlight: 'Hosts the World Cup 2026 Final on 19 July 2026 at MetLife Stadium.',
  },
  {
    name: 'Los Angeles',
    country: 'USA', flag: '🇺🇸', region: 'West Coast',
    venueSlugs: ['sofi-stadium', 'rose-bowl'],
    highlight: 'Two venues: SoFi Stadium (Inglewood) and the iconic Rose Bowl (Pasadena).',
  },
  {
    name: 'San Francisco Bay Area',
    country: 'USA', flag: '🇺🇸', region: 'West Coast',
    venueSlugs: ['levis-stadium'],
    highlight: "Levi's Stadium in Santa Clara hosts several group stage and knockout matches.",
  },
  {
    name: 'Dallas',
    country: 'USA', flag: '🇺🇸', region: 'South',
    venueSlugs: ['att-stadium'],
    highlight: 'AT&T Stadium in Arlington is the second-largest WC 2026 venue by capacity.',
  },
  {
    name: 'Miami',
    country: 'USA', flag: '🇺🇸', region: 'Southeast',
    venueSlugs: ['hard-rock-stadium'],
    highlight: 'Hard Rock Stadium hosts group and knockout matches in South Florida.',
  },
  {
    name: 'Seattle',
    country: 'USA', flag: '🇺🇸', region: 'Pacific Northwest',
    venueSlugs: ['lumen-field'],
    highlight: 'Lumen Field — home of the Seattle Sounders — hosts several World Cup matches.',
  },
  {
    name: 'Boston',
    country: 'USA', flag: '🇺🇸', region: 'New England',
    venueSlugs: ['gillette-stadium'],
    highlight: 'Gillette Stadium in Foxborough hosts New England region matches.',
  },
  {
    name: 'Philadelphia',
    country: 'USA', flag: '🇺🇸', region: 'Mid-Atlantic',
    venueSlugs: ['lincoln-financial-field'],
    highlight: 'Lincoln Financial Field brings the World Cup to the City of Brotherly Love.',
  },
  {
    name: 'Kansas City',
    country: 'USA', flag: '🇺🇸', region: 'Midwest',
    venueSlugs: ['arrowhead-stadium'],
    highlight: "Arrowhead Stadium — home of the Chiefs — hosts the World Cup's Midwest matches.",
  },
  {
    name: 'Atlanta',
    country: 'USA', flag: '🇺🇸', region: 'Southeast',
    venueSlugs: ['mercedes-benz-stadium'],
    highlight: 'Mercedes-Benz Stadium hosts group stage and knockout matches in Atlanta.',
  },
  // Mexico
  {
    name: 'Mexico City',
    country: 'Mexico', flag: '🇲🇽', region: 'Central Mexico',
    venueSlugs: ['estadio-azteca'],
    highlight: 'Azteca Stadium hosts the World Cup opening match on 11 June 2026 — the third World Cup at Azteca.',
  },
  {
    name: 'Guadalajara',
    country: 'Mexico', flag: '🇲🇽', region: 'Western Mexico',
    venueSlugs: ['estadio-akron'],
    highlight: "Estadio Akron (home of Chivas) hosts group stage matches in Mexico's second city.",
  },
  {
    name: 'Monterrey',
    country: 'Mexico', flag: '🇲🇽', region: 'Northern Mexico',
    venueSlugs: ['estadio-bbva'],
    highlight: "Estadio BBVA — one of Mexico's newest and most modern stadiums — hosts the World Cup.",
  },
  // Canada
  {
    name: 'Toronto',
    country: 'Canada', flag: '🇨🇦', region: 'Ontario',
    venueSlugs: ['bmo-field'],
    highlight: "BMO Field (expanded for the tournament) makes Toronto a World Cup host city for the first time.",
  },
  {
    name: 'Vancouver',
    country: 'Canada', flag: '🇨🇦', region: 'British Columbia',
    venueSlugs: ['bc-place'],
    highlight: "BC Place's retractable roof provides weather protection for Vancouver's World Cup matches.",
  },
];

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
      { '@type': 'ListItem', position: 3, name: 'Host Cities',     item: PAGE_URL },
    ],
  };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'FIFA World Cup 2026 Host Cities',
    description: 'All 13 host cities for the FIFA World Cup 2026 across the USA, Canada and Mexico.',
    url: PAGE_URL,
    numberOfItems: HOST_CITIES.length,
    itemListElement: HOST_CITIES.map((city, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'City',
        name: city.name,
        description: city.highlight,
        containedInPlace: { '@type': 'Country', name: city.country },
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const COUNTRY_ORDER = ['USA', 'Mexico', 'Canada'] as const;
const COUNTRY_FLAGS: Record<string, string> = { USA: '🇺🇸', Mexico: '🇲🇽', Canada: '🇨🇦' };

export default function HostCitiesPage() {
  const allVenues = WC_VENUE_SLUGS.map((s) => WC_VENUES[s]);
  const totalMatches = allVenues.reduce(
    (sum, v) => sum + v.matchInfo.reduce((s, m) => s + m.matchCount, 0),
    0,
  );

  const byCountry = COUNTRY_ORDER.map((country) => ({
    country,
    cities: HOST_CITIES.filter((c) => c.country === country),
  }));

  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Host Cities' },
        ]} />

        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-4 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">🌆 FIFA World Cup 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Host Cities
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
            The FIFA World Cup 2026 is hosted across <strong className="text-white">13 cities</strong> and{' '}
            <strong className="text-white">16 stadiums</strong> in three countries:{' '}
            🇺🇸 <strong className="text-white">United States</strong> (11 venues),{' '}
            🇲🇽 <strong className="text-white">Mexico</strong> (3 venues) and{' '}
            🇨🇦 <strong className="text-white">Canada</strong> (2 venues).
            The tournament runs from <strong className="text-white">11 June</strong> to{' '}
            <strong className="text-white">19 July 2026</strong>.
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mt-5">
            {[
              { label: '13', sublabel: 'Host Cities' },
              { label: '16', sublabel: 'Stadiums' },
              { label: '3',  sublabel: 'Countries' },
              { label: totalMatches.toString(), sublabel: 'Matches' },
            ].map(({ label, sublabel }) => (
              <div key={sublabel} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center min-w-[80px]">
                <p className="text-white font-black text-xl leading-none">{label}</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-1">{sublabel}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cities by country */}
        {byCountry.map(({ country, cities }) => (
          <section key={country} className="mb-10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>{COUNTRY_FLAGS[country]}</span>
              <span>{country}</span>
              <span className="text-gray-600 text-sm font-normal">({cities.length} cities)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cities.map((city) => {
                const venues = city.venueSlugs
                  .map((s) => WC_VENUES[s])
                  .filter(Boolean);
                const cityMatches = venues.reduce(
                  (sum, v) => sum + v.matchInfo.reduce((s, m) => s + m.matchCount, 0),
                  0,
                );

                return (
                  <div
                    key={city.name}
                    className="bg-gray-900 border border-gray-800 rounded-2xl p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-white font-bold text-base leading-tight">
                          {city.flag} {city.name}
                        </h3>
                        <p className="text-gray-500 text-xs mt-0.5">{city.region}</p>
                      </div>
                      <span className="shrink-0 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-2 py-0.5 rounded-full">
                        {cityMatches} matches
                      </span>
                    </div>

                    <p className="text-gray-400 text-sm leading-relaxed mb-3">{city.highlight}</p>

                    {/* Venue links */}
                    <div className="space-y-1.5">
                      {venues.map((venue) => (
                        <Link
                          key={venue.slug}
                          href={`/world-cup-2026/venues/${venue.slug}`}
                          className="flex items-center gap-2 text-sm text-gray-500 hover:text-yellow-400 transition-colors group"
                        >
                          <span className="text-base">🏟️</span>
                          <span className="group-hover:underline">{venue.name}</span>
                          <span className="text-gray-700 text-xs ml-auto">
                            {venue.capacity.toLocaleString()} cap.
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
            {[
              {
                q: 'How many countries host the FIFA World Cup 2026?',
                a: 'Three countries co-host the 2026 World Cup: the United States (11 stadiums), Mexico (3 stadiums) and Canada (2 stadiums) — the first World Cup hosted by three nations.',
              },
              {
                q: 'Which city hosts the World Cup 2026 Final?',
                a: 'East Rutherford, New Jersey (New York metropolitan area) hosts the World Cup Final at MetLife Stadium on 19 July 2026.',
              },
              {
                q: 'Where does the World Cup 2026 opening match take place?',
                a: "Mexico City’s Azteca Stadium hosts the opening match on 11 June 2026 — making it the third World Cup held at Azteca (after 1970 and 1986).",
              },
              {
                q: 'Does Canada host World Cup 2026 matches?',
                a: "Yes. Toronto (BMO Field) and Vancouver (BC Place) each host group stage and knockout matches — Canada’s first time hosting World Cup games.",
              },
              {
                q: 'Which US city hosts the most World Cup 2026 matches?',
                a: 'The New York/New Jersey area (MetLife Stadium) and Dallas (AT&T Stadium) host the most matches among US venues, with MetLife hosting the Final.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="px-5 py-4 cursor-pointer text-white font-semibold text-sm list-none flex items-center justify-between gap-3">
                  {q}
                  <span className="text-gray-600 group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        <WCRelatedLinks links={[
          { href: '/world-cup-2026',            icon: '🏆', label: 'WC 2026 Hub',       desc: 'Full tournament overview' },
          { href: '/world-cup-2026/venues',      icon: '🏟️', label: 'Stadiums & Venues', desc: 'Capacity, transport and match info' },
          { href: '/world-cup-2026/teams',       icon: '👥', label: 'All 48 Teams',      desc: 'Squads and fixtures for every nation' },
          { href: '/world-cup-2026/matches',     icon: '⚽', label: 'All Matches',       desc: 'Full fixture list and live scores' },
          { href: '/world-cup-2026-schedule',    icon: '📅', label: 'Match Schedule',    desc: 'All 104 fixtures with kickoff times' },
          { href: '/world-cup-2026-tv-guide',    icon: '📺', label: 'TV Guide',          desc: 'How to watch in your country' },
          { href: '/world-cup-2026/teams/usa',   icon: '🇺🇸', label: 'USA Team',         desc: 'USMNT schedule and squad' },
          { href: '/world-cup-2026/teams/mexico',icon: '🇲🇽', label: 'Mexico Team',      desc: 'El Tri schedule and squad' },
          { href: '/world-cup-2026/teams/canada',icon: '🇨🇦', label: 'Canada Team',      desc: 'Les Rouges schedule and squad' },
        ]} heading="More World Cup 2026" />
      </div>
    </>
  );
}
