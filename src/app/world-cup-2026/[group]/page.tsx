import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

// PERF-4.5
import { getStandingsCached, getUpcomingMatchesCached, getRecentMatchesCached } from '@/lib/api';
import { getGroupFixtures, WC_GROUP_FIXTURES, type WCGroupFixture } from '@/lib/wc-fixtures';
import { getStaticWCGroupTables } from '@/lib/wc-static-groups';
import { WC_ALL_TEAMS } from '@/lib/wc-all-teams';
import { matchPath } from '@/lib/url';
import type { Match, StandingEntry } from '@/lib/types';
import MatchCard from '@/components/MatchCard';
import WCGroupTable from '@/components/WCGroupTable';
import Breadcrumb from '@/components/Breadcrumb';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 3600;

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
  const letter = letterFromSlug(slug);

  // Use local team data — no API call needed during build
  const groupTeams = WC_ALL_TEAMS.filter((t) => t.group === letter);
  const teamNames  = groupTeams.map((t) => t.displayName).join(', ');
  const teamsText  = teamNames ? ` Featuring ${teamNames}.` : '';

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

/** Resolve a WC team slug from the API team name or display name. */
function wcTeamSlug(name: string): string | null {
  const t = WC_ALL_TEAMS.find(
    (t) =>
      t.apiName.toLowerCase() === name.toLowerCase() ||
      t.displayName.toLowerCase() === name.toLowerCase(),
  );
  return t?.slug ?? null;
}

function TeamCard({ entry, rank }: { entry: StandingEntry; rank: number }) {
  const advances    = rank <= 2;
  const mayAdvance  = rank === 3; // best third-placed teams rule
  const { team }    = entry;
  const slug        = wcTeamSlug(team.name);
  const href        = slug ? `/world-cup-2026/teams/${slug}` : `/teams/${team.id}`;

  return (
    <Link
      href={href}
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
// FAQ — generated from static fixture + team data (no API call)
// ---------------------------------------------------------------------------

interface GroupFaq {
  question: string;
  answer: string;
}

function buildGroupFaqs(letter: string, label: string): GroupFaq[] {
  const groupTeams = WC_ALL_TEAMS.filter((t) => t.group === letter);
  const fixtures   = getGroupFixtures(letter);

  const teamNames  = groupTeams.map((t) => `${t.flag} ${t.displayName}`).join(', ');

  // Distinct venue cities
  const cities = [...new Set(fixtures.map((f) => f.venueCity))];
  const venueText = cities.length > 0 ? cities.join(', ') : 'various venues across the USA, Canada and Mexico';

  // Date range
  const dates = fixtures.map((f) => f.utcDate).sort();
  const startDate = dates[0]
    ? new Date(dates[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '11 June 2026';
  const endDate = dates[dates.length - 1]
    ? new Date(dates[dates.length - 1]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '30 June 2026';

  // Match fixture list
  const fixtureLines = fixtures.map(
    (f) =>
      `${f.homeLabel} vs ${f.awayLabel} (Matchday ${f.matchday}, ${f.venueCity})`,
  );
  const fixtureText = fixtureLines.length > 0
    ? fixtureLines.join('; ')
    : 'Fixtures to be confirmed.';

  // Top team by FIFA ranking
  const sortedByRanking = [...groupTeams].sort((a, b) => a.fifaRanking - b.fifaRanking);
  const topTeam = sortedByRanking[0];
  const favoriteText = topTeam
    ? `${topTeam.displayName} (FIFA ranking #${topTeam.fifaRanking}) enter as the highest-ranked side in ${label}, making them the pre-tournament favourite to top the group.`
    : `All teams enter ${label} with a genuine chance of qualification.`;

  return [
    {
      question: `Which teams are in FIFA World Cup 2026 ${label}?`,
      answer: `${label} at the FIFA World Cup 2026 features four teams: ${teamNames}. Each team will play three group-stage matches against the other sides in the group.`,
    },
    {
      question: `When does FIFA World Cup 2026 ${label} start and finish?`,
      answer: `${label} begins on ${startDate} and concludes on ${endDate}. All three matchdays must be completed before the knockout stage begins, with the final matchday fixtures played simultaneously to ensure fairness.`,
    },
    {
      question: `How do teams qualify from ${label} at the 2026 World Cup?`,
      answer: `The top two teams from ${label} advance automatically to the Round of 32. Additionally, 8 of the 12 third-placed teams (those with the best record across all groups) will also progress. Teams earn 3 points for a win, 1 point for a draw, and 0 points for a loss. If teams are level on points, tiebreakers are applied in order: goal difference, goals scored, head-to-head result, and disciplinary record.`,
    },
    {
      question: `Where are ${label} matches played at the 2026 World Cup?`,
      answer: `${label} fixtures take place at ${venueText}. The FIFA World Cup 2026 is co-hosted by the United States, Canada and Mexico, with matches spread across 16 stadiums in all three nations.`,
    },
    {
      question: `What are the ${label} fixtures at the 2026 World Cup?`,
      answer: `The ${label} schedule is: ${fixtureText}.`,
    },
    {
      question: `Who is the favourite to win ${label} at the 2026 World Cup?`,
      answer: favoriteText,
    },
  ];
}

function GroupFaqJsonLd({ faqs }: { faqs: GroupFaq[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function GroupFaqSection({ faqs }: { faqs: GroupFaq[] }) {
  return (
    <section aria-labelledby="faq-heading">
      <h2
        id="faq-heading"
        className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4"
      >
        Frequently Asked Questions
      </h2>
      <dl className="space-y-4">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4"
          >
            <dt className="text-sm font-semibold text-white mb-1.5">
              {faq.question}
            </dt>
            <dd className="text-sm text-gray-400 leading-relaxed">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Qualification scenarios — static analysis, works pre-tournament
// ---------------------------------------------------------------------------

function QualificationScenarios({
  label,
  letter,
  tableEntries,
  totalMatches,
  playedMatches,
}: {
  label: string;
  letter: string;
  tableEntries: StandingEntry[];
  totalMatches: number;
  playedMatches: number;
}) {
  const groupTeams = WC_ALL_TEAMS.filter((t) => t.group === letter);
  const hasLiveData = tableEntries.some((e) => e.playedGames > 0);
  const groupComplete = playedMatches >= totalMatches && totalMatches > 0;

  return (
    <section aria-labelledby="scenarios-heading">
      <h2
        id="scenarios-heading"
        className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4"
      >
        Qualification Scenarios
      </h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
        {/* Points system */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Points System</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { result: 'Win', points: '3 pts', color: 'text-green-400' },
              { result: 'Draw', points: '1 pt',  color: 'text-yellow-400' },
              { result: 'Loss', points: '0 pts', color: 'text-red-400' },
            ].map(({ result, points, color }) => (
              <div key={result} className="bg-gray-800 rounded-lg py-2 px-3">
                <p className={`text-xs font-bold ${color}`}>{result}</p>
                <p className="text-white text-sm font-semibold">{points}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Qualification paths */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">How to Qualify</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
              <p><strong className="text-white">1st place:</strong> Automatically advances to the Round of 32. Maximum 9 points (3 wins). Six points from two wins is typically enough to clinch top spot.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
              <p><strong className="text-white">2nd place:</strong> Automatically advances to the Round of 32. Four or more points generally secures a top-two finish, depending on the group.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-500 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
              <p><strong className="text-white">3rd place (best record):</strong> Eight of the twelve third-placed teams advance. A team finishing third typically needs at least 4 points to be considered for one of the eight best-third-place spots. Goal difference is the first tiebreaker.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-500 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">4</span>
              <p><strong className="text-white">4th place:</strong> Eliminated. A team finishing fourth is out regardless of their points total.</p>
            </div>
          </div>
        </div>

        {/* Tiebreakers */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Tiebreaker Rules</h3>
          <p className="text-sm text-gray-400">
            When teams finish level on points, FIFA applies tiebreakers in order:{' '}
            <strong className="text-gray-300">(1)</strong> goal difference,{' '}
            <strong className="text-gray-300">(2)</strong> goals scored,{' '}
            <strong className="text-gray-300">(3)</strong> head-to-head points,{' '}
            <strong className="text-gray-300">(4)</strong> head-to-head goal difference,{' '}
            <strong className="text-gray-300">(5)</strong> disciplinary record,{' '}
            <strong className="text-gray-300">(6)</strong> FIFA ranking.
          </p>
        </div>

        {/* Live scenario analysis — only shown when matches have been played */}
        {hasLiveData && !groupComplete && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Current Standing Analysis</h3>
            <div className="space-y-2">
              {tableEntries.map((entry, i) => {
                const rank = i + 1;
                const gamesLeft = 3 - entry.playedGames;
                const maxPts = entry.points + gamesLeft * 3;
                const canStillWin = maxPts >= (tableEntries[0]?.points ?? 0);

                let outlook = '';
                if (rank <= 2 && entry.points >= 6) {
                  outlook = 'Very likely to qualify — needs only a draw from remaining matches.';
                } else if (rank <= 2 && entry.points >= 4) {
                  outlook = 'On track to qualify — a win or draw from remaining fixtures should be enough.';
                } else if (rank === 3 && entry.points >= 4) {
                  outlook = 'In contention for a best third-place spot — results in other groups will matter.';
                } else if (rank === 4 && !canStillWin) {
                  outlook = 'Eliminated from top-two contention. Must win remaining matches and hope for a best-third qualification.';
                } else if (gamesLeft === 0) {
                  outlook = rank <= 2 ? 'Qualified for the Round of 32.' : 'Awaiting best third-place determination.';
                } else {
                  outlook = `${gamesLeft} match${gamesLeft !== 1 ? 'es' : ''} remaining — maximum ${maxPts} points achievable.`;
                }

                return (
                  <div key={entry.team.id || i} className="flex items-start gap-2 text-sm">
                    <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                      rank <= 2 ? 'bg-green-500/20 text-green-400' : rank === 3 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-700 text-gray-500'
                    }`}>{rank}</span>
                    <div>
                      <span className="text-white font-medium">
                        {entry.team.shortName || entry.team.name}
                      </span>
                      <span className="text-gray-600 text-xs ml-2">{entry.points} pts</span>
                      <p className="text-gray-500 text-xs mt-0.5">{outlook}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pre-tournament — show team-level max points potential */}
        {!hasLiveData && groupTeams.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Pre-Tournament Overview</h3>
            <p className="text-sm text-gray-400">
              Each of the four teams in {label} will play 3 matches (6 total — every team plays each other once).
              The maximum any team can earn is <strong className="text-white">9 points</strong> (three wins).
              Historically at the World Cup, 6 points (2 wins) is virtually guaranteed to advance,
              4 points (1W 1D 1L) usually qualifies in the top two or as a strong third-place team,
              and 3 points or fewer typically requires other results to go your way.
            </p>
            {groupTeams.length > 0 && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...groupTeams]
                  .sort((a, b) => a.fifaRanking - b.fifaRanking)
                  .map((t) => (
                    <div key={t.slug} className="flex items-center gap-2 text-sm">
                      <span className="text-base">{t.flag}</span>
                      <Link
                        href={`/world-cup-2026/teams/${t.slug}`}
                        className="text-white hover:text-yellow-400 transition-colors font-medium"
                      >
                        {t.displayName}
                      </Link>
                      <span className="text-gray-600 text-xs ml-auto shrink-0">
                        FIFA #{t.fifaRanking}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {groupComplete && (
          <p className="text-sm text-gray-400 border-t border-gray-800 pt-3">
            ✅ {label} is complete. The top two teams have advanced to the Round of 32.
          </p>
        )}
      </div>
    </section>
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
    getStandingsCached('WC'),
    getUpcomingMatchesCached('WC'),
    getRecentMatchesCached('WC'),
  ]);

  // Group standings table — fall back to static (zeroed) table if API fails
  const liveGroupTable =
    standingsResult.status === 'fulfilled'
      ? standingsResult.value.standings.find(
          (s) => s.type === 'TOTAL' && s.group === apiGroup
        ) ?? null
      : null;

  let tableEntries: StandingEntry[] = liveGroupTable?.table ?? [];
  let isStaticStandings = false;

  if (tableEntries.length === 0) {
    // Serve static pre-tournament group table so the page always has team names
    const staticTables = getStaticWCGroupTables();
    const staticGroup  = staticTables.find((t) => t.group === apiGroup);
    tableEntries       = staticGroup?.table ?? [];
    isStaticStandings  = tableEntries.length > 0;
  }

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

  // Local fixture fallback — used when API upcoming is empty (pre-tournament or API down)
  const localFixtures: WCGroupFixture[] =
    upcoming.length === 0 && results.length === 0
      ? getGroupFixtures(letter)
      : [];

  const allMatches = [...allGroupResults, ...allGroupUpcoming];
  const totalGroupMatches = 6; // each WC group plays 6 matches (4 teams × 3 rounds C(4,2))
  const playedMatches = results.length;

  const faqs = buildGroupFaqs(letter, label);

  return (
    <>
      <JsonLd slug={slug} label={label} allMatches={allMatches} />
      <GroupFaqJsonLd faqs={faqs} />

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
              {isStaticStandings && (
                <p className="text-xs text-yellow-600/80 mt-2 px-1">
                  ⏳ Pre-tournament lineup — live standings update once matches begin on 11 June 2026.
                </p>
              )}
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
            {localFixtures.length > 0 ? 'Group Stage Schedule' : 'Upcoming Fixtures'}
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
          ) : localFixtures.length > 0 ? (
            /* Local static fixture list — shown when API is unavailable pre-tournament */
            <div className="space-y-2">
              {localFixtures.map((f) => (
                <div key={f.localId} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {f.homeFlag} {f.homeLabel} <span className="text-gray-500 font-normal">vs</span> {f.awayLabel} {f.awayFlag}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatKickoff(f.utcDate)} · {f.venueCity}</p>
                  </div>
                  <span className="text-[10px] text-gray-600 shrink-0">MD{f.matchday}</span>
                </div>
              ))}
              <p className="text-xs text-gray-600 px-1 pt-1">
                ℹ️ Scheduled kickoff times — live match links appear once the tournament begins.
              </p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              {results.length >= totalGroupMatches
                ? 'All group stage matches have been played.'
                : 'No upcoming fixtures for this group yet.'}
            </div>
          )}
        </section>

        {/* 6. Qualification scenarios */}
        <QualificationScenarios
          label={label}
          letter={letter}
          tableEntries={tableEntries}
          totalMatches={totalGroupMatches}
          playedMatches={playedMatches}
        />

        {/* 7. FAQ */}
        <GroupFaqSection faqs={faqs} />

        {/* Adjacent group navigation */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <GroupNav currentSlug={slug} />
        </div>

        {/* Internal links — standings, schedule, results, teams + hub */}
        <WCRelatedLinks
          sectionId={`wc-group-${letter.toLowerCase()}-links`}
          heading="More World Cup 2026"
          links={[
            {
              href:  '/world-cup-2026-standings',
              icon:  '📊',
              label: 'Group Standings',
              desc:  `Live standings tables for all 12 groups including ${label}`,
            },
            {
              href:  '/world-cup-2026-schedule',
              icon:  '📅',
              label: 'Full Schedule',
              desc:  'All 104 fixtures with kickoff times and venues',
            },
            {
              href:  '/world-cup-2026-results',
              icon:  '🏁',
              label: 'Results',
              desc:  'Scores for every completed World Cup 2026 match',
            },
            {
              href:  '/world-cup-2026/teams',
              icon:  '👥',
              label: 'All 48 Teams',
              desc:  'Squads, stats and fixtures for every qualified nation',
            },
            {
              href:  '/world-cup-2026-groups',
              icon:  '🗂️',
              label: 'Group Stage Guide',
              desc:  'Group draws, qualification rules and fixture lists',
            },
            {
              href:  '/world-cup-2026',
              icon:  '🏆',
              label: 'WC 2026 Hub',
              desc:  'Full tournament overview — fixtures, results and standings',
            },
            {
              href:  '/world-cup-2026-bracket',
              icon:  '🔗',
              label: 'Knockout Bracket',
              desc:  'Round of 32 draw through to the Final',
            },
            {
              href:  '/live',
              icon:  '🔴',
              label: 'Live Scores',
              desc:  'In-play scores across all competitions right now',
            },
          ]}
        />
      </div>
    </>
  );
}
