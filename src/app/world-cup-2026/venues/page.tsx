/**
 * /world-cup-2026/venues
 *
 * Hub page listing all 16 FIFA World Cup 2026 host stadiums.
 * Targets: "world cup 2026 stadiums", "world cup 2026 venues", "wc 2026 host cities"
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { WC_VENUES, WC_VENUE_SLUGS } from '@/lib/wc-venues';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import AdSlot from '@/components/AdSlot';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/venues`;

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Stadiums & Venues | All 16 Host Cities | GoalRadar',
  description:
    'Full guide to all 16 FIFA World Cup 2026 stadiums. Capacities, transport, match schedules and travel tips for every host venue across the USA, Canada and Mexico.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Stadiums & Venues | GoalRadar',
    description:
      'All 16 World Cup 2026 host stadiums — from MetLife to Azteca. Capacity, transport and match info for every venue.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIFA World Cup 2026 Stadiums | GoalRadar',
    description: 'All 16 World Cup 2026 host venues — capacities, transport and match schedules.',
  },
};

// Group venues by country
const COUNTRY_ORDER = ['USA', 'Mexico', 'Canada'];

export default function VenuesHubPage() {
  const allVenues = WC_VENUE_SLUGS.map((s) => WC_VENUES[s]);

  const byCountry = COUNTRY_ORDER.map((country) => ({
    country,
    venues: allVenues.filter((v) => v.country === country),
  }));

  const totalCapacity = allVenues.reduce((sum, v) => sum + v.capacity, 0);
  const totalMatches = allVenues.reduce(
    (sum, v) => sum + v.matchInfo.reduce((s, m) => s + m.matchCount, 0),
    0,
  );

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',           item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Venues',         item: PAGE_URL },
    ],
  };

  const jsonLdItemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'FIFA World Cup 2026 Venues',
    description: 'All 16 host stadiums for the FIFA World Cup 2026 across the USA, Canada and Mexico',
    url: PAGE_URL,
    numberOfItems: allVenues.length,
    itemListElement: allVenues.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SportsActivityLocation',
        name: v.name,
        description: v.metaDesc,
        url: `${BASE_URL}/world-cup-2026/venues/${v.slug}`,
        maximumAttendeeCapacity: v.capacity,
        address: {
          '@type': 'PostalAddress',
          addressLocality: v.city,
          addressRegion: v.stateOrRegion,
          addressCountry: v.country,
        },
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItemList) }} />

      <div className="max-w-5xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Venues' },
        ]} />

        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">🏟️ FIFA World Cup 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Stadiums &amp; Venues
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
            FIFA World Cup 2026 will be played across <strong className="text-white">16 stadiums</strong> in{' '}
            <strong className="text-white">three host nations</strong> — United States, Canada and Mexico.
            The tournament opens at Azteca Stadium in Mexico City and concludes with the Final at MetLife Stadium,
            East Rutherford, New Jersey.
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mt-5">
            {[
              { label: '16', sublabel: 'Host Venues' },
              { label: '3', sublabel: 'Host Nations' },
              { label: totalMatches.toString(), sublabel: 'Total Matches' },
              { label: totalCapacity.toLocaleString(), sublabel: 'Combined Capacity' },
            ].map(({ label, sublabel }) => (
              <div key={sublabel} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center min-w-[90px]">
                <p className="text-white font-black text-xl leading-none">{label}</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-1">{sublabel}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ad: top */}
        <AdSlot slotId="venues-hub-top" variant="banner" />

        {/* Venue cards by country */}
        {byCountry.map(({ country, venues }) => {
          if (venues.length === 0) return null;
          const flag = country === 'USA' ? '🇺🇸' : country === 'Mexico' ? '🇲🇽' : '🇨🇦';
          return (
            <section key={country} className="mb-10">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>{flag}</span>
                <span>{country}</span>
                <span className="text-gray-600 text-sm font-normal">({venues.length} venues)</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {venues.map((v) => {
                  const vMatches = v.matchInfo.reduce((s, m) => s + m.matchCount, 0);
                  return (
                    <Link
                      key={v.slug}
                      href={`/world-cup-2026/venues/${v.slug}`}
                      className="group bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-2xl p-4 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-white font-bold text-sm leading-tight group-hover:text-yellow-400 transition-colors">
                          {v.name}
                        </h3>
                        <span className="shrink-0 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-2 py-0.5 rounded-full">
                          {vMatches}M
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mb-3">
                        {v.city}, {v.stateOrRegion}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="bg-white/5 text-gray-400 text-[10px] px-2 py-0.5 rounded-full border border-white/10">
                          {v.capacity.toLocaleString()} cap.
                        </span>
                        <span className="bg-white/5 text-gray-400 text-[10px] px-2 py-0.5 rounded-full border border-white/10">
                          {v.surfaceType}
                        </span>
                        {v.roofType === 'Retractable' || v.roofType === 'Fully covered' ? (
                          <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20">
                            Indoor-capable
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Ad: mid */}
        <AdSlot slotId="venues-hub-mid" variant="rectangle" className="mx-auto mb-10" />

        {/* Key facts section */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">Key World Cup 2026 Venue Facts</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
            {[
              { q: 'Which stadium hosts the World Cup 2026 Final?', a: 'MetLife Stadium in East Rutherford, New Jersey (capacity 82,500) hosts the World Cup 2026 Final on 19 July 2026.' },
              { q: 'Which is the largest World Cup 2026 stadium?', a: 'Azteca Stadium in Mexico City has a World Cup capacity of 87,523, making it the largest host venue — and the only stadium to have hosted two previous World Cup Finals (1970 and 1986).' },
              { q: 'How many World Cup 2026 matches are played in the USA?', a: 'The United States hosts 78 of the 104 matches, spread across 11 stadiums from Los Angeles to Boston.' },
              { q: 'Does Canada host any World Cup matches?', a: 'Yes. Toronto (BMO Field / expanded) and Vancouver (BC Place) each host several group-stage and knockout matches.' },
              { q: 'Are any World Cup 2026 stadiums domed or covered?', a: 'Yes. SoFi Stadium (Los Angeles), Lucas Oil Stadium (Indianapolis, not in this tournament), BC Place (Vancouver) and AT&T Stadium (Dallas) all have retractable or fixed roofs — providing climate-controlled conditions.' },
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

        {/* Ad: bottom */}
        <AdSlot slotId="venues-hub-bottom" variant="banner" />

        <WCRelatedLinks links={[
          { href: '/world-cup-2026',              icon: '🏆', label: 'WC 2026 Hub',     desc: 'Full tournament overview' },
          { href: '/world-cup-2026-schedule',      icon: '📅', label: 'Match Schedule',  desc: 'All 104 fixtures with kickoff times' },
          { href: '/world-cup-2026-results',       icon: '🏁', label: 'Results',          desc: 'Full-time scores for every match' },
          { href: '/world-cup-2026-groups',        icon: '🗂️', label: 'Group Stage',      desc: 'All 12 groups and standings' },
          { href: '/world-cup-2026-bracket',       icon: '🔗', label: 'Knockout Bracket', desc: 'Round of 32 through the Final' },
          { href: '/world-cup-2026-tv-guide',      icon: '📺', label: 'TV Guide',         desc: 'How to watch in your country' },
          { href: '/world-cup-2026/teams/usa',     icon: '🇺🇸', label: 'USA Team',         desc: 'USA World Cup 2026 schedule and squad' },
          { href: '/world-cup-2026/teams/mexico',  icon: '🇲🇽', label: 'Mexico Team',      desc: 'Mexico World Cup 2026 schedule and squad' },
          { href: '/world-cup-2026/teams/canada',  icon: '🇨🇦', label: 'Canada Team',      desc: 'Canada World Cup 2026 schedule and squad' },
        ]} heading="More World Cup 2026" />
      </div>
    </>
  );
}
