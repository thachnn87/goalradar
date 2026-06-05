/**
 * /world-cup-2026/matches-today
 *
 * World Cup 2026 matches happening today (UTC). Shows live, scheduled and
 * recently-finished matches filtered to today's date.
 * ISR 60 s so live data stays fresh.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { getTodayMatches, getWCLiveMatches, getUpcomingMatches } from '@/lib/api';
import type { Match } from '@/lib/types';
import { matchPath } from '@/lib/url';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 60;

const BASE_URL  = 'https://goalradar.org';
const PAGE_URL  = `${BASE_URL}/world-cup-2026/matches-today`;
const TITLE     = 'World Cup 2026 Matches Today – Live Scores & Schedule | GoalRadar';
const DESC      = 'Find every FIFA World Cup 2026 match playing today. Live scores, kick-off times, results and where to watch — updated every minute.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: TITLE, description: DESC, type: 'website', url: PAGE_URL },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function tomorrowUTC(): string {
  return new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
}

function formatTime(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

function formatLocalDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Match['status'] }) {
  if (status === 'IN_PLAY') return (
    <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full text-xs font-bold">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
      </span>
      LIVE
    </span>
  );
  if (status === 'PAUSED') return <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full text-xs font-bold">HT</span>;
  if (status === 'FINISHED') return <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full text-xs font-bold">FT</span>;
  return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full text-xs font-bold">UPCOMING</span>;
}

function MatchRow({ match }: { match: Match }) {
  const href    = matchPath(match.id, match.homeTeam.name, match.awayTeam.name);
  const showScore = ['IN_PLAY','PAUSED','FINISHED'].includes(match.status);
  const group   = match.group ? match.group.replace('GROUP_','Group ') : null;
  const stage   = match.stage?.replace(/_/g,' ') ?? null;

  return (
    <Link href={href}
      className="group flex items-center gap-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-xl px-4 py-3 transition-all">
      {/* Time / status */}
      <div className="w-20 shrink-0 text-center">
        <StatusBadge status={match.status} />
        {(match.status === 'SCHEDULED' || match.status === 'TIMED') && (
          <p className="text-xs text-gray-500 mt-0.5">{formatTime(match.utcDate)}</p>
        )}
      </div>
      {/* Teams */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">
          {match.homeTeam.shortName || match.homeTeam.name}
          {' '}
          {showScore
            ? <span className="text-white font-black">{match.score.fullTime.home ?? 0}–{match.score.fullTime.away ?? 0}</span>
            : <span className="text-gray-500">vs</span>}
          {' '}
          {match.awayTeam.shortName || match.awayTeam.name}
        </p>
        <p className="text-[11px] text-gray-600 mt-0.5">{group ?? stage ?? 'World Cup 2026'}</p>
      </div>
      <span className="text-gray-700 group-hover:text-yellow-500 text-sm transition-colors shrink-0">→</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  { q: 'Are there World Cup 2026 matches today?', a: 'This page shows all FIFA World Cup 2026 matches scheduled for today (UTC). If no matches appear, it\'s a rest day in the tournament. Check the full fixtures page for the upcoming schedule.' },
  { q: 'What time do World Cup 2026 matches kick off today?', a: 'Group stage matches have four daily kick-off slots: 12:00 PM, 3:00 PM, 6:00 PM and 9:00 PM Eastern Time (16:00, 19:00, 22:00 and 01:00 UTC). This page shows today\'s matches with their confirmed kick-off times.' },
  { q: 'Where can I watch World Cup 2026 matches today?', a: 'In the USA, watch on Fox, FS1 or Telemundo. In the UK, watch free on BBC or ITV. In Canada on TSN or CTV. In Australia, free on SBS. See our Watch Live page for the full country-by-country guide.' },
  { q: 'How many matches are played each day in the World Cup group stage?', a: 'During the group stage (11 June – 27 June 2026), up to four matches are played per day. Some days have rest days or only one or two fixtures. The full daily schedule is on FIFA.com and GoalRadar\'s fixtures page.' },
  { q: 'How do I get a reminder for today\'s World Cup matches?', a: 'Subscribe to GoalRadar\'s free newsletter for match reminders and live score updates delivered directly to your inbox. You can also add matches to your calendar using the schedule page.' },
  { q: 'What happens if a World Cup match is postponed today?', a: 'FIFA has robust contingency plans for match postponement — weather, infrastructure or other issues can cause rescheduling. Postponed matches are reflected on GoalRadar as soon as FIFA confirms the change. Check the competition tab for official updates.' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MatchesTodayPage() {
  const today    = todayUTC();
  const tomorrow = tomorrowUTC();

  const [todayResult, liveResult, upcomingResult] = await Promise.allSettled([
    getTodayMatches(),
    getWCLiveMatches(),
    getUpcomingMatches('WC'),
  ]);

  // All-competitions today, filter to WC
  const allToday: Match[] = todayResult.status === 'fulfilled'
    ? todayResult.value.matches.filter((m) => m.competition?.code === 'WC')
    : [];

  // Live WC matches (possibly overlapping with allToday — deduplicate below)
  const liveMatches: Match[] = liveResult.status === 'fulfilled' ? liveResult.value.matches : [];
  const liveIds = new Set(liveMatches.map((m) => m.id));

  // Merge: live matches + scheduled today (no duplicates)
  const seenIds = new Set<number>(liveIds);
  const scheduledToday: Match[] = allToday.filter((m) => {
    if (seenIds.has(m.id)) return false;
    seenIds.add(m.id);
    return true;
  });

  // Tomorrow's fixtures (for the "next up" teaser)
  const tomorrowMatches: Match[] = upcomingResult.status === 'fulfilled'
    ? upcomingResult.value.matches.filter((m) => m.utcDate.startsWith(tomorrow)).slice(0, 4)
    : [];

  const finished = scheduledToday.filter((m) => m.status === 'FINISHED');
  const upcoming = scheduledToday.filter((m) => m.status === 'SCHEDULED' || m.status === 'TIMED');
  const hasAny   = liveMatches.length > 0 || scheduledToday.length > 0;

  const displayDate = formatLocalDate(new Date().toISOString());

  // JSON-LD
  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',           item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Matches Today',  item: PAGE_URL },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <div className="max-w-2xl mx-auto pb-16 space-y-6">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Matches Today' },
        ]} />

        {/* Hero */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚽</span>
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">FIFA World Cup 2026</span>
          </div>
          <h1 className="text-3xl font-black text-white leading-tight mb-1">World Cup Matches Today</h1>
          <p className="text-gray-400 text-sm">{displayDate}</p>
        </div>

        {/* Ad: top */}
        <AdSlot slotId="today-top" variant="banner" />

        {/* Live matches */}
        {liveMatches.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              Live Now
            </h2>
            <div className="space-y-2">
              {liveMatches.map((m) => <MatchRow key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* Upcoming today */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Upcoming Today</h2>
            <div className="space-y-2">
              {upcoming.map((m) => <MatchRow key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* Finished today */}
        {finished.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Finished Today</h2>
            <div className="space-y-2">
              {finished.map((m) => <MatchRow key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* No matches state */}
        {!hasAny && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-3">
            <div className="text-4xl">📅</div>
            <h2 className="text-white font-bold text-lg">No World Cup Matches Today</h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Today is a rest day. The next World Cup fixtures are on the schedule page.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link href="/world-cup-2026/matches-tomorrow"
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                Tomorrow's Matches →
              </Link>
              <Link href="/schedule?competition=WC"
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                Full Schedule
              </Link>
            </div>
          </div>
        )}

        {/* Watch Live CTA */}
        <div className="bg-gradient-to-br from-yellow-950/30 to-gray-900 border border-yellow-800/30 rounded-2xl p-5">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1">📺 Watch World Cup 2026</p>
          <p className="text-white font-bold text-base mb-1">Find your broadcaster</p>
          <p className="text-gray-400 text-sm mb-4">Official channels and streaming services by country — no illegal streams.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/world-cup-2026/watch-live"
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              Watch Live Guide →
            </Link>
            <Link href="/world-cup-2026/streaming-guide"
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold border border-gray-700 transition-colors">
              Streaming Guide
            </Link>
          </div>
        </div>

        {/* Ad: mid */}
        <AdSlot slotId="today-mid" variant="rectangle" className="mx-auto" />

        {/* Tomorrow's matches teaser */}
        {tomorrowMatches.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Coming Tomorrow</h2>
              <Link href="/world-cup-2026/matches-tomorrow" className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
                All tomorrow's matches →
              </Link>
            </div>
            <div className="space-y-2 opacity-70">
              {tomorrowMatches.map((m) => <MatchRow key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* TV Schedule CTA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { href: '/world-cup-2026/tv-schedule', icon: '📺', title: 'TV Schedule', sub: 'Channels by country' },
            { href: '/world-cup-2026/watch-live', icon: '📡', title: 'Stream Live', sub: 'Online options worldwide' },
          ].map(({ href, icon, title, sub }) => (
            <Link key={href} href={href}
              className="group flex items-center gap-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-xl px-4 py-3 transition-all">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">{title}</p>
                <p className="text-xs text-gray-600">{sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map(({ q, a }) => (
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

        {/* Ad: bottom */}
        <AdSlot slotId="today-bottom" variant="banner" />

        {/* Internal links */}
        <div className="border-t border-gray-800 pt-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">More World Cup 2026</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/world-cup-2026',                   label: '🏆 WC Hub' },
              { href: '/world-cup-2026/matches-tomorrow',  label: '📅 Tomorrow' },
              { href: '/schedule?competition=WC',           label: '📋 All Fixtures' },
              { href: '/world-cup-2026/results',            label: '🏁 Results' },
              { href: '/world-cup-2026/groups',             label: '🗂️ Groups' },
              { href: '/world-cup-2026/bracket',            label: '🔗 Bracket' },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-3 text-sm text-gray-300 hover:text-white transition-colors text-center">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
