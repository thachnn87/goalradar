import Link from 'next/link';
import type { Metadata } from 'next';

import { getWCLiveMatches, getUpcomingMatches, getTodayMatches } from '@/lib/api';
import type { Match } from '@/lib/types';
import { matchPath } from '@/lib/url';
import Breadcrumb from '@/components/Breadcrumb';
import MatchCard from '@/components/MatchCard';
import AffiliateBlock from '@/components/AffiliateBlock';

// Refresh every 60 s so live fixtures stay accurate
export const revalidate = 60;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/watch-live`;
const TITLE    = 'Watch World Cup 2026 Live – Streams, TV Channels & Today\'s Matches';
const DESC     = 'Watch FIFA World Cup 2026 live online and on TV. Find today\'s matches, kick-off times and official broadcasters in the USA, UK, Canada, Australia, Thailand, Vietnam, Indonesia and China.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: TITLE, description: DESC, type: 'article', url: PAGE_URL },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    q: 'How can I watch World Cup 2026 live online for free?',
    a: 'Several official broadcasters stream the FIFA World Cup 2026 for free. In the United Kingdom, BBC iPlayer and ITVX both offer free live streaming. In Australia, SBS On Demand is completely free. In Canada, CTV streams selected matches at no cost. In the USA, Fox and Telemundo air selected matches free over-the-air, and some games are available without a subscription on the Fox Sports website with a valid TV provider login. In Vietnam, FPT Play and VTV provide free access to matches. Always use official sources to ensure legal, high-quality coverage.',
  },
  {
    q: 'Which TV channels are showing the World Cup 2026 in the USA?',
    a: 'In the United States, Fox holds the primary English-language broadcast rights. Matches air across Fox, FS1, and FS2. Spanish-language coverage is on Telemundo and Universo. For streaming, use the Fox Sports app, Peacock, Fubo TV, Hulu + Live TV, or YouTube TV. The Fox Sports app also streams matches free with a participating TV provider login.',
  },
  {
    q: 'How to watch World Cup 2026 live in the UK?',
    a: 'In the United Kingdom, ITV and BBC share broadcast rights for FIFA World Cup 2026, as they did in 2022. Both are free-to-air on Freeview, Sky, and Virgin Media. Stream for free on ITVX (no subscription) or BBC iPlayer (requires a UK TV licence). No cable subscription is needed for the free streaming apps.',
  },
  {
    q: 'Where to watch World Cup 2026 live in Thailand?',
    a: 'In Thailand, FIFA World Cup 2026 matches are expected to be broadcast on TrueVisions and True Sport channels. True Sport offers live streaming via the TrueID app for subscribers. Free-to-air coverage may also be available on selected Thai public channels. Check TrueVisions and local Thai TV listings for confirmed match schedules.',
  },
  {
    q: 'Where to watch World Cup 2026 live in Vietnam?',
    a: 'In Vietnam, FIFA World Cup 2026 coverage is available on FPT Play and VTV (Vietnam Television). FPT Play offers live online streaming and is accessible via mobile app and web browser. VTV may broadcast selected key matches free to air. K+ (K Plus) satellite channel also has football broadcast rights in Vietnam and may carry World Cup coverage.',
  },
  {
    q: 'Where to watch World Cup 2026 live in Indonesia?',
    a: 'In Indonesia, FIFA World Cup 2026 matches are expected to be broadcast on RCTI, SCTV, and Mola TV. Mola TV offers live streaming via its app and website and typically carries comprehensive football coverage. RCTI and SCTV are free-to-air channels available nationwide. Check local Indonesian TV listings for confirmed broadcast details.',
  },
  {
    q: 'Where to watch World Cup 2026 live in China?',
    a: 'In China, FIFA World Cup 2026 is expected to be broadcast on CCTV-5 (China Central Television), which traditionally airs major international football tournaments. Online streaming is available through Migu Video (China Mobile), iQiyi, and Youku, which have previously held digital rights for major football competitions in China. Check official announcements for confirmed streaming platform rights.',
  },
  {
    q: 'Where to watch World Cup 2026 live in Australia?',
    a: 'In Australia, SBS holds broadcast rights for FIFA World Cup 2026. Matches air free to air on SBS and SBS World Sports. Free online streaming is available via SBS On Demand — no subscription required, just create a free account. Note that many matches will air very late at night or early morning in Australian time zones.',
  },
  {
    q: 'What time do World Cup 2026 matches kick off?',
    a: 'Group stage matches typically start at 12:00 PM, 3:00 PM, 6:00 PM, and 9:00 PM Eastern Time (ET). Since the tournament spans USA, Canada and Mexico, some matches start at slightly different local times depending on the host city. In UK time (BST), that is 5:00 PM, 8:00 PM, 11:00 PM, and 2:00 AM. In Southeast Asia (ICT, UTC+7), matches start at midnight, 3:00 AM, 6:00 AM, and 9:00 AM local time.',
  },
  {
    q: 'Do I need a VPN to watch World Cup 2026?',
    a: 'You do not need a VPN if you are in a country with official broadcast rights. A VPN is useful if you are travelling abroad and want to access your home country\'s streaming service. For example, a UK-based VPN server allows access to BBC iPlayer or ITVX from outside the UK. Always ensure VPN use complies with the streaming service\'s terms of service. We recommend reputable paid VPN services for reliable live sports streaming.',
  },
];

// ---------------------------------------------------------------------------
// Broadcaster data
// ---------------------------------------------------------------------------

const BROADCASTERS = [
  {
    flag: '🇺🇸',
    region: 'United States',
    channels: [
      { name: 'Fox / FS1 / FS2',     detail: 'English — Cable, Satellite, OTA',   free: false },
      { name: 'Telemundo / Universo', detail: 'Spanish — Cable, Satellite, OTA',  free: false },
      { name: 'Fubo TV',             detail: 'Streaming — From $79.99/mo',        free: false },
      { name: 'Peacock',             detail: 'Streaming — From $5.99/mo',         free: false },
    ],
  },
  {
    flag: '🇬🇧',
    region: 'United Kingdom',
    channels: [
      { name: 'ITV / ITVX',    detail: 'Free-to-air + free streaming',  free: true  },
      { name: 'BBC / iPlayer', detail: 'Free-to-air + free streaming',  free: true  },
    ],
  },
  {
    flag: '🇨🇦',
    region: 'Canada',
    channels: [
      { name: 'CTV',                  detail: 'English — Free-to-air',             free: true  },
      { name: 'TSN / TSN Direct',     detail: 'English — Subscription streaming',  free: false },
      { name: 'RDS / TVA Sports',     detail: 'French — Subscription',             free: false },
    ],
  },
  {
    flag: '🇦🇺',
    region: 'Australia',
    channels: [
      { name: 'SBS / SBS On Demand', detail: 'Free-to-air + free streaming',  free: true  },
      { name: 'Optus Sport',         detail: 'Subscription streaming',         free: false },
    ],
  },
  {
    flag: '🇹🇭',
    region: 'Thailand',
    channels: [
      { name: 'TrueVisions / True Sport', detail: 'Cable + TrueID app streaming',  free: false },
      { name: 'Thai Public TV (TBD)',      detail: 'Free-to-air — check listings',  free: true  },
    ],
  },
  {
    flag: '🇻🇳',
    region: 'Vietnam',
    channels: [
      { name: 'FPT Play',  detail: 'Online streaming — app & web',      free: true  },
      { name: 'VTV',       detail: 'Free-to-air national broadcaster',  free: true  },
      { name: 'K+ (K Plus)',detail: 'Satellite — subscription',         free: false },
    ],
  },
  {
    flag: '🇮🇩',
    region: 'Indonesia',
    channels: [
      { name: 'RCTI / SCTV', detail: 'Free-to-air — nationwide',   free: true  },
      { name: 'Mola TV',     detail: 'Streaming — app & web',       free: false },
    ],
  },
  {
    flag: '🇨🇳',
    region: 'China',
    channels: [
      { name: 'CCTV-5',        detail: 'Free-to-air national broadcaster',    free: true  },
      { name: 'Migu Video',    detail: 'China Mobile streaming platform',     free: false },
      { name: 'iQiyi / Youku', detail: 'Online streaming platforms',          free: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKickoff(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

function formatMatchDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-xl font-bold text-white mt-10 mb-4">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-200 mt-6 mb-2">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-400 text-sm leading-relaxed">{children}</p>;
}

// ---------------------------------------------------------------------------
// Upcoming fixture row (compact list item with team names + kickoff)
// ---------------------------------------------------------------------------

function FixtureRow({ match }: { match: Match }) {
  const hn = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const an = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  return (
    <Link
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors group"
    >
      {/* Kickoff / status */}
      <div className="shrink-0 w-20 text-center">
        {isLive ? (
          <span className="text-red-400 text-xs font-bold flex items-center gap-1 justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        ) : (
          <>
            <p className="text-white text-xs font-bold">{formatKickoff(match.utcDate)}</p>
            <p className="text-gray-600 text-[10px]">{formatMatchDate(match.utcDate)}</p>
          </>
        )}
      </div>

      {/* Home */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
        {match.homeTeam?.crest && (
          <img src={match.homeTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />
        )}
        <span className="text-gray-200 text-sm font-medium truncate text-right group-hover:text-white transition-colors">{hn}</span>
      </div>

      <span className="text-gray-600 text-xs shrink-0 font-mono">vs</span>

      {/* Away */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-gray-200 text-sm font-medium truncate group-hover:text-white transition-colors">{an}</span>
        {match.awayTeam?.crest && (
          <img src={match.awayTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />
        )}
      </div>

      <span className="text-yellow-500 text-xs shrink-0 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Watch →</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WatchLivePage() {
  // Fetch live + today + upcoming WC matches in parallel
  const [liveRes, upcomingRes, todayRes] = await Promise.allSettled([
    getWCLiveMatches(),
    getUpcomingMatches('WC'),
    getTodayMatches(),
  ]);

  const liveMatches: Match[] =
    liveRes.status === 'fulfilled' ? liveRes.value.matches : [];

  const todayWC: Match[] =
    todayRes.status === 'fulfilled'
      ? todayRes.value.matches.filter(
          (m) => m.competition.code === 'WC' && !['IN_PLAY', 'PAUSED'].includes(m.status)
        )
      : [];

  const upcoming: Match[] =
    upcomingRes.status === 'fulfilled'
      ? [...upcomingRes.value.matches]
          .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
          .slice(0, 8)
      : [];

  const hasLive   = liveMatches.length > 0;
  const hasToday  = todayWC.length > 0;

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
    dateModified: new Date().toISOString().split('T')[0],
    author:    { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
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
        <div className="mt-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📺</span>
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">FIFA World Cup 2026</span>
            {hasLive && (
              <span className="flex items-center gap-1 text-red-400 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE NOW
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
            Watch World Cup 2026 Live
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Find out how to <strong className="text-white">watch FIFA World Cup 2026 live</strong> — today&apos;s kick-off times, official TV channels and streaming services for every country, from the USA and UK to Thailand, Vietnam, Indonesia and China.
          </p>
        </div>

        {/* Section anchors */}
        <nav className="flex flex-wrap gap-2 mb-8 text-xs" aria-label="Page sections">
          {[
            { href: '#live-now',       label: '🔴 Live Now' },
            { href: '#todays-matches', label: '📅 Today' },
            { href: '#upcoming',       label: '🗓 Upcoming' },
            { href: '#broadcasters',   label: '📺 Broadcasters' },
            { href: '#asia',           label: '🌏 Asia' },
            { href: '#faq',            label: '❓ FAQ' },
          ].map(({ href, label }) => (
            <a key={href} href={href}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700 transition-colors">
              {label}
            </a>
          ))}
        </nav>

        {/* ── LIVE NOW ────────────────────────────────────────────────────── */}
        {hasLive && (
          <section id="live-now" className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <h2 className="text-lg font-bold text-red-400">Live World Cup Matches Right Now</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {liveMatches.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
            <p className="text-xs text-gray-600 mt-3">
              Find these matches on your official broadcaster — see the channel list below.
            </p>
          </section>
        )}

        {/* ── TODAY'S MATCHES ─────────────────────────────────────────────── */}
        <section id="todays-matches" className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">
            Today&apos;s World Cup Matches & Kick-off Times
          </h2>
          {hasToday || hasLive ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50">
              {liveMatches.map((m) => <FixtureRow key={m.id} match={m} />)}
              {todayWC.map((m) => <FixtureRow key={m.id} match={m} />)}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              No World Cup matches scheduled for today.{' '}
              <Link href="#upcoming" className="text-yellow-500 hover:text-yellow-300">See upcoming fixtures →</Link>
            </div>
          )}
        </section>

        {/* ── UPCOMING FIXTURES ────────────────────────────────────────────── */}
        {upcoming.length > 0 && (
          <section id="upcoming" className="mb-10">
            <h2 className="text-lg font-bold text-white mb-4">
              Upcoming World Cup Fixtures
            </h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50 mb-3">
              {upcoming.map((m) => <FixtureRow key={m.id} match={m} />)}
            </div>
            <Link
              href="/schedule?competition=WC"
              className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors"
            >
              View full World Cup schedule →
            </Link>
          </section>
        )}

        {/* ── WHERE TO WATCH ───────────────────────────────────────────────── */}
        <SectionTitle id="where-to-watch">Where to Watch FIFA World Cup 2026 Live</SectionTitle>
        <P>
          FIFA World Cup 2026 is broadcast across the globe through a network of official media partners. The tournament runs from <strong className="text-white">11 June to 19 July 2026</strong>, hosted across 16 cities in the United States, Canada and Mexico. With 104 matches and 48 nations competing, it is the largest FIFA World Cup in history — and coverage is available in virtually every country worldwide through official channels.
        </P>
        <P>
          To watch World Cup 2026 live, always use official broadcasters. Illegal streams risk poor quality, buffering, and exposure to malicious software. Every match is available through a legitimate broadcaster in your region — in many countries, including the UK, Australia, Canada and Vietnam, coverage is completely free.
        </P>

        {/* ── OFFICIAL BROADCASTERS TABLE ──────────────────────────────────── */}
        <SectionTitle id="broadcasters">Official World Cup 2026 Broadcasters by Country</SectionTitle>

        <div className="space-y-4 mb-8" id="broadcaster-list">
          {BROADCASTERS.map(({ flag, region, channels }) => (
            <div key={region} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-gray-800/60 px-4 py-2.5 flex items-center gap-2">
                <span className="text-lg">{flag}</span>
                <h3 className="text-sm font-bold text-white">{region}</h3>
              </div>
              <div className="divide-y divide-gray-800/50">
                {channels.map(({ name, detail, free }) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-white text-sm font-medium">{name}</span>
                      {free && (
                        <span className="bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                          FREE
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs shrink-0 text-right">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── USA detail ───────────────────────────────────────────────────── */}
        <SectionTitle id="usa">Watching World Cup 2026 Live in the USA</SectionTitle>
        <P>
          The United States is co-hosting World Cup 2026 and 11 of the 16 venues are on US soil, including MetLife Stadium in New Jersey where the Final takes place. Fox holds the primary English-language broadcast rights. All group stage matches, knockout rounds, and the Final will air across Fox, FS1, and FS2. Spanish-language coverage is on Telemundo and Universo.
        </P>
        <P>
          Cord-cutters can stream every World Cup 2026 match in the USA via Fubo TV, which carries Fox, FS1, and Telemundo in one package. Peacock, Hulu + Live TV, and YouTube TV are also options. The Fox Sports app allows free streaming for those with a participating cable or satellite provider login.
        </P>

        {/* ── UK detail ────────────────────────────────────────────────────── */}
        <SectionTitle id="uk">Watching World Cup 2026 Live in the UK</SectionTitle>
        <P>
          UK viewers enjoy the best deal of any major market — ITV and BBC share broadcast rights and both are free to air. Stream every covered match for free on ITVX (no subscription needed) or BBC iPlayer (requires a valid UK TV licence). Both apps are available on Smart TVs, mobile, desktop, and streaming sticks including Amazon Fire Stick and Roku.
        </P>

        {/* ── Asia detail ──────────────────────────────────────────────────── */}
        <SectionTitle id="asia">Watching World Cup 2026 Live in Southeast Asia &amp; China</SectionTitle>
        <H3>🇹🇭 Thailand</H3>
        <P>
          In Thailand, TrueVisions and True Sport hold broadcast rights. Subscribers can watch live via the TrueID app on mobile or Smart TV. True Sport channels provide full match coverage across the group stage and knockout rounds. Selected key matches may also be available on free-to-air Thai public channels — check local listings for confirmed schedule details.
        </P>

        <H3>🇻🇳 Vietnam</H3>
        <P>
          Vietnamese football fans have excellent options for watching World Cup 2026 live. FPT Play, the digital platform of FPT Corporation, provides live streaming of matches via the FPT Play app and website — accessible on mobile, Smart TV, and computers. VTV (Vietnam Television) traditionally airs World Cup matches free to air and is available nationwide. K+ (K Plus) satellite and cable platform also carries major international football tournaments in Vietnam.
        </P>

        <H3>🇮🇩 Indonesia</H3>
        <P>
          Indonesian fans can watch World Cup 2026 on RCTI and SCTV, both free-to-air networks with nationwide coverage. For premium online streaming, Mola TV is Indonesia's leading sports streaming platform and has previously held rights to major international football, including European competitions. Check Mola TV and official Indonesian broadcaster announcements for confirmed World Cup rights ahead of the tournament.
        </P>

        <H3>🇨🇳 China</H3>
        <P>
          In China, CCTV-5 (China Central Television Sports) is the primary broadcaster for major international football tournaments including the FIFA World Cup. Online streaming rights have previously been held by Migu Video (China Mobile's streaming platform), iQiyi, and Youku. These platforms offer mobile and web streaming with Chinese commentary. Confirm the latest rights agreements closer to the tournament start date.
        </P>

        {/* ── Legal note ───────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-yellow-800/30 rounded-xl p-4 my-8">
          <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">Important notice</p>
          <p className="text-gray-400 text-sm">
            GoalRadar only lists <strong className="text-white">official, licensed broadcasters</strong>. We do not link to or recommend any illegal streaming services. Illegal streams violate copyright law, deliver poor quality, and expose viewers to security risks. Every country has an official broadcaster — use the list above to find yours.
          </p>
        </div>

        {/* ── VPN note ─────────────────────────────────────────────────────── */}
        <SectionTitle id="vpn">Travelling Abroad? How to Watch World Cup 2026 Anywhere</SectionTitle>
        <P>
          If you are travelling during the tournament and want to access your home country&apos;s official stream, a reputable VPN service allows you to connect through a server in your home country. For example, UK travellers can use a VPN to access BBC iPlayer or ITVX from anywhere in the world. Always verify that VPN use complies with the streaming service&apos;s terms and conditions. We recommend established, paid VPN services with fast streaming-optimised servers.
        </P>

        {/* ── Affiliate: streaming service ─────────────────────────────────── */}
        {/* Replace url="#" with your affiliate link to activate */}
        <AffiliateBlock
          title="Stream Every World Cup 2026 Match"
          description="Don't miss a single kick-off. Set up your streaming service before the tournament starts on 11 June 2026."
          cta="Start Streaming"
          url="#"
          tag="watch-live-streaming-cta"
          className="my-8"
        />

        {/* ── Affiliate: VPN ────────────────────────────────────────────────── */}
        <AffiliateBlock
          title="Travelling During the World Cup?"
          description="Access your home broadcaster from anywhere with a fast VPN. Servers in 100+ countries, 30-day money-back guarantee."
          cta="Get a VPN"
          url="#"
          tag="watch-live-vpn-cta"
          variant="blue"
          className="mb-8"
        />

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <SectionTitle id="faq">Frequently Asked Questions</SectionTitle>
        <div className="space-y-3">
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
              { href: '/world-cup-2026',                 label: '🏆 Tournament Hub' },
              { href: '/world-cup-2026/tv-schedule',     label: '📺 TV Schedule' },
              { href: '/world-cup-2026/streaming-guide', label: '📡 Streaming Guide' },
              { href: '/schedule?competition=WC',         label: '📅 WC Fixtures' },
              { href: '/world-cup-2026/results',          label: '🏁 Results' },
              { href: '/world-cup-2026/bracket',          label: '🔗 Bracket' },
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
