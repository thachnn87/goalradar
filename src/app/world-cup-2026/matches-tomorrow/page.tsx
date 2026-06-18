/**
 * /world-cup-2026/matches-tomorrow
 *
 * World Cup 2026 matches scheduled for tomorrow (UTC).
 *
 * Sections:
 *   1. Tomorrow's World Cup Matches   — fixture list
 *   2. Kickoff Times                  — 6-timezone grid
 *   3. Stadiums                       — featured WC venues w/ internal links
 *   4. TV / Streaming                 — broadcaster CTA
 *   5. Related links                  — standings, groups, bracket, live
 *
 * Schema: FAQPage + BreadcrumbList + SportsEvent (one per match)
 * ISR: revalidate = 60 s
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { getWCAuthorityMatchesV2 } from '@/lib/api';
import type { CanonicalMatch } from '@/lib/canonical-match';
import { matchPath } from '@/lib/url';
import AdSlot from '@/components/AdSlot';
import Breadcrumb from '@/components/Breadcrumb';
import { WC_VENUES } from '@/lib/wc-venues';

export const revalidate = 60;

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/matches-tomorrow`;
const TITLE    = 'World Cup 2026 Matches Tomorrow – Fixtures, Kick-off Times & TV | GoalRadar';
const DESC     = "Plan ahead with FIFA World Cup 2026 tomorrow's match schedule. Kick-off times across all time zones, stadiums, results and where to watch — updated every minute.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: TITLE, description: DESC, type: 'website', url: PAGE_URL },
  twitter:  { card: 'summary_large_image', title: TITLE, description: DESC },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tomorrowUTC(): string {
  return new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
}

function dayAfterUTC(): string {
  return new Date(Date.now() + 2 * 86_400_000).toISOString().split('T')[0];
}

function formatTime(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
}

function formatLocalDate(isoDate: string) {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// SportsEvent JSON-LD — one schema per match
// ---------------------------------------------------------------------------

function buildSportsEventSchemas(matches: CanonicalMatch[]) {
  return matches.map((m) => ({
    '@context': 'https://schema.org',
    '@type':    'SportsEvent',
    name:       `${m.homeTeam.name} vs ${m.awayTeam.name} – FIFA World Cup 2026`,
    startDate:  m.utcDate,
    url:        `${BASE_URL}${matchPath(m.id, m.homeTeam.name, m.awayTeam.name)}`,
    sport:      'Soccer',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type':        'StadiumOrArena',
      name:           'FIFA World Cup 2026 Venue',
      addressCountry: 'US',
    },
    organizer: {
      '@type': 'SportsOrganization',
      name:    'FIFA',
      url:     'https://www.fifa.com',
    },
    competitor: [
      {
        '@type': 'SportsTeam',
        name:    m.homeTeam.name,
        ...(m.homeTeam.crest ? { image: m.homeTeam.crest } : {}),
      },
      {
        '@type': 'SportsTeam',
        name:    m.awayTeam.name,
        ...(m.awayTeam.crest ? { image: m.awayTeam.crest } : {}),
      },
    ],
  }));
}

// ---------------------------------------------------------------------------
// Match row
// ---------------------------------------------------------------------------

function KickoffRow({ match }: { match: CanonicalMatch }) {
  const href  = matchPath(match.id, match.homeTeam.name, match.awayTeam.name);
  const group = match.group ? match.group.replace('GROUP_', 'Group ') : null;
  const stage = match.stage?.replace(/_/g, ' ') ?? null;

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-xl px-4 py-3 transition-all"
    >
      {/* Kick-off time */}
      <div className="w-16 shrink-0 text-center">
        <p className="text-yellow-400 text-xs font-bold">{formatTime(match.utcDate)}</p>
      </div>
      {/* Teams */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">
          {match.homeTeam.shortName || match.homeTeam.name}
          <span className="text-gray-500 mx-1.5">vs</span>
          {match.awayTeam.shortName || match.awayTeam.name}
        </p>
        <p className="text-[11px] text-gray-600 mt-0.5">{group ?? stage ?? 'World Cup 2026'}</p>
      </div>
      {/* Watch pill — static badge; the outer Link handles navigation to the match page */}
      <span className="hidden sm:inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-400 text-[10px] font-bold px-2 py-1 rounded-full border border-yellow-500/20 shrink-0">
        📺 Watch
      </span>
      <span className="text-gray-700 group-hover:text-yellow-500 text-sm transition-colors shrink-0">→</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Kickoff Times section — 6-timezone grid
// ---------------------------------------------------------------------------

const TZ_COLS = [
  { label: 'UTC',  offset: 0  },
  { label: 'ET',   offset: -4 },   // US Eastern (EDT)
  { label: 'CT',   offset: -5 },   // US Central (CDT)
  { label: 'PT',   offset: -7 },   // US Pacific (PDT)
  { label: 'BST',  offset: 1  },   // UK Summer
  { label: 'CET',  offset: 2  },   // Central Europe Summer
];

function shiftHour(utcDate: string, offset: number): string {
  const d = new Date(new Date(utcDate).getTime() + offset * 3_600_000);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function KickoffTimesSection({ matches }: { matches: CanonicalMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <section aria-labelledby="kickoff-heading">
      <h2 id="kickoff-heading" className="text-xl font-bold text-white mb-4">
        Kickoff Times
      </h2>
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-800">
                <th className="px-4 py-3 text-left">Match</th>
                {TZ_COLS.map((tz) => (
                  <th key={tz.label} className="px-3 py-3 text-center whitespace-nowrap">
                    {tz.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={matchPath(m.id, m.homeTeam.name, m.awayTeam.name)} prefetch={true}
                      className="text-white hover:text-yellow-400 transition-colors font-medium text-xs leading-snug"
                    >
                      {m.homeTeam.shortName || m.homeTeam.name}
                      <span className="text-gray-500 mx-1"> vs </span>
                      {m.awayTeam.shortName || m.awayTeam.name}
                    </Link>
                  </td>
                  {TZ_COLS.map((tz) => (
                    <td key={tz.label} className="px-3 py-3 text-center font-mono text-xs text-gray-300">
                      {shiftHour(m.utcDate, tz.offset)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[10px] text-gray-600 border-t border-gray-800">
          Times shown with summer offsets active (EDT/CDT/PDT/BST/CEST). Verify with your local broadcaster.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stadiums section — static WC_VENUES registry
// ---------------------------------------------------------------------------

const FEATURED_VENUE_SLUGS = [
  'metlife-stadium',
  'azteca-stadium',
  'dallas',
  'los-angeles',
  'miami',
  'san-francisco',
  'boston',
  'philadelphia',
] as const;

function StadiumsSection() {
  const venues = FEATURED_VENUE_SLUGS.map((slug) => WC_VENUES[slug]).filter(Boolean);
  return (
    <section aria-labelledby="stadiums-heading">
      <h2 id="stadiums-heading" className="text-xl font-bold text-white mb-1">
        Stadiums
      </h2>
      <p className="text-gray-500 text-sm mb-4">
        FIFA World Cup 2026 is hosted across 16 venues in the USA, Canada and Mexico.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {venues.map((v) => (
          <Link
            key={v.slug}
            href={`/world-cup-2026/venues/${v.slug}`}
            className="group flex items-start gap-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-xl px-4 py-3 transition-all"
          >
            <span className="text-xl shrink-0 mt-0.5">{v.countryFlag}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-yellow-400 transition-colors truncate">
                {v.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {v.city}, {v.stateOrRegion} · {v.capacity.toLocaleString()} seats
              </p>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/world-cup-2026/venues"
        className="mt-3 inline-block text-xs text-yellow-500 hover:text-yellow-300 transition-colors"
      >
        View all 16 World Cup venues →
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    q: 'What World Cup 2026 matches are tomorrow?',
    a: 'This page shows all FIFA World Cup 2026 matches scheduled for tomorrow (UTC). The schedule updates in real time — check back if fixtures change.',
  },
  {
    q: "What time do tomorrow's World Cup matches kick off?",
    a: 'Group stage fixtures are scheduled at four daily slots: 16:00, 19:00, 22:00 and 01:00 UTC. In Eastern Time (ET) those are 12:00 PM, 3:00 PM, 6:00 PM and 9:00 PM. The Kickoff Times table on this page shows all six major time zones.',
  },
  {
    q: "Where can I watch tomorrow's World Cup matches?",
    a: 'US viewers: Fox, FS1, Telemundo. UK viewers: BBC or ITV (free to air). Canada: TSN, CTV. Australia: SBS (free). Visit our Watch Live page for the full international broadcaster guide.',
  },
  {
    q: 'Are there any big matches tomorrow in the World Cup?',
    a: "See the fixtures listed on this page for tomorrow's confirmed World Cup matchups. High-profile group stage games and knockout matches are all covered with links to detailed match pages.",
  },
  {
    q: "How can I get a reminder for tomorrow's World Cup matches?",
    a: "Subscribe to GoalRadar's free newsletter for match day reminders delivered to your inbox. You can also set calendar alerts from the match page — click any fixture for the full kick-off details.",
  },
  {
    q: "What if tomorrow's World Cup match is postponed?",
    a: "Postponements are rare at World Cups due to the controlled environment and FIFA's planning. If a match is postponed, this page and the match's individual page will reflect the updated schedule as soon as FIFA confirms.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MatchesTomorrowPage() {
  const tomorrow = tomorrowUTC();
  const dayAfter = dayAfterUTC();
  const builtAt  = new Date().toISOString();

  const { matches: allMatches } = await getWCAuthorityMatchesV2(builtAt, { source: '/world-cup-2026/matches-tomorrow', sourceType: 'page' }).catch(() => ({ matches: [] as CanonicalMatch[] }));

  const tomorrowMatches: CanonicalMatch[] = allMatches
    .filter((m) => m.utcDate.startsWith(tomorrow) && m.state !== 'finished')
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());

  const dayAfterMatches: CanonicalMatch[] = allMatches
    .filter((m) => m.utcDate.startsWith(dayAfter) && m.state !== 'finished')
    .slice(0, 4);

  const displayDate = formatLocalDate(tomorrow);

  // SportsEvent schemas — one per tomorrow's match
  const sportsEventSchemas = buildSportsEventSchemas(tomorrowMatches);

  // JSON-LD
  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',             item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',   item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Matches Tomorrow', item: PAGE_URL },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      {sportsEventSchemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}

      <div className="max-w-2xl mx-auto pb-16 space-y-6">
        <Breadcrumb items={[
          { label: 'Home',           href: '/'                  },
          { label: 'World Cup 2026', href: '/world-cup-2026'    },
          { label: 'Matches Tomorrow'                           },
        ]} />

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📅</span>
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">FIFA World Cup 2026</span>
          </div>
          <h1 className="text-3xl font-black text-white leading-tight mb-1">World Cup Matches Tomorrow</h1>
          <p className="text-gray-400 text-sm">{displayDate}</p>
        </div>

        {/* Ad: top */}
        <AdSlot slotId="tomorrow-top" variant="banner" />

        {/* ── 1. Tomorrow's fixtures ───────────────────────────────────────── */}
        {tomorrowMatches.length > 0 ? (
          <section aria-labelledby="fixtures-heading">
            <h2 id="fixtures-heading" className="text-xl font-bold text-white mb-3">
              Tomorrow&apos;s World Cup Matches
              <span className="ml-2 text-sm font-normal text-gray-500">
                {tomorrowMatches.length} fixture{tomorrowMatches.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <div className="space-y-2">
              {tomorrowMatches.map((m) => <KickoffRow key={m.id} match={m} />)}
            </div>
          </section>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-3">
            <div className="text-4xl">📅</div>
            <h2 className="text-white font-bold text-lg">No Fixtures Confirmed for Tomorrow</h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Tomorrow may be a rest day, or the schedule hasn&apos;t been updated yet.
            </p>
            <Link
              href="/schedule?competition=WC"
              className="inline-block bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-2 rounded-lg text-sm font-bold transition-colors mt-2"
            >
              Full WC Schedule →
            </Link>
          </div>
        )}

        {/* ── 2. Kickoff Times ─────────────────────────────────────────────── */}
        <KickoffTimesSection matches={tomorrowMatches} />

        {/* ── 3. Stadiums ──────────────────────────────────────────────────── */}
        <StadiumsSection />

        {/* ── 4. TV / Streaming ────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-yellow-950/30 to-gray-900 border border-yellow-800/30 rounded-2xl p-5">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1">📺 Don&apos;t Miss a Match</p>
          <p className="text-white font-bold text-base mb-1">Set up your stream before kick-off</p>
          <p className="text-gray-400 text-sm mb-4">
            Find your country&apos;s official broadcaster and streaming options — no illegal streams.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/world-cup-2026/watch-live"
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              Watch Live Guide →
            </Link>
            <Link
              href="/world-cup-2026/tv-schedule"
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold border border-gray-700 transition-colors"
            >
              TV Schedule
            </Link>
            <Link
              href="/world-cup-2026/streaming-guide"
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold border border-gray-700 transition-colors"
            >
              Streaming Guide
            </Link>
          </div>
        </div>

        {/* Ad: mid */}
        <AdSlot slotId="tomorrow-mid" variant="rectangle" className="mx-auto" />

        {/* Day after teaser */}
        {dayAfterMatches.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Coming in 2 Days</h2>
              <Link href="/schedule?competition=WC" className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
                Full schedule →
              </Link>
            </div>
            <div className="space-y-2 opacity-70">
              {dayAfterMatches.map((m) => <KickoffRow key={m.id} match={m} />)}
            </div>
          </section>
        )}

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
        <AdSlot slotId="tomorrow-bottom" variant="banner" />

        {/* ── 5. Related links ─────────────────────────────────────────────── */}
        <div className="border-t border-gray-800 pt-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">More World Cup 2026</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/live',                             label: '🔴 Live Scores'  },
              { href: '/world-cup-2026-standings',         label: '📊 Standings'    },
              { href: '/world-cup-2026/groups',            label: '🗂️ Groups'       },
              { href: '/world-cup-2026/bracket',           label: '🔗 Bracket'      },
              { href: '/world-cup-2026/matches-today',     label: '⚽ Today'        },
              { href: '/schedule?competition=WC',          label: '📋 All Fixtures' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-3 text-sm text-gray-300 hover:text-white transition-colors text-center"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
