/**
 * /world-cup-2026/golden-boot-predictions
 *
 * Sprint G7 – high-SEO top-scorer predictions page.
 * Targets: "world cup 2026 golden boot", "wc 2026 top scorer prediction",
 *          "who will win golden boot 2026", "world cup golden boot odds"
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

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'World Cup 2026 Golden Boot Predictions | GoalRadar',
  description:
    'Expert World Cup 2026 Golden Boot predictions. Who will be the top scorer — Mbappé, Haaland, Vinicius Jr, Bellingham, Kane, Julián Álvarez or Yamal? Full odds, player cards and historical winners.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'World Cup 2026 Golden Boot Predictions | GoalRadar',
    description:
      'Who will win the World Cup 2026 Golden Boot? Expert player cards, odds and top-scorer analysis for every major contender.',
    type: 'article',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Golden Boot Predictions | GoalRadar',
    description:
      'Full Golden Boot odds — Mbappé, Haaland, Vinicius Jr, Kane, Bellingham, Julián Álvarez and Yamal.',
  },
};

// ---------------------------------------------------------------------------
// Static data — player slugs in featured display order
// ---------------------------------------------------------------------------

// Top scorer favourites (traditional goal-getters most likely to win)
const FAVOURITE_SLUGS = ['Kylian Mbappé', 'Harry Kane', 'Vinicius Jr', 'Lamine Yamal'];

// Dark horse picks (outstanding value or unconventional routes to the award)
const DARK_HORSE_SLUGS = ['Erling Haaland', 'Jude Bellingham', 'Julián Álvarez'];

const DARK_HORSE_NOTES: Record<string, string> = {
  'Erling Haaland':
    'Norway\'s first-ever World Cup qualifier opens up a whole tournament for the planet\'s most clinical finisher. Haaland has never scored zero in any competition he\'s entered — expect goals from the first whistle.',
  'Jude Bellingham':
    'Midfielders rarely win the Golden Boot, but Bellingham is not a conventional midfielder. He scored 23 goals for Real Madrid in his debut season. England\'s entire attacking system is built around him finding the net.',
  'Julián Álvarez':
    '4 goals in 2022 proved Álvarez can deliver on the biggest stage. No longer in Messi\'s shadow at Atlético Madrid, he arrives in 2026 as Argentina\'s main striker — and with a point to prove.',
};

// Historical Golden Boot winners
const GOLDEN_BOOT_HISTORY = [
  { year: '2022', flag: '🇫🇷', player: 'Kylian Mbappé',         country: 'France',      goals: 8, note: 'Hat-trick in the final' },
  { year: '2018', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', player: 'Harry Kane',           country: 'England',     goals: 6, note: '5 from the spot' },
  { year: '2014', flag: '🇨🇴', player: 'James Rodríguez',       country: 'Colombia',    goals: 6, note: 'Goal of the tournament too' },
  { year: '2010', flag: '🇩🇪', player: 'Thomas Müller',         country: 'Germany',     goals: 5, note: 'Plus 3 assists' },
  { year: '2006', flag: '🇩🇪', player: 'Miroslav Klose',        country: 'Germany',     goals: 5, note: '3rd-place finisher' },
  { year: '2002', flag: '🇧🇷', player: 'Ronaldo',               country: 'Brazil',      goals: 8, note: 'Winner — 2 in the final' },
  { year: '1998', flag: '🇭🇷', player: 'Davor Šuker',           country: 'Croatia',     goals: 6, note: 'Dark horse pick' },
  { year: '1994', flag: '🇷🇺', player: 'Oleg Salenko',          country: 'Russia',      goals: 6, note: '5 in one game vs Cameroon' },
];

// All-time World Cup top scorers
const ALL_TIME_SCORERS = [
  { flag: '🇩🇪', player: 'Miroslav Klose',  goals: 16, years: '2002–2014' },
  { flag: '🇧🇷', player: 'Ronaldo',          goals: 15, years: '1994–2006' },
  { flag: '🇩🇪', player: 'Gerd Müller',      goals: 14, years: '1970–1974' },
  { flag: '🇫🇷', player: 'Kylian Mbappé',   goals: 12, years: '2018–2022' },
  { flag: '🇫🇷', player: 'Just Fontaine',    goals: 13, years: '1958'      },
];

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',                    item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',          item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Golden Boot Predictions', item: PAGE_URL },
    ],
  };

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'World Cup 2026 Golden Boot Predictions',
    description:
      'Expert top-scorer predictions for the FIFA World Cup 2026. Full player cards, odds and analysis for Mbappé, Haaland, Vinicius Jr, Bellingham, Kane, Julián Álvarez and Yamal.',
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
    },
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Who will win the Golden Boot at World Cup 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kylian Mbappé is the overwhelming favourite to win the World Cup 2026 Golden Boot with a 20% implied probability. He top-scored in 2022 with 8 goals and arrives at 27 in his absolute prime. Erling Haaland (7%) and Harry Kane (12%) are the closest challengers, with Vinicius Jr (10%) and Julián Álvarez (6%) also firmly in contention.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who scored the most goals in World Cup history?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Miroslav Klose (Germany) holds the all-time World Cup scoring record with 16 goals across the 2002, 2006, 2010 and 2014 tournaments. Ronaldo (Brazil) is second with 15 goals. Kylian Mbappé already has 12 goals heading into 2026 — if he has a strong tournament he could challenge Klose\'s record before retiring.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can midfielders win the World Cup Golden Boot?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Midfielders can and do win the Golden Boot — Thomas Müller won it in 2010 operating as a trequartista, and James Rodríguez won it in 2014 from a wide-midfield position. Jude Bellingham is the leading midfielder pick for the 2026 Golden Boot: he scored 23 goals for Real Madrid in his debut season and England\'s entire attacking system revolves around him arriving late into the box.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is the World Cup Golden Boot decided?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The FIFA World Cup Golden Boot (officially the Adidas Golden Boot) is awarded to the tournament\'s top scorer. If players are tied on goals, the tiebreaker is: (1) most assists, (2) fewest minutes played. With 48 teams in 2026, players can appear in up to 7 matches — more goal-scoring opportunities than any previous format.',
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

function ProbabilityBar({ value }: { value: string }) {
  const pct = parseFloat(value);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-2">
        <div
          className="bg-yellow-500 h-2 rounded-full"
          style={{ width: `${Math.min(pct * 4, 100)}%` }}
        />
      </div>
      <span className="text-yellow-400 font-bold font-mono text-xs w-9 text-right shrink-0">{value}</span>
    </div>
  );
}

function StatPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-white/5 text-gray-400 text-[10px] px-2 py-0.5 rounded-full border border-white/10">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GoldenBootPredictionsPage() {
  const byName = Object.fromEntries(GOLDEN_BOOT_PREDICTIONS.map((p) => [p.name, p]));

  const favourites = FAVOURITE_SLUGS.map((n) => byName[n]).filter(Boolean);
  const darkHorses = DARK_HORSE_SLUGS.map((n) => byName[n]).filter(Boolean);
  // Full sorted ranking including all players
  const allRanked  = [...GOLDEN_BOOT_PREDICTIONS].sort((a, b) => a.rank - b.rank);

  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto pb-16 space-y-12">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Golden Boot Predictions' },
        ]} />

        <WCPageNav />

        {/* ── Hero ── */}
        <div>
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-2">
            ⚽ FIFA World Cup 2026 · Top Scorer Predictions
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Golden Boot Predictions
          </h1>
          <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
            The FIFA World Cup 2026 Golden Boot goes to the tournament&apos;s top scorer across{' '}
            <strong className="text-white">104 matches</strong>. With the expanded 48-team format, a
            player on the winning side can appear in up to{' '}
            <strong className="text-white">7 games</strong> — giving the top scorer more opportunities
            than any previous World Cup. Here is our full analysis, from the overwhelming favourite to
            the most exciting dark-horse picks.
          </p>

          {/* Rule box */}
          <div className="mt-5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 max-w-2xl">
            <p className="text-yellow-400 text-xs font-semibold mb-1">ℹ️ How the Golden Boot is decided</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              Goals scored (primary) → most assists → fewest minutes played. The 8-goal record set by
              Mbappé (2022) and Ronaldo (2002) could be broken in 2026 with one extra potential match.
            </p>
          </div>

          {/* On-page nav */}
          <div className="flex flex-wrap gap-2 mt-5">
            {[
              { label: 'Top Favourites',  href: '#favourites' },
              { label: 'Dark Horses',     href: '#dark-horses' },
              { label: 'Full Rankings',   href: '#rankings' },
              { label: 'History',         href: '#history' },
              { label: 'All-time Scorers',href: '#all-time' },
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

        {/* ── Section 1: Top Scorer Favourites ── */}
        <section id="favourites" aria-labelledby="favourites-heading">
          <h2 id="favourites-heading" className="text-xl font-bold text-white mb-1">
            Top Scorer Favourites
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            Four players with the highest probability of finishing as the tournament&apos;s top scorer.
          </p>

          {/* Top 3 podium */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {favourites.slice(0, 3).map((p, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              const borders = ['border-yellow-500/50', 'border-gray-500/30', 'border-orange-600/30'];
              return (
                <div
                  key={p.name}
                  className={`bg-gray-900 border ${borders[i]} rounded-2xl p-5 flex flex-col gap-3`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{medals[i]}</span>
                    <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-sm font-black px-3 py-1 rounded-full">
                      {p.probability}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-black text-xl leading-tight">{p.name}</p>
                    <Link
                      href={`/teams/${p.countrySlug}`}
                      className="inline-flex items-center gap-1.5 text-gray-400 hover:text-yellow-400 transition-colors text-sm mt-0.5"
                    >
                      <span>{p.countryFlag}</span><span>{p.country}</span>
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatPill>Age {p.age}</StatPill>
                    <StatPill>{p.club}</StatPill>
                    {p.worldCupGoals > 0 && (
                      <span className="bg-green-500/10 text-green-400 text-[10px] px-2 py-0.5 rounded-full border border-green-500/20">
                        {p.worldCupGoals} WC goals
                      </span>
                    )}
                  </div>
                  <ProbabilityBar value={p.probability} />
                  <p className="text-gray-400 text-xs leading-relaxed">{p.reasoning}</p>
                  <Link
                    href={`/teams/${p.countrySlug}`}
                    className="text-blue-400 hover:text-blue-300 text-[11px] font-medium transition-colors"
                  >
                    {p.country} team profile →
                  </Link>
                </div>
              );
            })}
          </div>

          {/* 4th favourite — full-width card */}
          {favourites[3] && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4">
              <span className="text-2xl shrink-0 mt-0.5">4️⃣</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <p className="text-white font-bold text-base">{favourites[3].name}</p>
                    <Link
                      href={`/teams/${favourites[3].countrySlug}`}
                      className="inline-flex items-center gap-1 text-gray-400 hover:text-yellow-400 transition-colors text-xs mt-0.5"
                    >
                      <span>{favourites[3].countryFlag}</span>
                      <span>{favourites[3].country}</span>
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <StatPill>Age {favourites[3].age}</StatPill>
                    <StatPill>{favourites[3].club}</StatPill>
                    <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-2 py-0.5 rounded-full">
                      {favourites[3].probability}
                    </span>
                  </div>
                </div>
                <div className="mb-2"><ProbabilityBar value={favourites[3].probability} /></div>
                <p className="text-gray-400 text-sm leading-relaxed">{favourites[3].reasoning}</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Section 2: Dark Horse Picks ── */}
        <section id="dark-horses" aria-labelledby="dark-horse-heading">
          <h2 id="dark-horse-heading" className="text-xl font-bold text-white mb-1">
            Dark Horse Picks
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            Three players who could win the Golden Boot through less conventional routes — a
            first-time qualifier, a goal-scoring midfielder and a 2022 winner flying under the radar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {darkHorses.map((p) => (
              <div
                key={p.name}
                className="bg-gray-900 border border-blue-500/20 rounded-2xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                    Dark horse
                  </span>
                  <span className="text-blue-400 font-bold font-mono text-sm">{p.probability}</span>
                </div>
                <div>
                  <p className="text-white font-black text-lg leading-tight">{p.name}</p>
                  <Link
                    href={`/teams/${p.countrySlug}`}
                    className="inline-flex items-center gap-1.5 text-gray-400 hover:text-blue-400 transition-colors text-sm mt-0.5"
                  >
                    <span>{p.countryFlag}</span><span>{p.country}</span>
                  </Link>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatPill>Age {p.age}</StatPill>
                  <StatPill>{p.club}</StatPill>
                  {p.worldCupGoals > 0 && (
                    <span className="bg-green-500/10 text-green-400 text-[10px] px-2 py-0.5 rounded-full border border-green-500/20">
                      {p.worldCupGoals} WC goals
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(parseFloat(p.probability) * 4, 100)}%` }}
                    />
                  </div>
                  <span className="text-blue-400 font-bold font-mono text-xs w-9 text-right shrink-0">{p.probability}</span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">
                  {DARK_HORSE_NOTES[p.name] ?? p.reasoning}
                </p>
                <Link
                  href={`/teams/${p.countrySlug}`}
                  className="text-blue-400 hover:text-blue-300 text-[11px] font-medium transition-colors"
                >
                  {p.country} team profile →
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── Full Rankings ── */}
        <section id="rankings" aria-labelledby="rankings-heading">
          <h2 id="rankings-heading" className="text-xl font-bold text-white mb-1">
            Full Power Rankings
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            All {allRanked.length} contenders ranked by estimated Golden Boot probability.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50">
            {allRanked.map((p) => (
              <div key={p.name} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/30 transition-colors">
                <span className="text-gray-600 font-mono text-xs w-5 shrink-0 text-right">{p.rank}</span>
                <span className="text-xl shrink-0">{p.countryFlag}</span>
                <div className="w-36 shrink-0">
                  <Link
                    href={`/teams/${p.countrySlug}`}
                    className="text-white font-semibold text-sm hover:text-yellow-400 transition-colors block leading-tight"
                  >
                    {p.name}
                  </Link>
                  <span className="text-gray-600 text-[10px]">{p.club}</span>
                </div>
                <div className="flex-1">
                  <ProbabilityBar value={p.probability} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Historical Golden Boot Winners ── */}
        <section id="history" aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-xl font-bold text-white mb-1">
            Historical Golden Boot Winners
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            The last eight World Cup top scorers — and what each winning performance looked like.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 border-b border-gray-800">
              <span className="col-span-2">Year</span>
              <span className="col-span-3">Player</span>
              <span className="col-span-2">Country</span>
              <span className="col-span-1 text-center">Goals</span>
              <span className="col-span-4 hidden sm:block">Note</span>
            </div>
            {GOLDEN_BOOT_HISTORY.map(({ year, flag, player, country, goals, note }) => (
              <div
                key={year}
                className="grid grid-cols-12 items-center px-4 py-3 border-b border-gray-800/50 last:border-0 text-sm hover:bg-gray-800/30 transition-colors"
              >
                <span className="col-span-2 text-white font-bold">{year}</span>
                <span className="col-span-3 text-gray-200 font-medium text-xs">{player}</span>
                <span className="col-span-2 text-gray-400 text-xs">
                  {flag} {country}
                </span>
                <span className="col-span-1 text-center text-yellow-400 font-black">{goals}</span>
                <span className="col-span-4 text-gray-500 text-xs hidden sm:block">{note}</span>
              </div>
            ))}
          </div>

          {/* Key stat callout */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { stat: '8', label: 'Record goals in one WC', sub: 'Mbappé (2022) & Ronaldo (2002)' },
              { stat: '5×', label: 'Times a striker won it', sub: 'Since 2002 — midfielders (Müller, Rodríguez) are rare' },
              { stat: '7', label: 'Max games in 2026', sub: 'More scoring chances than any prior format' },
            ].map(({ stat, label, sub }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-yellow-400 font-black text-3xl">{stat}</p>
                <p className="text-white text-xs font-semibold mt-1">{label}</p>
                <p className="text-gray-500 text-[11px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── All-time scorers ── */}
        <section id="all-time" aria-labelledby="all-time-heading">
          <h2 id="all-time-heading" className="text-xl font-bold text-white mb-1">
            All-time World Cup Top Scorers
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            Mbappé (12 goals) is already 4th all-time heading into 2026. A strong tournament
            could put him within reach of Klose&apos;s 16-goal record.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 border-b border-gray-800">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Player</span>
              <span className="col-span-3">Active</span>
              <span className="col-span-3 text-right">WC Goals</span>
            </div>
            {ALL_TIME_SCORERS.map(({ flag, player, goals, years }, i) => {
              const isMbappe = player === 'Kylian Mbappé';
              return (
                <div
                  key={player}
                  className={`grid grid-cols-12 items-center px-4 py-3 border-b border-gray-800/50 last:border-0 text-sm ${
                    isMbappe ? 'bg-yellow-500/5' : 'hover:bg-gray-800/30'
                  } transition-colors`}
                >
                  <span className="col-span-1 text-gray-600 font-mono text-xs">{i + 1}</span>
                  <span className={`col-span-5 font-semibold text-sm ${isMbappe ? 'text-yellow-400' : 'text-gray-200'}`}>
                    {flag} {player}
                    {isMbappe && (
                      <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                  </span>
                  <span className="col-span-3 text-gray-500 text-xs">{years}</span>
                  <span className={`col-span-3 text-right font-black text-base ${isMbappe ? 'text-yellow-400' : 'text-white'}`}>
                    {goals}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-xl font-bold text-white mb-5">
            Golden Boot FAQ
          </h2>
          <div className="space-y-3">
            {[
              {
                q: 'Who will win the Golden Boot at World Cup 2026?',
                a: 'Kylian Mbappé is the overwhelming favourite with a 20% implied probability. He top-scored in 2022 with 8 goals and arrives at 27 in his absolute prime at Real Madrid. Erling Haaland (7%), Harry Kane (12%), Vinicius Jr (10%) and Julián Álvarez (6%) are all genuine challengers.',
              },
              {
                q: 'Who scored the most goals in World Cup history?',
                a: 'Miroslav Klose (Germany) holds the all-time record with 16 World Cup goals across 2002, 2006, 2010 and 2014. Ronaldo (Brazil) is second with 15. Kylian Mbappé already has 12 goals at just 27 years old — a strong 2026 tournament could bring him close to Klose\'s record.',
              },
              {
                q: 'Can midfielders win the World Cup Golden Boot?',
                a: 'Yes — Thomas Müller won it in 2010 as a trequartista and James Rodríguez won it in 2014 from a wide midfield role. Jude Bellingham is the best midfielder pick for 2026: he scored 23 goals for Real Madrid in a single season and England\'s attack is built around him finding the net from deep positions. If England go deep, Bellingham is a genuine Golden Boot contender.',
              },
              {
                q: 'How is the World Cup Golden Boot decided?',
                a: 'The FIFA World Cup Golden Boot is awarded to the tournament\'s top scorer. If players are level on goals, tiebreakers are applied in order: (1) most assists, (2) fewest minutes played. With 48 teams in 2026, stars who reach the final can play in up to 7 matches — more opportunities than any previous World Cup format.',
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
        <WCRelatedLinks
          heading="Explore More World Cup 2026"
          links={[
            { href: '/world-cup-2026',                         icon: '🏆', label: 'WC 2026 Hub',             desc: 'Full tournament overview — fixtures, results, groups' },
            { href: '/world-cup-2026/winner-predictions',      icon: '🔮', label: 'Winner Predictions',       desc: 'Who will lift the trophy on 19 July 2026?' },
            { href: '/world-cup-2026/fixtures',                icon: '📅', label: 'Fixtures',                 desc: 'All 104 match kick-off times and dates' },
            { href: '/world-cup-2026/predictions',             icon: '🗂️', label: 'All Predictions',          desc: 'Winner, Golden Boot and group predictions hub' },
            { href: '/teams/france',                           icon: '🇫🇷', label: 'France',                  desc: 'Mbappé\'s squad — fixtures and group info' },
            { href: '/teams/england',                          icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', label: 'England',                desc: 'Kane, Bellingham, Saka — WC 2026 schedule' },
            { href: '/teams/brazil',                           icon: '🇧🇷', label: 'Brazil',                  desc: 'Vinicius Jr and the Seleção — WC 2026' },
            { href: '/teams/argentina',                        icon: '🇦🇷', label: 'Argentina',               desc: 'Julián Álvarez and the defending champions' },
          ]}
        />
      </div>
    </>
  );
}
