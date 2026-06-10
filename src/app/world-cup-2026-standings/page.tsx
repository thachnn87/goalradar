/**
 * /world-cup-2026-standings
 *
 * Programmatic SEO — targets: "world cup 2026 standings" | "wc 2026 table" | "world cup 2026 group table"
 * Unique angle vs /world-cup-2026/groups: qualification scenarios explained per group.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
// PERF-4.5
import { getStandingsCached } from '@/lib/api';
import { getStaticWCGroupTables } from '@/lib/wc-static-groups';
import type { StandingTable, StandingEntry } from '@/lib/types';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import NewsletterSignup from '@/components/NewsletterSignup';

export const revalidate = 3600; // align with STANDINGS TTL (1 hour)

const BASE_URL = 'https://goalradar.org';
const CANONICAL = `${BASE_URL}/world-cup-2026-standings`;

export const metadata: Metadata = {
  title: 'World Cup 2026 Standings — Live Group Tables & Points | GoalRadar',
  description:
    'Live FIFA World Cup 2026 standings for all 12 groups (A–L). Updated after every match with points, goal difference, goals scored and qualification status.',
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'World Cup 2026 Standings | GoalRadar',
    description:
      'Live FIFA World Cup 2026 group standings — all 12 groups with current points and goal difference.',
    type: 'website',
    url: CANONICAL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Standings | GoalRadar',
    description: 'Live FIFA World Cup 2026 group standings for all 12 groups.',
  },
};

const FAQ = [
  {
    q: 'How many teams advance from each World Cup 2026 group?',
    a: 'The top two teams from each of the 12 groups advance automatically to the Round of 32. Additionally, the eight best third-placed teams across all groups also qualify.',
  },
  {
    q: 'How are World Cup 2026 group ties broken?',
    a: 'Ties in points are broken by: (1) goal difference in all group matches, (2) goals scored in all group matches, (3) head-to-head points, (4) head-to-head goal difference, (5) head-to-head goals scored, then fair-play points and drawing of lots.',
  },
  {
    q: 'How many points are needed to advance from the World Cup 2026 group stage?',
    a: 'Typically 6 points (two wins) guarantees progression. However, with 48 teams and 8 third-place spots available, as few as 3 or 4 points may be enough if goal difference is favourable.',
  },
  {
    q: 'When do World Cup 2026 group standings update?',
    a: 'GoalRadar updates standings every 5 minutes. Final group standings are confirmed after the last matchday, when all matches in each group kick off simultaneously.',
  },
  {
    q: 'Which third-placed teams qualify at World Cup 2026?',
    a: 'After all 12 groups conclude, the eight best third-placed finishers advance to the Round of 32. Ranking is based on points, then goal difference, goals scored and fair play.',
  },
];

function GroupTable({ table, groupLabel }: { table: StandingEntry[]; groupLabel: string }) {
  const slug = `group-${groupLabel.toLowerCase()}`;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <span className="text-xs font-bold text-white uppercase tracking-wider">Group {groupLabel}</span>
        <Link href={`/world-cup-2026/${slug}`} className="text-[10px] text-yellow-500 hover:text-yellow-300 transition-colors">
          Full group →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left pl-4 pr-2 py-2 text-gray-500 font-semibold w-6">#</th>
              <th className="text-left px-2 py-2 text-gray-500 font-semibold">Team</th>
              <th className="px-2 py-2 text-gray-500 font-semibold text-center">P</th>
              <th className="px-2 py-2 text-gray-500 font-semibold text-center">W</th>
              <th className="px-2 py-2 text-gray-500 font-semibold text-center">D</th>
              <th className="px-2 py-2 text-gray-500 font-semibold text-center">L</th>
              <th className="px-2 py-2 text-gray-500 font-semibold text-center">GD</th>
              <th className="pr-4 pl-2 py-2 text-gray-500 font-semibold text-center font-bold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, i) => {
              const qualified = i < 2;
              const maybe = i === 2;
              return (
                <tr key={row.team?.id ?? i}
                  className={`border-b border-white/5 last:border-0 ${qualified ? 'bg-green-950/10' : maybe ? 'bg-yellow-950/10' : ''}`}>
                  <td className="pl-4 pr-2 py-2.5 text-gray-500">{row.position}</td>
                  <td className="px-2 py-2.5 text-white font-medium">{row.team?.shortName ?? row.team?.name}</td>
                  <td className="px-2 py-2.5 text-gray-400 text-center">{row.playedGames}</td>
                  <td className="px-2 py-2.5 text-gray-400 text-center">{row.won}</td>
                  <td className="px-2 py-2.5 text-gray-400 text-center">{row.draw}</td>
                  <td className="px-2 py-2.5 text-gray-400 text-center">{row.lost}</td>
                  <td className="px-2 py-2.5 text-gray-400 text-center">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>
                  <td className="pr-4 pl-2 py-2.5 text-white font-black text-center">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-white/5 flex gap-4 text-[10px] text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-green-500/30 shrink-0" />Qualifies</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-yellow-500/30 shrink-0" />3rd-place contender</span>
      </div>
    </div>
  );
}

export default async function WC2026StandingsPage() {
  let standingTables: StandingTable[] = [];
  let isStaticData = false;

  try {
    const data = await getStandingsCached('WC');
    standingTables = (data.standings ?? []).filter((s) => s.type === 'TOTAL');
  } catch {
    // API unavailable — serve static pre-tournament group tables
    standingTables = getStaticWCGroupTables();
    isStaticData   = standingTables.length > 0;
  }

  // Also use static data if API returned nothing useful
  if (standingTables.length === 0) {
    standingTables = getStaticWCGroupTables();
    isStaticData   = standingTables.length > 0;
  }

  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',                    item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026 Standings', item: CANONICAL },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026 Standings' },
        ]} />
        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
            🗂️ FIFA World Cup 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Standings
          </h1>
          <p className="text-gray-400 text-sm">
            Live group tables for all 12 World Cup 2026 groups (A–L). Updated every 5 minutes.
            Top 2 from each group plus 8 best third-place teams advance to the Round of 32.
          </p>
        </div>

        <AdSlot slotId="wc-standings-top" variant="banner" />

        {/* Group tables */}
        {isStaticData && (
          <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-500/5 border border-yellow-700/20 rounded-lg px-4 py-2 mb-4">
            <span>⏳</span>
            <span>Pre-tournament group lineup — live standings update once matches begin on 11 June 2026.</span>
          </div>
        )}
        {standingTables.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              {isStaticData ? 'Group Preview' : 'Live Group Standings'}
            </h2>
            {standingTables.map((st, i) => {
              const groupLetter = String.fromCharCode(65 + i); // A, B, C...
              return (
                <GroupTable key={st.group ?? i} table={st.table} groupLabel={groupLetter} />
              );
            })}
          </section>
        ) : (
          <section className="mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
              <p className="text-4xl mb-3">🗂️</p>
              <p className="text-gray-300 font-semibold">Group standings not yet available</p>
              <p className="text-gray-500 text-sm mt-1">
                Standings will update after the first matches on 11 June 2026
              </p>
              <Link href="/world-cup-2026/groups"
                className="inline-block mt-4 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
                View Groups Preview →
              </Link>
            </div>
          </section>
        )}

        {/* Qualification guide */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">How Qualification Works</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            {[
              { pos: '1st & 2nd', detail: 'Automatically advance to Round of 32', badge: 'bg-green-500/10 text-green-400 border-green-500/20' },
              { pos: 'Best 8 × 3rd', detail: 'Best eight third-placed teams advance to Round of 32', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
              { pos: '4th place', detail: 'Eliminated from the tournament', badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
            ].map(({ pos, detail, badge }) => (
              <div key={pos} className="flex items-start gap-3">
                <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full border ${badge}`}>{pos}</span>
                <p className="text-sm text-gray-400 pt-0.5">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <AdSlot slotId="wc-standings-mid" variant="rectangle" className="mx-auto mb-8" />

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">World Cup 2026 Standings — FAQ</h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="bg-gray-900 border border-gray-800 rounded-xl group">
                <summary className="px-5 py-4 cursor-pointer text-white font-semibold text-sm list-none flex items-center justify-between gap-3">
                  {q}
                  <span className="text-gray-600 group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        <AdSlot slotId="wc-standings-bottom" variant="banner" />

        <NewsletterSignup
          source="wc-standings"
          heading="Never miss a World Cup 2026 match"
          description="Free email alerts delivered straight to your inbox."
          features={['Match reminders', 'Live score alerts', 'World Cup predictions']}
        />

        <WCRelatedLinks links={[
          { href: '/world-cup-2026-groups',         icon: '🗂️', label: 'Group Stage Guide',     desc: 'All 12 draws with tiebreaker rules explained' },
          { href: '/world-cup-2026-results',        icon: '🏁', label: 'WC 2026 Results',       desc: 'Full-time scores updated live during matches' },
          { href: '/world-cup-2026-schedule',       icon: '📅', label: 'WC 2026 Schedule',      desc: 'All 104 fixtures with kickoff times' },
          { href: '/world-cup-2026-bracket',        icon: '🔗', label: 'Knockout Bracket',      desc: 'Follow the path from Round of 32 to the Final' },
          { href: '/world-cup-2026-live-stream',    icon: '📡', label: 'Watch Live',            desc: 'Free streaming options for every country' },
          { href: '/world-cup-2026/teams',          icon: '👥', label: 'All 48 Teams',          desc: 'Squads, group info and form for every nation' },
        ]} />
      </div>
    </>
  );
}
