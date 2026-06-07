/**
 * /world-cup-2026/predictions
 *
 * Prediction Hub: aggregates winner, golden boot, group and dark-horse forecasts.
 * Targets: "world cup 2026 predictions", "wc 2026 odds", "who will win world cup 2026"
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { WINNER_PREDICTIONS, GOLDEN_BOOT_PREDICTIONS, GROUP_PREDICTIONS } from '@/lib/wc-predictions';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 86400;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/predictions`;

export const metadata: Metadata = {
  title: 'World Cup 2026 Predictions, Winner Odds & Tournament Forecasts | GoalRadar',
  description:
    'Expert FIFA World Cup 2026 predictions including winner forecasts, Golden Boot picks, group stage predictions and knockout bracket projections.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'World Cup 2026 Predictions, Winner Odds & Tournament Forecasts | GoalRadar',
    description:
      'Expert FIFA World Cup 2026 predictions including winner forecasts, Golden Boot picks, group stage predictions and knockout bracket projections.',
    type: 'article',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Predictions & Tournament Forecasts | GoalRadar',
    description:
      'Who will win the FIFA World Cup 2026? Expert winner odds, Golden Boot picks and all group predictions.',
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
      { '@type': 'ListItem', position: 1, name: 'Home',           item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Predictions',    item: PAGE_URL },
    ],
  };

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'FIFA World Cup 2026 Predictions – Complete Tournament Forecast',
    description:
      'Expert FIFA World Cup 2026 predictions: winner odds, Golden Boot picks, all group stage forecasts, dark horse teams and knockout bracket projections.',
    url: PAGE_URL,
    datePublished: '2026-01-01',
    dateModified: new Date().toISOString().split('T')[0],
    author: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    isPartOf: { '@type': 'WebSite', name: 'GoalRadar', url: BASE_URL },
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
          text: 'France are the most-backed favourite to win the FIFA World Cup 2026, given their 2018 triumph and back-to-back final appearances. Brazil, England and Argentina are the next tier of serious contenders.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who will win the Golden Boot at World Cup 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kylian Mbappé is the leading Golden Boot prediction at World Cup 2026, having already scored in two previous World Cups. Erling Haaland, Vinicius Jr and Harry Kane are also strong contenders.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which teams are dark horses at the 2026 World Cup?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Japan, Morocco, Colombia and the USA are widely considered dark horse contenders at the 2026 World Cup. Japan have already upset Germany and Spain; Morocco reached the semi-finals in 2022; Colombia boast a richly talented generation; and the USA play on home soil.',
        },
      },
      {
        '@type': 'Question',
        name: 'When does the FIFA World Cup 2026 start?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The FIFA World Cup 2026 starts on 11 June 2026. The Final will be played on 19 July 2026 at MetLife Stadium in New Jersey, USA.',
        },
      },
      {
        '@type': 'Question',
        name: 'How many teams are at the 2026 World Cup?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '48 teams compete at the 2026 FIFA World Cup — an expansion from the 32-team format used at all tournaments from 1998 to 2022. The expanded format adds a Round of 32 before the Round of 16.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where is the 2026 World Cup Final?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The 2026 World Cup Final is at MetLife Stadium in East Rutherford, New Jersey, USA — one of the largest stadiums in North America with a capacity of over 82,500.',
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const GROUPS = ['a','b','c','d','e','f','g','h'] as const;

const DARK_HORSES = [
  {
    flag: '🇯🇵', name: 'Japan', reason:
      'Topped a group containing Germany and Spain in 2022. Their high-press, counter-attack style will trouble any opponent.',
  },
  {
    flag: '🇲🇦', name: 'Morocco', reason:
      'The first African nation to reach a World Cup semi-final (Qatar 2022). Defensively outstanding with match-winners in attack.',
  },
  {
    flag: '🇨🇴', name: 'Colombia', reason:
      'A golden generation led by Luis Díaz and James Rodríguez. Clinical on the break and dangerous from set-pieces.',
  },
  {
    flag: '🇺🇸', name: 'United States', reason:
      'Hosting the tournament, with a young, athletic squad that improves every cycle. Home advantage could be decisive.',
  },
];

const KNOCKOUT_ROUNDS = [
  { round: 'Round of 32', matches: 16, note: 'New in 2026 — all 48 group qualifiers meet here' },
  { round: 'Round of 16', matches: 8,  note: 'Traditional last-16 bracket resumes' },
  { round: 'Quarter-finals', matches: 4, note: 'Four ties to determine the final four' },
  { round: 'Semi-finals', matches: 2, note: 'One step from glory' },
  { round: 'Final', matches: 1, note: 'MetLife Stadium, New Jersey · 19 July 2026' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WCPredictionsHubPage() {
  const topWinners = WINNER_PREDICTIONS.slice(0, 5);
  const topScorers = GOLDEN_BOOT_PREDICTIONS.slice(0, 4);

  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto space-y-10 pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Predictions' },
        ]} />

        {/* ── Header ── */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔮</span>
            <h1 className="text-3xl sm:text-4xl font-black text-white">
              World Cup 2026 Predictions
            </h1>
          </div>
          <p className="text-gray-400 text-base max-w-2xl">
            Expert forecasts for the FIFA World Cup 2026 — winner odds, Golden Boot picks, group stage
            predictions and knockout bracket projections for all 104 matches across USA, Canada and Mexico.
          </p>
        </div>

        <WCPageNav />

        {/* ── Section 1: Winner Predictions ── */}
        <section aria-labelledby="winner-heading">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h2 id="winner-heading" className="text-xl font-bold text-white">Winner Predictions</h2>
            </div>
            <Link
              href="/world-cup-2026/winner-predictions"
              className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
            >
              Full analysis →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {topWinners.map((team, i) => (
              <div
                key={team.name}
                className={`bg-gray-900 border rounded-xl p-4 flex items-start gap-3 ${
                  i === 0 ? 'border-yellow-500/40' : 'border-gray-800'
                }`}
              >
                <span className="text-2xl shrink-0">{team.flag}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-sm">{team.name}</span>
                    {i === 0 && (
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded font-semibold">
                        FAVOURITE
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-blue-400 font-bold font-mono text-sm">{team.probability}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(parseFloat(team.probability) * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-gray-500 text-[11px] mt-1.5 line-clamp-2 leading-snug">{team.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/world-cup-2026/winner-predictions"
            className="inline-flex items-center gap-2 text-sm text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
          >
            View all 8 contenders with full strength/weakness breakdown →
          </Link>
        </section>

        {/* ── Section 2: Golden Boot Predictions ── */}
        <section aria-labelledby="golden-boot-heading">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">👟</span>
              <h2 id="golden-boot-heading" className="text-xl font-bold text-white">Golden Boot Predictions</h2>
            </div>
            <Link
              href="/world-cup-2026/golden-boot-predictions"
              className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
            >
              Full rankings →
            </Link>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50 mb-4">
            {topScorers.map((player, i) => (
              <div key={player.name} className="flex items-center gap-3 px-4 py-3">
                <span className="text-gray-600 font-mono text-xs w-4 shrink-0">{i + 1}</span>
                <span className="text-lg shrink-0">{player.countryFlag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{player.name}</p>
                  <p className="text-gray-500 text-[11px]">{player.club} · {player.age} yrs</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-blue-400 font-bold font-mono text-sm">{player.probability}%</span>
                  <div className="w-16 bg-gray-800 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(parseFloat(player.probability) * 3, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/world-cup-2026/golden-boot-predictions"
            className="inline-flex items-center gap-2 text-sm text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
          >
            Full Golden Boot rankings with detailed player analysis →
          </Link>
        </section>

        {/* ── Section 3: Group Predictions ── */}
        <section aria-labelledby="groups-heading">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🗂️</span>
            <h2 id="groups-heading" className="text-xl font-bold text-white">Group Stage Predictions</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {GROUPS.map((g) => {
              const data = GROUP_PREDICTIONS[g.toUpperCase()];
              return (
                <Link
                  key={g}
                  href={`/world-cup-2026/group-${g}-predictions`}
                  className="bg-gray-900 border border-gray-800 hover:border-yellow-500/40 rounded-xl p-4 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">Group {g.toUpperCase()}</span>
                    <span className="text-yellow-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </div>
                  {data && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{data.predicted1st.flag}</span>
                        <span className="text-gray-300 text-xs font-medium truncate">{data.predicted1st.name}</span>
                        <span className="text-[10px] text-yellow-500 ml-auto shrink-0">1st</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{data.predicted2nd.flag}</span>
                        <span className="text-gray-500 text-xs truncate">{data.predicted2nd.name}</span>
                        <span className="text-[10px] text-gray-600 ml-auto shrink-0">2nd</span>
                      </div>
                    </div>
                  )}
                  <p className="text-gray-600 text-[10px] mt-2 group-hover:text-gray-500 transition-colors">
                    Full prediction →
                  </p>
                </Link>
              );
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GROUPS.map((g) => (
              <Link
                key={g}
                href={`/world-cup-2026/group-${g}-predictions`}
                className="text-center text-xs text-blue-400 hover:text-blue-300 transition-colors py-1 font-medium"
              >
                Group {g.toUpperCase()} →
              </Link>
            ))}
          </div>
        </section>

        {/* ── Section 4: Dark Horse Teams ── */}
        <section aria-labelledby="dark-horse-heading">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🐴</span>
            <h2 id="dark-horse-heading" className="text-xl font-bold text-white">Dark Horse Teams</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Four nations with a genuine chance to outperform their pre-tournament billing and reach the latter stages.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DARK_HORSES.map((team) => (
              <div key={team.name} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
                <span className="text-3xl shrink-0">{team.flag}</span>
                <div>
                  <p className="text-white font-bold text-sm mb-1">{team.name}</p>
                  <p className="text-gray-400 text-xs leading-relaxed">{team.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 5: Knockout Forecast ── */}
        <section aria-labelledby="knockout-heading">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🔗</span>
            <h2 id="knockout-heading" className="text-xl font-bold text-white">Knockout Forecast</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            The 2026 World Cup introduces a new Round of 32 with 48 teams — the biggest format change since 1998.
            Here is our forecast for each knockout phase.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50 mb-4">
            {KNOCKOUT_ROUNDS.map(({ round, matches, note }) => (
              <div key={round} className="flex items-start gap-4 px-4 py-3">
                <div className="w-32 shrink-0">
                  <p className="text-white font-semibold text-sm">{round}</p>
                  <p className="text-gray-600 text-[11px]">{matches} match{matches !== 1 ? 'es' : ''}</p>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">{note}</p>
              </div>
            ))}
          </div>

          {/* Predicted Final */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30 rounded-2xl p-5">
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-3">🏆 Predicted Final</p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-4xl mb-1">🇫🇷</div>
                <p className="text-white font-bold text-sm">France</p>
                <p className="text-gray-500 text-[11px]">2018 Champions</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-xl font-black">vs</p>
                <p className="text-gray-600 text-[10px] mt-1">MetLife Stadium</p>
                <p className="text-gray-600 text-[10px]">19 July 2026</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-1">🇧🇷</div>
                <p className="text-white font-bold text-sm">Brazil</p>
                <p className="text-gray-500 text-[11px]">5× World Champions</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="faq-heading">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">❓</span>
            <h2 id="faq-heading" className="text-xl font-bold text-white">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                q: 'Who is predicted to win the FIFA World Cup 2026?',
                a: 'France are the most-backed favourite, given their 2018 triumph and 2022 runner-up finish. Brazil, England and Argentina are the next tier of serious contenders at the 2026 World Cup.',
              },
              {
                q: 'Who will win the Golden Boot at World Cup 2026?',
                a: 'Kylian Mbappé is the leading Golden Boot prediction, having scored in two previous World Cups. Erling Haaland, Vinicius Jr and Harry Kane are strong challengers.',
              },
              {
                q: 'Which teams are dark horses at the 2026 World Cup?',
                a: 'Japan, Morocco, Colombia and the USA are the standout dark horses. Japan beat Germany and Spain in 2022; Morocco reached the semi-finals; Colombia have a golden generation; and the USA play at home.',
              },
              {
                q: 'When does the FIFA World Cup 2026 start?',
                a: 'The FIFA World Cup 2026 starts on 11 June 2026. The Final is on 19 July 2026 at MetLife Stadium, New Jersey.',
              },
              {
                q: 'How many teams are at the 2026 World Cup?',
                a: '48 teams compete — up from 32 in previous tournaments. The expanded format introduces a new Round of 32 before the traditional Round of 16.',
              },
              {
                q: 'Where is the 2026 World Cup Final?',
                a: 'MetLife Stadium in East Rutherford, New Jersey, USA — one of the largest stadiums in North America with a capacity of over 82,500.',
              },
            ].map(({ q, a }) => (
              <details
                key={q}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group"
              >
                <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-gray-800/50 transition-colors">
                  <span className="text-white font-semibold text-sm">{q}</span>
                  <span className="text-gray-600 text-lg shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-4 pb-4 pt-1">
                  <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        <WCRelatedLinks links={[
          { href: '/world-cup-2026/winner-predictions',      icon: '🏆', label: 'Winner Predictions',      desc: 'Full contender analysis — who lifts the trophy in July 2026?' },
          { href: '/world-cup-2026/golden-boot-predictions', icon: '👟', label: 'Golden Boot Predictions',  desc: 'Top scorers forecast — Mbappé, Haaland, Vinicius Jr and more' },
          { href: '/world-cup-2026/group-a-predictions',     icon: '🗂️', label: 'Group A Predictions',      desc: 'France, USA, Japan, Switzerland — who advances?' },
          { href: '/world-cup-2026/fixtures',                icon: '📅', label: 'WC 2026 Fixtures',         desc: 'Full schedule with kick-off times for all 104 matches' },
          { href: '/world-cup-2026-standings',               icon: '📊', label: 'Group Standings',          desc: 'Live points tables for all 12 groups' },
          { href: '/world-cup-2026-bracket',                 icon: '🔗', label: 'Knockout Bracket',         desc: 'Round of 32 through to the Final at MetLife' },
        ]} />
      </div>
    </>
  );
}
