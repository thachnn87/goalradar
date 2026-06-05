import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 86400; // 24 hours — evergreen content

const BASE_URL  = 'https://goalradar.org';
const PAGE_URL  = `${BASE_URL}/world-cup-2026/watch-live`;
const TITLE     = 'How to Watch FIFA World Cup 2026 Live – Streams, TV & Channels';
const DESC      = 'Complete guide on how to watch FIFA World Cup 2026 live. Find official broadcasters, free streaming options, TV channels and the best ways to follow every match from USA, Canada & Mexico.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: TITLE, description: DESC, type: 'article', url: PAGE_URL },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

const FAQ_ITEMS = [
  {
    q: 'How can I watch FIFA World Cup 2026 live for free?',
    a: 'Several official broadcasters offer free-to-air coverage of the FIFA World Cup 2026. In the United States, select matches air on Fox and on Telemundo (Spanish). In the United Kingdom, ITV and BBC share the broadcast rights with free streaming on ITVX and BBC iPlayer. In Canada, CTV airs matches free to air. Availability varies by country — check your local broadcaster for free viewing options.',
  },
  {
    q: 'Which TV channels are showing the World Cup 2026?',
    a: 'Coverage varies by country. In the USA: Fox, FS1, Telemundo, and Universo. In the UK: ITV and BBC. In Canada: TSN, CTV, RDS, and TVA Sports. In Australia: SBS. In India: Sports18 and JioTV. In Germany: ARD and ZDF. Always check your local listings for the exact schedule.',
  },
  {
    q: 'Can I stream World Cup 2026 matches online?',
    a: 'Yes. In the USA you can stream on Fubo TV, Peacock, and the Fox Sports app. In the UK, BBC iPlayer and ITVX provide free online streaming. In Canada, use the TSN Direct or CTV apps. Most official broadcasters in your region offer an accompanying streaming app or website. A VPN may be required for some international streams.',
  },
  {
    q: 'What time do World Cup 2026 matches kick off?',
    a: 'Kick-off times vary depending on the match and host city. The tournament spans the USA, Canada and Mexico across multiple time zones (ET, CT, MT, PT). Group stage matches typically start at 12:00 PM, 3:00 PM, 6:00 PM, and 9:00 PM Eastern Time. Check the GoalRadar schedule for exact kick-off times converted to your local time.',
  },
  {
    q: 'Is the World Cup 2026 Final on free TV?',
    a: 'In most countries, yes. The 2026 World Cup Final is scheduled for 19 July 2026 at MetLife Stadium, New Jersey. It is expected to air on free-to-air channels including Fox (USA), ITV or BBC (UK), and other national broadcasters. Confirm with your local TV listings closer to the date.',
  },
  {
    q: 'Do I need a VPN to watch World Cup 2026?',
    a: 'A VPN is not required if you are in a country with official broadcast rights. However, if you are travelling abroad and wish to access your home country\'s streaming service, a reputable VPN can help you maintain access. Always ensure using a VPN complies with the streaming service\'s terms of use.',
  },
];

// ---------------------------------------------------------------------------
// Affiliate CTA — replace href="#" with your affiliate link
// ---------------------------------------------------------------------------
function AffiliateCTA({
  label, desc, href = '#', tag,
}: { label: string; desc: string; href?: string; tag?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3">
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm">{label}</p>
        <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-xs font-bold transition-colors shrink-0"
        data-affiliate-tag={tag}
      >
        Watch Now →
      </a>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-xl font-bold text-white mt-8 mb-3">{children}</h2>;
}

function SectionH3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-200 mt-5 mb-2">{children}</h3>;
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="text-gray-400 text-sm leading-relaxed space-y-3">{children}</div>;
}

export default function WatchLivePage() {
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
      { '@type': 'ListItem', position: 3, name: 'Watch Live',      item: PAGE_URL },
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
          { label: 'Watch Live' },
        ]} />

        {/* Hero */}
        <div className="mt-6 mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📺</span>
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">World Cup 2026 Guide</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
            How to Watch FIFA World Cup 2026 Live
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            The FIFA World Cup 2026 runs from <strong className="text-white">11 June to 19 July 2026</strong> across the United States, Canada and Mexico. Here is everything you need to know to watch every match live — from free-to-air TV options to premium streaming services.
          </p>
        </div>

        {/* Quick links */}
        <nav className="flex flex-wrap gap-2 mb-8 text-xs" aria-label="Page sections">
          {['Official Broadcasters','Streaming Services','By Country','Free Options','VPN Guide','FAQ'].map(s => (
            <a key={s} href={`#${s.toLowerCase().replace(/\s/g,'-')}`}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700 transition-colors">{s}</a>
          ))}
        </nav>

        {/* 1 — Official Broadcasters */}
        <SectionTitle id="official-broadcasters">Official FIFA World Cup 2026 Broadcasters</SectionTitle>
        <Prose>
          <p>FIFA has sold broadcast rights for the 2026 World Cup to a network of official media partners in every country. These are the only legally licensed sources for live coverage. Watching through official channels guarantees the best picture quality, full commentary, and access to replays and highlights without geo-blocking issues.</p>
          <p>Below are the confirmed official broadcasters for the most-watched markets. Rights deals are subject to change, so always verify with your local broadcaster before each match.</p>
        </Prose>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          {[
            { country: '🇺🇸 United States',  channels: 'Fox, FS1, FS2, Telemundo, Universo' },
            { country: '🇬🇧 United Kingdom', channels: 'ITV, BBC (rights TBC)' },
            { country: '🇨🇦 Canada',         channels: 'TSN, CTV, RDS, TVA Sports' },
            { country: '🇦🇺 Australia',      channels: 'SBS, Optus Sport' },
            { country: '🇩🇪 Germany',        channels: 'ARD, ZDF' },
            { country: '🇫🇷 France',         channels: 'TF1, beIN Sports' },
            { country: '🇪🇸 Spain',          channels: 'RTVE, Mediaset' },
            { country: '🇮🇳 India',          channels: 'Sports18, JioTV, Viacom18' },
            { country: '🇧🇷 Brazil',         channels: 'Globo, SporTV, Band' },
            { country: '🇲🇽 Mexico',         channels: 'Azteca, Canal 5, Sky Sports MX' },
          ].map(({ country, channels }) => (
            <div key={country} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-white font-semibold text-sm">{country}</p>
              <p className="text-gray-500 text-xs mt-0.5">{channels}</p>
            </div>
          ))}
        </div>

        {/* 2 — Streaming Services */}
        <SectionTitle id="streaming-services">Live Streaming Services for World Cup 2026</SectionTitle>
        <Prose>
          <p>Cord-cutters and mobile viewers can stream every World Cup 2026 match through official streaming apps and platforms. Most official broadcaster apps are free with a cable login or a standalone subscription. In the United States, the Fox Sports app and Peacock provide comprehensive coverage, while international viewers can use their national broadcaster's app.</p>
          <p>The following streaming services offer live World Cup coverage. Availability and pricing are subject to change — always check the provider's website for the latest offers.</p>
        </Prose>

        {/* ── AFFILIATE CTAs — replace href="#" with affiliate links ── */}
        <div className="space-y-3 my-6">
          <AffiliateCTA label="Fubo TV" desc="USA — Fox, FS1, Telemundo & more. 7-day free trial available." href="#" tag="fubo-wc2026" />
          <AffiliateCTA label="Peacock Premium" desc="USA — NBC coverage. Stream all World Cup matches." href="#" tag="peacock-wc2026" />
          <AffiliateCTA label="ITVX (Free)" desc="UK — Free streaming with ITV coverage. Create a free account." href="#" tag="itvx-wc2026" />
          <AffiliateCTA label="BBC iPlayer (Free)" desc="UK — Free online streaming. No subscription required." href="#" tag="bbc-iplayer-wc2026" />
          <AffiliateCTA label="TSN Direct" desc="Canada — All TSN channels. $4.99/day or $19.99/month." href="#" tag="tsn-wc2026" />
          <AffiliateCTA label="SBS On Demand" desc="Australia — Free streaming of all SBS World Cup coverage." href="#" tag="sbs-wc2026" />
        </div>

        <Prose>
          <p><em>Disclaimer: Links above are affiliate partnerships. GoalRadar may receive a commission if you purchase a subscription through these links, at no extra cost to you. We only recommend services with confirmed World Cup broadcasting rights.</em></p>
        </Prose>

        {/* 3 — By Country */}
        <SectionTitle id="by-country">How to Watch by Country</SectionTitle>

        <SectionH3>🇺🇸 United States</SectionH3>
        <Prose>
          <p>In the United States, Fox holds the primary English-language broadcast rights for FIFA World Cup 2026. All group stage matches, knockout rounds, and the Final will air across Fox, FS1, and FS2. Spanish-language coverage is available on Telemundo and Universo. Streaming is available via the Fox Sports app, Peacock, and the Telemundo Deportes app — most requiring a cable provider login or a standalone streaming subscription such as Fubo TV, Hulu Live TV, or YouTube TV.</p>
          <p>With the USA hosting 11 of the 16 venues, including MetLife Stadium in New Jersey (site of the Final), expect prime-time scheduling for many of the most anticipated matches.</p>
        </Prose>

        <SectionH3>🇬🇧 United Kingdom</SectionH3>
        <Prose>
          <p>The UK is expected to see shared broadcast coverage between ITV and BBC, the same arrangement used for the 2022 World Cup in Qatar. Both channels are free to air and available on Freeview, Sky, Virgin Media, and BT. Free online streaming is available via ITVX and BBC iPlayer — no subscription required, though a valid UK TV licence is needed for BBC coverage.</p>
        </Prose>

        <SectionH3>🇨🇦 Canada</SectionH3>
        <Prose>
          <p>Canada co-hosts the World Cup, making this a particularly exciting tournament for Canadian fans. Coverage is available on TSN and CTV (English) and RDS and TVA Sports (French). CTV offers free-to-air broadcasting, while TSN Direct provides a streaming subscription. With Canada in the competition, expect high demand for every Canucks match.</p>
        </Prose>

        <SectionH3>🇦🇺 Australia</SectionH3>
        <Prose>
          <p>Australian fans can watch on SBS, which provides free-to-air broadcasting of all World Cup matches. SBS On Demand offers free live streaming for those watching online. Optus Sport may also carry matches depending on their rights agreement. Note the significant time difference — most matches will air late at night or in the early hours of the morning Australian time.</p>
        </Prose>

        {/* 4 — Free Options */}
        <SectionTitle id="free-options">Free Ways to Watch World Cup 2026</SectionTitle>
        <Prose>
          <p>Not everyone wants to pay for a streaming subscription, and the good news is that the FIFA World Cup 2026 will be available free to air in many countries. Here are the best free viewing options:</p>
        </Prose>
        <ul className="list-disc list-inside text-gray-400 text-sm space-y-2 my-4 ml-2">
          <li><strong className="text-white">United Kingdom:</strong> BBC iPlayer and ITVX — completely free online streaming.</li>
          <li><strong className="text-white">United States:</strong> Select matches on Fox (free over-the-air with antenna) and Telemundo (Spanish, free OTA).</li>
          <li><strong className="text-white">Canada:</strong> CTV provides free-to-air broadcasting for selected matches.</li>
          <li><strong className="text-white">Australia:</strong> SBS and SBS On Demand — free with an account.</li>
          <li><strong className="text-white">Germany:</strong> ARD and ZDF — free public broadcasters covering all key matches.</li>
          <li><strong className="text-white">France:</strong> TF1 — free-to-air for selected matches.</li>
        </ul>

        {/* 5 — VPN Guide */}
        <SectionTitle id="vpn-guide">Using a VPN to Watch World Cup 2026</SectionTitle>
        <Prose>
          <p>A Virtual Private Network (VPN) allows you to route your internet traffic through a server in another country, making streaming services believe you are in that location. This is particularly useful if you are travelling abroad and want to access your home country's broadcaster, or if you want to access a free-to-air service such as BBC iPlayer from outside the UK.</p>
          <p>When choosing a VPN for streaming, look for fast connection speeds, servers in your target country, and a strict no-logs policy. Always check that using a VPN complies with the streaming service's terms of service before subscribing.</p>
        </Prose>

        {/* ── AFFILIATE: VPN CTAs ── */}
        <div className="space-y-3 my-6">
          <div className="flex items-center justify-between gap-4 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-white font-semibold text-sm">ExpressVPN</p>
              <p className="text-gray-500 text-xs">Fastest speeds. Servers in 105 countries. 30-day money back.</p>
            </div>
            <a href="#" target="_blank" rel="noopener noreferrer sponsored" data-affiliate-tag="expressvpn-wc2026"
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-xs font-bold transition-colors shrink-0">Get VPN →</a>
          </div>
          <div className="flex items-center justify-between gap-4 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-white font-semibold text-sm">NordVPN</p>
              <p className="text-gray-500 text-xs">6,000+ servers. Great for streaming. 30-day money back.</p>
            </div>
            <a href="#" target="_blank" rel="noopener noreferrer sponsored" data-affiliate-tag="nordvpn-wc2026"
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-xs font-bold transition-colors shrink-0">Get VPN →</a>
          </div>
        </div>

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
              { href: '/world-cup-2026/tv-schedule',    label: '📺 TV Schedule' },
              { href: '/world-cup-2026/streaming-guide',label: '📡 Streaming Guide' },
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
