import Link from 'next/link';

import {
  getTodayMatches,
  getWCLiveMatches,
  getStandings,
} from '@/lib/api';
import type { Match, StandingTable } from '@/lib/types';
import MatchCard from '@/components/MatchCard';
import WCGroupTable from '@/components/WCGroupTable';

export const revalidate = 30;

// World Cup 2026 date window
const WC_START = '2026-06-11';
const WC_END   = '2026-07-19';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isWCActive(today: string) {
  return today >= WC_START && today <= WC_END;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-white mb-4">{children}</h2>;
}

function MatchGrid({ matches }: { matches: Match[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {matches.map((m) => <MatchCard key={m.id} match={m} />)}
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      <div className="text-3xl mb-2">📅</div>
      <p className="text-gray-400 font-medium">No matches scheduled for today</p>
    </div>
  );
}

function ErrorBanner() {
  return (
    <div className="bg-gray-900 border border-red-900/40 rounded-xl p-6 text-center text-gray-500">
      Match data is temporarily unavailable. Please try again later.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HomePage() {
  const today = new Date().toISOString().split('T')[0];
  const wcActive = isWCActive(today);

  // Fetch in parallel — WC calls skipped (resolve empty) when not active
  const [todayResult, wcLiveResult, wcStandingsResult] = await Promise.allSettled([
    getTodayMatches(),
    wcActive ? getWCLiveMatches() : Promise.resolve({ matches: [] as Match[] }),
    wcActive
      ? getStandings('WC')
      : Promise.resolve({ standings: [] as StandingTable[], competition: { name: '', emblem: '' } }),
  ]);

  const todayError = todayResult.status === 'rejected';
  const allToday: Match[] = todayResult.status === 'fulfilled' ? todayResult.value.matches : [];

  // Split today's matches: WC vs other leagues
  const wcToday = allToday.filter(
    (m) =>
      m.competition.code === 'WC' &&
      !['IN_PLAY', 'PAUSED'].includes(m.status) // live handled separately
  );
  const otherToday = allToday.filter((m) => m.competition.code !== 'WC');

  // Live WC matches
  const wcLive: Match[] =
    wcLiveResult.status === 'fulfilled' ? wcLiveResult.value.matches : [];

  // WC group standings — only show groups where at least one game has been played
  const allGroupTables: StandingTable[] =
    wcStandingsResult.status === 'fulfilled'
      ? wcStandingsResult.value.standings.filter((s) => s.type === 'TOTAL')
      : [];
  const activeGroupTables = allGroupTables.filter((t) =>
    t.table.some((e) => e.playedGames > 0)
  );

  const showWCStandings = wcActive && activeGroupTables.length > 0;

  return (
    <div className="space-y-10">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      {wcActive ? (
        // World Cup active hero
        <div className="relative bg-gradient-to-br from-yellow-950/40 via-gray-900 to-gray-900 rounded-2xl p-8 border border-yellow-800/30 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(234,179,8,0.08)_0%,_transparent_60%)] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">🏆</span>
              <h1 className="text-4xl font-black text-white tracking-tight">GoalRadar</h1>
            </div>
            <p className="text-gray-400 text-lg mb-1 max-w-xl">
              FIFA World Cup 2026 is live.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              United States · Canada · Mexico &nbsp;|&nbsp; 11 Jun – 19 Jul 2026
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/world-cup-2026"
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                🏆 World Cup Hub
              </Link>
              <Link
                href="/live"
                className="bg-green-500 hover:bg-green-400 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                All Live Scores
              </Link>
              <Link
                href="/schedule"
                className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Schedule
              </Link>
            </div>
          </div>
        </div>
      ) : (
        // Standard hero
        <div className="relative bg-gradient-to-br from-green-950/60 to-gray-900 rounded-2xl p-8 border border-green-900/30 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">⚽</span>
              <h1 className="text-4xl font-black text-white tracking-tight">GoalRadar</h1>
            </div>
            <p className="text-gray-400 text-lg mb-6 max-w-xl">
              Live scores, standings, and schedules from Europe&apos;s top football leagues.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/live"
                className="bg-green-500 hover:bg-green-400 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                Live Scores
              </Link>
              <Link
                href="/schedule"
                className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Schedule
              </Link>
              <Link
                href="/standings"
                className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Standings
              </Link>
              <Link
                href="/world-cup-2026"
                className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/30 px-5 py-2.5 rounded-lg font-semibold transition-colors"
              >
                🏆 World Cup 2026
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Live World Cup Matches ──────────────────────────────────── */}
      {wcActive && wcLive.length > 0 && (
        <section aria-labelledby="wc-live-heading">
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <h2 id="wc-live-heading" className="text-xl font-bold text-red-400">
              Live World Cup Matches
            </h2>
          </div>
          <MatchGrid matches={wcLive} />
        </section>
      )}

      {/* ── 2. Today's World Cup Fixtures ─────────────────────────────── */}
      {wcActive && (
        <section aria-labelledby="wc-today-heading">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>
              <span id="wc-today-heading">
                🏆 Today&apos;s World Cup Fixtures
              </span>
            </SectionTitle>
            <Link
              href="/world-cup-2026"
              className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors shrink-0"
            >
              Full hub →
            </Link>
          </div>

          {wcToday.length > 0 ? (
            <MatchGrid matches={wcToday} />
          ) : wcLive.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              No World Cup matches scheduled for today.{' '}
              <Link href="/world-cup-2026" className="text-yellow-500 hover:text-yellow-300">
                View upcoming fixtures →
              </Link>
            </div>
          ) : null /* live matches already shown above */}
        </section>
      )}

      {/* ── 3. World Cup Group Standings ──────────────────────────────── */}
      {showWCStandings && (
        <section aria-labelledby="wc-standings-heading">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>
              <span id="wc-standings-heading">📊 World Cup Standings</span>
            </SectionTitle>
            <Link
              href="/world-cup-2026"
              className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors shrink-0"
            >
              All groups →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGroupTables.map((t) => (
              <WCGroupTable
                key={t.group ?? t.stage}
                group={t.group ?? t.stage}
                table={t.table}
              />
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0" />
            Advances to knockout stage
          </p>
        </section>
      )}

      {/* ── 4. Other Leagues — Today's Matches ────────────────────────── */}
      <section aria-labelledby="today-heading">
        <SectionTitle>
          <span id="today-heading">
            {wcActive ? "Today's Matches — Other Leagues" : "Today's Matches"}
          </span>
        </SectionTitle>

        {todayError && <ErrorBanner />}

        {!todayError && otherToday.length === 0 && !wcActive && <EmptyDay />}

        {!todayError && otherToday.length === 0 && wcActive && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
            No other league matches today.
          </div>
        )}

        {!todayError && otherToday.length > 0 && <MatchGrid matches={otherToday} />}
      </section>
    </div>
  );
}
