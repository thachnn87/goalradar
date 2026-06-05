import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/tv-schedule`;
const TITLE    = 'FIFA World Cup 2026 TV Schedule – Match Times, Channels & Kick-offs';
const DESC     = 'Complete FIFA World Cup 2026 TV schedule. Find match kick-off times, TV channels by country, key dates, time zone conversions and how to never miss a World Cup match on TV.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: TITLE, description: DESC, type: 'article', url: PAGE_URL },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

const FAQ_ITEMS = [
  {
    q: 'What time do World Cup 2026 matches kick off?',
    a: 'Group stage matches are scheduled at 12:00 PM, 3:00 PM, 6:00 PM, and 9:00 PM Eastern Time (ET). Since the tournament spans three host countries, some matches in Mexico and Canada may have slightly different local kick-off times. Check the GoalRadar schedule page for exact times in your timezone.',
  },
  {
    q: 'When is the World Cup 2026 Final?',
    a: 'The FIFA World Cup 2026 Final is scheduled for Sunday 19 July 2026 at MetLife Stadium in East Rutherford, New Jersey, USA. Kick-off time is expected to be at approximately 7:00 PM Eastern Time (midnight BST in the UK). This is the showpiece event of the tournament, followed by a third-place play-off on 18 July.',
  },
  {
    q: 'What channel is the World Cup 2026 on in the USA?',
    a: 'In the United States, Fox holds the primary English-language broadcast rights. Matches will air across Fox, FS1, and FS2. Spanish-language coverage is on Telemundo and Universo. For streaming, the Fox Sports app, Peacock, and the Telemundo Deportes app will carry matches. YouTube TV, Hulu Live TV, and Fubo TV are also options for cord-cutters.',
  },
  {
    q: 'What channel is the World Cup 2026 on in the UK?',
    a: 'In the United Kingdom, ITV and BBC are expected to share broadcast rights for World Cup 2026, as they did in 2022. Both are free-to-air channels available on Freeview, Sky, and Virgin. Online streaming is available on ITVX (free) and BBC iPlayer (free with a TV licence).',
  },
  {
    q: 'How many World Cup 2026 matches are there in total?',
    a: 'FIFA World Cup 2026 features 104 matches in total — significantly more than the 64 matches at the 2022 tournament. The expanded format includes 48 teams, 12 groups of four, a Round of 32, Round of 16, Quarter-finals, Semi-finals, Third Place Play-off, and the Final.',
  },
  {
    q: 'When does the World Cup 2026 start?',
    a: 'The FIFA World Cup 2026 kicks off on Thursday 11 June 2026 with the opening match, Mexico vs South Africa, in Mexico City. The opening ceremony is expected to take place at the same venue before kick-off. The tournament runs through to the Final on 19 July 2026.',
  },
  {
    q: 'What are the key World Cup 2026 dates?',
    a: 'Key dates: Group Stage — 11 June to 27 June 2026. Round of 32 — 28 June to 4 July 2026. Round of 16 — 4 to 7 July 2026. Quarter-finals — 9 to 12 July 2026. Semi-finals — 14 to 15 July 2026. Third Place Play-off — 18 July 2026. Final — 19 July 2026.',
  },
];

const TIME_ZONES = [
  { zone: 'Eastern Time (ET)', utcOffset: 'UTC−5 / UTC−4 DST', note: 'New York, Miami, Atlanta' },
  { zone: 'Central Time (CT)', utcOffset: 'UTC−6 / UTC−5 DST', note: 'Dallas, Kansas City, Chicago' },
  { zone: 'Mountain Time (MT)', utcOffset: 'UTC−7 / UTC−6 DST', note: 'Denver, Phoenix' },
  { zone: 'Pacific Time (PT)', utcOffset: 'UTC−8 / UTC−7 DST', note: 'Los Angeles, Seattle' },
  { zone: 'BST (British Summer Time)', utcOffset: 'UTC+1', note: 'London, Edinburgh, Cardiff' },
  { zone: 'CEST (Central European Summer)', utcOffset: 'UTC+2', note: 'Berlin, Paris, Madrid, Rome' },
  { zone: 'AEST (Australian Eastern)', utcOffset: 'UTC+10', note: 'Sydney, Melbourne, Brisbane' },
  { zone: 'IST (India Standard Time)', utcOffset: 'UTC+5:30', note: 'Mumbai, Delhi, Bangalore' },
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

export default function TVSchedulePage() {
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
      { '@type': 'ListItem', position: 3, name: 'TV Schedule',     item: PAGE_URL },
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
          { label: 'TV Schedule' },
        ]} />

        {/* Hero */}
        <div className="mt-6 mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📺</span>
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">World Cup 2026 Guide</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
            FIFA World Cup 2026 TV Schedule
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            The FIFA World Cup 2026 features <strong className="text-white">104 matches across 39 days</strong>, from the Group Stage opening on 11 June to the Final on 19 July 2026. Here is the complete TV schedule by country, time zone conversion guide, and everything you need to plan your World Cup viewing.
          </p>
        </div>

        {/* Quick key dates */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {[
            { label: 'Tournament Start',  value: '11 Jun 2026', sub: 'Mexico vs South Africa' },
            { label: 'Round of 32',       value: '28 Jun',      sub: 'Knockout begins' },
            { label: 'Semi-finals',       value: '14–15 Jul',   sub: 'Final four' },
            { label: 'The Final',         value: '19 Jul 2026', sub: 'MetLife Stadium, NJ' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-gray-900 border border-yellow-800/30 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{label}</p>
              <p className="text-white font-black text-sm">{value}</p>
              <p className="text-gray-600 text-[10px] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <nav className="flex flex-wrap gap-2 mb-8 text-xs" aria-label="Page sections">
          {['Key Dates','Kick-off Times','TV by Country','Time Zones','Planning Your Viewing','FAQ'].map(s => (
            <a key={s} href={`#${s.toLowerCase().replace(/\s/g,'-')}`}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700 transition-colors">{s}</a>
          ))}
        </nav>

        {/* Key Dates */}
        <SectionTitle id="key-dates">World Cup 2026 Key Dates & Tournament Stages</SectionTitle>
        <Prose>
          <p>The FIFA World Cup 2026 is the largest men's football tournament in history, expanded to 48 teams for the first time. The expanded format creates a Round of 32 between the Group Stage and the traditional Round of 16, adding an extra knockout round compared to previous World Cups.</p>
        </Prose>

        <div className="overflow-x-auto my-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-semibold text-xs uppercase tracking-wider">Stage</th>
                <th className="text-left px-4 py-3 text-gray-400 font-semibold text-xs uppercase tracking-wider">Dates</th>
                <th className="text-left px-4 py-3 text-gray-400 font-semibold text-xs uppercase tracking-wider">Matches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[
                ['Group Stage', '11 – 27 June 2026', '72'],
                ['Round of 32', '28 June – 4 July', '16'],
                ['Round of 16', '4 – 7 July 2026', '8'],
                ['Quarter-finals', '9 – 12 July 2026', '4'],
                ['Semi-finals', '14 – 15 July 2026', '2'],
                ['Third Place Play-off', '18 July 2026', '1'],
                ['Final', '19 July 2026', '1'],
              ].map(([stage, dates, matches]) => (
                <tr key={stage} className="bg-gray-900 hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{stage}</td>
                  <td className="px-4 py-3 text-gray-400">{dates}</td>
                  <td className="px-4 py-3 text-gray-400">{matches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Kick-off Times */}
        <SectionTitle id="kick-off-times">Typical Kick-off Times by Time Zone</SectionTitle>
        <Prose>
          <p>The Group Stage typically features four matches per day. Host city time zones span Eastern Time (ET) in cities like Miami and Boston, Central Time in Dallas and Kansas City, and Mountain Time in cities like Guadalajara. Here are the standard daily kick-off slots converted across key international time zones.</p>
        </Prose>

        <div className="overflow-x-auto my-6">
          <table className="w-full text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-gray-800">
                {['Match Time (ET)', 'UK (BST)', 'Germany (CEST)', 'Australia (AEST)', 'India (IST)'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-gray-400 font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[
                ['12:00 PM',  '5:00 PM',   '6:00 PM',   '2:00 AM+1',  '10:30 PM'],
                ['3:00 PM',   '8:00 PM',   '9:00 PM',   '5:00 AM+1',  '1:30 AM+1'],
                ['6:00 PM',   '11:00 PM',  '12:00 AM+1','8:00 AM+1',  '4:30 AM+1'],
                ['9:00 PM',   '2:00 AM+1', '3:00 AM+1', '11:00 AM+1', '7:30 AM+1'],
              ].map(row => (
                <tr key={row[0]} className="bg-gray-900 hover:bg-gray-800/50 transition-colors">
                  {row.map((cell, i) => (
                    <td key={i} className={`px-3 py-2.5 ${i === 0 ? 'text-white font-semibold' : 'text-gray-400'}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-gray-600 text-xs">+1 = next calendar day. Times based on Eastern Daylight Time (EDT, UTC−4) active during the tournament.</p>

        {/* TV by Country */}
        <SectionTitle id="tv-by-country">World Cup 2026 TV Channels by Country</SectionTitle>
        <Prose>
          <p>Broadcast rights for World Cup 2026 have been sold to official media partners in every region. The following channels have confirmed or expected rights to broadcast matches. Always check your local TV guide for exact match schedules.</p>
        </Prose>

        <div className="space-y-3 my-6">
          {[
            {
              region: '🇺🇸 United States',
              channels: [
                { name: 'Fox / FS1 / FS2',     type: 'English, Cable/Satellite/OTA' },
                { name: 'Telemundo / Universo', type: 'Spanish, Cable/Satellite/OTA' },
                { name: 'Fubo TV',             type: 'English + Spanish, Streaming' },
                { name: 'Peacock',             type: 'Streaming, Subscription' },
              ],
            },
            {
              region: '🇬🇧 United Kingdom',
              channels: [
                { name: 'ITV / ITVX',     type: 'Free-to-air, Free Streaming' },
                { name: 'BBC / iPlayer',  type: 'Free-to-air, Free Streaming' },
              ],
            },
            {
              region: '🇨🇦 Canada',
              channels: [
                { name: 'TSN / TSN Direct', type: 'English, Subscription' },
                { name: 'CTV',              type: 'English, Free-to-air' },
                { name: 'RDS / TVA Sports', type: 'French, Subscription' },
              ],
            },
            {
              region: '🇦🇺 Australia',
              channels: [
                { name: 'SBS / SBS On Demand', type: 'Free-to-air, Free Streaming' },
                { name: 'Optus Sport',          type: 'Streaming, Subscription' },
              ],
            },
            {
              region: '🇩🇪 Germany',
              channels: [
                { name: 'ARD / Das Erste', type: 'Free-to-air' },
                { name: 'ZDF',             type: 'Free-to-air' },
              ],
            },
          ].map(({ region, channels }) => (
            <div key={region} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-white font-bold text-sm mb-3">{region}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {channels.map(({ name, type }) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                    <span className="text-gray-300 text-xs font-medium">{name}</span>
                    <span className="text-gray-600 text-xs">— {type}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Time Zones */}
        <SectionTitle id="time-zones">World Cup 2026 Time Zone Guide</SectionTitle>
        <Prose>
          <p>The FIFA World Cup 2026 hosts matches across multiple time zones in the USA, Canada and Mexico. All official times are typically given in Eastern Time (ET). Use the table below to convert to your local time zone.</p>
        </Prose>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
          {TIME_ZONES.map(({ zone, utcOffset, note }) => (
            <div key={zone} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <p className="text-white font-semibold text-sm">{zone}</p>
              <p className="text-yellow-500 text-xs font-mono">{utcOffset}</p>
              <p className="text-gray-600 text-xs mt-0.5">{note}</p>
            </div>
          ))}
        </div>

        {/* Planning */}
        <SectionTitle id="planning-your-viewing">Planning Your World Cup 2026 Viewing</SectionTitle>
        <Prose>
          <p>With 104 matches across 39 days, planning which games to watch is important. Here are some practical tips for making the most of the World Cup 2026 TV schedule:</p>
        </Prose>
        <ul className="list-disc list-inside text-gray-400 text-sm space-y-2 my-4 ml-2">
          <li><strong className="text-white">Set calendar reminders:</strong> Add key matches — especially your national team's games — to your calendar with the correct kick-off time for your time zone.</li>
          <li><strong className="text-white">Use GoalRadar's live schedule:</strong> Our <Link href="/schedule?competition=WC" className="text-yellow-400 hover:text-yellow-300 underline">World Cup fixtures page</Link> shows all match times in real time.</li>
          <li><strong className="text-white">Check for scheduling conflicts:</strong> The Group Stage often has two simultaneous matches. Plan ahead to decide which to watch live and which to record.</li>
          <li><strong className="text-white">Record for time zone clashes:</strong> If you're in Australia or Asia, many matches will air at inconvenient local times. Set recordings on your DVR or use catch-up services.</li>
          <li><strong className="text-white">Subscribe to streaming services early:</strong> Sign up for your preferred streaming service before the tournament starts to avoid missing opening matches.</li>
          <li><strong className="text-white">Download apps in advance:</strong> Install your broadcaster's streaming app — Fox Sports, BBC iPlayer, TSN, SBS On Demand — before the tournament.</li>
        </ul>

        {/* ── AFFILIATE: streaming CTA ── */}
        <div className="bg-gradient-to-br from-yellow-950/30 to-gray-900 border border-yellow-800/30 rounded-2xl p-5 my-8">
          <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">📺 Stream Every Match</p>
          <p className="text-white font-bold text-base mb-1">Don't miss a World Cup 2026 kick-off</p>
          <p className="text-gray-400 text-sm mb-4">Set up your streaming service before the tournament starts. Check availability in your region.</p>
          <div className="flex flex-wrap gap-3">
            <a href="#" target="_blank" rel="noopener noreferrer sponsored" data-affiliate-tag="fubo-tvschedule"
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">Fubo TV — Free Trial →</a>
            <Link href="/world-cup-2026/streaming-guide"
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors border border-gray-700">Streaming Guide →</Link>
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
              { href: '/world-cup-2026',                   label: '🏆 Tournament Hub' },
              { href: '/world-cup-2026/watch-live',        label: '📺 Watch Live' },
              { href: '/world-cup-2026/streaming-guide',   label: '📡 Streaming Guide' },
              { href: '/schedule?competition=WC',           label: '📅 WC Fixtures' },
              { href: '/world-cup-2026/results',            label: '🏁 Results' },
              { href: '/world-cup-2026/bracket',            label: '🔗 Bracket' },
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
