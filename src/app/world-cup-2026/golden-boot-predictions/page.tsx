/**
 * /world-cup-2026/golden-boot-predictions
 *
 * SEO money page: Who will win the Golden Boot at the FIFA World Cup 2026?
 * Targets: "world cup 2026 golden boot prediction", "wc 2026 top scorer", "world cup 2026 golden boot odds"
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { GOLDEN_BOOT_PREDICTIONS } from '@/lib/wc-predictions';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/golden-boot-predictions`;

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Golden Boot Predictions – Top Scorer | GoalRadar',
  description:
    'Expert predictions for the FIFA World Cup 2026 Golden Boot. Who will be the top scorer? Full analysis of Mbappé, Kane, Vinicius Jr, Yamal and every major contender.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Golden Boot Predictions | GoalRadar',
    description:
      'Who will win the World Cup 2026 Golden Boot? Expert analysis of Mbappé, Kane, Vinicius Jr and every top scorer contender.',
    type: 'article',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Golden Boot Predictions | GoalRadar',
    description: 'Who will be the top scorer at the 2026 World Cup? Full Golden Boot contender analysis.',
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
      { '@type': 'ListItem', position: 1, name: 'Home',               item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',     item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Golden Boot Predictions', item: PAGE_URL },
    ],
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Who will win the Golden Boot at the 2026 World Cup?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kylian Mbappé is the overwhelming favourite to win the World Cup 2026 Golden Boot. He top-scored at the 2022 World Cup with 8 goals and arrives in 2026 aged 27, in his absolute prime at Real Madrid. Harry Kane and Vinicius Jr are the next most likely candidates.',
        },
      },
      {
        '@type': 'Question',
        name: 'How many goals has Kylian Mbappé scored at World Cups?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kylian Mbappé has scored 12 World Cup goals across the 2018 and 2022 tournaments. He finished as the top scorer at the 2022 World Cup in Qatar with 8 goals, including a hat-trick in the final against Argentina.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the World Cup Golden Boot award?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The FIFA World Cup Golden Boot (officially the Adidas Golden Boot) is awarded to the top scorer of the tournament. If two players are level on goals, the Golden Boot goes to the player with more assists. If still level, the player with fewer minutes played wins.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who won the Golden Boot at the 2022 World Cup?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kylian Mbappé won the Golden Boot at the 2022 FIFA World Cup with 8 goals, including a hat-trick in the final. He also scored in the semi-finals, making him one of the most prolific World Cup performers in history.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can a defender or goalkeeper win the World Cup Golden Boot?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The Golden Boot is exclusively for outfield players who score goals. In practice, it is almost always won by a striker or attacking midfielder. The all-time record belongs to Ronaldo (Brazil) with 15 World Cup goals across four tournaments.',
        },
      },
    ],
  };

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'FIFA World Cup 2026 Golden Boot Predictions',
    description: 'Expert analysis of every top scorer contender for the 2026 World Cup Golden Boot.',
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

export default function GoldenBootPredictionsPage() {
  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Golden Boot Predictions' },
        ]} />

        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-4 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">⚽ World Cup 2026 Predictions</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Golden Boot Predictions
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
            The FIFA World Cup 2026 Golden Boot goes to the tournament&apos;s top scorer across{' '}
            <strong className="text-white">104 matches</strong>. With the expanded 48-team format, stars can
            score in up to <strong className="text-white">7 matches</strong> if their team wins the trophy.
            Here is our comprehensive analysis of every major Golden Boot contender.
          </p>

          {/* Golden Boot format note */}
          <div className="mt-5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-yellow-400 text-xs font-semibold mb-1">ℹ️ How the Golden Boot is decided</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              Goals scored → most assists → fewest minutes played. With 7 possible matches in 2026 (up from 7 in a standard 32-team tournament),
              the winner could exceed the 8 goals Mbappé scored in 2022.
            </p>
          </div>
        </div>

        {/* Top 3 highlight */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">Top 3 Golden Boot Favourites</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {GOLDEN_BOOT_PREDICTIONS.slice(0, 3).map((pick, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={pick.name} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{medals[i]}</span>
                    <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-sm font-black px-3 py-1 rounded-full">
                      {pick.probability}
                    </span>
                  </div>
                  <p className="text-white font-black text-lg mb-0.5">{pick.name}</p>
                  <Link
                    href={`/world-cup-2026/teams/${pick.countrySlug}`}
                    className="flex items-center gap-1.5 text-gray-400 hover:text-yellow-400 transition-colors text-sm mb-2"
                  >
                    <span>{pick.countryFlag}</span>
                    <span>{pick.country}</span>
                  </Link>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="bg-white/5 text-gray-400 text-[10px] px-2 py-0.5 rounded-full border border-white/10">
                      Age {pick.age}
                    </span>
                    <span className="bg-white/5 text-gray-400 text-[10px] px-2 py-0.5 rounded-full border border-white/10">
                      {pick.club}
                    </span>
                    {pick.worldCupGoals > 0 && (
                      <span className="bg-green-500/10 text-green-400 text-[10px] px-2 py-0.5 rounded-full border border-green-500/20">
                        {pick.worldCupGoals} WC goals
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{pick.reasoning}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Full list */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">All Golden Boot Contenders</h2>
          <div className="space-y-3">
            {GOLDEN_BOOT_PREDICTIONS.map((pick) => (
              <div key={pick.name} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-8 text-center mt-0.5">
                    <span className="text-gray-600 font-black text-lg">#{pick.rank}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div>
                        <p className="text-white font-black text-base leading-tight">{pick.name}</p>
                        <Link
                          href={`/world-cup-2026/teams/${pick.countrySlug}`}
                          className="flex items-center gap-1.5 text-gray-400 hover:text-yellow-400 transition-colors text-xs mt-0.5"
                        >
                          <span>{pick.countryFlag}</span>
                          <span>{pick.country}</span>
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="bg-white/5 text-gray-400 text-[10px] px-2 py-0.5 rounded-full border border-white/10">
                          Age {pick.age}
                        </span>
                        <span className="bg-white/5 text-gray-400 text-[10px] px-2 py-0.5 rounded-full border border-white/10">
                          {pick.club}
                        </span>
                        {pick.worldCupGoals > 0 && (
                          <span className="bg-green-500/10 text-green-400 text-[10px] px-2 py-0.5 rounded-full border border-green-500/20">
                            {pick.worldCupGoals} WC goals
                          </span>
                        )}
                        <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-2 py-0.5 rounded-full">
                          {pick.probability}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">{pick.reasoning}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Historical Golden Boot winners */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4">Past Golden Boot Winners</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2 border-b border-gray-800">
              <span>Year</span>
              <span>Player</span>
              <span>Goals</span>
            </div>
            {[
              { year: '2022', player: 'Kylian Mbappé (🇫🇷)', goals: 8 },
              { year: '2018', player: 'Harry Kane (🏴󠁧󠁢󠁥󠁮󠁧󠁿)', goals: 6 },
              { year: '2014', player: 'James Rodríguez (🇨🇴)', goals: 6 },
              { year: '2010', player: 'Thomas Müller (🇩🇪)', goals: 5 },
              { year: '2006', player: 'Miroslav Klose (🇩🇪)', goals: 5 },
              { year: '2002', player: 'Ronaldo (🇧🇷)', goals: 8 },
            ].map(({ year, player, goals }) => (
              <div key={year} className="grid grid-cols-3 px-4 py-3 border-b border-gray-800/50 last:border-0 text-sm">
                <span className="text-white font-bold">{year}</span>
                <span className="text-gray-300">{player}</span>
                <span className="text-yellow-400 font-bold">{goals}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-4">Golden Boot Predictions FAQ</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
            {[
              {
                q: 'Who will win the Golden Boot at the 2026 World Cup?',
                a: 'Kylian Mbappé is the overwhelming favourite. He top-scored at the 2022 World Cup with 8 goals and arrives in 2026 aged 27 in his absolute prime at Real Madrid. Harry Kane and Vinicius Jr are the next most likely.',
              },
              {
                q: 'How many goals has Kylian Mbappé scored at World Cups?',
                a: 'Kylian Mbappé has scored 12 World Cup goals across 2018 and 2022. He finished as the top scorer in Qatar with 8 goals, including a hat-trick in the final against Argentina.',
              },
              {
                q: 'What is the World Cup Golden Boot award?',
                a: 'The FIFA World Cup Golden Boot is awarded to the top scorer of the tournament. If level on goals, it goes to the player with more assists. If still level, the player with fewer minutes played wins.',
              },
              {
                q: 'Can Harry Kane win the World Cup Golden Boot again?',
                a: 'Kane won the Golden Boot in 2018 with 6 goals and has the finishing quality to win it again. At 32 he remains one of the most prolific strikers in the world, scoring 30+ goals per season at Bayern Munich.',
              },
              {
                q: 'How many matches can a player score in at World Cup 2026?',
                a: 'In the expanded 48-team format, a player on the winning team could play in up to 7 matches: 3 group stage, Round of 32, Round of 16, Quarter-final, Semi-final, and the Final. This gives top scorers more opportunities than ever before.',
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
          { href: '/world-cup-2026/winner-predictions',        icon: '🏆', label: 'Winner Predictions',     desc: 'Who will lift the trophy in July 2026?' },
          { href: '/world-cup-2026/teams/france',              icon: '🇫🇷', label: 'France',                desc: 'Mbappé and Les Bleus — fixtures and squad' },
          { href: '/world-cup-2026/teams/england',             icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', label: 'England',              desc: 'Kane, Saka, Bellingham — WC 2026 fixtures' },
          { href: '/world-cup-2026/teams/brazil',              icon: '🇧🇷', label: 'Brazil',                desc: 'Vinicius Jr and the Seleção — WC 2026' },
          { href: '/world-cup-2026/group-a-predictions',       icon: '🔮', label: 'Group A Predictions',    desc: 'France, USA, Japan, Switzerland' },
          { href: '/world-cup-2026/group-b-predictions',       icon: '🔮', label: 'Group B Predictions',    desc: 'England, Denmark, South Korea, Canada' },
          { href: '/world-cup-2026/teams',                     icon: '👥', label: 'All 48 Teams',           desc: 'Full team list for every WC nation' },
          { href: '/world-cup-2026',                           icon: '🏆', label: 'WC 2026 Hub',            desc: 'Full tournament overview' },
        ]} heading="More World Cup 2026 Predictions" />
      </div>
    </>
  );
}
