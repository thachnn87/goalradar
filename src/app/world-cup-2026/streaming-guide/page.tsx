import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/streaming-guide`;
const TITLE    = 'FIFA World Cup 2026 Streaming Guide – Best Ways to Stream Every Match';
const DESC     = 'The complete FIFA World Cup 2026 streaming guide. Find the best streaming platforms, apps and services to watch every match live online. Free and paid options for every country.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: TITLE, description: DESC, type: 'article', url: PAGE_URL },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

const FAQ_ITEMS = [
  {
    q: 'What is the best streaming service for World Cup 2026?',
    a: 'The best streaming service depends on your country. In the USA, Fubo TV offers comprehensive coverage including Fox, FS1, Telemundo and more, making it the top choice for cord-cutters. In the UK, BBC iPlayer and ITVX are free and require no subscription. In Canada, TSN Direct is the premium option while CTV offers free matches. In Australia, SBS On Demand is free and covers all matches.',
  },
  {
    q: 'Can I stream World Cup 2026 for free?',
    a: 'Yes, in several countries you can stream matches for free. UK viewers can use BBC iPlayer and ITVX at no cost. Australian fans get SBS On Demand for free. In the USA, some matches on Fox are available to stream free on the Fox Sports website with a valid cable subscription. Free trial periods on paid services like Fubo TV also allow temporary free access.',
  },
  {
    q: 'What streaming devices can I use to watch the World Cup?',
    a: 'Most official broadcaster apps are compatible with a wide range of devices including Smart TVs (Samsung, LG, Sony), streaming sticks (Amazon Fire Stick, Roku, Chromecast), gaming consoles (PS5, Xbox Series X), Apple TV, iOS and Android smartphones and tablets, and desktop browsers. Check your specific app for supported devices.',
  },
  {
    q: 'Can I watch World Cup 2026 on my phone?',
    a: 'Yes. All major official streaming services have dedicated iOS and Android apps. The Fox Sports app, Peacock, Telemundo Deportes, BBC iPlayer, ITVX, TSN Direct, and SBS On Demand all support mobile streaming. You can watch matches on your smartphone or tablet with a stable internet connection.',
  },
  {
    q: 'How much data does streaming the World Cup use?',
    a: 'Streaming in Standard Definition (SD) uses approximately 1 GB per hour. High Definition (HD, 1080p) uses around 3 GB per hour. 4K Ultra HD can use up to 7 GB per hour. For a typical 2-hour World Cup match, expect 2–6 GB in HD. For mobile streaming, connect to Wi-Fi where possible to avoid excessive mobile data charges.',
  },
  {
    q: 'Do I need a VPN to stream World Cup 2026?',
    a: 'You do not need a VPN to access your home country\'s official stream. A VPN becomes useful when travelling abroad and wanting to access your home broadcaster\'s app, or when accessing a free service (like BBC iPlayer) from outside the UK. Choose a VPN with fast servers in your target country and check that it does not violate the streaming service\'s terms of service.',
  },
  {
    q: 'What internet speed do I need to stream the World Cup?',
    a: 'For smooth streaming: SD quality requires at least 3 Mbps, HD (1080p) requires 5–10 Mbps, and 4K requires 25 Mbps or more. For the best experience during live matches, especially during peak viewing hours, a stable connection of at least 10 Mbps for HD is recommended. Use a wired ethernet connection over Wi-Fi if possible for reliability.',
  },
];

type StreamPlatform = {
  name: string;
  region: string;
  price: string;
  devices: string;
  free: boolean;
  tag: string;
};

const PLATFORMS: StreamPlatform[] = [
  { name: 'Fubo TV',              region: '🇺🇸 USA',      price: 'From $79.99/mo',   devices: 'Smart TV, Mobile, Browser, Streaming Sticks', free: false, tag: 'fubo-stream' },
  { name: 'Peacock Premium',      region: '🇺🇸 USA',      price: 'From $5.99/mo',    devices: 'Smart TV, Mobile, Browser, Apple TV, Chromecast', free: false, tag: 'peacock-stream' },
  { name: 'Hulu + Live TV',       region: '🇺🇸 USA',      price: 'From $76.99/mo',   devices: 'Smart TV, Mobile, Browser, Streaming Sticks', free: false, tag: 'hulu-stream' },
  { name: 'YouTube TV',           region: '🇺🇸 USA',      price: 'From $72.99/mo',   devices: 'Smart TV, Mobile, Browser, Chromecast, Roku', free: false, tag: 'ytv-stream' },
  { name: 'BBC iPlayer',          region: '🇬🇧 UK',       price: 'Free',             devices: 'Smart TV, Mobile, Browser, Streaming Sticks', free: true, tag: 'bbc-stream' },
  { name: 'ITVX',                 region: '🇬🇧 UK',       price: 'Free',             devices: 'Smart TV, Mobile, Browser, Streaming Sticks', free: true, tag: 'itvx-stream' },
  { name: 'TSN Direct',           region: '🇨🇦 Canada',   price: 'From $19.99/mo',   devices: 'Smart TV, Mobile, Browser, Apple TV, Chromecast', free: false, tag: 'tsn-stream' },
  { name: 'CTV',                  region: '🇨🇦 Canada',   price: 'Free',             devices: 'Smart TV, Mobile, Browser', free: true, tag: 'ctv-stream' },
  { name: 'SBS On Demand',        region: '🇦🇺 Australia', price: 'Free',            devices: 'Smart TV, Mobile, Browser, Chromecast', free: true, tag: 'sbs-stream' },
  { name: 'JioTV / Sports18',     region: '🇮🇳 India',    price: 'Free/Subscription',devices: 'Mobile, Smart TV, Browser', free: true, tag: 'jio-stream' },
];

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-xl font-bold text-white mt-8 mb-3">{children}</h2>;
}

function SectionH3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-200 mt-5 mb-2">{children}</h3>;
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="text-gray-400 text-sm leading-relaxed space-y-3">{children}</div>;
}

export default function StreamingGuidePage() {
  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',            item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',  item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Streaming Guide', item: PAGE_URL },
    ],
  };

  const jsonLdArticle = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: TITLE,
    description: DESC,
    url: PAGE_URL,
    datePublished: '2026-01-01',
    dateModified: '2026-06-01',
    author: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Streaming Guide' },
        ]} />

        {/* Hero */}
        <div className="mt-6 mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📡</span>
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">World Cup 2026 Guide</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
            FIFA World Cup 2026 Streaming Guide
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            With <strong className="text-white">104 World Cup matches</strong> spread across 39 days, cord-cutters and streaming fans have more options than ever to watch every kick from the opening group stage to the MetLife Stadium Final. This guide covers every major streaming platform, how to watch for free, and the best setup for your device and country.
          </p>
        </div>

        <nav className="flex flex-wrap gap-2 mb-8 text-xs" aria-label="Page sections">
          {['All Platforms','Free Streaming','USA','UK','Canada','Devices','Speed Guide','VPN Tips','FAQ'].map(s => (
            <a key={s} href={`#${s.toLowerCase().replace(/\s/g,'-')}`}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700 transition-colors">{s}</a>
          ))}
        </nav>

        {/* All Platforms */}
        <SectionTitle id="all-platforms">All World Cup 2026 Streaming Platforms</SectionTitle>
        <Prose>
          <p>The table below covers all major official streaming platforms with confirmed or expected World Cup 2026 rights, grouped by region. Prices are indicative and subject to change — check each provider's website for current offers, including free trials.</p>
        </Prose>

        <div className="space-y-3 my-6">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold text-sm">{p.name}</span>
                  <span className="text-gray-600 text-xs">{p.region}</span>
                  {p.free && (
                    <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded text-[10px] font-semibold">FREE</span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-0.5">{p.devices}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white font-semibold text-sm">{p.price}</p>
                {/* ── replace href="#" with affiliate link ── */}
                <a href="#" target="_blank" rel="noopener noreferrer sponsored" data-affiliate-tag={p.tag}
                  className="text-yellow-500 hover:text-yellow-300 text-xs transition-colors">Watch →</a>
              </div>
            </div>
          ))}
        </div>
        <p className="text-gray-600 text-xs italic">* Affiliate links: GoalRadar may earn a commission at no extra cost to you. We only list services with official broadcast rights.</p>

        {/* Free Streaming */}
        <SectionTitle id="free-streaming">How to Stream World Cup 2026 for Free</SectionTitle>
        <Prose>
          <p>The good news for football fans on a budget is that you do not necessarily need to pay for a subscription to stream the World Cup 2026. Here are the best completely free streaming options by region:</p>
        </Prose>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          {[
            { flag: '🇬🇧', region: 'United Kingdom', service: 'BBC iPlayer + ITVX', detail: 'Full free streaming. BBC iPlayer requires a UK TV licence. ITVX needs a free account.', tag: 'uk-free' },
            { flag: '🇦🇺', region: 'Australia', service: 'SBS On Demand', detail: 'All matches streamed free. Create a free SBS account and watch on any device.', tag: 'au-free' },
            { flag: '🇨🇦', region: 'Canada', service: 'CTV', detail: 'Selected matches broadcast free on CTV. Stream via the CTV app for free.', tag: 'ca-free' },
            { flag: '🇩🇪', region: 'Germany', service: 'ARD Mediathek + ZDF', detail: 'Both public broadcasters offer free online streams for their World Cup coverage.', tag: 'de-free' },
            { flag: '🇫🇷', region: 'France', service: 'MyTF1', detail: 'TF1 streams free to air matches online via the MyTF1 website and app.', tag: 'fr-free' },
            { flag: '🇮🇳', region: 'India', service: 'JioTV / Sports18', detail: 'Jio subscribers get free access via JioTV. Sports18 also streams selected matches free.', tag: 'in-free' },
          ].map(({ flag, region, service, detail }) => (
            <div key={region} className="bg-gray-900 border border-green-800/30 rounded-xl p-4">
              <p className="text-white font-bold text-sm mb-1">{flag} {region}</p>
              <p className="text-green-400 font-semibold text-sm mb-1">✓ {service}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>

        {/* USA Streaming */}
        <SectionTitle id="usa">Streaming World Cup 2026 in the USA</SectionTitle>
        <Prose>
          <p>The United States is co-hosting the World Cup 2026, making this one of the most hyped sporting events in American history. Fox holds the primary English broadcast rights, while Telemundo covers the Spanish-language audience. Here is how to stream every match in the USA:</p>
        </Prose>

        <SectionH3>English Language</SectionH3>
        <Prose>
          <p><strong className="text-white">Fubo TV</strong> is the most comprehensive streaming option for US viewers, carrying Fox, FS1, FS2, and Telemundo channels in one package. It offers a 7-day free trial, making it possible to watch the opening days at no cost. Hulu + Live TV and YouTube TV also carry Fox channels.</p>
          <p><strong className="text-white">Peacock</strong> (NBC's streaming service) carries selected World Cup matches and is available as a standalone subscription from $5.99/month. The Fox Sports app also allows streaming if you authenticate with a cable or streaming TV login.</p>
        </Prose>

        <SectionH3>Spanish Language</SectionH3>
        <Prose>
          <p><strong className="text-white">Telemundo Deportes</strong> has full Spanish-language streaming rights. The free Telemundo Deportes app allows live streaming with a cable login. Fubo TV also carries Telemundo and Universo for Spanish-language viewers.</p>
        </Prose>

        {/* UK Streaming */}
        <SectionTitle id="uk">Streaming World Cup 2026 in the UK</SectionTitle>
        <Prose>
          <p>UK viewers are well-served by free-to-air options. The BBC and ITV shared broadcasting rights in 2022, and a similar arrangement is expected for 2026. Both offer completely free streaming:</p>
        </Prose>
        <ul className="list-disc list-inside text-gray-400 text-sm space-y-2 my-4 ml-2">
          <li><strong className="text-white">BBC iPlayer:</strong> Streams all BBC-covered matches live and on-demand. Free to use but requires a UK TV licence. Available on Smart TVs, phones, tablets, and browsers.</li>
          <li><strong className="text-white">ITVX:</strong> Streams all ITV-covered matches live and on-demand. Free to access with a free account. No TV licence required.</li>
        </ul>

        {/* Canada Streaming */}
        <SectionTitle id="canada">Streaming World Cup 2026 in Canada</SectionTitle>
        <Prose>
          <p>Canada is a co-host of World Cup 2026 and will see unprecedented national interest in the tournament. TSN and CTV hold English-language rights; RDS and TVA Sports hold French-language rights.</p>
          <p><strong className="text-white">TSN Direct</strong> offers a full streaming subscription from $4.99/day or $19.99/month, covering all TSN channels. CTV streams selected matches for free via the CTV app with no subscription required. For French speakers, the TVA Sports app offers streaming coverage.</p>
        </Prose>

        {/* Devices */}
        <SectionTitle id="devices">Best Devices to Stream World Cup 2026</SectionTitle>
        <Prose>
          <p>Most streaming services support a wide range of devices. Here is a compatibility breakdown to help you choose the best setup:</p>
        </Prose>

        <div className="overflow-x-auto my-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-800">
                <th className="text-left px-3 py-2.5 text-gray-400 font-semibold uppercase tracking-wider">Device</th>
                <th className="text-left px-3 py-2.5 text-gray-400 font-semibold uppercase tracking-wider">Best For</th>
                <th className="text-left px-3 py-2.5 text-gray-400 font-semibold uppercase tracking-wider">Max Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[
                ['Smart TV (Samsung/LG/Sony)', 'Living room big screen viewing', '4K / HDR'],
                ['Amazon Fire Stick 4K', 'Affordable HDTV upgrade', '4K HDR'],
                ['Roku Ultra', 'Best all-round streaming stick', '4K HDR'],
                ['Apple TV 4K', 'Best for iPhone/iPad users', '4K Dolby Vision'],
                ['Chromecast with Google TV', 'Google/Android users', '4K HDR'],
                ['PS5 / Xbox Series X', 'Gaming console streaming', '4K HDR'],
                ['iPhone / iPad', 'Mobile streaming', '1080p / 4K on newer models'],
                ['Android Phone / Tablet', 'Mobile streaming', '1080p / 4K'],
                ['Laptop / Desktop Browser', 'Flexible, no extra hardware', 'Up to 4K'],
              ].map(row => (
                <tr key={row[0]} className="bg-gray-900 hover:bg-gray-800/50 transition-colors">
                  {row.map((cell, i) => (
                    <td key={i} className={`px-3 py-2.5 ${i === 0 ? 'text-white font-medium' : 'text-gray-400'}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Speed Guide */}
        <SectionTitle id="speed-guide">Internet Speed Guide for Streaming</SectionTitle>
        <Prose>
          <p>A stable internet connection is essential for live sports streaming without buffering. Use the guide below to ensure your connection is suitable for the quality you want:</p>
        </Prose>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          {[
            { quality: 'SD (480p)',    speed: '3 Mbps',  data: '~1 GB/hr' },
            { quality: 'HD (1080p)',   speed: '10 Mbps', data: '~3 GB/hr' },
            { quality: '4K Ultra HD',  speed: '25 Mbps', data: '~7 GB/hr' },
            { quality: 'Recommended',  speed: '15 Mbps+',data: 'Stable HD' },
          ].map(({ quality, speed, data }) => (
            <div key={quality} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{quality}</p>
              <p className="text-white font-black">{speed}</p>
              <p className="text-gray-600 text-[10px] mt-0.5">{data}</p>
            </div>
          ))}
        </div>

        {/* VPN Tips */}
        <SectionTitle id="vpn-tips">VPN Tips for World Cup Streaming</SectionTitle>
        <Prose>
          <p>A VPN (Virtual Private Network) lets you change your apparent location online, which can be useful for accessing geo-restricted streaming content when travelling. Here are key considerations:</p>
        </Prose>
        <ul className="list-disc list-inside text-gray-400 text-sm space-y-2 my-4 ml-2">
          <li><strong className="text-white">Use case 1 — Travelling abroad:</strong> Connect to a VPN server in your home country to access your regular streaming service (e.g. BBC iPlayer when travelling outside the UK).</li>
          <li><strong className="text-white">Use case 2 — Access free services:</strong> Use a UK VPN server to access BBC iPlayer or ITVX if you are located outside the UK. Note: this may violate the service's terms.</li>
          <li><strong className="text-white">Choose a fast VPN:</strong> Live sports streaming requires fast, stable connections. Look for VPNs with 10 Gbps servers and low latency.</li>
          <li><strong className="text-white">Avoid free VPNs:</strong> Free VPN services often throttle speeds and may log your data. Use a reputable paid service for live match streaming.</li>
        </ul>

        {/* ── AFFILIATE: VPN ── */}
        <div className="space-y-3 my-6">
          {[
            { name: 'ExpressVPN', desc: 'Industry-leading speed. Servers in 105 countries. 30-day refund policy.', tag: 'expressvpn-stream' },
            { name: 'NordVPN', desc: '6,000+ servers. Streaming-optimized servers. Up to 6 devices.', tag: 'nordvpn-stream' },
            { name: 'Surfshark', desc: 'Budget-friendly. Unlimited devices. Fast servers for streaming.', tag: 'surfshark-stream' },
          ].map(({ name, desc, tag }) => (
            <div key={name} className="flex items-center justify-between gap-4 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3">
              <div>
                <p className="text-white font-semibold text-sm">{name}</p>
                <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
              </div>
              <a href="#" target="_blank" rel="noopener noreferrer sponsored" data-affiliate-tag={tag}
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-xs font-bold transition-colors shrink-0">Get Deal →</a>
            </div>
          ))}
        </div>
        <p className="text-gray-600 text-xs italic">Disclaimer: Affiliate links. GoalRadar earns a commission if you subscribe. Always verify that VPN use complies with your streaming service's terms.</p>

        {/* FAQ */}
        <SectionTitle id="faq">Frequently Asked Questions</SectionTitle>
        <div className="space-y-4">
          {FAQ_ITEMS.map(({ q, a }) => (
            <details key={q} className="bg-gray-900 border border-gray-800 rounded-xl group">
              <summary className="px-5 py-4 cursor-pointer text-white font-semibold text-sm list-none flex items-center justify-between gap-3">
                {q}
                <span className="text-gray-600 group-open:rotate-180 transition-transform shrink-0">▾</span>
              </summary>
              <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">{a}</div>
            </details>
          ))}
        </div>

        {/* Internal links */}
        <div className="mt-12 border-t border-gray-800 pt-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">More World Cup 2026</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/world-cup-2026',                label: '🏆 Tournament Hub' },
              { href: '/world-cup-2026/watch-live',     label: '📺 Watch Live' },
              { href: '/world-cup-2026/tv-schedule',    label: '📋 TV Schedule' },
              { href: '/schedule?competition=WC',        label: '📅 WC Fixtures' },
              { href: '/world-cup-2026/results',         label: '🏁 Results' },
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
