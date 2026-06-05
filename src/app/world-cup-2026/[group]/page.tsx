import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getStandings, getUpcomingMatches, getRecentMatches } from '@/lib/api';
import { matchPath } from '@/lib/url';
import type { Match, StandingEntry } from '@/lib/types';
import MatchCard from '@/components/MatchCard';
import WCGroupTable from '@/components/WCGroupTable';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 60;

const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Group slug mapping — WC 2026 has 12 groups A–L
// ---------------------------------------------------------------------------

const GROUPS = ['a','b','c','d','e','f','g','h','i','j','k','l'] as const;
type GroupLetter = (typeof GROUPS)[number];

function isValidSlug(slug: string): slug is `group-${GroupLetter}` {
  return GROUPS.includes(slug.replace('group-', '') as GroupLetter);
}

function slugToApiGroup(slug: string) {
  return slug.replace('group-', 'GROUP_').toUpperCase(); // group-a → GROUP_A
}

function slugToLabel(slug: string) {
  const letter = slug.replace('group-', '').toUpperCase(); // group-a → 'A'
  return `Group ${letter}`;
}

function letterFromSlug(slug: string) {
  return slug.replace('group-', '').toUpperCase();
}

type Params = { params: Promise<{ group: string }> };

export function generateStaticParams() {
  return GROUPS.map((g) => ({ group: `group-${g}` }));
}

// ---------------------------------------------------------------------------
// Metadata — includes team names when available
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { group: slug } = await params;
  if (!isValidSlug(slug)) return { title: 'World Cup 2026 | GoalRadar' };

  const label = slugToLabel(slug);
  const url   = `${BASE_URL}/world-cup-2026/${slug}`;

  let teamNames = '';
  try {
    const data = await getStandings('WC');
    const table = data.standings.find(
      (s) => s.type === 'TOTAL' && s.group === slugToApiGroup(slug)
    );
    if (table?.table.length) {
      teamNames = table.table
        .map((e) => e.team.shortName || e.team.name)
        .join(', ');
    }
  } catch { /* standings not yet available */ }

  const teamsText = teamNames ? ` Featuring ${teamNames}.` : '';
  const title = `FIFA World Cup 2026 ${label} Standings, Fixtures & Teams | GoalRadar`;
  const description =
    `Follow FIFA World Cup 2026 ${label} with live standings, match results, upcoming fixtures and team information.${teamsText}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: 'website', url },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKickoff(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// JSON-LD: BreadcrumbList + CollectionPage + SportsEvent
// ---------------------------------------------------------------------------

function JsonLd({
  slug, label, allMatches,
}: {
  slug: string;
  label: string;
  allMatches: Match[];
}) {
  const pageUrl = `${BASE_URL}/world-cup-2026/${slug}`;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',            item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',  item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: label,             item: pageUrl },
    ],
  };

  // SportsEvent schema items for each match in the group
  const eventItems = allMatches.map((m) => ({
    '@type': 'SportsEvent',
    name: `${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}`,
    sport: 'Football',
    startDate: m.utcDate,
    url: `${BASE_URL}${matchPath(m.id, m.homeTeam?.name, m.awayTeam?.name)}`,
    location: { '@type': 'Place', name: 'FIFA World Cup 2026' },
  }));

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `FIFA World Cup 2026 ${label} – Fixtures & Standings`,
    description: `All ${label} fixtures, results and standings for FIFA World Cup 2026.`,
    url: pageUrl,
    isPartOf: { '@type': 'WebSite', name: 'GoalRadar', url: BASE_URL },
    hasPart: eventItems,
  };

  const sortedDates = allMatches.map((m) => m.utcDate).sort();
  const sportsEvent = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `FIFA World Cup 2026 ${label}`,
    sport: 'Football',
    startDate: sortedDates[0] ?? '2026-06-11',
    endDate: sortedDates[sortedDates.length - 1] ?? '2026-06-26',
    url: pageUrl,
    location: {
      '@type': 'Place',
      name: 'United States, Canada & Mexico',
      address: { '@type': 'PostalAddress', addressCountry: 'US' },
    },
    organizer: { '@type': 'Organization', name: 'FIFA', url: 'https://www.fifa.com' },
    superEvent: {
      '@type': 'SportsEvent',
      name: 'FIFA World Cup 2026',
      url: `${BASE_URL}/world-cup-2026`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPage) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEvent) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Teams grid
// ---------------------------------------------------------------------------

function TeamCard({ entry, rank }: { entry: StandingEntry; rank: number }) {
  const advances    = rank <= 2;
  const mayAdvance  = rank === 3; // best third-placed teams rule
  const { team }    = entry;

  return (
    <Link
      href={`/team/${team.id}`}
      className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 hover:bg-gray-800/50 transition-all group"
    >
      {team.crest ? (
        <img src={team.crest} alt={team.name} width={36} height={36} className="object-contain shrink-0" />
      ) : (
        <div className="w-9 h-9 bg-gray-800 rounded-full shrink-0 flex items-center justify-center text-gray-600 text-xs">
          {team.tla ?? '?'}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-white font-semibold text-sm truncate group-hover:text-green-400 transition-colors">
          {team.name}
        </p>
        <p className="text-gray-600 text-xs">{team.tla}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className="text-white font-bold text-sm">{entry.points}pts</span>
        {advances && (
          <p className="text-green-400 text-[10px] font-semibold">Advancing</p>
        )}
        {mayAdvance && (
          <p className="text-yellow-500 text-[10px]">May qualify</p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Qualification summary
// ---------------------------------------------------------------------------

function QualificationSummary({
  table, label, totalMatches, playedMatches,
}: {
  table: StandingEntry[];
  label: string;
  totalMatches: number;
  playedMatches: number;
}) {
  const complete    = playedMatches >= totalMatches && totalMatches > 0;
  const started     = playedMatches > 0;
  const qualifier1  = table[0];
  const qualifier2  = table[1];
  const mayQualify  = table[2]; // best third-place possibility

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Qualification
        </h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          complete
            ? 'bg-gray-700 text-gray-300'
            : started
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {complete ? 'Group complete' : started ? `${playedMatches}/${totalMatches} played` : 'Not started'}
        </span>
      </div>

      <p className="text-sm text-gray-400">
        The top 2 teams from {label} advance automatically to the{' '}
        <strong className="text-white">Round of 32</strong>. The best 8 third-placed teams across all 12 groups may also qualify.
      </p>

      {started && (
        <div className="space-y-1.5 pt-1">
          {qualifier1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center font-bold shrink-0">1</span>
              <span className={`font-medium ${complete ? 'text-green-400' : 'text-white'}`}>
                {qualifier1.team.shortName || qualifier1.team.name}
              </span>
              <span className="text-gray-600 text-xs ml-auto">{qualifier1.points} pts</span>
              {complete && <span className="text-green-400 text-xs font-semibold">✓ Qualified</span>}
            </div>
          )}
          {qualifier2 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center font-bold shrink-0">2</span>
              <span className={`font-medium ${complete ? 'text-green-400' : 'text-white'}`}>
                {qualifier2.team.shortName || qualifier2.team.name}
              </span>
              <span className="text-gray-600 text-xs ml-auto">{qualifier2.points} pts</span>
              {complete && <span className="text-green-400 text-xs font-semibold">✓ Qualified</span>}
            </div>
          )}
          {mayQualify && (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-500 text-xs flex items-center justify-center font-bold shrink-0">3</span>
              <span className="text-gray-400 font-medium">
                {mayQualify.team.shortName || mayQualify.team.name}
              </span>
              <span className="text-gray-600 text-xs ml-auto">{mayQualify.points} pts</span>
              <span className="text-yellow-500 text-xs">May qualify</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adjacent group navigation
// ---------------------------------------------------------------------------

function GroupNav({ currentSlug }: { currentSlug: string }) {
  const letter  = currentSlug.replace('group-', '') as GroupLetter;
  const idx     = GROUPS.indexOf(letter);
  const prev    = idx > 0               ? `group-${GROUPS[idx - 1]}` : null;
  const next    = idx < GROUPS.length-1 ? `group-${GROUPS[idx + 1]}` : null;

  return (
    <div className="flex items-center justify-between pt-2">
      {prev ? (
        <Link
          href={`/world-cup-2026/${prev}`}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← {slugToLabel(prev)}
        </Link>
      ) : <span />}
      <Link
        href="/world-cup-2026"
        className="text-sm text-yellow-500 hover:text-yellow-300 transition-colors font-medium"
      >
        🏆 All Groups
      </Link>
      {next ? (
        <Link
          href={`/world-cup-2026/${next}`}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {slugToLabel(next)} →
        </Link>
      ) : <span />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCGroupPage({ params }: Params) {
  const { group: slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const apiGroup = slugToApiGroup(slug);
  const label    = slugToLabel(slug);
  const letter   = letterFromSlug(slug);

  const [standingsResult, upcomingResult, recentResult] = await Promise.allSettled([
    getStandings('WC'),
    getUpcomingMatches('WC'),
    getRecentMatches('WC'),
  ]);

  // Group standings table
  const groupTable =
    standingsResult.status === 'fulfilled'
      ? standingsResult.value.standings.find(
          (s) => s.type === 'TOTAL' && s.group === apiGroup
        ) ?? null
      : null;

  const tableEntries: StandingEntry[] = groupTable?.table ?? [];

  // All group matches — for JSON-LD and stats
  const allGroupUpcoming: Match[] =
    upcomingResult.status === 'fulfilled'
      ? upcomingResult.value.matches.filter((m) => m.group === apiGroup)
      : [];

  const allGroupResults: Match[] =
    recentResult.status === 'fulfilled'
      ? recentResult.value.matches.filter((m) => m.group === apiGroup && m.status === 'FINISHED')
      : [];

  const upcoming = [...allGroupUpcoming].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );
  const results = [...allGroupResults].sort(
    (a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
  );

  const allMatches = [...allGroupResults, ...allGroupUpcoming];
  const totalGroupMatches = 6; // each WC group plays 6 matches (4 teams × 3 rounds C(4,2))
  const playedMatches = results.length;

  return (
    <>
      <JsonLd slug={slug} label={label} allMatches={allMatches} />

      <div className="max-w-3xl mx-auto space-y-8 pb-10">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Home',          href: '/' },
            { label: 'World Cup 2026', href: '/world-cup-2026' },
            { label: label },
          ]}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-yellow-400 font-black text-lg">{letter}</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {label}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">FIFA World Cup 2026</p>
            </div>
          </div>
          <Link
            href="/world-cup-2026"
            className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors shrink-0 flex items-center gap-1"
          >
            🏆 World Cup hub
          </Link>
        </div>

        {/* 1. Group standings */}
        <section aria-labelledby="standings-heading">
          <h2 id="standings-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Group Standings
          </h2>
          {tableEntries.length > 0 ? (
            <>
              <WCGroupTable group={apiGroup} table={tableEntries} />
              <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0" />
                Advances to knockout stage
              </p>
            </>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              Standings will appear once matches begin on 11 June 2026.
            </div>
          )}
        </section>

        {/* 2. Qualification summary */}
        <section aria-labelledby="qual-heading">
          <h2 id="qual-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Qualification Summary
          </h2>
          <QualificationSummary
            table={tableEntries}
            label={label}
            totalMatches={totalGroupMatches}
            playedMatches={playedMatches}
          />
        </section>

        {/* 3. Teams */}
        {tableEntries.length > 0 && (
          <section aria-labelledby="teams-heading">
            <h2 id="teams-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Teams
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tableEntries.map((entry, i) => (
                <TeamCard key={entry.team.id} entry={entry} rank={i + 1} />
              ))}
            </div>
          </section>
        )}

        {/* 4. Results */}
        {results.length > 0 && (
          <section aria-labelledby="results-heading">
            <h2 id="results-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Results
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* 5. Upcoming fixtures */}
        <section aria-labelledby="fixtures-heading">
          <h2 id="fixtures-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Upcoming Fixtures
          </h2>
          {upcoming.length > 0 ? (
            <div className="space-y-2">
              {upcoming.map((m) => (
                <div key={m.id}>
                  <p className="text-xs text-gray-600 mb-1.5 px-1">{formatKickoff(m.utcDate)}</p>
                  <MatchCard match={m} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              {results.length >= totalGroupMatches
                ? 'All group stage matches have been played.'
                : 'No upcoming fixtures for this group yet.'}
            </div>
          )}
        </section>

        {/* Internal links — World Cup hub + adjacent groups */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            World Cup 2026 Navigation
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/world-cup-2026"
              className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-yellow-500/25 transition-colors"
            >
              🏆 Tournament Hub
            </Link>
            <Link
              href="/world-cup-2026"
              className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-700 transition-colors"
            >
              All Groups & Standings
            </Link>
            <Link
              href="/live"
              className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-700 transition-colors"
            >
              Live Scores
            </Link>
          </div>
          <GroupNav currentSlug={slug} />
        </div>
      </div>
    </>
  );
}
