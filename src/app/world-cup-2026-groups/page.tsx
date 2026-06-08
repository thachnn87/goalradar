/**
 * /world-cup-2026-groups
 *
 * Programmatic SEO — targets: "world cup 2026 groups" | "wc 2026 group stage" | "world cup 2026 group draw"
 * Unique angle vs /world-cup-2026/groups: tournament preview with all 12 groups + group analysis.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getStandings } from '@/lib/api';
import type { StandingTable } from '@/lib/types';
import { isStaticMode, STATIC_GROUPS, STATIC_TEAMS } from '@/data/worldcup/loader';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 3600; // align with STANDINGS TTL (1 hour)

const BASE_URL = 'https://goalradar.org';
const CANONICAL = `${BASE_URL}/world-cup-2026-groups`;

export const metadata: Metadata = {
  title: 'World Cup 2026 Groups — All 12 Groups & Group Stage Guide | GoalRadar',
  description:
    'Complete guide to FIFA World Cup 2026 groups A to L. Group stage results, standings, fixtures and match schedules for all 48 teams. Updated live during the tournament.',
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'World Cup 2026 Groups | GoalRadar',
    description:
      'All 12 FIFA World Cup 2026 groups with current standings and upcoming fixtures.',
    type: 'website',
    url: CANONICAL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Groups | GoalRadar',
    description: 'World Cup 2026 group stage guide — all 12 groups, standings and fixtures.',
  },
};

const WC_GROUPS = ['a','b','c','d','e','f','g','h','i','j','k','l'];

const FAQ = [
  {
    q: 'How many groups are there in World Cup 2026?',
    a: 'There are 12 groups (A through L) in the FIFA World Cup 2026, each containing 4 teams. This is an expansion from 8 groups at the 2022 World Cup, accommodating 48 teams instead of 32.',
  },
  {
    q: 'How many teams advance from each World Cup 2026 group?',
    a: 'The top 2 teams from each of the 12 groups advance automatically to the Round of 32. Additionally, the 8 best third-placed teams across all groups also qualify — giving a total of 32 teams in the knockout stage.',
  },
  {
    q: 'When does the World Cup 2026 group stage start and end?',
    a: 'The group stage begins on 11 June 2026 with Mexico vs South Africa in Mexico City, and concludes on 26 June 2026 with the final round of group matches played simultaneously.',
  },
  {
    q: 'What is the Group of Death at World Cup 2026?',
    a: 'The Group of Death is the group widely considered most difficult to escape — often containing multiple strong nations. After the World Cup 2026 draw, analysts identified groups containing traditional powerhouses like Brazil, France or Spain alongside dark-horse qualifiers as the most competitive.',
  },
  {
    q: 'How are World Cup 2026 group games scheduled?',
    a: 'Each group plays a round-robin format: matchday 1 and 2 can feature any pairing, but matchday 3 sees both matches in the group played simultaneously to prevent collusion.',
  },
  {
    q: 'Which groups do the host nations USA, Canada and Mexico play in?',
    a: 'As the three host nations, USA, Canada and Mexico were seeded in different groups (pots 1 and 2) at the draw to ensure a spread across the 12 groups. Check the live standings for their current group assignments.',
  },
];

export default async function WC2026GroupsPage() {
  let standingTables: StandingTable[] = [];

  if (!isStaticMode()) {
    try {
      const data = await getStandings('WC');
      standingTables = (data.standings ?? []).filter((s) => s.type === 'TOTAL');
    } catch { /* static only */ }
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
      { '@type': 'ListItem', position: 1, name: 'Home',                  item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026 Groups', item: CANONICAL },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026 Groups' },
        ]} />
        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
            🗂️ FIFA World Cup 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Groups
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            All 12 groups of the FIFA World Cup 2026 — live standings, group-stage fixtures and qualification status.
            48 teams compete across Groups A to L from 11 June 2026.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {['12 Groups', '48 Teams', '72 Group Matches', '8 Qualify as Best 3rd'].map((stat) => (
              <span key={stat} className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">
                {stat}
              </span>
            ))}
          </div>
        </div>

        <AdSlot slotId="wc-groups-top" variant="banner" />

        {/* Live standings or preview grid */}
        {standingTables.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Live Group Standings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {standingTables.map((st, i) => {
                const letter = String.fromCharCode(65 + i);
                return (
                  <div key={st.group ?? i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Group {letter}</span>
                      <Link href={`/world-cup-2026/group-${letter.toLowerCase()}`}
                        className="text-[10px] text-yellow-500 hover:text-yellow-300 transition-colors">
                        Details →
                      </Link>
                    </div>
                    <div className="divide-y divide-white/5">
                      {st.table.slice(0, 4).map((row, j) => (
                        <div key={row.team?.id ?? j} className={`flex items-center justify-between px-4 py-2 ${j < 2 ? 'bg-green-950/10' : ''}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-gray-600 w-3">{row.position}</span>
                            <span className="text-xs text-white truncate">{row.team?.shortName ?? row.team?.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs shrink-0">
                            <span className="text-gray-500">{row.playedGames}p</span>
                            <span className="text-white font-bold w-4 text-right">{row.points}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">All 12 Groups</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WC_GROUPS.map((g) => {
                const letter = g.toUpperCase();
                const teamSlugs = STATIC_GROUPS[letter] ?? [];
                const teamMap = new Map(STATIC_TEAMS.map((t) => [t.slug, t]));
                return (
                  <Link key={g} href={`/world-cup-2026/group-${g}`}
                    className="group bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-xl p-4 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-white group-hover:text-yellow-400 transition-colors">
                        Group {letter}
                      </span>
                      <span className="text-[10px] text-yellow-600 group-hover:text-yellow-400">Details →</span>
                    </div>
                    <div className="space-y-1">
                      {teamSlugs.map((slug) => {
                        const t = teamMap.get(slug);
                        return t ? (
                          <div key={slug} className="flex items-center gap-1.5 text-xs text-gray-400">
                            <span>{t.flag}</span>
                            <span>{t.name}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* How qualification works */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">How the Group Stage Works</h2>
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">Round-Robin Format</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                In each group of 4 teams, every team plays the other three teams once (3 matches per team).
                Teams earn 3 points for a win, 1 for a draw, 0 for a loss. The final matchday of each group
                has both matches kick off simultaneously.
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">Who Qualifies?</h3>
              <div className="space-y-2">
                {[
                  { label: '1st & 2nd place (×12)', detail: '24 teams automatically qualify for Round of 32', cls: 'text-green-400' },
                  { label: 'Best 8 × 3rd place',    detail: '8 more teams qualify from 12 third-placed finishers', cls: 'text-yellow-400' },
                  { label: '4th place (×12)',        detail: '12 teams are eliminated', cls: 'text-red-400' },
                ].map(({ label, detail, cls }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className={`text-xs font-bold shrink-0 ${cls}`}>{label}</span>
                    <span className="text-xs text-gray-500">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <AdSlot slotId="wc-groups-mid" variant="rectangle" className="mx-auto mb-8" />

        {/* Tiebreaker explained */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Tiebreakers Explained</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <ol className="space-y-2 text-sm text-gray-400">
              {[
                'Points in all group matches',
                'Goal difference in all group matches',
                'Goals scored in all group matches',
                'Points in head-to-head matches between tied teams',
                'Goal difference in head-to-head matches',
                'Goals scored in head-to-head matches',
                'Fair-play points (yellow/red cards)',
                'Drawing of lots by FIFA',
              ].map((rule, i) => (
                <li key={rule} className="flex items-start gap-3">
                  <span className="shrink-0 text-yellow-600 font-bold w-4">{i + 1}.</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">World Cup 2026 Groups — FAQ</h2>
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

        <AdSlot slotId="wc-groups-bottom" variant="banner" />

        <WCRelatedLinks links={[
          { href: '/world-cup-2026/groups',         icon: '🗂️', label: 'Groups Overview',        desc: 'Live standings for all 12 groups' },
          { href: '/world-cup-2026-standings',      icon: '📊', label: 'Live Standings',          desc: 'Points, GD and qualification status per group' },
          { href: '/world-cup-2026-results',        icon: '🏁', label: 'WC 2026 Results',         desc: 'All full-time scores and live match updates' },
          { href: '/world-cup-2026-schedule',       icon: '📅', label: 'WC 2026 Schedule',        desc: 'All 104 matches with timezone converter' },
          { href: '/world-cup-2026-bracket',        icon: '🔗', label: 'Knockout Bracket',        desc: 'Round of 32 through to the Final at MetLife' },
          { href: '/world-cup-2026/teams',          icon: '👥', label: 'All 48 Teams',            desc: 'Squads, group and form for every WC nation' },
        ]} />
      </div>
    </>
  );
}
