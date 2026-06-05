/**
 * /world-cup-2026-live-stream
 *
 * Programmatic SEO — targets:
 * "world cup 2026 live stream" | "how to watch world cup 2026 free" | "world cup 2026 streaming"
 * Unique angle: "free first" streaming guide with VPN guide section.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const CANONICAL = `${BASE_URL}/world-cup-2026-live-stream`;

export const metadata: Metadata = {
  title: 'World Cup 2026 Live Stream — How to Watch Free Online | GoalRadar',
  description:
    'How to watch FIFA World Cup 2026 live stream free and legally. Best streaming platforms by country, free-to-air broadcasters, VPN guide and mobile apps — USA, UK, Canada, Australia and more.',
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'World Cup 2026 Live Stream | GoalRadar',
    description:
      'Stream FIFA World Cup 2026 live and free — official broadcasters and streaming platforms for every country.',
    type: 'website',
    url: CANONICAL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Live Stream | GoalRadar',
    description: 'Watch FIFA World Cup 2026 live stream free — all official streaming options by country.',
  },
};

const STREAMERS = [
  {
    country: '🇺🇸 USA',
    free: ['Tubi (Fox matches)', 'Peacock (select)'],
    paid: ['FuboTV', 'Sling TV', 'DirecTV Stream'],
    channels: 'Fox Sports, Telemundo',
    note: 'Fox holds English-language rights; Telemundo covers Spanish-language',
  },
  {
    country: '🇬🇧 UK',
    free: ['ITV X (free streaming)', 'BBC iPlayer (free streaming)'],
    paid: ['None required'],
    channels: 'ITV1, BBC One',
    note: 'All matches are free-to-air on ITV and BBC — no subscription needed',
  },
  {
    country: '🇨🇦 Canada',
    free: ['CTV (select matches)'],
    paid: ['TSN+', 'RDS (French)'],
    channels: 'TSN, CTV',
    note: 'TSN holds primary rights; CTV broadcasts selected high-profile matches free',
  },
  {
    country: '🇦🇺 Australia',
    free: ['SBS On Demand (all matches free)'],
    paid: ['Optus Sport'],
    channels: 'SBS, SBS World Sport',
    note: 'SBS streams every match free — best free option outside Europe',
  },
  {
    country: '🇹🇭 Thailand',
    free: ['True Sport (subscription)'],
    paid: ['True4U streaming'],
    channels: 'True Sport channels',
    note: 'True Sport holds exclusive Thai rights across all platforms',
  },
  {
    country: '🇻🇳 Vietnam',
    free: ['VTV (free-to-air, select matches)', 'VTVgo app (free)'],
    paid: ['FPT Play'],
    channels: 'VTV, FPT Sport',
    note: 'VTV shows selected matches free; FPT Play has most comprehensive coverage',
  },
];

const FAQ = [
  {
    q: 'Is there a free World Cup 2026 live stream?',
    a: 'Yes! In the UK, ITV and BBC stream all matches free. In Australia, SBS On Demand is completely free. In the USA, Tubi streams selected Fox matches free. Check our country guide for your region.',
  },
  {
    q: 'Can I use a VPN to watch World Cup 2026 free?',
    a: 'A VPN can help you access geo-restricted broadcasts. However, VPN use may violate some streaming platforms\' terms of service. We recommend using your country\'s official free broadcaster where available.',
  },
  {
    q: 'What is the best World Cup 2026 streaming service in the USA?',
    a: 'In the USA, FuboTV is the most comprehensive option as it carries both Fox Sports and Telemundo. For free streaming, Tubi carries select Fox Sports matches. For mobile, the Fox Sports and Telemundo apps stream to verified subscribers.',
  },
  {
    q: 'Can I watch World Cup 2026 on mobile?',
    a: 'Yes. Most official broadcasters offer mobile apps — Fox Sports app (USA), ITV X app (UK), SBS On Demand app (Australia), FPT Play app (Vietnam) and TSN app (Canada). Most require a subscription or are free with a broadcaster login.',
  },
  {
    q: 'Does Netflix or Amazon Prime have World Cup 2026 rights?',
    a: 'No. Netflix and Amazon Prime Video do not hold FIFA World Cup 2026 broadcast rights. Rights are held by traditional broadcasters and sports-specific streaming services in each country.',
  },
  {
    q: 'What time zone are World Cup 2026 live streams in?',
    a: 'Most matches kick off between 17:00–21:00 ET (22:00–02:00 UTC). UK viewers will see evening kickoffs. Australian viewers will watch early morning (around 07:00–11:00 AEST).',
  },
];

export default function WC2026LiveStreamPage() {
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
      { '@type': 'ListItem', position: 1, name: 'Home',                      item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026 Live Stream', item: CANONICAL },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026 Live Stream' },
        ]} />

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
            📺 FIFA World Cup 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Live Stream
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            How to watch FIFA World Cup 2026 live and online — free options first.
            Official broadcasters and streaming platforms for USA, UK, Canada, Australia, Thailand, Vietnam and more.
          </p>
          <div className="mt-4 bg-green-950/30 border border-green-800/30 rounded-xl p-3">
            <p className="text-green-400 text-sm font-semibold">
              ✅ Free streams available in UK (ITV/BBC), Australia (SBS) and parts of USA (Tubi/Fox)
            </p>
          </div>
        </div>

        <AdSlot slotId="wc-livestream-top" variant="banner" />

        {/* Country streaming guide */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">How to Watch — By Country</h2>
          <div className="space-y-4">
            {STREAMERS.map(({ country, free, paid, channels, note }) => (
              <div key={country} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-base font-bold text-white mb-3">{country}</p>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-[10px] text-green-400 font-bold uppercase tracking-wider mb-2">🆓 Free Options</p>
                    <ul className="space-y-1">
                      {free.map((f) => <li key={f} className="text-xs text-gray-300 flex items-center gap-1.5"><span className="text-green-500">✓</span> {f}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-2">💳 Paid Options</p>
                    <ul className="space-y-1">
                      {paid.map((p) => <li key={p} className="text-xs text-gray-300 flex items-center gap-1.5"><span className="text-blue-500">→</span> {p}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="border-t border-white/5 pt-3 flex flex-col gap-1">
                  <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">TV channels:</span> {channels}</p>
                  <p className="text-xs text-gray-600 italic">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* VPN guide */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">VPN Guide for World Cup 2026</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              A VPN (Virtual Private Network) can allow you to access geo-restricted streams from other countries.
              For example, UK residents abroad can access BBC iPlayer or ITV X via a UK-based VPN server.
            </p>
            <div className="space-y-2 mb-4">
              {[
                { tip: 'Connect to a UK server to access BBC iPlayer or ITV X free streams', flag: '🇬🇧' },
                { tip: 'Connect to an Australian server for SBS On Demand free streams', flag: '🇦🇺' },
                { tip: 'Always check if VPN use complies with the platform\'s terms of service', flag: '⚠️' },
              ].map(({ tip, flag }) => (
                <div key={tip} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="shrink-0">{flag}</span>
                  <p>{tip}</p>
                </div>
              ))}
            </div>
            <a href="https://nordvpn.com" target="_blank" rel="noopener noreferrer sponsored"
              className="inline-block bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
              Best VPN for World Cup 2026 →
            </a>
          </div>
        </section>

        <AdSlot slotId="wc-livestream-mid" variant="rectangle" className="mx-auto mb-8" />

        {/* Country deep-dives */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Country-Specific Streaming Guides</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/world-cup-2026/watch-live/us',        label: '🇺🇸 USA Guide' },
              { href: '/world-cup-2026/watch-live/uk',        label: '🇬🇧 UK Guide' },
              { href: '/world-cup-2026/watch-live/canada',    label: '🇨🇦 Canada Guide' },
              { href: '/world-cup-2026/watch-live/australia', label: '🇦🇺 Australia Guide' },
              { href: '/world-cup-2026/watch-live/thailand',  label: '🇹🇭 Thailand Guide' },
              { href: '/world-cup-2026/watch-live/vietnam',   label: '🇻🇳 Vietnam Guide' },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/30 rounded-xl p-3 text-sm text-gray-300 hover:text-white transition-all text-center">
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">World Cup 2026 Streaming — FAQ</h2>
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

        <AdSlot slotId="wc-livestream-bottom" variant="banner" />

        <div className="border-t border-gray-800 pt-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">More World Cup 2026</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/world-cup-2026',                  label: '🏆 WC Hub' },
              { href: '/world-cup-2026/watch-live',       label: '📺 Full Watch Guide' },
              { href: '/world-cup-2026/tv-schedule',      label: '🗓️ TV Schedule' },
              { href: '/world-cup-2026/streaming-guide',  label: '🌐 Streaming Guide' },
              { href: '/world-cup-2026/fixtures',         label: '📅 Fixtures' },
              { href: '/world-cup-2026/matches-today',    label: '⚽ Today\'s Matches' },
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
