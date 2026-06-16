import Link from 'next/link';
import type { Metadata } from 'next';

// PERF-4.5: page-safe *Cached variants — zero provider calls during page render.
// DATA-4 unified: getWCAuthorityMatchesCached replaces separate upcoming/recent calls.
import {
  getWCLiveMatchesCached,
  getWCKnockoutMatchesCached,
  getWCAuthorityMatchesCached,
  getStandingsCached,
} from '@/lib/api';
import type { Match, StandingTable } from '@/lib/types';
import { matchPath } from '@/lib/url';
import MatchCard from '@/components/MatchCard';
import Breadcrumb from '@/components/Breadcrumb';
import SnapshotPrewarmHints from '@/components/SnapshotPrewarmHints';
import WCBracket from '@/components/WCBracket';
import WCGroupTable from '@/components/WCGroupTable';
import WCCountdown from '@/components/WCCountdown';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import AdSlot from '@/components/AdSlot';
import NewsletterSignup from '@/components/NewsletterSignup';
import { WC_ALL_TEAMS } from '@/lib/wc-all-teams';
import { WC_ROUNDS } from '@/lib/wc-rounds';
// getStaticUpcomingMatches is no longer needed here — fallback is handled inside getUpcomingMatchesCached
import PushNotificationButton from '@/components/PushNotificationButton';

export const revalidate = 30;

const BASE_URL = 'https://goalradar.org';
const WC_START = '2026-06-11';
const WC_END = '2026-07-19';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Live Scores, Fixtures, Results and Standings | GoalRadar',
  description:
    'Follow FIFA World Cup 2026 live scores, today\'s fixtures, upcoming matches, group standings and recent results on GoalRadar. USA · Canada · Mexico.',
  alternates: { canonical: `${BASE_URL}/world-cup-2026` },
  openGraph: {
    title: 'FIFA World Cup 2026 Live Scores, Fixtures, Results and Standings | GoalRadar',
    description:
      'Live scores, today\'s matches, group standings, upcoming fixtures and recent results for FIFA World Cup 2026.',
    type: 'website',
    url: `${BASE_URL}/world-cup-2026`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIFA World Cup 2026 | GoalRadar',
    description: 'Live scores, fixtures, results and group standings for World Cup 2026.',
  },
};

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd() {
  const today = todayUTC();
  const wcEventStatus =
    today > WC_END   ? 'https://schema.org/EventCompleted'  :
    today >= WC_START ? 'https://schema.org/EventInProgress' :
                        'https://schema.org/EventScheduled';

  const event = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: 'FIFA World Cup 2026',
    sport: 'Association football',
    startDate: WC_START,
    endDate: WC_END,
    url: `${BASE_URL}/world-cup-2026`,
    description:
      'FIFA World Cup 2026 football match coverage — live scores, fixtures, group standings, results and statistics. Hosted by the United States, Canada and Mexico, featuring 48 nations.',
    image: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a8/FIFA_World_Cup_2026_logo.svg/800px-FIFA_World_Cup_2026_logo.svg.png',
    location: {
      '@type': 'Place',
      name: 'United States, Canada & Mexico',
      address: { '@type': 'PostalAddress', addressCountry: 'US' },
    },
    organizer: {
      '@type': 'Organization',
      name: 'FIFA',
      url: 'https://www.fifa.com',
    },
    performer: [
      { '@type': 'SportsOrganization', name: 'UEFA', description: '16 qualified UEFA nations' },
      { '@type': 'SportsOrganization', name: 'CONMEBOL', description: '6 qualified CONMEBOL nations' },
      { '@type': 'SportsOrganization', name: 'CONCACAF', description: '6 qualified CONCACAF nations (inc. hosts)' },
    ],
    eventStatus: wcEventStatus,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(event) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayUTC() {
  return new Date().toISOString().split('T')[0];
}

function formatDayHeading(isoDate: string) {
  const d = new Date(isoDate + 'T00:00:00Z');
  const today = todayUTC();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  if (isoDate === today) return 'Today';
  if (isoDate === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

function formatKickoff(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
}

function formatResultDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function groupByDate(matches: Match[]): Record<string, Match[]> {
  return matches.reduce<Record<string, Match[]>>((acc, m) => {
    const d = m.utcDate.split('T')[0];
    (acc[d] ??= []).push(m);
    return acc;
  }, {});
}


// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  live = false,
  count,
}: {
  title: string;
  live?: boolean;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {live && (
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}
      <h2 className={`text-xs font-semibold uppercase tracking-widest ${live ? 'text-red-400' : 'text-gray-400'}`}>
        {title}
      </h2>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-gray-600 ml-auto">{count} matches</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match grid — date-grouped
// ---------------------------------------------------------------------------

function MatchGrid({ matches, maxDays = 99 }: { matches: Match[]; maxDays?: number }) {
  const byDate = groupByDate(matches);
  const dates = Object.keys(byDate).sort().slice(0, maxDays);

  if (!dates.length) return null;

  return (
    <div className="space-y-6">
      {dates.map((date) => (
        <div key={date}>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
            {formatDayHeading(date)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byDate[date].map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent result row
// ---------------------------------------------------------------------------

function ResultRow({ match }: { match: Match }) {
  const { score } = match;
  const hn = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const an = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';

  return (
    <Link
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-800/60 transition-colors"
    >
      {/* Date */}
      <span className="text-xs text-gray-600 w-16 shrink-0">{formatResultDate(match.utcDate)}</span>

      {/* Home crest + name */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
        <span className="text-white text-sm font-medium truncate text-right">{hn}</span>
        {match.homeTeam?.crest && (
          <img src={match.homeTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />
        )}
      </div>

      {/* Score */}
      <div className="text-center shrink-0 w-16">
        <span className="text-white font-black tabular-nums text-sm">
          {score.fullTime.home ?? '–'} – {score.fullTime.away ?? '–'}
        </span>
        {score.winner === 'HOME_TEAM' || score.winner === 'AWAY_TEAM' || score.winner === 'DRAW' ? (
          <p className="text-xs text-gray-600">FT</p>
        ) : null}
      </div>

      {/* Away crest + name */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {match.awayTeam?.crest && (
          <img src={match.awayTeam.crest} alt="" width={18} height={18} className="object-contain shrink-0" />
        )}
        <span className="text-white text-sm font-medium truncate">{an}</span>
      </div>
    </Link>
  );
}

// GroupTable is the shared WCGroupTable component (imported above)

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      <p className="text-gray-400 text-sm font-medium">{message}</p>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WorldCup2026Page() {
  const today = todayUTC();

  // PERF-4.5: all four calls use page-safe *Cached variants.
  // DATA-4 unified: getWCAuthorityMatchesCached merges the upcoming (SCHEDULED/TIMED)
  // and recent (FINISHED) feeds so a finished match is never shown as upcoming.
  const [liveResult, authorityResult, standingsResult, knockoutResult] =
    await Promise.allSettled([
      getWCLiveMatchesCached(),
      getWCAuthorityMatchesCached(),
      getStandingsCached('WC'),
      getWCKnockoutMatchesCached(),
    ]);

  // 1. Live matches — getWCLiveMatchesCached is snapshot-overlaid internally
  // (DATA-2): finished matches are already filtered out of this list.
  const liveMatches: Match[] =
    liveResult.status === 'fulfilled' ? liveResult.value.matches : [];

  // 2. Authority set — all WC matches with correct status from merged feeds + overlay.
  // DATA-4 stray routing: section membership follows STATUS, not feed origin.
  //   FINISHED  → recentResults   (correct score visible immediately)
  //   IN_PLAY / PAUSED → liveMatches (merged with live cache below)
  //   SCHEDULED / TIMED → today / upcoming by UTC day
  const allAuthority: Match[] =
    authorityResult.status === 'fulfilled'
      ? [...authorityResult.value.matches].sort(
          (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
        )
      : [];

  const dedupById = (arr: Match[]): Match[] => {
    const seen = new Set<number>();
    return arr.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  };

  // Live strays: authority knows they're IN_PLAY but live cache may lag — merge.
  const liveStrays = allAuthority.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const allLive: Match[] = dedupById([...liveMatches, ...liveStrays]);

  // Today's matches — only truly upcoming (SCHEDULED/TIMED) ones; live in allLive above.
  const todayMatches = allAuthority.filter(
    (m) => m.utcDate.startsWith(today) && (m.status === 'SCHEDULED' || m.status === 'TIMED'),
  );

  // Upcoming = SCHEDULED/TIMED starting tomorrow, capped at 12.
  const upcomingMatches = allAuthority
    .filter(
      (m) =>
        m.utcDate.split('T')[0] > today &&
        (m.status === 'SCHEDULED' || m.status === 'TIMED'),
    )
    .slice(0, 12);

  // Recent results — FINISHED from authority set, newest first.
  const recentResults: Match[] = allAuthority
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 10);

  // 3. Knockout bracket matches
  const knockoutMatches: Match[] =
    knockoutResult.status === 'fulfilled' ? knockoutResult.value.matches : [];

  // 5. Group standings
  const groupTables: StandingTable[] =
    standingsResult.status === 'fulfilled'
      ? standingsResult.value.standings.filter((s) => s.type === 'TOTAL')
      : [];

  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto space-y-10 pb-12">
        {/* PERF-8 Phase 3: seed KV snapshots for the first visible matches */}
        <SnapshotPrewarmHints
          ids={[...allLive, ...todayMatches, ...upcomingMatches].slice(0, 10).map((m) => m.id)}
        />
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'World Cup 2026' }]}
        />
        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-800 rounded-2xl p-6 sm:p-8 overflow-hidden">
          {/* Subtle gold glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(234,179,8,0.06)_0%,_transparent_60%)] pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <span className="text-6xl shrink-0 leading-none">🏆</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                FIFA World Cup 2026
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                United States · Canada · Mexico
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                11 June – 19 July 2026 &nbsp;·&nbsp; 48 teams &nbsp;·&nbsp; 104 matches
              </p>
            </div>
            <div className="flex sm:flex-col gap-2 text-xs">
              <span className="bg-green-500/15 text-green-400 border border-green-500/25 px-3 py-1 rounded-full font-semibold">
                48 Nations
              </span>
              <span className="bg-blue-500/15 text-blue-400 border border-blue-500/25 px-3 py-1 rounded-full font-semibold">
                3 Countries
              </span>
            </div>
          </div>
        </div>

        {/* ── Countdown ────────────────────────────────────────────────── */}
        {/* LIVE-2: live matches drive the CTA; currentPath enables the
            self-reference guard (this page previously linked to itself) */}
        <WCCountdown compact liveMatches={allLive} currentPath="/world-cup-2026" />

        {/* ── Push notification opt-in ─────────────────────────────────── */}
        <PushNotificationButton variant="banner" matchLabel="World Cup 2026" />

        {/* Ad: below countdown, above nav */}
        <AdSlot slotId="wc-top" variant="banner" />

        {/* ── Navigation shortcuts — sticky on mobile ───────────────────── */}
        <nav
          aria-label="World Cup sections"
          className="sticky top-16 z-40 -mx-4 px-4 sm:mx-0 sm:px-0 sm:static sm:z-auto bg-gray-950/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-b border-gray-800/50 sm:border-0 pb-3 sm:pb-0"
        >
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-3 sm:pt-0">
            {[
              { href: '#fixtures',  icon: '📅', label: 'Fixtures'  },
              { href: '/world-cup-2026/results', icon: '🏁', label: 'Results', external: true },
              { href: '#groups',    icon: '📊', label: 'Groups'    },
              { href: '/world-cup-2026/bracket', icon: '🔗', label: 'Bracket', external: true },
              { href: '/world-cup-2026/group-a', icon: '🗂',  label: 'Group A', external: true },
            ].map(({ href, icon, label, external }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors bg-gray-800/80 hover:bg-yellow-500/15 text-gray-300 hover:text-yellow-400 border border-gray-700/50 hover:border-yellow-500/30 shrink-0"
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
                {external && <span className="text-gray-600 text-xs">↗</span>}
              </Link>
            ))}
          </div>
        </nav>

        {/* ── 1. Live Matches ───────────────────────────────────────────── */}
        {allLive.length > 0 && (
          <section aria-labelledby="live-heading">
            <SectionHeader title="Live Matches" live count={allLive.length} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allLive.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* ── 2. Today's Matches ────────────────────────────────────────── */}
        <section aria-labelledby="today-heading">
          <SectionHeader title="Today's Matches" count={todayMatches.length + allLive.length} />
          {todayMatches.length > 0 || allLive.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {todayMatches.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
          ) : (
            <EmptyState
              message="No matches scheduled for today"
              sub="Check the upcoming fixtures below"
            />
          )}
        </section>

        {/* ── 3. Upcoming Matches ───────────────────────────────────────── */}
        <section id="fixtures" aria-labelledby="upcoming-heading">
          <SectionHeader title="Upcoming Matches" count={upcomingMatches.length} />
          {upcomingMatches.length > 0 ? (
            <MatchGrid matches={upcomingMatches} />
          ) : (
            <EmptyState
              message="No upcoming fixtures available"
              sub="Upcoming matches will appear here once scheduled"
            />
          )}
        </section>

        {/* ── 4. Group Standings ────────────────────────────────────────── */}
        <section id="groups" aria-labelledby="standings-heading">
          <SectionHeader title="Group Standings" />
          {groupTables.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupTables.map((t) => {
                  const groupSlug = (t.group ?? '')
                    .toLowerCase()
                    .replace(/[\s_]+/g, '-'); // GROUP_A / "Group A" → group-a
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
                Advances to knockout round of 32
              </p>
            </>
          ) : (
            <EmptyState
              message="Group stage hasn't started yet"
              sub="Standings will appear once the tournament begins on 11 June 2026"
            />
          )}
        </section>

        {/* Ad: between standings and bracket */}
        <AdSlot slotId="wc-mid" variant="rectangle" className="mx-auto" />

        {/* ── 5. Knockout Bracket ───────────────────────────────────────── */}
        <section aria-labelledby="bracket-heading">
          <SectionHeader title="Knockout Bracket" />
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
            <WCBracket matches={knockoutMatches} />
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-700">
                Bracket auto-updates as teams advance · Scroll horizontally on small screens
              </p>
              <Link
                href="/world-cup-2026/bracket"
                className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium shrink-0 ml-4"
              >
                Full bracket →
              </Link>
            </div>
          </div>
        </section>

        {/* ── 6. Recent Results ─────────────────────────────────────────── */}
        <section id="results" aria-labelledby="results-heading">
          <SectionHeader title="Recent Results" count={recentResults.length} />
          {recentResults.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50">
              {recentResults.map((m) => <ResultRow key={m.id} match={m} />)}
            </div>
          ) : (
            <EmptyState
              message="No results yet"
              sub="Match results will appear here once the group stage begins"
            />
          )}
        </section>

        {/* ── Newsletter ────────────────────────────────────────────────── */}
        <NewsletterSignup
          source="wc-hub"
          heading="Never miss a World Cup 2026 match"
          description="Free email alerts delivered straight to your inbox."
          features={['Match reminders', 'Live score alerts', 'World Cup predictions']}
        />

        {/* ── Crawler discovery — static links for all groups, fixtures, teams ── */}
        <nav aria-label="World Cup 2026 knockout rounds, groups and teams" className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-5">
          {/* Knockout Rounds */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Knockout Rounds
            </h2>
            <div className="flex flex-wrap gap-2">
              {WC_ROUNDS.map((r) => (
                <Link
                  key={r.slug}
                  href={`/world-cup-2026/${r.slug}`}
                  className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-xs font-semibold text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
                >
                  {r.icon} {r.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Groups A–L */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              All Groups
            </h2>
            <div className="flex flex-wrap gap-2">
              {['a','b','c','d','e','f','g','h','i','j','k','l'].map((g) => (
                <Link
                  key={g}
                  href={`/world-cup-2026/group-${g}`}
                  className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-xs font-semibold text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
                >
                  Group {g.toUpperCase()}
                </Link>
              ))}
              <Link
                href="/world-cup-2026/fixtures"
                className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-xs font-semibold text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
              >
                📅 All Fixtures
              </Link>
            </div>
          </div>

          {/* All 48 teams */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              All 48 Teams
            </h2>
            <div className="flex flex-wrap gap-2">
              {WC_ALL_TEAMS.map((team) => (
                <Link
                  key={team.slug}
                  href={`/world-cup-2026/teams/${team.slug}`}
                  className="px-2.5 py-1 rounded-lg border border-gray-800 bg-gray-950 text-xs text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
                >
                  {team.flag} {team.shortName}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="flex justify-center gap-6 text-sm text-gray-600 mb-4">
          <Link href="/competition/WC" className="hover:text-white transition-colors">
            Full competition page →
          </Link>
          <Link href="/live" className="hover:text-white transition-colors">
            All live scores →
          </Link>
        </div>
        <WCRelatedLinks links={[
          { href: '/world-cup-2026-schedule',       icon: '📅', label: 'WC 2026 Schedule',      desc: 'All 104 matches with timezone converter' },
          { href: '/world-cup-2026-results',        icon: '🏁', label: 'WC 2026 Results',       desc: 'Live and full-time scores for every match' },
          { href: '/world-cup-2026-standings',      icon: '📊', label: 'Group Standings',       desc: 'Live tables for all 12 groups A–L' },
          { href: '/world-cup-2026-groups',         icon: '🗂️', label: 'Group Stage Guide',     desc: 'All 12 draws, fixtures and tiebreaker rules' },
          { href: '/world-cup-2026-bracket',        icon: '🔗', label: 'Knockout Bracket',      desc: 'Round of 32 path to the Final at MetLife' },
          { href: '/world-cup-2026-live-stream',    icon: '📡', label: 'Live Stream Guide',     desc: 'Free streaming options for every country' },
          { href: '/world-cup-2026-tv-guide',       icon: '📺', label: 'TV Channel Guide',      desc: 'What channel is World Cup 2026 on near you?' },
          { href: '/world-cup-2026/teams',          icon: '👥', label: 'All 48 Teams',          desc: 'Squads, form and group info for every nation' },
          { href: '/world-cup-2026/venues',         icon: '🏟️', label: 'WC Venues',           desc: '16 stadiums across USA, Canada and Mexico' },
        ]} />
      </div>
    </>
  );
}
