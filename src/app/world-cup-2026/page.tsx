import Link from 'next/link';
import type { Metadata } from 'next';

import {
  getWCAuthorityMatchesV2,
  getStandingsCached,
} from '@/lib/api';
import { buildKnockoutViewModel } from '@/lib/knockout-vm';
// WC-LIVE-SSOT: single source of truth for live WC match state
import { getCurrentLiveMatches } from '@/lib/wc-live-ssot';
import { classifyMatchState } from '@/lib/match-classify';
import type { Match, StandingTable } from '@/lib/types';
import type { CanonicalMatch } from '@/lib/canonical-match';
import { canonicalToMatch } from '@/lib/canonical-match';
import { deriveMatchDisplay } from '@/lib/match-display';
import { matchPath } from '@/lib/url';
import MatchCard from '@/components/MatchCard';
import Breadcrumb from '@/components/Breadcrumb';
import SnapshotPrewarmHints from '@/components/SnapshotPrewarmHints';
import WCBracket from '@/components/WCBracket';
import WCGroupTabsClient from '@/components/WCGroupTabsClient';
import WCGroupTable from '@/components/WCGroupTable';
import { calculateQualificationStatus, type QualificationStatus } from '@/lib/wc-qualification';
import WCCountdown from '@/components/WCCountdown';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';
import AdSlot from '@/components/AdSlot';
import NewsletterSignup from '@/components/NewsletterSignup';
import { WC_ALL_TEAMS } from '@/lib/wc-all-teams';
import { WC_ROUNDS } from '@/lib/wc-rounds';
import PushNotificationButton from '@/components/PushNotificationButton';
// DATA-18WC.13: knockout slot fallback for when authority cache has no upcoming matches
import { WC_KNOCKOUT_SLOTS, type WCKnockoutSlot } from '@/lib/wc-fixtures';

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

function groupByDate(matches: CanonicalMatch[]): Record<string, CanonicalMatch[]> {
  return matches.reduce<Record<string, CanonicalMatch[]>>((acc, m) => {
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
  id,
  live = false,
  count,
}: {
  title: string;
  id?: string;
  live?: boolean;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {live && (
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}
      <h2 id={id} className={`text-xs font-semibold uppercase tracking-widest ${live ? 'text-red-400' : 'text-gray-400'}`}>
        {title}
      </h2>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-gray-500 ml-auto">{count} matches</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match grid — date-grouped
// ---------------------------------------------------------------------------

function MatchGrid({ matches, maxDays = 99 }: { matches: CanonicalMatch[]; maxDays?: number }) {
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

function ResultRow({ match }: { match: CanonicalMatch }) {
  const display = deriveMatchDisplay(canonicalToMatch(match));
  const hn = match.homeTeam?.shortName || match.homeTeam?.name || 'TBD';
  const an = match.awayTeam?.shortName || match.awayTeam?.name || 'TBD';

  return (
    <Link
      href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-800/60 transition-colors"
    >
      {/* Date */}
      <span className="text-xs text-gray-600 w-16 shrink-0">{display.displayDate}</span>

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
          {display.homeScore ?? '–'} – {display.awayScore ?? '–'}
        </span>
        {display.winner !== null && (
          <p className="text-xs text-gray-600">FT</p>
        )}
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
// Knockout slot schedule — shown when authority cache has no upcoming matches
// Same data source as bracket/page.tsx LocalKnockoutRound (DATA-18WC.13)
// ---------------------------------------------------------------------------

function LocalKnockoutRound({ slots }: { slots: WCKnockoutSlot[] }) {
  if (slots.length === 0) return null;
  return (
    <div className="divide-y divide-gray-800/50 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {slots.map((s) => (
        <div key={s.localId} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-sm text-gray-300 font-medium truncate">{s.homeLabel}</span>
          </div>
          <div className="mx-4 text-center shrink-0">
            <p className="text-gray-500 text-xs font-semibold">{s.roundLabel}</p>
            <p className="text-gray-500 text-xs">
              {new Date(s.utcDate).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', timeZone: 'UTC',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <span className="text-sm text-gray-300 font-medium truncate text-right">{s.awayLabel}</span>
          </div>
        </div>
      ))}
      <div className="px-4 py-2 text-xs text-gray-500">
        Scheduled — teams confirmed once group stage qualifies
      </div>
    </div>
  );
}

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

  const builtAt = new Date().toISOString();
  const [authorityResult, standingsResult, vmResult, liveResult] =
    await Promise.allSettled([
      getWCAuthorityMatchesV2(builtAt, { source: '/world-cup-2026', sourceType: 'page' }),
      getStandingsCached('WC'),
      buildKnockoutViewModel(),
      getCurrentLiveMatches(),
    ]);

  const allAuthority: CanonicalMatch[] =
    authorityResult.status === 'fulfilled'
      ? [...authorityResult.value.matches].sort(
          (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
        )
      : [];

  const classify = (m: CanonicalMatch) => classifyMatchState(m, today);

  // WC-LIVE-SSOT: live comes from the live-cache KV (allLive), not authority filtering.
  const allLive: Match[] = liveResult.status === 'fulfilled' ? liveResult.value : [];
  const liveMatchIds = new Set(allLive.map((m) => m.id));
  // DATA-18B.3E: a match the authority cache still marks live but that the live
  // SSOT no longer lists has ended → bucket it as finished so it leaves the
  // SSOT-gated live grid and appears in Recent Results (never as LIVE).
  const effectiveBucket = (m: CanonicalMatch) =>
    liveMatchIds.has(m.id) ? 'live' : classify(m) === 'live' ? 'finished' : classify(m);
  const todayMatches               = allAuthority.filter((m) => effectiveBucket(m) === 'today');
  const upcomingMatches            = allAuthority.filter((m) => effectiveBucket(m) === 'upcoming').slice(0, 12);
  const recentResults: CanonicalMatch[] = allAuthority
    .filter((m) => effectiveBucket(m) === 'finished')
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 10);

  // Bracket preview: R16→Final tree from single KnockoutViewModel
  const bracketMatches: Match[] =
    vmResult.status === 'fulfilled' ? vmResult.value.fullBracketMatches : [];

  // DATA-18WC.13: static knockout slot fallback for upcoming section.
  // Used when authority cache has no upcoming matches (group stage finished,
  // R32 fixtures not yet posted by FD API). Mirrors bracket/page.tsx behaviour.
  const knockoutSlots =
    upcomingMatches.length === 0
      ? WC_KNOCKOUT_SLOTS.filter((s) => new Date(s.utcDate) > new Date()).slice(0, 16)
      : [];

  // Hero stats — pure computation from allAuthority, no new I/O
  const playedCount = allAuthority.filter(m => effectiveBucket(m) === 'finished').length;
  const goalCount = allAuthority
    .filter(m => effectiveBucket(m) === 'finished')
    .reduce((sum, m) => sum + (m.score.fullTime.home ?? 0) + (m.score.fullTime.away ?? 0), 0);
  const remainingCount = upcomingMatches.length + todayMatches.length + knockoutSlots.length;

  // 5. Group standings
  const groupTables: StandingTable[] =
    standingsResult.status === 'fulfilled'
      ? standingsResult.value.standings.filter((s) => s.type === 'TOTAL')
      : [];

  // Qualification engine — runs pure computation, no I/O
  const qualMap = calculateQualificationStatus(groupTables);
  // Build per-group maps for WCGroupTable (Map<teamId, QualificationStatus>)
  function groupQualMap(groupKey: string | null): Map<number, QualificationStatus> {
    const letter = (groupKey ?? '').replace(/^GROUP_/, '').toUpperCase();
    const out = new Map<number, QualificationStatus>();
    for (const [id, q] of qualMap) {
      if (q.group === letter) out.set(id, q.qualificationStatus);
    }
    return out;
  }

  return (
    <>
      <JsonLd />

      <div className="max-w-5xl mx-auto space-y-10 pb-12">
        {/* PERF-8 Phase 3: seed KV snapshots for the first visible matches */}
        <SnapshotPrewarmHints
          ids={[
            ...allLive.map(m => m.id),
            ...todayMatches.map(m => m.id),
            ...upcomingMatches.map(m => m.id),
          ].slice(0, 10)}
        />
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'World Cup 2026' }]}
        />
        <div className="mt-3 mb-6"><WCPageNav /></div>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl bg-gray-950 border border-amber-800/20 p-6 sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/20 via-transparent to-violet-950/10 pointer-events-none" aria-hidden="true" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">FIFA World Cup 2026</span>
              <span className="text-gray-700" aria-hidden="true">·</span>
              <span className="text-xs text-gray-500">USA · Canada · Mexico</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">
              {allLive.length > 0 ? (
                <>Live — <span className="text-red-400">{allLive.length} match{allLive.length > 1 ? 'es' : ''} in progress</span></>
              ) : today >= WC_START && today <= WC_END ? (
                <>The World Cup is <span className="text-amber-400">Happening Now</span></>
              ) : (
                <>FIFA World Cup <span className="text-amber-400">2026</span></>
              )}
            </h1>
            <p className="text-gray-400 text-sm max-w-lg">
              48 nations · 104 matches · 3 host countries. Follow every goal, every result, every moment.
            </p>
          </div>

          {playedCount > 0 && (
            <div className="relative flex flex-wrap gap-6 mt-5 pt-5 border-t border-gray-800/60">
              <div>
                <p className="text-white font-black text-xl tabular-nums">{playedCount}</p>
                <p className="text-gray-500 text-xs">Matches played</p>
              </div>
              <div>
                <p className="text-white font-black text-xl tabular-nums">{goalCount}</p>
                <p className="text-gray-500 text-xs">Total goals</p>
              </div>
              <div>
                <p className={`font-black text-xl tabular-nums ${allLive.length > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  {allLive.length > 0 ? allLive.length : remainingCount}
                </p>
                <p className="text-gray-500 text-xs">{allLive.length > 0 ? 'Live now' : 'Remaining'}</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Countdown ────────────────────────────────────────────────── */}
        {/* LIVE-2: live matches drive the CTA; currentPath enables the
            self-reference guard (this page previously linked to itself) */}
        <WCCountdown compact liveMatches={allLive} currentPath="/world-cup-2026" />

        {/* ── Push notification opt-in ─────────────────────────────────── */}
        <PushNotificationButton variant="banner" matchLabel="World Cup 2026" />

        {/* Ad: below countdown, above nav */}
        <AdSlot slotId="wc-top" variant="banner" />

        {/* ── 1. Today (Live + scheduled) ───────────────────────────────── */}
        <section aria-labelledby="today-heading">
          <SectionHeader
            id="today-heading"
            title={allLive.length > 0 ? 'Live Now' : "Today's Matches"}
            live={allLive.length > 0}
            count={allLive.length > 0 ? allLive.length : todayMatches.length}
          />
          {allLive.length > 0 || todayMatches.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allLive.map((m) => <MatchCard key={m.id} match={m} />)}
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
          <SectionHeader id="upcoming-heading" title="Upcoming Matches" count={upcomingMatches.length || knockoutSlots.length} />
          {upcomingMatches.length > 0 ? (
            <MatchGrid matches={upcomingMatches} />
          ) : knockoutSlots.length > 0 ? (
            <LocalKnockoutRound slots={knockoutSlots} />
          ) : (
            <EmptyState
              message="No upcoming fixtures available"
              sub="Upcoming matches will appear here once scheduled"
            />
          )}
        </section>


        {/* ── 4. Group Standings ────────────────────────────────────────── */}
        <section id="groups" aria-labelledby="standings-heading">
          <SectionHeader id="standings-heading" title="Group Standings" />
          {groupTables.length > 0 ? (
            <>
              <WCGroupTabsClient tabs={groupTables.map((t) => {
                const letter = (t.group ?? '').replace(/^GROUP_/, '');
                return `Group ${letter}`;
              })}>
                {groupTables.map((t) => {
                  const groupSlug = (t.group ?? '')
                    .toLowerCase()
                    .replace(/[\s_]+/g, '-');
                  return (
                    <WCGroupTable
                      key={t.group ?? t.stage}
                      group={t.group ?? t.stage}
                      table={t.table}
                      href={groupSlug ? `/world-cup-2026/${groupSlug}` : undefined}
                      qualifications={groupQualMap(t.group)}
                    />
                  );
                })}
              </WCGroupTabsClient>
              <p className="text-xs text-gray-600 mt-3 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0" />
                Advances to knockout round of 32
              </p>
            </>
          ) : (
            <EmptyState
              message="Group standings temporarily unavailable"
              sub="Standings will reappear shortly — check back in a few minutes"
            />
          )}
        </section>

        {/* Ad: between standings and bracket */}
        <AdSlot slotId="wc-mid" variant="rectangle" className="mx-auto" />

        {/* ── 5. Knockout Bracket ───────────────────────────────────────── */}
        <section aria-labelledby="bracket-heading">
          <SectionHeader id="bracket-heading" title="Knockout Bracket" />
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
            <WCBracket matches={bracketMatches} />
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-500">
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
          <SectionHeader id="results-heading" title="Recent Results" count={recentResults.length} />
          {recentResults.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800/50">
              {recentResults.map((m) => <MatchCard variant="result" key={m.id} match={m} />)}
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
