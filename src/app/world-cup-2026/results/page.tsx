/**
 * /world-cup-2026/results — DATA-18E: authority cache single source of truth.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getWCAuthorityMatchesV2 } from '@/lib/api';
import { getLiveMatchIdSet } from '@/lib/wc-live-ssot';
import { canonicalToMatch, type CanonicalMatch } from '@/lib/canonical-match';
import { deriveMatchDisplay } from '@/lib/match-display';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import { matchPath } from '@/lib/url';

export const revalidate = 300;

const BASE_URL  = 'https://goalradar.org';
const CANONICAL = `${BASE_URL}/world-cup-2026/results`;

export const metadata: Metadata = {
  title: 'World Cup 2026 Results — Live & Full-Time Scores | GoalRadar',
  description:
    'All FIFA World Cup 2026 results with real-time score updates. Full-time scores, goal scorers and match reports from every game.',
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: 'World Cup 2026 Results | GoalRadar',
    description: 'Live and final FIFA World Cup 2026 scores. All group stage through Final results.',
    type: 'website',
    url: CANONICAL,
  },
};

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function formatScore(e: CanonicalMatch): string {
  const d = deriveMatchDisplay(canonicalToMatch(e));
  if (d.homeScore === null || d.awayScore === null) return 'vs';
  return `${d.homeScore} – ${d.awayScore}`;
}

function statusBadge(e: CanonicalMatch): { label: string; cls: string } {
  if (e.state === 'live')
    return {
      label: e.minute != null ? `${e.minute}'` : 'LIVE',
      cls: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
  if (e.state === 'finished')
    return { label: 'FT', cls: 'bg-gray-700 text-gray-300 border-gray-600' };
  return { label: e.state, cls: 'bg-gray-800 text-gray-500 border-gray-700' };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WC2026ResultsPage() {
  const builtAt = new Date().toISOString();

  const [{ matches }, liveMatchIds] = await Promise.all([
    getWCAuthorityMatchesV2(builtAt, { source: '/world-cup-2026/results', sourceType: 'page' }).catch(() => ({ matches: [] as CanonicalMatch[] })),
    getLiveMatchIdSet().catch(() => new Set<number>()),
  ]);

  // DATA-18B.3E: live is decided ONLY by the live SSOT (liveMatchIds), never by
  // authority `state`. A match the authority cache still marks 'live' but that
  // the SSOT no longer lists has ended → render as finished.
  const entries: CanonicalMatch[] = matches.map((m) => ({
    ...m,
    state: (liveMatchIds.has(m.id)
      ? 'live'
      : m.state === 'live'
        ? 'finished'
        : m.state) as CanonicalMatch['state'],
  }));

  const live     = entries.filter((e) => e.state === 'live');
  const finished = entries
    .filter((e) => e.state === 'finished')
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime());

  // Statistics
  let totalGoals = 0, homeWins = 0, awayWins = 0, draws = 0;
  for (const e of finished) {
    const d = deriveMatchDisplay(canonicalToMatch(e));
    const h = d.homeScore ?? 0;
    const a = d.awayScore ?? 0;
    totalGoals += h + a;
    if (h > a) homeWins++;
    else if (a > h) awayWins++;
    else draws++;
  }
  const played = finished.length + live.length;

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',                  item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',        item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'World Cup 2026 Results', item: CANONICAL },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-3xl mx-auto pb-16">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Results' },
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
            Live and full-time scores from every FIFA World Cup 2026 match. Updated every 5 minutes.
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

        <AdSlot slotId="wc-results-live-top" variant="banner" />

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
              {live.map((e) => {
                const { label, cls } = statusBadge(e);
                return (
                  <Link key={e.id} href={matchPath(e.id, e.homeTeam.name, e.awayTeam.name)} prefetch={true}
                    className="flex items-center justify-between bg-red-950/20 border border-red-900/30 hover:border-red-700/50 rounded-xl px-4 py-3 transition-colors group">
                    <span className="text-sm font-semibold text-white group-hover:text-red-300 transition-colors">
                      {e.homeTeam.name} vs {e.awayTeam.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold font-mono">{formatScore(e)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Finished results */}
        {finished.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-4">Results</h2>
            <div className="space-y-2">
              {finished.slice(0, 40).map((e) => {
                const { label, cls } = statusBadge(e);
                const date = new Date(e.utcDate).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', timeZone: 'UTC',
                });
                return (
                  <Link key={e.id} href={matchPath(e.id, e.homeTeam.name, e.awayTeam.name)} prefetch={true}
                    className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-yellow-700/30 rounded-xl px-4 py-3 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] text-gray-600 shrink-0 w-10">{date}</span>
                      <span className="text-sm font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">
                        {e.homeTeam.name} vs {e.awayTeam.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white font-bold font-mono text-sm">{formatScore(e)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {played === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center mb-8">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-300 font-semibold">No results yet</p>
            <p className="text-gray-500 text-sm mt-1">Check back after the first matches kick off</p>
          </div>
        )}

        <AdSlot slotId="wc-results-live-bottom" variant="banner" />

        <WCRelatedLinks links={[
          { href: '/world-cup-2026-results',         icon: '🏁', label: 'Results Summary',    desc: 'Live-first results with tournament stats' },
          { href: '/world-cup-2026/fixtures',        icon: '📅', label: 'Upcoming Fixtures',  desc: 'All remaining matches with kick-off times' },
          { href: '/world-cup-2026',                 icon: '🌍', label: 'WC 2026 Hub',        desc: 'Tournament overview and standings' },
          { href: '/world-cup-2026/groups',          icon: '🗂️', label: 'Group Stage',        desc: 'All 12 group draws and match schedules' },
        ]} />
      </div>
    </>
  );
}
