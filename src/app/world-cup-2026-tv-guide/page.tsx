/**
 * /world-cup-2026-tv-guide
 *
 * Programmatic SEO — targets: "world cup 2026 tv guide" | "what channel is world cup 2026" | "world cup 2026 channel"
 * Unique angle: channel-first, "what channel is it on?" guide.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const CANONICAL = `${BASE_URL}/world-cup-2026-tv-guide`;

export const metadata: Metadata = {
  title: 'World Cup 2026 TV Guide — What Channel Is It On? | GoalRadar',
  description:
    'What channel is FIFA World Cup 2026 on? Full TV guide by country — USA (Fox/Telemundo), UK (ITV/BBC), Canada (TSN/CTV), Australia (SBS), plus cable and satellite listings.',
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'World Cup 2026 TV Guide | GoalRadar',
    description:
      'What channel is World Cup 2026 on? Complete TV channel guide for every country.',
    type: 'website',
    url: CANONICAL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 TV Guide | GoalRadar',
    description: 'World Cup 2026 TV channel guide — what channel to watch in every country.',
  },
};

const TV_CHANNELS = [
  {
    country: '🇺🇸 United States',
    topLine: 'Fox Sports & Telemundo',
    channels: [
      { name: 'Fox (OTA)',         type: 'Free-to-air', detail: 'English, major matches only' },
      { name: 'FS1',               type: 'Cable',       detail: 'English, most group matches' },
      { name: 'Telemundo (OTA)',   type: 'Free-to-air', detail: 'Spanish, major matches' },
      { name: 'Universo',          type: 'Cable',       detail: 'Spanish, remaining matches' },
    ],
    note: 'Fox and Telemundo split rights. For every match, check FuboTV or the Fox Sports app.',
    countrySlug: 'usa',
  },
  {
    country: '🇬🇧 United Kingdom',
    topLine: 'ITV & BBC (all free)',
    channels: [
      { name: 'ITV1',    type: 'Free-to-air', detail: 'All matches shared with BBC' },
      { name: 'ITV X',   type: 'Free stream', detail: 'Free online streaming, all matches' },
      { name: 'BBC One', type: 'Free-to-air', detail: 'Selected matches including Final' },
      { name: 'BBC iPlayer', type: 'Free stream', detail: 'Free online streaming' },
    ],
    note: 'Every World Cup 2026 match is free to watch on ITV or BBC. No subscription needed.',
    countrySlug: 'uk',
  },
  {
    country: '🇨🇦 Canada',
    topLine: 'TSN & CTV',
    channels: [
      { name: 'TSN 1–5',    type: 'Cable/Stream', detail: 'Primary rights holder, all matches' },
      { name: 'CTV',        type: 'Free-to-air',  detail: 'Selected high-profile matches free' },
      { name: 'RDS',        type: 'Cable',        detail: 'French-language coverage' },
      { name: 'TSN+',       type: 'Stream',       detail: 'Online streaming platform' },
    ],
    note: 'TSN has the most comprehensive coverage. CTV shows selected matches for free.',
    countrySlug: 'canada',
  },
  {
    country: '🇦🇺 Australia',
    topLine: 'SBS (all free)',
    channels: [
      { name: 'SBS',              type: 'Free-to-air', detail: 'Selected matches, free' },
      { name: 'SBS World Sport',  type: 'Free-to-air', detail: 'Dedicated sports channel' },
      { name: 'SBS On Demand',    type: 'Free stream', detail: 'All 104 matches, free online' },
    ],
    note: 'SBS On Demand is the best free option for Australian viewers — all matches, no subscription.',
    countrySlug: 'australia',
  },
];

const FAQ = [
  {
    q: 'What channel is the World Cup 2026 on in the USA?',
    a: 'In the USA, World Cup 2026 is on Fox (free-to-air OTA) and FS1 (cable) for English, and Telemundo/Universo for Spanish. FuboTV, Sling TV and DirecTV Stream carry both Fox and Telemundo.',
  },
  {
    q: 'What channel is the World Cup 2026 Final on?',
    a: 'The World Cup 2026 Final on 19 July 2026 will be broadcast in the USA on Fox (free-to-air) and Telemundo. In the UK, it will be on BBC One or ITV1. In Australia, on SBS.',
  },
  {
    q: 'Is World Cup 2026 on free TV in the UK?',
    a: 'Yes! Every match of the FIFA World Cup 2026 is free to watch in the UK on ITV or BBC. Both channels also offer free online streaming via ITV X and BBC iPlayer.',
  },
  {
    q: 'What channel is the World Cup on in Canada?',
    a: 'In Canada, TSN holds primary rights with coverage across TSN 1–5. CTV will show selected free-to-air matches. French-language coverage is on RDS.',
  },
  {
    q: 'Is World Cup 2026 on Sky Sports?',
    a: 'No. In the UK, FIFA World Cup 2026 rights are held by ITV and BBC, not Sky Sports. The tournament is completely free to watch on free-to-air TV.',
  },
  {
    q: 'What time do World Cup 2026 matches start on TV?',
    a: 'Most matches start at 17:00 or 20:00/21:00 ET in North America. For UK viewers this is 22:00 or 01:00/02:00 BST. For Australian viewers this is 07:00 or 10:00/11:00 AEST.',
  },
];

export default function WC2026TVGuidePage() {
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
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026 TV Guide', item: CANONICAL },
    ],
  };

  const typeColors: Record<string, string> = {
    'Free-to-air': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Free stream':  'bg-green-500/10 text-green-400 border-green-500/20',
    'Cable':        'bg-blue-500/10  text-blue-400  border-blue-500/20',
    'Stream':       'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'Cable/Stream': 'bg-blue-500/10  text-blue-400  border-blue-500/20',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026 TV Guide' },
        ]} />

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
            📺 FIFA World Cup 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 TV Guide
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            What channel is the World Cup 2026 on? Your complete TV guide — free-to-air channels, cable listings,
            and streaming platforms for every country. Find your broadcast right now.
          </p>
        </div>

        <AdSlot slotId="wc-tvguide-top" variant="banner" />

        {/* Channel guide by country */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">TV Channels by Country</h2>
          <div className="space-y-5">
            {TV_CHANNELS.map(({ country, topLine, channels, note, countrySlug }) => (
              <div key={country} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-white">{country}</p>
                    <p className="text-sm text-yellow-400 font-semibold">{topLine}</p>
                  </div>
                  <Link href={`/world-cup-2026/tv-schedule/${countrySlug}`}
                    className="shrink-0 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
                    Full schedule →
                  </Link>
                </div>
                <div className="divide-y divide-white/5">
                  {channels.map(({ name, type, detail }) => (
                    <div key={name} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{name}</p>
                        <p className="text-xs text-gray-500">{detail}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeColors[type] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                        {type}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 bg-white/5 border-t border-white/5">
                  <p className="text-xs text-gray-500 italic">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick finder CTA */}
        <div className="bg-gradient-to-br from-yellow-950/30 to-gray-900 border border-yellow-800/30 rounded-2xl p-5 mb-8">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1">📺 Detailed TV Schedules</p>
          <p className="text-white font-bold text-base mb-1">Find kickoff times in your timezone</p>
          <p className="text-gray-400 text-sm mb-4">
            See every match with local kickoff times, channel listings and friendly/competitive match labels for your country.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/world-cup-2026/tv-schedule/usa',    label: '🇺🇸 USA Schedule' },
              { href: '/world-cup-2026/tv-schedule/uk',     label: '🇬🇧 UK Schedule' },
              { href: '/world-cup-2026/tv-schedule/canada', label: '🇨🇦 Canada Schedule' },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-lg border border-gray-700 transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>

        <AdSlot slotId="wc-tvguide-mid" variant="rectangle" className="mx-auto mb-8" />

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">World Cup 2026 TV Guide — FAQ</h2>
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

        <AdSlot slotId="wc-tvguide-bottom" variant="banner" />

        <div className="border-t border-gray-800 pt-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">More World Cup 2026</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/world-cup-2026',                  label: '🏆 WC Hub' },
              { href: '/world-cup-2026/tv-schedule',      label: '🗓️ TV Schedule' },
              { href: '/world-cup-2026/watch-live',       label: '📺 Watch Live' },
              { href: '/world-cup-2026/streaming-guide',  label: '🌐 Streaming Guide' },
              { href: '/world-cup-2026/fixtures',         label: '📅 Fixtures' },
              { href: '/world-cup-2026-live-stream',      label: '🔴 Live Stream Guide' },
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
