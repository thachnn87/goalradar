/**
 * /world-cup-2026/winner-predictions
 *
 * Sprint G6 – high-SEO winner predictions page.
 * Targets: "world cup 2026 winner predictions", "wc 2026 favourites",
 *          "who will win world cup 2026", "world cup 2026 odds"
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

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'World Cup 2026 Winner Predictions: Favorites, Odds & Expert Picks | GoalRadar',
  description:
    'Expert FIFA World Cup 2026 winner predictions with odds, power rankings and tournament simulation. Who will win — France, Brazil, England or Argentina? Full contender analysis.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'World Cup 2026 Winner Predictions: Favorites, Odds & Expert Picks | GoalRadar',
    description:
      'Who will win the FIFA World Cup 2026? Expert odds, power rankings and tournament simulation for every major contender.',
    type: 'article',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Winner Predictions & Expert Picks | GoalRadar',
    description:
      'Full odds, power rankings and tournament path simulation for World Cup 2026 — France, Brazil, England, Argentina and more.',
  },
};

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

// The 7 primary contender slugs in display order
const PRIMARY_SLUGS = ['brazil', 'argentina', 'france', 'england', 'spain', 'germany', 'portugal'];

// Dark-horse teams (beyond the main 7)
const DARK_HORSES = [
  {
    flag: '🇲🇦', name: 'Morocco', slug: 'morocco',
    probability: '5%',
    reason: 'Africa\'s first-ever semi-finalists (Qatar 2022). Defensively elite with a team spirit that toppled Belgium, Spain and Portugal. Could go further on home continent.',
    tag: 'Semi-finalist 2022',
  },
  {
    flag: '🇯🇵', name: 'Japan', slug: 'japan',
    probability: '3%',
    reason: 'Beat Germany and Spain in 2022. Play high-press football with lightning-quick transitions. Capable of topping any group and causing upsets into the quarters.',
    tag: 'Giant-killers',
  },
  {
    flag: '🇨🇴', name: 'Colombia', slug: 'colombia',
    probability: '3%',
    reason: 'A golden generation led by Luis Díaz (Liverpool) and James Rodríguez. Clinical on the counter and dangerous from set-pieces. Could upset anyone in the knockout rounds.',
    tag: 'Golden generation',
  },
  {
    flag: '🇺🇸', name: 'United States', slug: 'united-states',
    probability: '3%',
    reason: 'Playing on home soil with massive crowd support. Athletic, well-organised and improving rapidly. The hosts could exceed all expectations at their own tournament.',
    tag: 'Host nation',
  },
];

// Simulated tournament paths for top 5 favourites
const SIMULATION = [
  {
    flag: '🇫🇷', name: 'France',
    path: ['Group A Winners', 'Round of 16', 'Quarter-finals', 'Semi-finals', '🏆 Champions'],
    outcome: 'Champions',
    colour: 'yellow',
  },
  {
    flag: '🇧🇷', name: 'Brazil',
    path: ['Group H Winners', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Runners-up'],
    outcome: 'Runners-up',
    colour: 'blue',
  },
  {
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'England',
    path: ['Group B Winners', 'Round of 16', 'Quarter-finals', 'Semi-finals exit'],
    outcome: 'Semi-final',
    colour: 'gray',
  },
  {
    flag: '🇦🇷', name: 'Argentina',
    path: ['Group G Winners', 'Round of 16', 'Quarter-final exit'],
    outcome: 'Quarter-final',
    colour: 'gray',
  },
  {
    flag: '🇩🇪', name: 'Germany',
    path: ['Group D 2nd', 'Round of 16', 'Quarter-finals', 'Semi-final exit'],
    outcome: 'Semi-final',
    colour: 'gray',
  },
];

// Historical winners table
const HISTORY = [
  { year: '2022', host: 'Qatar',             winner: '🇦🇷 Argentina', final: 'vs France (pens)' },
  { year: '2018', host: 'Russia',            winner: '🇫🇷 France',    final: 'vs Croatia 4–2' },
  { year: '2014', host: 'Brazil',            winner: '🇩🇪 Germany',   final: 'vs Argentina 1–0 (aet)' },
  { year: '2010', host: 'South Africa',      winner: '🇪🇸 Spain',     final: 'vs Netherlands 1–0 (aet)' },
  { year: '2006', host: 'Germany',           winner: '🇮🇹 Italy',     final: 'vs France (pens)' },
  { year: '2002', host: 'Japan/South Korea', winner: '🇧🇷 Brazil',    final: 'vs Germany 2–0' },
  { year: '1998', host: 'France',            winner: '🇫🇷 France',    final: 'vs Brazil 3–0' },
  { year: '1994', host: 'USA',               winner: '🇧🇷 Brazil',    final: 'vs Italy (pens)' },
];

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

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GoalRadar',
    url: BASE_URL,
    description: 'Expert football predictions, live scores and World Cup 2026 coverage.',
    sameAs: ['https://goalradar.org'],
  };

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'World Cup 2026 Winner Predictions: Favorites, Odds & Expert Picks',
    description:
      'Expert FIFA World Cup 2026 winner predictions with power rankings, tournament simulation and historical context.',
    url: PAGE_URL,
    datePublished: '2026-01-01',
    dateModified: new Date().toISOString().split('T')[0],
    author:    { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'GoalRadar', url: BASE_URL },
    about: {
      '@type': 'SportsEvent',
      name: 'FIFA World Cup 2026',
      startDate: '2026-06-11',
      endDate: '2026-07-19',
      location: { '@type': 'Place', name: 'USA, Canada, Mexico' },
    },
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Who will win World Cup 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'France are the consensus expert pick to win the FIFA World Cup 2026, supported by an 18% implied probability. They have the deepest squad of any team, with Mbappé at the peak of his powers. Brazil (15%) and England (12%) are the closest challengers.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which team is the favourite for the 2026 World Cup?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'France are the clear favourite for the 2026 World Cup. The 2018 champions and 2022 runners-up have the most complete squad in the tournament — world-class in every position and led by Kylian Mbappé, arguably the best player on the planet.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can a dark horse win the World Cup 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes — dark horses have won the World Cup before (Croatia reached the final in 2018; Morocco reached the semi-finals in 2022). With 48 teams and a new Round of 32, upsets are more likely than ever. Morocco, Japan, Colombia and the USA (at home) are the most credible dark-horse picks for a deep run.',
        },
      },
      {
        '@type': 'Question',
        name: 'How accurate are World Cup predictions?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'World Cup predictions are educated estimates, not certainties. Tournament football is notoriously unpredictable — the pre-tournament favourites have won only 3 of the last 8 World Cups. Our probability figures are expert assessments based on squad strength, form, fixture difficulty and historical data. Use them as a guide, not a guarantee.',
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ProbabilityBar({ value, colour = 'blue' }: { value: string; colour?: string }) {
  const pct = parseFloat(value);
  const barColour = colour === 'yellow' ? 'bg-yellow-500' : colour === 'green' ? 'bg-green-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-2">
        <div className={`${barColour} h-2 rounded-full`} style={{ width: `${Math.min(pct * 4, 100)}%` }} />
      </div>
      <span className="text-white font-bold font-mono text-sm w-10 text-right shrink-0">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WinnerPredictionsPage() {
  // Primary contenders — the 7 featured teams, in display order
  const primaryContenders = PRIMARY_SLUGS
    .map((slug) => WINNER_PREDICTIONS.find((p) => p.slug === slug))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  // Top 3 for the hero highlight cards
  const top3 = WINNER_PREDICTIONS.slice(0, 3);

  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto pb-16 space-y-10">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Winner Predictions' },
        ]} />

        <WCPageNav />

        {/* ── Hero ── */}
        <div>
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-2">
            🏆 FIFA World Cup 2026 · Expert Analysis
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Winner Predictions
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
            Full expert picks for the FIFA World Cup 2026 — from tournament favourites and power rankings
            to dark-horse contenders and our simulated bracket. The tournament runs{' '}
            <strong className="text-white">11 June – 19 July 2026</strong> across the USA, Canada and Mexico.
          </p>
          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: 'Top Favourites', href: '#favourites' },
              { label: 'Power Rankings', href: '#power-rankings' },
              { label: 'Dark Horses',    href: '#dark-horses' },
              { label: 'Simulation',     href: '#simulation' },
              { label: 'History',        href: '#history' },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-full transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* ── Section 1: Top Favourites ── */}
        <section id="favourites" aria-labelledby="favourites-heading">
          <h2 id="favourites-heading" className="text-xl font-bold text-white mb-1">Top Favourites</h2>
          <p className="text-gray-500 text-sm mb-5">
            The three teams with the highest probability of lifting the trophy in New Jersey on 19 July 2026.
          </p>

          {/* Podium cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {top3.map((pick, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              const borders = ['border-yellow-500/50', 'border-gray-500/40', 'border-orange-600/40'];
              const glows   = ['shadow-yellow-500/10', 'shadow-gray-500/5', 'shadow-orange-600/5'];
              return (
                <Link
                  key={pick.slug}
                  href={`/teams/${pick.slug}`}
                  className={`bg-gray-900 hover:bg-gray-800 border ${borders[i]} rounded-2xl p-5 transition-all group shadow-lg ${glows[i]}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{medals[i]}</span>
                    <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-sm font-black px-3 py-1 rounded-full">
                      {pick.probability}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-4xl">{pick.flag}</span>
                    <span className="text-white font-black text-xl group-hover:text-yellow-400 transition-colors leading-tight">
                      {pick.name}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed mb-3 line-clamp-3">{pick.reasoning}</p>
                  <div className="flex flex-col gap-1 text-[11px]">
                    <p><span className="text-green-400 font-semibold">✓ </span><span className="text-gray-400">{pick.strength}</span></p>
                    <p><span className="text-red-400 font-semibold">✗ </span><span className="text-gray-400">{pick.weakness}</span></p>
                  </div>
                  <p className="text-blue-400 text-[11px] mt-3 font-medium group-hover:text-blue-300">
                    View team profile →
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Remaining featured teams — Brazil, Argentina, France, England, Spain, Germany, Portugal */}
          <h3 className="text-base font-bold text-white mb-3">All Featured Contenders</h3>
          <div className="space-y-3">
            {primaryContenders.map((pick) => (
              <div key={pick.slug} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 text-center w-8 pt-1">
                    <span className="text-gray-600 font-black">#{pick.rank}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <Link href={`/teams/${pick.slug}`} className="flex items-center gap-2 group">
                        <span className="text-2xl">{pick.flag}</span>
                        <span className="text-white font-black text-base group-hover:text-yellow-400 transition-colors">
                          {pick.name}
                        </span>
                        <span className="text-gray-600 text-xs">Group {pick.group}</span>
                      </Link>
                      <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                        {pick.probability} chance
                      </span>
                    </div>
                    <ProbabilityBar value={pick.probability} />
                    <p className="text-gray-400 text-sm leading-relaxed mt-3">{pick.reasoning}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs">
                      <span><span className="text-green-400 font-semibold">✓ </span><span className="text-gray-500">{pick.strength}</span></span>
                      <span><span className="text-red-400 font-semibold">✗ </span><span className="text-gray-500">{pick.weakness}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 2: Power Rankings ── */}
        <section id="power-rankings" aria-labelledby="power-heading">
          <h2 id="power-heading" className="text-xl font-bold text-white mb-1">Power Rankings</h2>
          <p className="text-gray-500 text-sm mb-5">
            Comparative probability chart for all top contenders. Percentages reflect estimated tournament-win likelihood.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50">
            {WINNER_PREDICTIONS.map((pick, i) => (
              <div key={pick.slug} className="flex items-center gap-3 px-4 py-3">
                <span className="text-gray-600 font-mono text-xs w-5 shrink-0 text-right">{i + 1}</span>
                <span className="text-xl shrink-0 w-7">{pick.flag}</span>
                <Link
                  href={`/teams/${pick.slug}`}
                  className="text-white font-semibold text-sm hover:text-yellow-400 transition-colors w-28 shrink-0"
                >
                  {pick.name}
                </Link>
                <div className="flex-1">
                  <ProbabilityBar
                    value={pick.probability}
                    colour={i === 0 ? 'yellow' : i <= 2 ? 'blue' : 'blue'}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-2 px-1">
            Probabilities are expert estimates. Remaining probability distributed across 41 other qualified nations.
          </p>
        </section>

        {/* ── Section 3: Dark Horses ── */}
        <section id="dark-horses" aria-labelledby="dark-horse-heading">
          <h2 id="dark-horse-heading" className="text-xl font-bold text-white mb-1">Dark Horses</h2>
          <p className="text-gray-500 text-sm mb-5">
            Teams with a genuine — if unlikely — chance of causing a major upset and reaching the latter stages.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DARK_HORSES.map((team) => (
              <Link
                key={team.slug}
                href={`/teams/${team.slug}`}
                className="bg-gray-900 border border-gray-800 hover:border-blue-500/40 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl shrink-0">{team.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <span className="text-white font-bold text-sm group-hover:text-blue-400 transition-colors">
                        {team.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-semibold">
                          {team.tag}
                        </span>
                        <span className="text-gray-500 font-mono text-xs">{team.probability}</span>
                      </div>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed">{team.reason}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Section 4: Tournament Simulation ── */}
        <section id="simulation" aria-labelledby="simulation-heading">
          <h2 id="simulation-heading" className="text-xl font-bold text-white mb-1">Tournament Simulation</h2>
          <p className="text-gray-500 text-sm mb-5">
            Our predicted bracket path for the top 5 contenders — from group stage through to the Final.
          </p>
          <div className="space-y-3">
            {SIMULATION.map((team) => {
              const outcomeColour =
                team.outcome === 'Champions'  ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                team.outcome === 'Runners-up' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                'text-gray-400 bg-gray-800 border-gray-700';
              return (
                <div key={team.name} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-2xl">{team.flag}</span>
                    <span className="text-white font-bold text-sm">{team.name}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${outcomeColour} ml-auto shrink-0`}>
                      {team.outcome === 'Champions' ? '🏆 ' : ''}{team.outcome}
                    </span>
                  </div>
                  {/* Path steps */}
                  <div className="flex flex-wrap items-center gap-0">
                    {team.path.map((step, i) => (
                      <div key={step} className="flex items-center">
                        <span
                          className={`text-[11px] px-2 py-1 rounded font-medium ${
                            i === team.path.length - 1
                              ? team.outcome === 'Champions'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : team.outcome === 'Runners-up'
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-gray-800 text-gray-400'
                              : 'bg-gray-800/60 text-gray-500'
                          }`}
                        >
                          {step}
                        </span>
                        {i < team.path.length - 1 && (
                          <span className="text-gray-700 text-xs mx-1">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-gray-600 text-xs mt-3 px-1">
            Simulation based on group draw, form and squad ratings. Actual results may vary — that&apos;s what makes the World Cup special.
          </p>
        </section>

        {/* ── Section 5: Historical Winners ── */}
        <section id="history" aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-xl font-bold text-white mb-1">Historical Winners</h2>
          <p className="text-gray-500 text-sm mb-5">
            The last eight World Cup champions — context for which nations have recent tournament pedigree.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 border-b border-gray-800">
              <span className="col-span-2">Year</span>
              <span className="col-span-4">Host</span>
              <span className="col-span-3">Winner</span>
              <span className="col-span-3 hidden sm:block">Final score</span>
            </div>
            {HISTORY.map(({ year, host, winner, final }) => (
              <div key={year} className="grid grid-cols-12 items-center px-4 py-3 border-b border-gray-800/50 last:border-0 text-sm hover:bg-gray-800/30 transition-colors">
                <span className="col-span-2 text-white font-bold">{year}</span>
                <span className="col-span-4 text-gray-400 text-xs">{host}</span>
                <span className="col-span-3 text-white font-medium">{winner}</span>
                <span className="col-span-3 text-gray-500 text-xs hidden sm:block">{final}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-300 text-sm font-semibold mb-2">📊 Key statistics</p>
            <ul className="space-y-1.5 text-gray-400 text-xs">
              <li>• No team has won back-to-back World Cups since <strong className="text-white">Brazil (1958 & 1962)</strong></li>
              <li>• European teams have won <strong className="text-white">5 of the last 7</strong> World Cups (since 1994)</li>
              <li>• The host nation has reached the <strong className="text-white">quarter-finals or further</strong> at every modern tournament</li>
              <li>• Defending champions have been <strong className="text-white">eliminated in the group stage</strong> in 3 of the last 5 tournaments</li>
              <li>• France have appeared in <strong className="text-white">3 of the last 5 finals</strong>, winning two (1998, 2018)</li>
            </ul>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-xl font-bold text-white mb-5">
            World Cup 2026 Predictions — FAQ
          </h2>
          <div className="space-y-3">
            {[
              {
                q: 'Who will win World Cup 2026?',
                a: 'France are the consensus expert pick to win the FIFA World Cup 2026 with an 18% implied probability. They have the deepest squad, Mbappé at peak form, and the best recent tournament record of any nation. Brazil (15%) and England (12%) are the closest challengers.',
              },
              {
                q: 'Which team is the favourite for the 2026 World Cup?',
                a: 'France are the clear favourite. The 2018 champions and 2022 runners-up have the most complete squad in the tournament — world-class in every position and led by Kylian Mbappé, arguably the best player on the planet heading into 2026.',
              },
              {
                q: 'Can a dark horse win the World Cup 2026?',
                a: 'Absolutely — dark horses have historically punched above their weight. Croatia reached the 2018 final; Morocco reached the 2022 semi-finals. The expanded 48-team format adds a new Round of 32, meaning more upset opportunities. Morocco, Japan, Colombia and host nation USA all have credible routes to the quarter-finals and beyond.',
              },
              {
                q: 'How accurate are World Cup predictions?',
                a: 'World Cup predictions are educated estimates based on squad strength, FIFA rankings, form and historical data — not certainties. The pre-tournament favourite has won only 3 of the last 8 World Cups. Tournament football is inherently unpredictable: a single injury, red card or penalty can change everything. Use our probability figures as informed guidance rather than guarantees.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
                <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-800/50 transition-colors">
                  <span className="text-white font-semibold text-sm">{q}</span>
                  <span className="text-gray-500 text-lg shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-4 pt-1 text-gray-400 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* ── Internal links ── */}
        <WCRelatedLinks links={[
          { href: '/world-cup-2026',                          icon: '🏆', label: 'WC 2026 Hub',              desc: 'Full tournament overview — fixtures, groups, bracket' },
          { href: '/world-cup-2026/groups',                   icon: '🗂️', label: 'Group Stage',              desc: 'All 12 groups with standings and predictions' },
          { href: '/world-cup-2026/bracket',                  icon: '🔗', label: 'Knockout Bracket',          desc: 'Round of 32 path from group exit to the Final' },
          { href: '/world-cup-2026/golden-boot-predictions',  icon: '👟', label: 'Golden Boot Predictions',   desc: 'Top scorer forecast — Mbappé, Haaland, Vinicius Jr' },
          { href: '/world-cup-2026/predictions',              icon: '🔮', label: 'All Predictions',           desc: 'Winner, Golden Boot and all 8 group predictions' },
          { href: '/world-cup-2026/fixtures',                 icon: '📅', label: 'Fixtures',                  desc: 'Full schedule with kick-off times for all 104 matches' },
          { href: '/teams/france',                            icon: '🇫🇷', label: 'France Team Profile',       desc: 'Squad, fixtures and group stage info' },
          { href: '/teams/brazil',                            icon: '🇧🇷', label: 'Brazil Team Profile',       desc: 'Squad, fixtures and group stage info' },
        ]} heading="Explore More" />
      </div>
    </>
  );
}
