/**
 * /world-cup-2026-bracket
 *
 * Programmatic SEO — targets: "world cup 2026 bracket" | "wc 2026 knockout stage" | "world cup bracket 2026"
 * Unique angle vs /world-cup-2026/bracket: round-by-round narrative guide + key dates.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { buildKnockoutViewModel } from '@/lib/knockout-vm';
import { WC_KNOCKOUT_SLOTS } from '@/lib/wc-fixtures';
import type { Match } from '@/lib/types';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import NewsletterSignup from '@/components/NewsletterSignup';
import { matchPath } from '@/lib/url';

export const revalidate = 900; // 15 min — matches other knockout pages

const BASE_URL = 'https://goalradar.org';
const CANONICAL = `${BASE_URL}/world-cup-2026-bracket`;

export const metadata: Metadata = {
  title: 'World Cup 2026 Bracket — Knockout Stage, Semi-Finals & Final | GoalRadar',
  description:
    'Full FIFA World Cup 2026 bracket and knockout stage draw. Round of 32, Round of 16, Quarter-Finals, Semi-Finals and Final at MetLife Stadium on 19 July 2026.',
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'World Cup 2026 Bracket | GoalRadar',
    description:
      'FIFA World Cup 2026 knockout bracket — from Round of 32 to the Final on 19 July.',
    type: 'website',
    url: CANONICAL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Bracket | GoalRadar',
    description: 'Full FIFA World Cup 2026 knockout bracket and tournament draw.',
  },
};

const KNOCKOUT_ROUNDS = [
  {
    stage: 'LAST_32',
    label: 'Round of 32',
    dates: '27 Jun – 3 Jul 2026',
    desc: 'The 24 group qualifiers (top 2 per group) meet the 8 best third-placed teams.',
    matches: 16,
    icon: '⚔️',
  },
  {
    stage: 'LAST_16',
    label: 'Round of 16',
    dates: '4 – 7 Jul 2026',
    desc: '16 teams battle for a quarter-final place.',
    matches: 8,
    icon: '🏅',
  },
  {
    stage: 'QUARTER_FINALS',
    label: 'Quarter-Finals',
    dates: '9 – 12 Jul 2026',
    desc: 'Eight teams, four matches. Only the best advance.',
    matches: 4,
    icon: '🎯',
  },
  {
    stage: 'SEMI_FINALS',
    label: 'Semi-Finals',
    dates: '15 – 16 Jul 2026',
    desc: 'Two matches determine who contests the World Cup Final.',
    matches: 2,
    icon: '🔥',
  },
  {
    stage: 'THIRD_PLACE',
    label: 'Third-Place Play-off',
    dates: '18 Jul 2026',
    desc: 'Semi-final losers compete for third place.',
    matches: 1,
    icon: '🥉',
  },
  {
    stage: 'FINAL',
    label: 'World Cup Final',
    dates: '19 Jul 2026',
    desc: 'The greatest match in football — MetLife Stadium, New York/NJ.',
    matches: 1,
    icon: '🏆',
  },
];

const FAQ = [
  {
    q: 'What is the World Cup 2026 bracket format?',
    a: 'The 2026 World Cup introduces a new 48-team format with 12 groups of 4. After the group stage, the top 2 from each group plus 8 best third-placed teams (32 teams total) enter the Round of 32 knockout bracket.',
  },
  {
    q: 'When does the World Cup 2026 knockout stage start?',
    a: 'The Round of 32 begins on 27 June 2026, approximately two weeks after the tournament opener on 11 June.',
  },
  {
    q: 'Where is the World Cup 2026 Final?',
    a: 'The Final takes place on 19 July 2026 at MetLife Stadium in East Rutherford, New Jersey — the largest stadium hosting the tournament with a capacity of 82,500.',
  },
  {
    q: 'Is there a third-place play-off at World Cup 2026?',
    a: 'Yes. The two semi-final losers play the third-place match on 18 July 2026, one day before the Final.',
  },
  {
    q: 'How does extra time work at World Cup 2026?',
    a: 'If a knockout match is tied after 90 minutes, 30 minutes of extra time are played (two 15-minute halves). If still level, a penalty shootout determines the winner.',
  },
];

export default async function WC2026BracketPage() {
  const vm = await buildKnockoutViewModel();

  const useLocalSlots = !vm.hasApiData;
  const localByStage = new Map(
    ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'].map(
      (round) => [round, WC_KNOCKOUT_SLOTS.filter((s) => s.round === round)]
    )
  );

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
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026 Bracket', item: CANONICAL },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026 Bracket' },
        ]} />
        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
            🏆 FIFA World Cup 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Bracket
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            The complete FIFA World Cup 2026 knockout bracket. 32 teams enter the Round of 32 on 27 June 2026.
            Follow every match from the last 32 through to the Final at MetLife Stadium, New York on 19 July 2026.
          </p>
        </div>

        <AdSlot slotId="wc-bracket-top" variant="banner" />

        {/* Knockout rounds overview */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Knockout Stage Rounds</h2>
          <div className="space-y-3">
            {KNOCKOUT_ROUNDS.map(({ label, dates, desc, matches, icon, stage }) => {
              const stageMatches = vm.byStage(stage);
              return (
                <div key={stage} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{icon}</span>
                      <div>
                        <p className="text-sm font-bold text-white">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{dates}</p>
                        <p className="text-xs text-gray-400 mt-1">{desc}</p>
                      </div>
                    </div>
                    <span className="shrink-0 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full">
                      {matches} match{matches !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  {/* Live matches from API */}
                  {stageMatches.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {stageMatches.slice(0, 4).map((m) => {
                        const h = m.score?.fullTime?.home;
                        const a = m.score?.fullTime?.away;
                        const score = h !== null && h !== undefined && a !== null && a !== undefined ? `${h}–${a}` : 'vs';
                        return (
                          <Link key={m.id} href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
                            className="flex items-center justify-between bg-gray-800/60 hover:bg-gray-800 rounded-lg px-3 py-2 text-xs transition-colors group">
                            <span className="text-gray-300 group-hover:text-white transition-colors">
                              {m.homeTeam?.shortName ?? m.homeTeam?.name} vs {m.awayTeam?.shortName ?? m.awayTeam?.name}
                            </span>
                            <span className="text-white font-bold font-mono">{score}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  {/* Local scheduled fixtures — shown when API is unavailable */}
                  {useLocalSlots && (localByStage.get(stage) ?? []).length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {(localByStage.get(stage) ?? []).slice(0, 4).map((s) => (
                        <div key={s.localId} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2 text-xs">
                          <span className="text-gray-400">
                            {s.homeLabel} vs {s.awayLabel}
                          </span>
                          <span className="text-gray-600 font-mono">
                            {new Date(s.utcDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Path to Final */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Path to the World Cup Final</h2>
          <div className="bg-gradient-to-br from-yellow-950/30 to-gray-900 border border-yellow-800/30 rounded-2xl p-5">
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              To lift the FIFA World Cup 2026, a team must win <strong className="text-white">7 consecutive matches</strong> — including potentially extra time and penalties in any of the knockout rounds.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              {['Group (3)', 'R32', 'R16', 'QF', 'SF', 'Final'].map((r, i) => (
                <span key={r} className="flex items-center gap-1.5">
                  <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/20 px-2 py-0.5 rounded-full">{r}</span>
                  {i < 5 && <span className="text-gray-600">→</span>}
                </span>
              ))}
            </div>
          </div>
        </section>

        <AdSlot slotId="wc-bracket-mid" variant="rectangle" className="mx-auto mb-8" />

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">World Cup 2026 Bracket — FAQ</h2>
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

        <AdSlot slotId="wc-bracket-bottom" variant="banner" />

        <NewsletterSignup
          source="wc-bracket"
          heading="Never miss a World Cup 2026 match"
          description="Free email alerts delivered straight to your inbox."
          features={['Match reminders', 'Live score alerts', 'World Cup predictions']}
        />

        <WCRelatedLinks links={[
          { href: '/world-cup-2026/bracket',        icon: '🔗', label: 'Interactive Bracket',   desc: 'Visual knockout bracket with live scores' },
          { href: '/world-cup-2026-results',        icon: '🏁', label: 'WC 2026 Results',       desc: 'All scores — live during matches, full-time after' },
          { href: '/world-cup-2026-schedule',       icon: '📅', label: 'WC 2026 Schedule',      desc: 'Full 104-match schedule with kickoff times' },
          { href: '/world-cup-2026-standings',      icon: '📊', label: 'Group Standings',       desc: 'Live tables for all 12 groups' },
          { href: '/world-cup-2026-groups',         icon: '🗂️', label: 'Group Stage',           desc: 'Group draws, fixtures and qualification rules' },
          { href: '/world-cup-2026-live-stream',    icon: '📡', label: 'Watch Live',            desc: 'Stream every match free or cheaply online' },
          { href: '/world-cup-2026/teams',          icon: '👥', label: 'All 48 Teams',          desc: 'Squads and stats for every WC nation' },
          { href: '/world-cup-2026/venues',         icon: '🏟️', label: 'WC Venues',           desc: '16 match stadiums across USA, Canada, Mexico' },
        ]} />
      </div>
    </>
  );
}
