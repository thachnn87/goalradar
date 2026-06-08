/**
 * /world-cup-2026-results
 *
 * Programmatic SEO — targets: "world cup 2026 results" | "wc 2026 scores today" | "world cup scores 2026"
 * Unique angle vs /world-cup-2026/results: live-first + stat summary above the fold.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getRecentMatches, getWCLiveMatches } from '@/lib/api';
import type { Match } from '@/lib/types';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import { matchPath } from '@/lib/url';

export const revalidate = 900; // align with FIXTURES TTL (15 min)

const BASE_URL = 'https://goalradar.org';
const CANONICAL = `${BASE_URL}/world-cup-2026-results`;

export const metadata: Metadata = {
  title: 'World Cup 2026 Results — All Scores & Match Reports | GoalRadar',
  description:
    'All FIFA World Cup 2026 results and scores. Live updates during matches, full-time scores, goal scorers and match reports from every game of the tournament.',
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'World Cup 2026 Results | GoalRadar',
    description:
      'Live and final FIFA World Cup 2026 scores. All results from group stage through the Final.',
    type: 'website',
    url: CANONICAL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup 2026 Results | GoalRadar',
    description: 'All FIFA World Cup 2026 results and scores — live and full-time.',
  },
};

const FAQ = [
  {
    q: 'Where can I find World Cup 2026 results?',
    a: 'GoalRadar updates World Cup 2026 results in real time. Scores are refreshed every 60 seconds during live matches and immediately after full time.',
  },
  {
    q: 'How many goals have been scored at World Cup 2026?',
    a: 'GoalRadar tracks every goal scored at the 2026 World Cup. Check our live results page above for the running total across all matches played so far.',
  },
  {
    q: 'Are there VAR decisions at World Cup 2026?',
    a: 'Yes. FIFA is using VAR and semi-automated offside technology (SAOT) at World Cup 2026, continuing from the 2022 tournament in Qatar.',
  },
  {
    q: 'Which team has the best results at World Cup 2026?',
    a: 'Track every team\'s results and form on our Group Standings page. See wins, goals scored and goals against for all 48 nations.',
  },
  {
    q: 'How do I see all results from a specific group?',
    a: 'Visit our Groups page to see results filtered by group, or visit any team page for a full list of that team\'s results in the tournament.',
  },
];

function formatScore(m: Match): string {
  const home = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null;
  const away = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null;
  if (home === null || away === null) return 'vs';
  return `${home} – ${away}`;
}

function statusBadge(m: Match): { label: string; cls: string } {
  if (m.status === 'IN_PLAY' || m.status === 'PAUSED')
    return { label: 'LIVE', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (m.status === 'FINISHED')
    return { label: 'FT', cls: 'bg-gray-700 text-gray-300 border-gray-600' };
  return { label: m.status ?? '', cls: 'bg-gray-800 text-gray-500 border-gray-700' };
}

export default async function WC2026ResultsPage() {
  let results: Match[] = [];
  let live: Match[]    = [];

  // allSettled — each source fails independently so a live-data 403 does not
  // also wipe out the results list (and vice versa).
  const [rResult, lResult] = await Promise.allSettled([
    getRecentMatches('WC'),
    getWCLiveMatches(),
  ]);
  if (rResult.status === 'fulfilled') results = rResult.value.matches;
  if (lResult.status === 'fulfilled') live    = lResult.value.matches;

  // Deduplicate live matches from results
  const liveIds = new Set(live.map((m) => m.id));
  const finishedResults = results.filter((m) => !liveIds.has(m.id));

  // Statistics
  let totalGoals = 0, homeWins = 0, awayWins = 0, draws = 0;
  for (const m of finishedResults) {
    const h = m.score?.fullTime?.home ?? 0;
    const a = m.score?.fullTime?.away ?? 0;
    totalGoals += h + a;
    if (h > a) homeWins++;
    else if (a > h) awayWins++;
    else draws++;
  }
  const played = finishedResults.length + live.length;

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
      { '@type': 'ListItem', position: 1, name: 'Home',                 item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026 Results', item: CANONICAL },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026 Results' },
        ]} />
        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* Hero */}
        <div className="mt-6 mb-8">
          <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
            📊 FIFA World Cup 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            World Cup 2026 Results
          </h1>
          <p className="text-gray-400 text-sm">
            Live and full-time scores from every FIFA World Cup 2026 match. Updated every 60 seconds.
          </p>
        </div>

        {/* Stats strip */}
        {played > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Played',    value: played },
              { label: 'Goals',     value: totalGoals },
              { label: 'Avg Goals', value: played > 0 ? (totalGoals / played).toFixed(1) : '–' },
              { label: 'Live Now',  value: live.length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-white">{value}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        <AdSlot slotId="wc-results-top" variant="banner" />

        {/* Live matches */}
        {live.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <h2 className="text-lg font-bold text-white">Live Now</h2>
            </div>
            <div className="space-y-2">
              {live.map((m) => {
                const { label, cls } = statusBadge(m);
                return (
                  <Link key={m.id} href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
                    className="flex items-center justify-between bg-red-950/20 border border-red-900/30 hover:border-red-700/50 rounded-xl px-4 py-3 transition-colors group">
                    <span className="text-sm font-semibold text-white group-hover:text-red-300 transition-colors">
                      {m.homeTeam?.name} vs {m.awayTeam?.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold font-mono">{formatScore(m)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Finished results */}
        {finishedResults.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-4">Recent Results</h2>
            <div className="space-y-2">
              {finishedResults.slice(0, 30).map((m) => {
                const { label, cls } = statusBadge(m);
                const date = new Date(m.utcDate).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', timeZone: 'UTC',
                });
                return (
                  <Link key={m.id} href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
                    className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-yellow-700/30 rounded-xl px-4 py-3 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] text-gray-600 shrink-0 w-10">{date}</span>
                      <span className="text-sm font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">
                        {m.homeTeam?.name} vs {m.awayTeam?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white font-bold font-mono text-sm">{formatScore(m)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Link href="/world-cup-2026/results"
              className="inline-block mt-4 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
              View all results with stats →
            </Link>
          </section>
        )}

        {played === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center mb-8">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-300 font-semibold">No results yet</p>
            <p className="text-gray-500 text-sm mt-1">Check back after the first matches on 11 June 2026</p>
          </div>
        )}

        <AdSlot slotId="wc-results-mid" variant="rectangle" className="mx-auto mb-8" />

        {/* FAQ */}
        <section id="faq" className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">World Cup 2026 Results — FAQ</h2>
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

        <AdSlot slotId="wc-results-bottom" variant="banner" />

        <WCRelatedLinks links={[
          { href: '/world-cup-2026/results',        icon: '🏁', label: 'Live Results (API)',    desc: 'Real-time score updates with match cards' },
          { href: '/world-cup-2026-schedule',       icon: '📅', label: 'WC 2026 Schedule',      desc: 'All 104 matches with timezone converter' },
          { href: '/world-cup-2026-standings',      icon: '📊', label: 'Group Standings',       desc: 'Points tables updated after every result' },
          { href: '/world-cup-2026-groups',         icon: '🗂️', label: 'Group Stage',           desc: 'All 12 group draws and qualification rules' },
          { href: '/world-cup-2026-bracket',        icon: '🔗', label: 'Knockout Bracket',      desc: 'Follow the path from R32 to the Final' },
          { href: '/world-cup-2026-live-stream',    icon: '📡', label: 'Watch Live',            desc: 'Stream every match free or cheaply online' },
          { href: '/world-cup-2026-tv-guide',       icon: '📺', label: 'TV Channel Guide',      desc: 'What channel is World Cup 2026 on near you?' },
          { href: '/world-cup-2026/teams/argentina',icon: '👥', label: 'All 48 Teams',          desc: 'Squads, form and stats for every WC nation' },
        ]} />
      </div>
    </>
  );
}
