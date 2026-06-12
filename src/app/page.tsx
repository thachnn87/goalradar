import type { Metadata } from 'next';
import Link from 'next/link';

// PERF-4.5: use page-safe *Cached variants — zero provider calls during page render.
import {
  getTodayMatchesCached,
  getWCLiveMatchesCached,
  getWCKnockoutMatchesCached,
  getStandingsCached,
  getUpcomingMatchesCached,
  getRecentMatchesCached,
} from '@/lib/api';
import type { Match, StandingTable } from '@/lib/types';
import MatchCard from '@/components/MatchCard';
import WCGroupTable from '@/components/WCGroupTable';
import WCCountdown from '@/components/WCCountdown';
import { matchPath } from '@/lib/url';
import AdSlot from '@/components/AdSlot';
import WCCountdownBanner from '@/components/WCCountdownBanner';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'GoalRadar — Live Football Scores, World Cup 2026 & Match Schedules',
  description:
    'GoalRadar delivers live football scores, World Cup 2026 fixtures, results, standings and streaming guides. Follow every match in real time — from group stage to the FIFA World Cup 2026 Final.',
  alternates: { canonical: 'https://goalradar.org' },
  openGraph: {
    title: 'GoalRadar — Live Football Scores & World Cup 2026',
    description:
      'Live scores, World Cup 2026 fixtures, group standings, streaming guides and match schedules. Your home for football in 2026.',
    type: 'website',
    url: 'https://goalradar.org',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GoalRadar — Live Football Scores & World Cup 2026',
    description:
      'Live football scores, World Cup 2026 fixtures, standings and streaming guides.',
  },
};

const WC_START = '2026-06-11';
const WC_END   = '2026-07-19';
const TOTAL_WC_MATCHES = 104;

function isWCActive(today: string) {
  return today >= WC_START && today <= WC_END;
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function SectionHeader({
  id, title, href, hrefLabel = 'View all →',
}: {
  id?: string; title: string; href?: string; hrefLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 id={id} className="text-xl font-bold text-white">{title}</h2>
      {href && (
        <Link href={href} className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors shrink-0 font-medium">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

function MatchGrid({ matches, cols = 3 }: { matches: Match[]; cols?: 2 | 3 }) {
  const colClass = cols === 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid ${colClass} gap-4`}>
      {matches.map((m) => <MatchCard key={m.id} match={m} />)}
    </div>
  );
}

function EmptyState({ icon = '📅', message, sub, href, hrefLabel }: {
  icon?: string; message: string; sub?: string; href?: string; hrefLabel?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-gray-400 font-medium text-sm">{message}</p>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
      {href && hrefLabel && (
        <Link href={href} className="inline-block mt-3 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. World Cup Hero
// ---------------------------------------------------------------------------

function WCHero({ liveCount, wcActive }: { liveCount: number; wcActive: boolean }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-yellow-700/30">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-950/70 via-gray-900 to-gray-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_left,_rgba(234,179,8,0.12),_transparent)]" />

      {/* UI-2: mobile = tight padding; tablet = minor reduction; desktop (lg) unchanged */}
      <div className="relative px-4 py-4 md:px-6 md:py-8 lg:px-10 lg:py-10">
        {/* Tournament badge */}
        <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/25 rounded-full px-4 py-1.5 mb-3 md:mb-5">
          <span className="text-sm">🏆</span>
          <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">
            FIFA World Cup 2026
          </span>
          {liveCount > 0 && (
            <span className="flex items-center gap-1 ml-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-red-400 text-xs font-bold">{liveCount} LIVE</span>
            </span>
          )}
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-2 md:mb-3">
          GoalRadar
        </h1>
        {/* UI-2: descriptive copy hidden on mobile — content surfaces sooner */}
        <p className="hidden md:block text-gray-300 text-base sm:text-lg mb-1 max-w-xl">
          {wcActive
            ? 'The FIFA World Cup 2026 is live. Follow every match.'
            : 'Your home for FIFA World Cup 2026 live scores, fixtures and standings.'}
        </p>
        <p className="hidden md:block text-gray-500 text-sm mb-7">
          USA · Canada · Mexico &nbsp;·&nbsp; 11 Jun – 19 Jul 2026 &nbsp;·&nbsp; 48 teams
        </p>

        {/* CTA buttons — 2×2 grid on mobile, original flex row at md+ */}
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3 mt-3 md:mt-0">
          {/* Primary */}
          <Link
            href="/world-cup-2026"
            className="bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-bold transition-colors text-sm flex items-center justify-center md:justify-start gap-2 shadow-lg shadow-yellow-500/20 whitespace-nowrap"
          >
            🏆 <span className="hidden md:inline">World Cup Hub</span><span className="md:hidden">WC26</span>
          </Link>

          {/* Secondary CTAs */}
          <Link
            href="/world-cup-2026"
            className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700 text-center md:text-left whitespace-nowrap"
          >
            📅 <span className="hidden md:inline">WC Fixtures</span><span className="md:hidden">Schedule</span>
          </Link>
          <Link
            href="/world-cup-2026#standings"
            className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700 text-center md:text-left whitespace-nowrap"
          >
            📊 <span className="hidden md:inline">Group </span>Standings
          </Link>
          <Link
            href={liveCount > 0 ? '/live' : '/world-cup-2026/bracket'}
            className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700 text-center md:text-left whitespace-nowrap md:hidden"
          >
            {liveCount > 0 ? `🔴 ${liveCount} Live` : '🔗 Bracket'}
          </Link>
          <Link
            href="/world-cup-2026/bracket"
            className="hidden md:block bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700"
          >
            🔗 Bracket
          </Link>

          {/* Live scores */}
          {liveCount > 0 && (
            <Link
              href="/live"
              className="hidden md:flex bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm items-center gap-2"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              {liveCount} Live Now
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Live pulse header
// ---------------------------------------------------------------------------

function LiveHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <h2 className="text-xl font-bold text-red-400">
        Live World Cup Matches
        <span className="ml-2 text-sm text-red-500/70 font-normal">({count})</span>
      </h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Knockout bracket preview
// ---------------------------------------------------------------------------

function BracketPreview({ matches }: { matches: Match[] }) {
  const KNOCKOUT = new Set(['LAST_32','LAST_16','QUARTER_FINALS','SEMI_FINALS','THIRD_PLACE','FINAL']);
  const knockout = matches.filter((m) => KNOCKOUT.has(m.stage));

  // Show Final + SF + most-advanced played round
  const finalMatch    = knockout.find((m) => m.stage === 'FINAL');
  const sfMatches     = knockout.filter((m) => m.stage === 'SEMI_FINALS');
  const qfMatches     = knockout.filter((m) => m.stage === 'QUARTER_FINALS').slice(0, 4);
  const r16Matches    = knockout.filter((m) => m.stage === 'LAST_16').slice(0, 4);
  const r32Matches    = knockout.filter((m) => m.stage === 'LAST_32').slice(0, 4);

  const previewMatches = [
    ...sfMatches,
    ...qfMatches,
    ...r16Matches,
    ...r32Matches,
  ].slice(0, 4);

  const hasData = finalMatch || sfMatches.length > 0 || qfMatches.length > 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <h3 className="text-sm font-bold text-white">Knockout Bracket</h3>
        </div>
        <Link href="/world-cup-2026/bracket" className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium">
          Full bracket →
        </Link>
      </div>

      {finalMatch && (
        <div className="px-5 py-3 border-b border-gray-800 bg-yellow-950/20">
          <p className="text-xs text-yellow-600 uppercase tracking-wider mb-2 font-semibold">🏆 The Final</p>
          <MatchCard match={finalMatch} />
        </div>
      )}

      {previewMatches.length > 0 ? (
        <div className="divide-y divide-gray-800">
          {previewMatches.map((m) => {
            const hn = m.homeTeam?.shortName || m.homeTeam?.name || 'TBD';
            const an = m.awayTeam?.shortName || m.awayTeam?.name || 'TBD';
            const showScore = ['FINISHED','IN_PLAY','PAUSED'].includes(m.status);
            const roundLabel = m.stage === 'SEMI_FINALS' ? 'SF'
              : m.stage === 'QUARTER_FINALS' ? 'QF'
              : m.stage === 'LAST_16' ? 'R16'
              : 'R32';
            return (
              <Link
                key={m.id}
                href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)} prefetch={true}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-gray-700 text-xs w-8 shrink-0 font-mono">{roundLabel}</span>
                <span className="flex-1 text-gray-300 text-sm truncate">{hn}</span>
                <span className="text-white font-bold tabular-nums text-sm shrink-0 mx-2">
                  {showScore ? `${m.score.fullTime.home ?? 0}–${m.score.fullTime.away ?? 0}` : 'vs'}
                </span>
                <span className="flex-1 text-gray-300 text-sm truncate text-right">{an}</span>
              </Link>
            );
          })}
        </div>
      ) : !hasData ? (
        <div className="px-5 py-8 text-center text-gray-600 text-sm">
          Knockout stage begins 28 June 2026
        </div>
      ) : null}

      <div className="px-5 py-3 border-t border-gray-800">
        <Link
          href="/world-cup-2026/bracket"
          className="flex items-center justify-center gap-2 text-sm text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
        >
          View full bracket with all {TOTAL_WC_MATCHES} matches →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. World Cup statistics
// ---------------------------------------------------------------------------

function WCStats({ results, upcomingCount }: { results: Match[]; upcomingCount: number }) {
  const played  = results.length;
  const total   = TOTAL_WC_MATCHES;
  const goals   = results.reduce(
    (s, m) => s + (m.score.fullTime.home ?? 0) + (m.score.fullTime.away ?? 0), 0
  );
  const gpm       = played > 0 ? (goals / played).toFixed(1) : '–';
  const homeWins  = results.filter((m) => m.score.winner === 'HOME_TEAM').length;
  const draws     = results.filter((m) => m.score.winner === 'DRAW').length;
  const awayWins  = results.filter((m) => m.score.winner === 'AWAY_TEAM').length;
  const cleanSheets = results.filter(
    (m) => (m.score.fullTime.home ?? 1) === 0 || (m.score.fullTime.away ?? 1) === 0
  ).length;
  const pct = Math.round((played / total) * 100);

  const statCards = [
    { label: 'Matches Played',  value: String(played),   sub: `of ${total}` },
    { label: 'Total Goals',     value: String(goals),    sub: `${gpm} per match` },
    { label: 'Home Wins',       value: String(homeWins), sub: 'home advantage' },
    { label: 'Draws',           value: String(draws),    sub: 'shared points' },
    { label: 'Away Wins',       value: String(awayWins), sub: 'on the road' },
    { label: 'Clean Sheets',    value: String(cleanSheets), sub: 'shutouts' },
  ];

  if (played === 0) return null;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-medium">Tournament Progress</span>
          <span className="text-xs text-gray-500">{played}/{total} matches played</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-1.5">{upcomingCount} matches remaining</p>
      </div>

      {/* Stat grid */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map(({ label, value, sub }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <dt className="text-xs text-gray-500 mb-1">{label}</dt>
            <dd className="text-2xl font-black text-white">{value}</dd>
            <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evergreen SEO content — always SSR-rendered, no API dependency
//
// Provides meaningful body text for Googlebot regardless of API state or
// tournament phase. Sits directly below the hero so it is in the first
// screenful of content that crawlers see.
// ---------------------------------------------------------------------------

function HomepageEvergreen() {
  return (
    <section
      aria-label="About GoalRadar — FIFA World Cup 2026 coverage"
      className="rounded-2xl border border-gray-800 bg-gray-900 px-6 py-8 sm:px-10"
    >
      {/* ── Main heading ─────────────────────────────────────────── */}
      <h2 className="text-2xl font-black text-white mb-2">
        FIFA World Cup 2026 — Live Scores, Fixtures &amp; Standings
      </h2>
      <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-3xl">
        GoalRadar is your home for the <strong className="text-gray-200">2026 FIFA World Cup</strong> — the
        largest football tournament in history. 48 national teams, 104 matches, 16 host cities across the
        United States, Canada, and Mexico. Follow every game from the{' '}
        <strong className="text-gray-200">opening match on 11 June 2026</strong> to the{' '}
        <strong className="text-gray-200">Final at MetLife Stadium on 19 July 2026</strong>.
      </p>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">

        {/* ── Col 1: Live scores ──────────────────────────────────── */}
        <div>
          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <span className="text-red-400">●</span> Live Scores &amp; Match Updates
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-3">
            Track every World Cup match as it happens — scorelines, goal scorers, minute-by-minute
            status, extra time, and penalty shootouts. During the group stage up to eight matches
            run simultaneously; the{' '}
            <a href="/live" className="text-yellow-500 hover:text-yellow-300 transition-colors underline-offset-2 hover:underline">
              live scores dashboard
            </a>{' '}
            keeps them all visible at a glance.
          </p>
          <ul className="space-y-1.5 text-sm text-gray-500">
            {[
              'Real-time scorelines with goal times',
              'Status: KO · HT · FT · AET · Pens',
              'All 104 World Cup 2026 matches',
              'Premier League, La Liga, Bundesliga &amp; more',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-yellow-600 shrink-0 mt-0.5">›</span>
                <span dangerouslySetInnerHTML={{ __html: item }} />
              </li>
            ))}
          </ul>
        </div>

        {/* ── Col 2: Standings ────────────────────────────────────── */}
        <div>
          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <span className="text-yellow-500">▲</span> Group Standings &amp; Bracket
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-3">
            The 2026 World Cup group stage features <strong className="text-gray-400">12 groups</strong> (A–L),
            each with four teams. The top two from each group advance to the round of 32. GoalRadar&apos;s{' '}
            <a href="/standings" className="text-yellow-500 hover:text-yellow-300 transition-colors underline-offset-2 hover:underline">
              standings tables
            </a>{' '}
            show points, goal difference, and qualification status updated live after every match.
          </p>
          <ul className="space-y-1.5 text-sm text-gray-500">
            {[
              'Groups A–L · 48 qualified nations',
              'Points, GD, GF, GA after every match',
              'Advancement indicators per group',
              'Knockout bracket: R32 → R16 → QF → SF → Final',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-yellow-600 shrink-0 mt-0.5">›</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Col 3: Fixtures & schedule ──────────────────────────── */}
        <div>
          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <span className="text-blue-400">📅</span> Fixtures &amp; Match Schedule
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-3">
            Every World Cup 2026 fixture listed with kick-off times, venue, and stage. The{' '}
            <a href="/schedule" className="text-yellow-500 hover:text-yellow-300 transition-colors underline-offset-2 hover:underline">
              full schedule
            </a>{' '}
            covers all 104 matches across 16 stadiums — MetLife Stadium, SoFi Stadium,
            AT&amp;T Stadium, Estadio Azteca, and twelve more venues.
          </p>
          <ul className="space-y-1.5 text-sm text-gray-500">
            {[
              'All 104 matches · group stage through Final',
              'Kick-off times: ET · BST · CET · JST',
              '16 venues across USA, Canada & Mexico',
              'Filter by group, stage, and team',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-yellow-600 shrink-0 mt-0.5">›</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Bottom strip: tournament context + additional links ─── */}
      <div className="mt-8 pt-6 border-t border-gray-800">
        <h3 className="text-sm font-bold text-white mb-3">
          Complete Football Coverage
        </h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-4 max-w-3xl">
          Beyond the World Cup, GoalRadar covers Europe&apos;s top club competitions year-round —
          the Premier League, La Liga, Bundesliga, Serie A, Ligue 1, and the UEFA Champions League.
          Live scores, standings tables, fixtures, and results for every tracked competition are
          available on a single platform, updated in real time throughout the season.
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { href: '/world-cup-2026', label: '🏆 World Cup 2026 Hub' },
            { href: '/live',           label: '● Live Scores'          },
            { href: '/schedule',       label: '📅 Match Schedule'      },
            { href: '/standings',      label: '📊 League Standings'    },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Standard hero (non-WC mode)
// ---------------------------------------------------------------------------

function StandardHero() {
  // UI-2: mobile (<768px) = compact — no paragraph, 2×2 CTA grid, tight padding.
  // Tablet (768–1024px) = minor spacing reduction. Desktop (≥1024px) unchanged.
  return (
    <div className="relative bg-gradient-to-br from-green-950/60 to-gray-900 rounded-2xl p-4 md:p-6 lg:p-8 border border-green-900/30 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(34,197,94,0.08),_transparent_60%)] pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-3 md:mb-2">
          <span className="text-3xl md:text-4xl">⚽</span>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">GoalRadar</h1>
        </div>
        <p className="hidden md:block text-gray-400 text-lg mb-6 max-w-xl">
          Live scores, standings, and schedules from Europe&apos;s top football leagues.
        </p>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3">
          <Link href="/live" className="bg-green-500 hover:bg-green-400 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center md:justify-start gap-2 text-sm whitespace-nowrap">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Live<span className="hidden md:inline">&nbsp;Scores</span>
          </Link>
          <Link href="/schedule"  className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700 text-center md:text-left whitespace-nowrap">Schedule</Link>
          <Link href="/standings" className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700 text-center md:text-left whitespace-nowrap">Standings</Link>
          <Link href="/world-cup-2026" className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/30 px-3 py-2 md:px-5 md:py-2.5 rounded-xl font-semibold transition-colors text-sm text-center md:text-left whitespace-nowrap">
            🏆 <span className="hidden md:inline">World Cup 2026</span><span className="md:hidden">WC26</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HomePage() {
  const today   = new Date().toISOString().split('T')[0];
  const wcActive = isWCActive(today);

  // All 6 fetches in parallel — WC-specific ones resolve empty when inactive
  const [
    todayResult,
    wcLiveResult,
    wcStandingsResult,
    wcUpcomingResult,
    wcRecentResult,
    wcKnockoutResult,
  ] = await Promise.allSettled([
    getTodayMatchesCached(),
    wcActive ? getWCLiveMatchesCached()       : Promise.resolve({ matches: [] as Match[] }),
    wcActive ? getStandingsCached('WC')       : Promise.resolve({ standings: [] as StandingTable[], competition: { name: '', emblem: '' } }),
    wcActive ? getUpcomingMatchesCached('WC') : Promise.resolve({ matches: [] as Match[], resultSet: { count: 0 } }),
    wcActive ? getRecentMatchesCached('WC')   : Promise.resolve({ matches: [] as Match[] }),
    wcActive ? getWCKnockoutMatchesCached()   : Promise.resolve({ matches: [] as Match[] }),
  ]);

  // ── Today's matches ────────────────────────────────────────────────────────
  // DATA-2: lists are snapshot-overlaid inside the *Cached functions
  const todayError = todayResult.status === 'rejected';
  const allToday: Match[] = todayResult.status === 'fulfilled' ? todayResult.value.matches : [];
  const wcToday   = allToday.filter((m) => m.competition.code === 'WC' && !['IN_PLAY','PAUSED'].includes(m.status));
  const otherToday = allToday.filter((m) => m.competition.code !== 'WC');

  // ── Live WC matches ────────────────────────────────────────────────────────
  const wcLive: Match[] = wcLiveResult.status === 'fulfilled' ? wcLiveResult.value.matches : [];

  // ── WC upcoming ────────────────────────────────────────────────────────────
  const wcUpcoming: Match[] =
    wcUpcomingResult.status === 'fulfilled'
      ? [...wcUpcomingResult.value.matches]
          .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
          .slice(0, 6)
      : [];

  // ── WC recent results ─────────────────────────────────────────────────────
  const wcResults: Match[] =
    wcRecentResult.status === 'fulfilled'
      ? [...wcRecentResult.value.matches]
          .filter((m) => m.status === 'FINISHED')
          .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
          .slice(0, 6)
      : [];

  // ── WC group standings ────────────────────────────────────────────────────
  const allGroupTables: StandingTable[] =
    wcStandingsResult.status === 'fulfilled'
      ? wcStandingsResult.value.standings.filter((s) => s.type === 'TOTAL')
      : [];
  const activeGroupTables = allGroupTables.filter((t) => t.table.some((e) => e.playedGames > 0));
  const showStandings = wcActive && activeGroupTables.length > 0;

  // ── WC knockout matches ───────────────────────────────────────────────────
  const wcKnockout: Match[] =
    wcKnockoutResult.status === 'fulfilled' ? wcKnockoutResult.value.matches : [];

  const upcomingCount =
    wcUpcomingResult.status === 'fulfilled' ? wcUpcomingResult.value.matches.length : 0;

  const jsonLdWebSite = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GoalRadar',
    url: 'https://goalradar.org',
    description: 'Live football scores, World Cup 2026 fixtures, group standings, streaming guides and match schedules.',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://goalradar.org/schedule',
      'query-input': 'required name=search_term_string',
    },
  };

  const jsonLdSportsEvent = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: 'FIFA World Cup 2026',
    startDate: '2026-06-11',
    endDate: '2026-07-19',
    location: {
      '@type': 'Place',
      name: 'USA, Canada & Mexico',
    },
    organizer: {
      '@type': 'SportsOrganization',
      name: 'FIFA',
      url: 'https://www.fifa.com',
    },
    url: 'https://goalradar.org/world-cup-2026',
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebSite) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSportsEvent) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://goalradar.org' }],
    }) }} />
    {/* UI-2: tighter block spacing on mobile/tablet; desktop unchanged */}
    <div className="space-y-5 md:space-y-8 lg:space-y-10">

      {/* ── Countdown banner — sits above everything, slim strip ─────────── */}
      <WCCountdownBanner />

      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      {wcActive
        ? <WCHero liveCount={wcLive.length} wcActive={wcActive} />
        : <StandardHero />}

      {/* Ad: below hero — banner */}
      <AdSlot slotId="homepage-top" variant="banner" className="my-2" />

      {/* ── Evergreen SEO content ─────────────────────────────────────────
           Always SSR-rendered. No API dependency. Ensures meaningful body
           text is present for Googlebot regardless of API state or whether
           the World Cup is currently active.                               */}
      <HomepageEvergreen />

      {/* ── 2. Today's World Cup Matches ─────────────────────────────────── */}
      {wcActive && (
        <section aria-labelledby="wc-today-h">
          <SectionHeader id="wc-today-h" title="📅 Today's World Cup Matches" href="/world-cup-2026" hrefLabel="Full hub →" />
          {wcToday.length > 0 ? (
            <MatchGrid matches={wcToday} />
          ) : wcLive.length === 0 ? (
            <EmptyState
              icon="📅"
              message="No World Cup matches today"
              sub="Check upcoming fixtures below"
              href="/world-cup-2026"
              hrefLabel="View upcoming fixtures →"
            />
          ) : null}
        </section>
      )}

      {/* ── 3. Live World Cup Matches ─────────────────────────────────────── */}
      {wcActive && wcLive.length > 0 && (
        <section aria-labelledby="wc-live-h">
          <LiveHeader count={wcLive.length} />
          <MatchGrid matches={wcLive} />
        </section>
      )}

      {/* ── 4. Upcoming WC Fixtures ───────────────────────────────────────── */}
      {wcActive && (
        <section aria-labelledby="wc-upcoming-h">
          <SectionHeader id="wc-upcoming-h" title="🗓 Upcoming World Cup Fixtures" href="/world-cup-2026" hrefLabel="All fixtures →" />
          {wcUpcoming.length > 0 ? (
            <MatchGrid matches={wcUpcoming} />
          ) : (
            <EmptyState
              icon="🗓"
              message="No upcoming fixtures"
              sub="Fixtures will appear once the schedule is confirmed"
            />
          )}
        </section>
      )}

      {/* ── 5. Group Standings ────────────────────────────────────────────── */}
      {showStandings && (
        <section aria-labelledby="wc-standings-h">
          <SectionHeader
            id="wc-standings-h"
            title="📊 World Cup Group Standings"
            href="/world-cup-2026"
            hrefLabel="All groups →"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGroupTables.map((t) => {
              const groupSlug = (t.group ?? '').toLowerCase().replace(/[\s_]+/g, '-');
              return (
                <WCGroupTable
                  key={t.group ?? t.stage}
                  group={t.group ?? t.stage}
                  table={t.table}
                  href={groupSlug ? `/world-cup-2026/${groupSlug}` : undefined}
                />
              );
            })}
          </div>
          <p className="text-xs text-gray-600 mt-3 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0" />
            Advances to knockout stage
          </p>
        </section>
      )}

      {/* ── 6. Knockout Bracket ───────────────────────────────────────────── */}
      {wcActive && (
        <section aria-labelledby="wc-bracket-h">
          <SectionHeader
            id="wc-bracket-h"
            title="🔗 Knockout Bracket"
            href="/world-cup-2026/bracket"
            hrefLabel="Full bracket →"
          />
          <BracketPreview matches={wcKnockout} />
        </section>
      )}

      {/* ── 7. Latest WC Results ──────────────────────────────────────────── */}
      {wcActive && wcResults.length > 0 && (
        <section aria-labelledby="wc-results-h">
          <SectionHeader
            id="wc-results-h"
            title="🏁 Latest World Cup Results"
            href="/world-cup-2026"
            hrefLabel="All results →"
          />
          <MatchGrid matches={wcResults} />
        </section>
      )}

      {/* ── 8. World Cup Statistics ───────────────────────────────────────── */}
      {wcActive && wcResults.length > 0 && (
        <section aria-labelledby="wc-stats-h">
          <SectionHeader id="wc-stats-h" title="📈 World Cup Statistics" />
          <WCStats results={wcResults} upcomingCount={upcomingCount} />
        </section>
      )}

      {/* Ad: between WC sections and other leagues — rectangle */}
      <AdSlot slotId="homepage-mid" variant="rectangle" className="mx-auto" />

      {/* ── Other leagues divider ─────────────────────────────────────────── */}
      {wcActive && (
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600 font-medium uppercase tracking-wider shrink-0">
            Other Leagues
          </span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>
      )}

      {/* ── Today's Matches — Other Leagues ──────────────────────────────── */}
      <section aria-labelledby="today-h">
        <SectionHeader
          id="today-h"
          title={wcActive ? "Today's Matches — Other Leagues" : "Today's Matches"}
        />
        {todayError ? (
          <div className="bg-gray-900 border border-red-900/40 rounded-xl p-6 text-center text-gray-500 text-sm">
            Match data is temporarily unavailable. Please try again later.
          </div>
        ) : otherToday.length > 0 ? (
          <MatchGrid matches={otherToday} />
        ) : (
          <EmptyState
            icon="📅"
            message={wcActive ? 'No other league matches today.' : 'No matches scheduled for today.'}
            sub={wcActive ? 'All the action today is in the World Cup.' : undefined}
          />
        )}
      </section>

    </div>
    </>
  );
}
