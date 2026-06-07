/**
 * src/components/WCWatchCountryContent.tsx
 *
 * Shared async server component for /world-cup-2026/watch-live/[country] pages.
 * Renders broadcaster table, FAQ, affiliate blocks, AdSense slots and internal links.
 */

import Link from 'next/link';
import type { WCWatchCountry, WCBroadcaster } from '@/lib/wc-watch-countries';
import AdSlot from '@/components/AdSlot';
import AffiliateBlock from '@/components/AffiliateBlock';
import NewsletterSignup from '@/components/NewsletterSignup';

const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BroadcasterBadge({ type }: { type: WCBroadcaster['type'] }) {
  const map: Record<WCBroadcaster['type'], { label: string; cls: string }> = {
    'free-tv':         { label: 'Free TV',    cls: 'bg-green-700/40 text-green-200 border border-green-600/50' },
    'pay-tv':          { label: 'Pay TV',     cls: 'bg-yellow-700/40 text-yellow-200 border border-yellow-600/50' },
    'streaming-free':  { label: 'Free Stream',cls: 'bg-emerald-700/40 text-emerald-200 border border-emerald-600/50' },
    'streaming-paid':  { label: 'Paid Stream',cls: 'bg-blue-700/40 text-blue-200 border border-blue-600/50' },
  };
  const { label, cls } = map[type];
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

function BroadcasterTable({ broadcasters }: { broadcasters: WCBroadcaster[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 text-white/60 uppercase text-xs tracking-wide">
            <th className="text-left px-4 py-3">Service</th>
            <th className="text-left px-4 py-3 hidden sm:table-cell">Type</th>
            <th className="text-left px-4 py-3">Coverage</th>
            <th className="text-left px-4 py-3 hidden md:table-cell">Platform</th>
            <th className="text-left px-4 py-3">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {broadcasters.map((b, i) => (
            <tr key={i} className="hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 font-semibold text-white">
                {b.name}
                {b.note && (
                  <span className="block text-xs text-white/45 font-normal mt-0.5">{b.note}</span>
                )}
              </td>
              <td className="px-4 py-3 hidden sm:table-cell">
                <BroadcasterBadge type={b.type} />
              </td>
              <td className="px-4 py-3 text-white/80">{b.coverage}</td>
              <td className="px-4 py-3 text-white/60 hidden md:table-cell">{b.platform}</td>
              <td className="px-4 py-3 font-medium text-yellow-400">{b.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KickoffTable({ kickoffs }: { kickoffs: WCWatchCountry['timezoneSection']['kickoffs'] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 mt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 text-white/60 uppercase text-xs tracking-wide">
            <th className="text-left px-4 py-3">UTC Time</th>
            <th className="text-left px-4 py-3">Local Time</th>
            <th className="text-left px-4 py-3 hidden sm:table-cell">Slot</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {kickoffs.map((k, i) => (
            <tr key={i} className="hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 text-white/60">{k.utcTime}</td>
              <td className="px-4 py-3 font-semibold text-yellow-400">{k.localTime}</td>
              <td className="px-4 py-3 text-white/60 hidden sm:table-cell">{k.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FAQAccordionItem({ q, a, index }: { q: string; a: string; index: number }) {
  const id = `faq-${index}`;
  return (
    <details className="group border border-white/10 rounded-xl overflow-hidden" name="faq">
      <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-white/5 transition-colors">
        <span className="font-semibold text-white">{q}</span>
        <span className="text-white/40 group-open:rotate-180 transition-transform shrink-0">▾</span>
      </summary>
      <div id={id} className="px-5 pb-4 pt-1 text-white/70 text-sm leading-relaxed bg-white/2">
        {a}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Quick Guide card
// ---------------------------------------------------------------------------

function QuickGuideCard({ country }: { country: WCWatchCountry }) {
  return (
    <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/25 to-transparent p-5 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">Quick Guide</h2>
      <p className="text-white text-base font-medium">{country.quickVerdict}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Best Free Option</p>
          <p className="text-sm text-green-300 font-semibold">{country.bestFree}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Best Paid / Premium</p>
          <p className="text-sm text-blue-300 font-semibold">{country.bestPaid}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  country: WCWatchCountry;
}

export default function WCWatchCountryContent({ country }: Props) {
  const canonicalUrl = `${BASE_URL}/world-cup-2026/watch-live/${country.slug}`;

  // JSON-LD: FAQPage + BreadcrumbList
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: country.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',          item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Watch Live',     item: `${BASE_URL}/world-cup-2026/watch-live` },
      { '@type': 'ListItem', position: 4, name: `Watch in ${country.name}`, item: canonicalUrl },
    ],
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-yellow-900/30 via-gray-900 to-gray-950 border-b border-white/10 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="text-sm text-white/40 mb-6 flex flex-wrap gap-1.5 items-center">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <span>/</span>
              <Link href="/world-cup-2026" className="hover:text-white/70 transition-colors">World Cup 2026</Link>
              <span>/</span>
              <Link href="/world-cup-2026/watch-live" className="hover:text-white/70 transition-colors">Watch Live</Link>
              <span>/</span>
              <span className="text-white/70">{country.name}</span>
            </nav>

            <div className="flex items-center gap-4 mb-4">
              <span className="text-6xl" role="img" aria-label={`${country.name} flag`}>{country.flag}</span>
              <div>
                <p className="text-yellow-400 text-sm font-semibold uppercase tracking-wider mb-1">
                  Watch Guide · {country.utcOffset}
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                  Watch World Cup 2026 in {country.name}
                </h1>
              </div>
            </div>

            <p className="text-lg text-white/70 max-w-2xl mb-6">{country.heroSubtitle}</p>

            {/* Quick Guide card */}
            <QuickGuideCard country={country} />
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 py-10 space-y-14">

          {/* ── Intro / Ad ─────────────────────────────────────────────────── */}
          <section>
            <p className="text-white/75 leading-relaxed text-base">{country.intro}</p>
            <div className="mt-6">
              <AdSlot variant="banner" />
            </div>
          </section>

          {/* ── Broadcaster table ─────────────────────────────────────────── */}
          <section id="broadcasters">
            <h2 className="text-2xl font-bold text-white mb-2">
              Official Broadcasters in {country.name}
            </h2>
            <p className="text-white/55 text-sm mb-5">
              Every confirmed channel and streaming service for FIFA World Cup 2026 in {country.name}.
            </p>
            <BroadcasterTable broadcasters={country.broadcasters} />
          </section>

          {/* ── First affiliate(s) ────────────────────────────────────────── */}
          {country.affiliates.slice(0, 1).map((aff) => (
            <AffiliateBlock
              key={aff.tag}
              title={aff.title}
              description={aff.description}
              cta={aff.cta}
              url="#"
            />
          ))}

          {/* ── Cord-cutting section ──────────────────────────────────────── */}
          <section id="streaming">
            <h2 className="text-2xl font-bold text-white mb-3">
              {country.cordCuttingSection.heading}
            </h2>
            <p className="text-white/75 leading-relaxed">{country.cordCuttingSection.body}</p>
          </section>

          {/* ── Timezone section ──────────────────────────────────────────── */}
          <section id="times">
            <h2 className="text-2xl font-bold text-white mb-3">
              {country.timezoneSection.heading}
            </h2>
            <p className="text-white/75 leading-relaxed mb-1">{country.timezoneSection.body}</p>
            <KickoffTable kickoffs={country.timezoneSection.kickoffs} />
          </section>

          {/* ── Rectangle ad ─────────────────────────────────────────────── */}
          <div className="flex justify-center">
            <AdSlot variant="rectangle" />
          </div>

          {/* ── VPN section ───────────────────────────────────────────────── */}
          <section id="vpn">
            <h2 className="text-2xl font-bold text-white mb-3">
              {country.vpnSection.heading}
            </h2>
            <p className="text-white/75 leading-relaxed">{country.vpnSection.body}</p>
            {/* Second affiliate if present */}
            {country.affiliates.length > 1 && (
              <div className="mt-6">
                <AffiliateBlock
                  title={country.affiliates[1].title}
                  description={country.affiliates[1].description}
                  cta={country.affiliates[1].cta}
                  url="#"
                />
              </div>
            )}
          </section>

          {/* ── FAQ ───────────────────────────────────────────────────────── */}
          <section id="faq">
            <h2 className="text-2xl font-bold text-white mb-6">
              Frequently Asked Questions — Watching in {country.name}
            </h2>
            <div className="space-y-3">
              {country.faq.map((item, i) => (
                <FAQAccordionItem key={i} q={item.q} a={item.a} index={i} />
              ))}
            </div>
          </section>

          {/* ── Newsletter ────────────────────────────────────────────────── */}
          <NewsletterSignup
            source={`watch-live-${country.slug}`}
            heading="Get World Cup 2026 Match Alerts"
            description="Fixture reminders, live score updates and broadcaster news delivered to your inbox."
          />

          {/* ── Banner ad ─────────────────────────────────────────────────── */}
          <AdSlot variant="banner" />

          {/* ── Internal links ────────────────────────────────────────────── */}
          <section aria-label="Related pages">
            <h2 className="text-lg font-bold text-white mb-4">More World Cup 2026</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { href: '/world-cup-2026',                 label: '🏆 WC Hub' },
                { href: '/world-cup-2026/watch-live',      label: '📺 Watch Live (All Countries)' },
                { href: '/live',                           label: '🔴 Live Scores' },
                { href: '/world-cup-2026/fixtures',        label: '📅 Fixtures' },
                { href: '/world-cup-2026/results',         label: '📊 Results' },
                { href: '/world-cup-2026/groups',          label: '🗂️ Groups' },
                { href: '/world-cup-2026/streaming-guide', label: '📡 Streaming Guide' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-center text-sm font-medium text-white/70 hover:text-yellow-400 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-3 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
