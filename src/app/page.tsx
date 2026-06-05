import Link from 'next/link';

import {
  getTodayMatches,
  getWCLiveMatches,
  getWCKnockoutMatches,
  getStandings,
  getUpcomingMatches,
  getRecentMatches,
} from '@/lib/api';
import type { Match, StandingTable } from '@/lib/types';
import MatchCard from '@/components/MatchCard';
import WCGroupTable from '@/components/WCGroupTable';
import WCCountdown from '@/components/WCCountdown';
import { matchPath } from '@/lib/url';

export const revalidate = 30;

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

      <div className="relative px-6 py-8 sm:px-10 sm:py-10">
        {/* Tournament badge */}
        <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/25 rounded-full px-4 py-1.5 mb-5">
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
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-3">
          GoalRadar
        </h1>
        <p className="text-gray-300 text-base sm:text-lg mb-1 max-w-xl">
          {wcActive
            ? 'The FIFA World Cup 2026 is live. Follow every match.'
            : 'Your home for FIFA World Cup 2026 live scores, fixtures and standings.'}
        </p>
        <p className="text-gray-500 text-sm mb-7">
          USA · Canada · Mexico &nbsp;·&nbsp; 11 Jun – 19 Jul 2026 &nbsp;·&nbsp; 48 teams
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Primary */}
          <Link
            href="/world-cup-2026"
            className="bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black px-5 py-2.5 rounded-xl font-bold transition-colors text-sm flex items-center gap-2 shadow-lg shadow-yellow-500/20"
          >
            🏆 World Cup Hub
          </Link>

          {/* Secondary CTAs */}
          <Link
            href="/world-cup-2026"
            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700"
          >
            📅 WC Fixtures
          </Link>
          <Link
            href="/world-cup-2026#standings"
            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700"
          >
            📊 Group Standings
          </Link>
          <Link
            href="/world-cup-2026/bracket"
            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700"
          >
            🔗 Bracket
          </Link>

          {/* Live scores */}
          {liveCount > 0 && (
            <Link
              href="/live"
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm flex items-center gap-2"
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
                href={matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}
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
// Standard hero (non-WC mode)
// ---------------------------------------------------------------------------

function StandardHero() {
  return (
    <div className="relative bg-gradient-to-br from-green-950/60 to-gray-900 rounded-2xl p-8 border border-green-900/30 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(34,197,94,0.08),_transparent_60%)] pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">⚽</span>
          <h1 className="text-4xl font-black text-white tracking-tight">GoalRadar</h1>
        </div>
        <p className="text-gray-400 text-lg mb-6 max-w-xl">
          Live scores, standings, and schedules from Europe&apos;s top football leagues.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/live" className="bg-green-500 hover:bg-green-400 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Live Scores
          </Link>
          <Link href="/schedule"  className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700">Schedule</Link>
          <Link href="/standings" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-gray-700">Standings</Link>
          <Link href="/world-cup-2026" className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/30 px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm">
            🏆 World Cup 2026
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
    getTodayMatches(),
    wcActive ? getWCLiveMatches()       : Promise.resolve({ matches: [] as Match[] }),
    wcActive ? getStandings('WC')       : Promise.resolve({ standings: [] as StandingTable[], competition: { name: '', emblem: '' } }),
    wcActive ? getUpcomingMatches('WC') : Promise.resolve({ matches: [] as Match[], resultSet: { count: 0 } }),
    wcActive ? getRecentMatches('WC')   : Promise.resolve({ matches: [] as Match[] }),
    wcActive ? getWCKnockoutMatches()   : Promise.resolve({ matches: [] as Match[] }),
  ]);

  // ── Today's matches ────────────────────────────────────────────────────────
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

  return (
    <div className="space-y-10">

      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      {wcActive
        ? <WCHero liveCount={wcLive.length} wcActive={wcActive} />
        : <StandardHero />}

      {/* ── Countdown (shown before tournament starts, or live banner) ──── */}
      <WCCountdown />

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
              const groupSlug = (t.group ?? '').toLowerCase().replace('_', '-');
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
  );
}
