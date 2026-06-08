/**
 * /world-cup-2026/tv-schedule/[country]
 *
 * Country-specific TV schedule pages for FIFA World Cup 2026.
 * Five static routes: usa, canada, uk, thailand, vietnam.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { WC_TV_COUNTRY_SLUGS, getTVCountry } from '@/lib/wc-tv-countries';
import type { TVChannel, TVKickoff } from '@/lib/wc-tv-countries';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 86400; // daily — TV schedules don't change frequently

const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Static params & metadata
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return WC_TV_COUNTRY_SLUGS.map((country) => ({ country }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}): Promise<Metadata> {
  const { country: slug } = await params;
  const country = getTVCountry(slug);
  if (!country) return {};

  const canonicalUrl = `${BASE_URL}/world-cup-2026/tv-schedule/${slug}`;
  return {
    title: country.metaTitle,
    description: country.metaDesc,
    alternates: { canonical: canonicalUrl },
    openGraph: { title: country.metaTitle, description: country.metaDesc, type: 'website', url: canonicalUrl },
    twitter: { card: 'summary_large_image', title: country.metaTitle, description: country.metaDesc },
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChannelTypeBadge({ type }: { type: TVChannel['type'] }) {
  const map: Record<TVChannel['type'], { label: string; cls: string }> = {
    'free-tv':        { label: 'Free TV',     cls: 'bg-green-700/40 text-green-200 border border-green-600/50' },
    'cable':          { label: 'Cable/Sat',   cls: 'bg-yellow-700/40 text-yellow-200 border border-yellow-600/50' },
    'streaming-free': { label: 'Free Stream', cls: 'bg-emerald-700/40 text-emerald-200 border border-emerald-600/50' },
    'streaming-paid': { label: 'Streaming $', cls: 'bg-blue-700/40 text-blue-200 border border-blue-600/50' },
  };
  const { label, cls } = map[type];
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}

function KickoffRow({ ko, isLast }: { ko: TVKickoff; isLast: boolean }) {
  return (
    <tr className={`${!isLast ? 'border-b border-white/5' : ''} hover:bg-white/3 transition-colors`}>
      <td className="px-4 py-3 text-gray-500 text-xs">{ko.utcTime}</td>
      <td className="px-4 py-3">
        <span className={`font-bold text-sm ${ko.friendly ? 'text-yellow-400' : 'text-gray-400'}`}>
          {ko.localTime}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{ko.slot}</td>
      <td className="px-4 py-3 text-center">
        {ko.friendly
          ? <span className="text-green-400 text-xs font-bold">✓ Good</span>
          : <span className="text-gray-600 text-xs">Late</span>
        }
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TVScheduleCountryPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country: slug } = await params;
  const country = getTVCountry(slug);
  if (!country) notFound();

  const canonicalUrl = `${BASE_URL}/world-cup-2026/tv-schedule/${slug}`;

  // Some TV-schedule slugs differ from the /watch-live/[country] slugs.
  // "usa" is the TV-schedule slug but the watch-live route uses "us".
  const WATCH_LIVE_SLUG_MAP: Record<string, string> = { usa: 'us' };
  const watchLiveSlug = WATCH_LIVE_SLUG_MAP[slug] ?? slug;

  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: country.faq.map(({ q, a }) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',             item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',   item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'TV Schedule',      item: `${BASE_URL}/world-cup-2026/tv-schedule` },
      { '@type': 'ListItem', position: 4, name: country.name,       item: canonicalUrl },
    ],
  };

  const freeChannels    = country.channels.filter((c) => c.type === 'free-tv' || c.type === 'streaming-free');
  const paidChannels    = country.channels.filter((c) => c.type === 'cable'   || c.type === 'streaming-paid');
  const friendlySlots   = country.kickoffs.filter((k) => k.friendly).length;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'TV Schedule', href: '/world-cup-2026/tv-schedule' },
          { label: country.name },
        ]} />

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-5xl">{country.flag}</span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">World Cup 2026 TV Guide</span>
                <span className="text-gray-600 text-xs">{country.utcOffset}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                World Cup 2026 TV Schedule — {country.name}
              </h1>
            </div>
          </div>
          <p className="text-gray-400 text-base leading-relaxed">{country.heroSubtitle}</p>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-gray-900 border border-yellow-800/30 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Time Zone</p>
              <p className="text-white font-black text-sm">{country.utcOffset}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Channels</p>
              <p className="text-white font-black text-sm">{country.channels.length}</p>
            </div>
            <div className="bg-gray-900 border border-green-800/30 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Good Slots</p>
              <p className="text-green-400 font-black text-sm">{friendlySlots} / 4</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Best Free</p>
              <p className="text-white font-bold text-xs leading-tight pt-0.5">{freeChannels[0]?.name ?? 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Ad: top */}
        <AdSlot slotId={`tvsch-${slug}-top`} variant="banner" />

        {/* Intro */}
        <p className="text-gray-400 leading-relaxed text-sm mt-6 mb-8">{country.intro}</p>

        {/* Channels table */}
        <section id="channels" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">
            World Cup 2026 TV Channels in {country.name}
          </h2>

          {freeChannels.length > 0 && (
            <>
              <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3 mt-5">
                ✓ Free Options
              </h3>
              <div className="overflow-x-auto rounded-xl border border-white/8 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 text-white/50 uppercase text-[10px] tracking-wide">
                      <th className="text-left px-4 py-3">Channel</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Type</th>
                      <th className="text-left px-4 py-3">Coverage</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">Where</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {freeChannels.map((ch) => (
                      <tr key={ch.name} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{ch.name}</td>
                        <td className="px-4 py-3 hidden sm:table-cell"><ChannelTypeBadge type={ch.type} /></td>
                        <td className="px-4 py-3 text-gray-300 text-xs">{ch.coverage}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{ch.where}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {paidChannels.length > 0 && (
            <>
              <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-3 mt-5">
                Paid / Subscription Options
              </h3>
              <div className="overflow-x-auto rounded-xl border border-white/8">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 text-white/50 uppercase text-[10px] tracking-wide">
                      <th className="text-left px-4 py-3">Channel</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Type</th>
                      <th className="text-left px-4 py-3">Coverage</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">Where</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {paidChannels.map((ch) => (
                      <tr key={ch.name} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{ch.name}</td>
                        <td className="px-4 py-3 hidden sm:table-cell"><ChannelTypeBadge type={ch.type} /></td>
                        <td className="px-4 py-3 text-gray-300 text-xs">{ch.coverage}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{ch.where}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Watch Live CTA */}
        <div className="bg-gradient-to-br from-yellow-950/30 to-gray-900 border border-yellow-800/30 rounded-2xl p-5 mb-8">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1">📺 Best option in {country.name}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Best Free</p>
              <p className="text-green-300 text-sm font-semibold">{country.bestPickFree}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Best Paid / Full Coverage</p>
              <p className="text-blue-300 text-sm font-semibold">{country.bestPickPaid}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href={`/world-cup-2026/watch-live/${watchLiveSlug}`}
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              Full Streaming Guide →
            </Link>
            <Link href="/world-cup-2026/tv-schedule"
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold border border-gray-700 transition-colors">
              All Countries
            </Link>
          </div>
        </div>

        {/* Kick-off times table */}
        <section id="times" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-2">
            Match Times in {country.name} ({country.utcOffset})
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Group stage matches have four daily kick-off slots.
            <span className="text-green-400 ml-2">✓ Good</span> = comfortable viewing time.
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-white/50 uppercase text-[10px] tracking-wide">
                  <th className="text-left px-4 py-3">UTC</th>
                  <th className="text-left px-4 py-3">Local Time</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Slot</th>
                  <th className="text-left px-4 py-3">Viewing</th>
                </tr>
              </thead>
              <tbody>
                {country.kickoffs.map((ko, i) => (
                  <KickoffRow key={ko.utcTime} ko={ko} isLast={i === country.kickoffs.length - 1} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ad: mid */}
        <AdSlot slotId={`tvsch-${slug}-mid`} variant="rectangle" className="mx-auto mb-8" />

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">
            Frequently Asked Questions — {country.name}
          </h2>
          <div className="space-y-3">
            {country.faq.map(({ q, a }) => (
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

        {/* VPN CTA */}
        <div className="bg-gradient-to-br from-blue-950/30 to-gray-900 border border-blue-800/30 rounded-2xl p-5 mb-8">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">🌍 Watching Abroad?</p>
          <p className="text-white font-bold text-base mb-1">Access {country.name} coverage from anywhere</p>
          <p className="text-gray-400 text-sm mb-4">
            A VPN lets you watch your home broadcaster while travelling outside {country.name}.
            Also useful for expats who want {country.name} commentary and analysis.
          </p>
          <a href="https://nordvpn.com" target="_blank" rel="noopener noreferrer sponsored" data-affiliate-tag={`vpn-tvsch-${slug}`}
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
            Get a VPN →
          </a>
        </div>

        {/* Ad: bottom */}
        <AdSlot slotId={`tvsch-${slug}-bottom`} variant="banner" />

        {/* Internal links */}
        <div className="border-t border-gray-800 pt-8 mt-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">More World Cup 2026</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/world-cup-2026',                   label: '🏆 WC Hub' },
              { href: '/world-cup-2026/tv-schedule',       label: '📺 TV Schedule (All)' },
              { href: `/world-cup-2026/watch-live/${watchLiveSlug}`, label: `📡 Watch Live (${country.name})` },
              { href: '/world-cup-2026/watch-live',        label: '🌍 Watch Live (All)' },
              { href: '/world-cup-2026/streaming-guide',   label: '📡 Streaming Guide' },
              { href: '/schedule?competition=WC',           label: '📅 WC Fixtures' },
            ].map(({ href, label }) => (
              <Link key={href + label} href={href}
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
