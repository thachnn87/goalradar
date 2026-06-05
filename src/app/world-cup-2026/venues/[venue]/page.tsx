/**
 * /world-cup-2026/venues/[venue]
 *
 * FIFA World Cup 2026 venue pages.
 * Five statically-generated routes: metlife-stadium, azteca-stadium, dallas, miami, los-angeles.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { WC_VENUE_SLUGS, getVenue } from '@/lib/wc-venues';
import type { VenueTransport, VenueMatchInfo } from '@/lib/wc-venues';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 3600; // hourly — match assignments can update

const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Static params & metadata
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return WC_VENUE_SLUGS.map((venue) => ({ venue }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ venue: string }>;
}): Promise<Metadata> {
  const { venue: slug } = await params;
  const venue = getVenue(slug);
  if (!venue) return {};

  const canonicalUrl = `${BASE_URL}/world-cup-2026/venues/${slug}`;
  return {
    title: venue.metaTitle,
    description: venue.metaDesc,
    alternates: { canonical: canonicalUrl },
    openGraph: { title: venue.metaTitle, description: venue.metaDesc, type: 'website', url: canonicalUrl },
    twitter: { card: 'summary_large_image', title: venue.metaTitle, description: venue.metaDesc },
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-white font-bold text-sm leading-tight">{value}</p>
    </div>
  );
}

function TransportCard({ t }: { t: VenueTransport }) {
  return (
    <div className="flex gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
      <span className="text-2xl shrink-0 mt-0.5">{t.icon}</span>
      <div>
        <p className="text-sm font-bold text-white mb-1">{t.mode}</p>
        <p className="text-xs text-gray-400 leading-relaxed">{t.description}</p>
      </div>
    </div>
  );
}

function MatchInfoRow({ info }: { info: VenueMatchInfo }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="text-sm font-semibold text-white">{info.round}</p>
        <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
      </div>
      <span className="shrink-0 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-2 py-0.5 rounded-full">
        {info.matchCount} match{info.matchCount !== 1 ? 'es' : ''}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function VenuePage({
  params,
}: {
  params: Promise<{ venue: string }>;
}) {
  const { venue: slug } = await params;
  const venue = getVenue(slug);
  if (!venue) notFound();

  const canonicalUrl = `${BASE_URL}/world-cup-2026/venues/${slug}`;
  const totalMatches  = venue.matchInfo.reduce((sum, m) => sum + m.matchCount, 0);

  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: venue.faq.map(({ q, a }) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',           item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Venues',         item: `${BASE_URL}/world-cup-2026/venues` },
      { '@type': 'ListItem', position: 4, name: venue.name,       item: canonicalUrl },
    ],
  };

  const jsonLdSportsActivityLocation = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    description: venue.metaDesc,
    address: {
      '@type': 'PostalAddress',
      addressLocality: venue.city,
      addressRegion: venue.stateOrRegion,
      addressCountry: venue.country,
    },
    sport: 'Football (Soccer)',
    maximumAttendeeCapacity: venue.capacity,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSportsActivityLocation) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Venues', href: '/world-cup-2026/venues' },
          { label: venue.shortName },
        ]} />

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">
              {venue.countryFlag} World Cup 2026 Venue
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">
            {venue.name}
          </h1>
          <p className="text-gray-400 text-base">
            {venue.city}, {venue.stateOrRegion} · {venue.country}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-3 py-1 rounded-full">
              {totalMatches} WC Matches
            </span>
            <span className="bg-white/5 text-gray-300 border border-white/10 text-xs px-3 py-1 rounded-full">
              {venue.capacity.toLocaleString()} capacity
            </span>
            <span className="bg-white/5 text-gray-300 border border-white/10 text-xs px-3 py-1 rounded-full">
              Opened {venue.openedYear}
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
          {venue.stats.map(({ label, value }) => (
            <StatCard key={label} label={label} value={value} />
          ))}
        </div>

        {/* Ad: top */}
        <AdSlot slotId={`venue-${slug}-top`} variant="banner" />

        {/* Intro */}
        <section className="my-8">
          <h2 className="text-xl font-bold text-white mb-3">About {venue.name}</h2>
          <p className="text-gray-400 leading-relaxed text-sm">{venue.intro}</p>
          <p className="text-gray-600 text-xs mt-3 italic">{venue.architecturalNote}</p>
        </section>

        {/* Matches at this venue */}
        <section id="matches" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">World Cup 2026 Matches at {venue.shortName}</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Match Schedule</p>
              <span className="text-xs text-yellow-400 font-bold">{totalMatches} total matches</span>
            </div>
            <div className="px-5 py-2">
              {venue.matchInfo.map((info) => <MatchInfoRow key={info.round} info={info} />)}
            </div>
          </div>
          <Link href="/schedule?competition=WC"
            className="inline-block mt-3 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
            View full fixture schedule →
          </Link>
        </section>

        {/* Getting there + tickets CTA */}
        <div className="bg-gradient-to-br from-yellow-950/30 to-gray-900 border border-yellow-800/30 rounded-2xl p-5 mb-8">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1">🎫 Attending {venue.shortName}?</p>
          <p className="text-white font-bold text-base mb-1">Buy tickets through FIFA&apos;s official platform</p>
          <p className="text-gray-400 text-sm mb-4">
            All World Cup 2026 tickets are sold exclusively through FIFA.com/tickets.
            No third-party sellers are authorised for original face-value tickets.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/tickets"
              target="_blank" rel="noopener noreferrer"
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              FIFA Official Tickets →
            </a>
            <a href="https://www.booking.com/searchresults.html" target="_blank" rel="noopener noreferrer sponsored" data-affiliate-tag={`hotel-venue-${slug}`}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold border border-gray-700 transition-colors">
              Hotels Near Venue
            </a>
          </div>
        </div>

        {/* Ad: mid */}
        <AdSlot slotId={`venue-${slug}-mid`} variant="rectangle" className="mx-auto mb-8" />

        {/* Location info */}
        <section id="location" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-2">Location &amp; Access</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="text-gray-500 w-32 shrink-0">City</span>
                <span className="text-white">{venue.city}, {venue.stateOrRegion}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-500 w-32 shrink-0">From City Centre</span>
                <span className="text-gray-300">{venue.distanceFromCity}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-500 w-32 shrink-0">Nearest Airport</span>
                <span className="text-gray-300">{venue.nearestAirport}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Getting there */}
        <section id="transport" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Getting to {venue.shortName}</h2>
          <div className="space-y-3">
            {venue.transport.map((t) => <TransportCard key={t.mode} t={t} />)}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {venue.faq.map(({ q, a }) => (
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

        {/* Watch the matches at home CTA */}
        <div className="bg-gradient-to-br from-blue-950/30 to-gray-900 border border-blue-800/30 rounded-2xl p-5 mb-8">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">📺 Watching from Home?</p>
          <p className="text-white font-bold text-base mb-1">Stream {venue.shortName} matches live</p>
          <p className="text-gray-400 text-sm mb-4">
            Find your official broadcaster and streaming options for every match at {venue.shortName}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/world-cup-2026/watch-live"
              className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              Watch Live Guide →
            </Link>
            <Link href="/world-cup-2026/tv-schedule"
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold border border-gray-700 transition-colors">
              TV Schedule
            </Link>
          </div>
        </div>

        {/* Ad: bottom */}
        <AdSlot slotId={`venue-${slug}-bottom`} variant="banner" />

        {/* Other venues */}
        <section className="mb-8">
          <h2 className="text-base font-bold text-white mb-3">Other World Cup 2026 Venues</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {WC_VENUE_SLUGS.filter((s) => s !== slug).map((s) => {
              const v = getVenue(s);
              if (!v) return null;
              return (
                <Link key={s} href={`/world-cup-2026/venues/${s}`}
                  className="group bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/30 rounded-xl p-3 text-center transition-all">
                  <p className="text-xs font-semibold text-white group-hover:text-yellow-400 transition-colors leading-tight">{v.shortName}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{v.city}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Internal links */}
        <div className="border-t border-gray-800 pt-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">More World Cup 2026</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/world-cup-2026',                 label: '🏆 WC Hub' },
              { href: '/world-cup-2026/fixtures',        label: '📅 Fixtures' },
              { href: '/world-cup-2026/watch-live',      label: '📺 Watch Live' },
              { href: '/world-cup-2026/tv-schedule',     label: '🗓️ TV Schedule' },
              { href: '/world-cup-2026/groups',          label: '🗂️ Groups' },
              { href: '/world-cup-2026/bracket',         label: '🔗 Bracket' },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-3 text-sm text-gray-300 hover:text-white transition-colors text-center">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
