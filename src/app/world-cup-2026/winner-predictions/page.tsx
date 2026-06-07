/**
 * /world-cup-2026/winner-predictions
 *
 * SEO money page: Who will win the FIFA World Cup 2026?
 * Targets: "world cup 2026 winner prediction", "wc 2026 winner odds", "who will win world cup 2026"
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { WINNER_PREDICTIONS } from '@/lib/wc-predictions';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/winner-predictions`;

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Winner Predictions – Who Will Win? | GoalRadar',
  description:
    'Expert predictions for the FIFA World Cup 2026 winner. Who will lift the trophy in July 2026? Comprehensive analysis of every top contender — France, Brazil, England, Argentina and more.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Winner Predictions | GoalRadar',
    description:
      'Who will win the FIFA World Cup 2026? Expert analysis of every top contender from France and Brazil to England and Argentina.',
    type: 'article',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Winner Predictions | GoalRadar',
    description: 'Who will win the FIFA World Cup 2026? Full contender analysis and predictions.',
  },
};

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',              item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',    item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Winner Predictions', item: PAGE_URL },
    ],
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Who is predicted to win the FIFA World Cup 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'France are the consensus favourites to win the FIFA World Cup 2026, backed by the deepest squad in the tournament and a track record of recent success. Brazil and England are considered the closest challengers, with Argentina (the defending champions), Germany, Spain, and Portugal also in contention.',
        },
      },
      {
        '@type': 'Question',
        name: 'Will Brazil win the World Cup 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Brazil are among the top favourites for the 2026 World Cup. The Seleção have not won since 2002 and are desperate for the Hexacampeonato. With world-class attacking talent including Vinicius Jr and Raphinha, they are a genuine title contender.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can England win the World Cup 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'England are among the serious favourites for the 2026 World Cup after reaching consecutive major tournament finals. With Bellingham, Saka, Kane and Foden in their prime, the Three Lions have the squad to go all the way.',
        },
      },
      {
        '@type': 'Question',
        name: 'Will Argentina defend their World Cup title in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Argentina defending champions with Messi expected to play his final World Cup. Back-to-back World Cup wins are rare in history, but Argentina have the team cohesion and mental strength that could make them serious contenders despite an ageing squad.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which team is the biggest dark horse for the World Cup 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Morocco are widely considered the biggest dark horses for the 2026 World Cup after their stunning semi-final run in 2022. The Atlas Lions are the first African side to reach that stage and have the defensive organisation and team spirit to go further still.',
        },
      },
      {
        '@type': 'Question',
        name: 'When is the FIFA World Cup 2026 Final?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The FIFA World Cup 2026 Final takes place on 19 July 2026 at MetLife Stadium in East Rutherford, New Jersey, USA.',
        },
      },
    ],
  };

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'FIFA World Cup 2026 Winner Predictions',
    description: 'Expert analysis of every top contender for the 2026 World Cup title.',
    url: PAGE_URL,
    author: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    about: { '@type': 'SportsEvent', name: 'FIFA World Cup 2026', startDate: '2026-06-11', endDate: '2026-07-19' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const MEDAL_EMOJI = ['🥇', '🥈', '🥉'];

export default function WinnerPredictionsPage() {
  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Winner Predictions' },
        ]} />

        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-4 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">🏆 World Cup 2026 Predictions</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Who Will Win the World Cup 2026?
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
            The FIFA World Cup 2026 will be played from <strong className="text-white">11 June to 19 July 2026</strong> across
            16 stadiums in the USA, Canada and Mexico. Here is our full analysis of every major title contender — from the
            tournament favourites to the biggest dark horses — with probability estimates and detailed reasoning.
          </p>
        </div>

        {/* Top 3 highlight */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">Top 3 Favourites</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {WINNER_PREDICTIONS.slice(0, 3).map((pick, i) => (
              <Link
                key={pick.slug}
                href={`/world-cup-2026/teams/${pick.slug}`}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-2xl p-5 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{MEDAL_EMOJI[i]}</span>
                  <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-sm font-black px-3 py-1 rounded-full">
                    {pick.probability}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">{pick.flag}</span>
                  <span className="text-white font-black text-xl group-hover:text-yellow-400 transition-colors">
                    {pick.name}
                  </span>
                </div>
                <p className="text-gray-500 text-xs">Group {pick.group}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Full predictions list */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">Full Contender Analysis</h2>
          <div className="space-y-4">
            {WINNER_PREDICTIONS.map((pick) => (
              <div key={pick.slug} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-8 text-center">
                    <span className="text-gray-600 font-black text-lg">#{pick.rank}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                      <Link
                        href={`/world-cup-2026/teams/${pick.slug}`}
                        className="flex items-center gap-2 group"
                      >
                        <span className="text-2xl">{pick.flag}</span>
                        <span className="text-white font-black text-lg group-hover:text-yellow-400 transition-colors">
                          {pick.name}
                        </span>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-500 text-xs">Group {pick.group}</span>
                        <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-2 py-0.5 rounded-full">
                          {pick.probability} chance
                        </span>
                      </div>
                    </div>

                    <p className="text-gray-300 text-sm leading-relaxed mb-3">{pick.reasoning}</p>

                    <div className="flex flex-wrap gap-4 text-xs">
                      <div>
                        <span className="text-green-400 font-semibold">✓ Strengths: </span>
                        <span className="text-gray-400">{pick.strength}</span>
                      </div>
                      <div>
                        <span className="text-red-400 font-semibold">✗ Risk: </span>
                        <span className="text-gray-400">{pick.weakness}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Historical context */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">World Cup Winner History</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2 border-b border-gray-800">
              <span>Year</span>
              <span>Host</span>
              <span>Winner</span>
            </div>
            {[
              { year: '2022', host: 'Qatar', winner: '🇦🇷 Argentina' },
              { year: '2018', host: 'Russia', winner: '🇫🇷 France' },
              { year: '2014', host: 'Brazil', winner: '🇩🇪 Germany' },
              { year: '2010', host: 'South Africa', winner: '🇪🇸 Spain' },
              { year: '2006', host: 'Germany', winner: '🇮🇹 Italy' },
              { year: '2002', host: 'Japan/South Korea', winner: '🇧🇷 Brazil' },
            ].map(({ year, host, winner }) => (
              <div key={year} className="grid grid-cols-3 px-4 py-3 border-b border-gray-800/50 last:border-0 text-sm">
                <span className="text-white font-bold">{year}</span>
                <span className="text-gray-400">{host}</span>
                <span className="text-white">{winner}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-2 px-1">
            Note: No team has won back-to-back World Cups since Brazil in 1958 and 1962.
            The defending champions face enormous pressure — and history is against them.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">World Cup 2026 Winner Predictions FAQ</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
            {[
              {
                q: 'Who is predicted to win the FIFA World Cup 2026?',
                a: 'France are the consensus favourites, backed by the deepest squad in the tournament. Brazil and England are the closest challengers, with Argentina (defending champions), Germany, Spain and Portugal also in contention.',
              },
              {
                q: 'Will Brazil win the World Cup 2026?',
                a: 'Brazil are among the top three favourites. The Seleção have not won since 2002 and are desperate for the Hexacampeonato. With Vinicius Jr, Raphinha and Rodrygo, they have the firepower to win the tournament.',
              },
              {
                q: 'Can England win the World Cup 2026?',
                a: 'England are serious contenders after reaching consecutive major tournament finals. With Bellingham, Saka, Kane and Foden at peak age, the Three Lions have the squad to finally end 60 years of hurt.',
              },
              {
                q: 'Will Argentina defend their title in 2026?',
                a: 'Argentina defending their title would be extraordinarily rare — no team has achieved back-to-back wins since Brazil in 1962. However, with Messi\'s farewell tournament and strong squad cohesion, they remain credible contenders.',
              },
              {
                q: 'Which team is the biggest dark horse for World Cup 2026?',
                a: 'Morocco are the standout dark horses — Africa\'s first semi-finalists in 2022 — but Germany\'s revenge mission after consecutive group-stage exits also makes them an intriguing dark horse pick to win the title.',
              },
              {
                q: 'When is the FIFA World Cup 2026 Final?',
                a: 'The FIFA World Cup 2026 Final takes place on 19 July 2026 at MetLife Stadium in East Rutherford, New Jersey, USA. The stadium has a capacity of 82,500.',
              },
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

        <WCRelatedLinks links={[
          { href: '/world-cup-2026/golden-boot-predictions',   icon: '⚽', label: 'Golden Boot Predictions', desc: 'Top scorer predictions for WC 2026' },
          { href: '/world-cup-2026/group-a-predictions',       icon: '🔮', label: 'Group A Predictions',     desc: 'France, USA, Japan, Switzerland' },
          { href: '/world-cup-2026/group-g-predictions',       icon: '🔮', label: 'Group G Predictions',     desc: 'Argentina, Italy, Egypt, Iraq' },
          { href: '/world-cup-2026/group-h-predictions',       icon: '🔮', label: 'Group H Predictions',     desc: 'Brazil, Belgium, Cameroon, Jordan' },
          { href: '/world-cup-2026/teams',                     icon: '👥', label: 'All 48 Teams',            desc: 'Squads and fixtures for every nation' },
          { href: '/world-cup-2026/bracket',                   icon: '🔗', label: 'Knockout Bracket',        desc: 'Round of 32 path to the Final' },
          { href: '/world-cup-2026/venues/metlife-stadium',    icon: '🏟️', label: 'MetLife Stadium',         desc: 'World Cup 2026 Final venue' },
          { href: '/world-cup-2026',                           icon: '🏆', label: 'WC 2026 Hub',             desc: 'Full tournament overview' },
        ]} heading="More World Cup 2026 Predictions" />
      </div>
    </>
  );
}
