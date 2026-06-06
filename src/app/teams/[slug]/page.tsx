/**
 * /teams/[slug] — SEO team profile page.
 *
 * Slug format: {id}-{slugified-name}   e.g. "57-arsenal-fc"
 * The numeric ID prefix makes resolution reliable without a static registry.
 *
 * Canonical enforcement: if the slug doesn't match {id}-{slugify(team.name)}
 * the page issues a 308 permanent redirect so there is exactly one URL per team.
 *
 * Sections
 *   1. Team header   — crest, name, TLA, league, coach, founded, venue, colors
 *   2. League standing — single-row table + zone label + full-table link
 *   3. Upcoming fixtures — next 5 from league schedule filtered for this team
 *   4. Recent results   — last 10 finished matches
 *   5. Internal links   — standings, schedule, competition hub
 *
 * Caching: ISR revalidate=300 (5 min). No generateStaticParams — renders on
 * first request then serves from cache. Zero API calls at build time.
 */

import Link from 'next/link';
import { permanentRedirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';

import {
  getTeam,
  getTeamMatches,
  getStandings,
  getUpcomingMatches,
  NotFoundError,
} from '@/lib/api';
import { COMPETITIONS } from '@/lib/types';
import type { TeamDetail, Match, StandingEntry } from '@/lib/types';
import { slugify, teamPath, matchPath, extractTeamId } from '@/lib/url';
import Breadcrumb from '@/components/Breadcrumb';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import AdSlot from '@/components/ads/AdSlot';

export const revalidate = 300;

const BASE_URL = 'https://goalradar.org';

type Params = { params: Promise<{ slug: string }> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coachName(team: TeamDetail): string | null {
  if (!team.coach) return null;
  const { firstName, lastName } = team.coach;
  return [firstName, lastName].filter(Boolean).join(' ') || null;
}

function formatDate(utcDate: string, includeTime = false): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  };
  if (includeTime) {
    opts.hour = '2-digit';
    opts.minute = '2-digit';
  }
  return new Date(utcDate).toLocaleDateString('en-GB', opts);
}

// Compute W / D / L outcome from a team's perspective
function outcome(match: Match, teamId: number): 'W' | 'D' | 'L' | null {
  if (match.status !== 'FINISHED') return null;
  const isHome = match.homeTeam.id === teamId;
  const winner = match.score.winner;
  if (!winner || winner === 'DRAW') return 'D';
  return winner === (isHome ? 'HOME_TEAM' : 'AWAY_TEAM') ? 'W' : 'L';
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const id = extractTeamId(slug);
  if (!id) return { title: 'Team | GoalRadar' };

  try {
    const team = await getTeam(id);
    const leagueComp = team.runningCompetitions.find(
      (c) => c.type === 'LEAGUE' && COMPETITIONS.some((k) => k.code === c.code),
    );
    const leagueName = leagueComp?.name ?? '';
    const canonical = `${BASE_URL}${teamPath(team.id, team.name)}`;

    const title = leagueName
      ? `${team.name} – Fixtures, Results & ${leagueName} Standing | GoalRadar`
      : `${team.name} – Squad, Fixtures & Results | GoalRadar`;
    const description =
      `${team.name} fixtures, results, league table position` +
      (leagueName ? ` and ${leagueName} standing` : '') +
      ` on GoalRadar. Live scores, upcoming matches and full match history.`;

    return {
      title,
      description,
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description,
        type: 'website',
        url: canonical,
        ...(team.crest ? { images: [{ url: team.crest, width: 200, height: 200, alt: team.name }] } : {}),
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
    };
  } catch {
    return { title: 'Team | GoalRadar' };
  }
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function TeamJsonLd({
  team,
  leagueName,
  leagueCode,
  canonicalUrl,
}: {
  team:         TeamDetail;
  leagueName:   string;
  leagueCode:   string;
  canonicalUrl: string;
}) {
  const coach = coachName(team);
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type':    'SportsTeam',
    name:        team.name,
    alternateName: team.shortName || team.tla || undefined,
    sport:      'Association Football',
    url:         canonicalUrl,
    image:       team.crest || undefined,
    ...(team.founded ? { foundingDate: String(team.founded) } : {}),
    ...(team.website ? { sameAs: [team.website] } : {}),
    ...(coach ? { coach: { '@type': 'Person', name: coach } } : {}),
    ...(team.venue
      ? {
          location: {
            '@type': 'StadiumOrArena',
            name:    team.venue,
            address: {
              '@type':          'PostalAddress',
              addressCountry:   team.area?.code ?? '',
              addressLocality:  team.area?.name ?? '',
            },
          },
        }
      : {}),
    ...(leagueName && leagueCode
      ? {
          memberOf: [
            {
              '@type': 'SportsOrganization',
              name:    leagueName,
              url:     `${BASE_URL}/competition/${leagueCode}`,
            },
          ],
        }
      : {}),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      ...(leagueName && leagueCode
        ? [{ '@type': 'ListItem', position: 2, name: leagueName, item: `${BASE_URL}/competition/${leagueCode}` }]
        : []),
      { '@type': 'ListItem', position: leagueName ? 3 : 2, name: team.name, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        {children}
      </h2>
      {action}
    </div>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs text-gray-500 hover:text-white transition-colors">
      {children}
    </Link>
  );
}

// Single-row league standing table
function StandingCard({
  entry,
  total,
  leagueName,
  leagueCode,
}: {
  entry:       StandingEntry;
  total:       number;
  leagueName:  string;
  leagueCode:  string;
}) {
  const i = entry.position - 1;
  const zone =
    i < 4
      ? { label: 'Champions League qualification zone', color: 'text-blue-400',   borderBar: 'border-l-blue-500' }
      : i === 4
      ? { label: 'Europa League qualification zone',   color: 'text-orange-400', borderBar: 'border-l-orange-400' }
      : i >= total - 3
      ? { label: 'Relegation zone',                   color: 'text-red-400',     borderBar: 'border-l-red-500' }
      : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <SectionHeader action={
        <SectionLink href={`/standings?competition=${leagueCode}`}>Full table →</SectionLink>
      }>
        {leagueName} Standing
      </SectionHeader>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-2.5 text-left w-10">#</th>
              <th className="px-4 py-2.5 text-center w-10">P</th>
              <th className="px-4 py-2.5 text-center w-10">W</th>
              <th className="px-4 py-2.5 text-center w-10">D</th>
              <th className="px-4 py-2.5 text-center w-10">L</th>
              <th className="px-4 py-2.5 text-center w-12">GD</th>
              <th className="px-4 py-2.5 text-center w-12 text-white font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            <tr
              className={`border-t border-gray-800 border-l-2 ${zone ? zone.borderBar : 'border-l-transparent'} bg-gray-800/30`}
            >
              <td className="px-4 py-3 text-white font-bold">{entry.position}</td>
              <td className="px-4 py-3 text-center text-gray-400">{entry.playedGames}</td>
              <td className="px-4 py-3 text-center text-gray-400">{entry.won}</td>
              <td className="px-4 py-3 text-center text-gray-400">{entry.draw}</td>
              <td className="px-4 py-3 text-center text-gray-400">{entry.lost}</td>
              <td
                className={`px-4 py-3 text-center ${
                  entry.goalDifference > 0
                    ? 'text-green-400'
                    : entry.goalDifference < 0
                    ? 'text-red-400'
                    : 'text-gray-400'
                }`}
              >
                {entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
              </td>
              <td className="px-4 py-3 text-center font-bold text-white">{entry.points}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {zone && (
        <p className={`mt-3 text-xs px-1 ${zone.color}`}>
          ● {zone.label} ({entry.position}/{total})
        </p>
      )}
    </div>
  );
}

// Upcoming fixtures list
function UpcomingCard({
  matches,
  teamId,
  leagueName,
  leagueCode,
}: {
  matches:     Match[];
  teamId:      number;
  leagueName:  string;
  leagueCode:  string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <SectionHeader action={
        <SectionLink href={`/schedule?competition=${leagueCode}`}>Full schedule →</SectionLink>
      }>
        Upcoming Fixtures
      </SectionHeader>

      <div className="divide-y divide-gray-800/60 rounded-xl border border-gray-800 overflow-hidden">
        {matches.map((match) => {
          const isHome   = match.homeTeam.id === teamId;
          const opponent = isHome ? match.awayTeam : match.homeTeam;
          return (
            <Link
              key={match.id}
              href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
              className="flex items-center gap-3 p-3 bg-gray-900 hover:bg-gray-800/60 transition-colors"
            >
              {/* Home / Away tag */}
              <span
                className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded shrink-0 ${
                  isHome
                    ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                    : 'bg-gray-700/60 text-gray-400'
                }`}
              >
                {isHome ? 'H' : 'A'}
              </span>

              {/* Opponent */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {opponent.crest && (
                  <img
                    src={opponent.crest}
                    alt=""
                    width={20}
                    height={20}
                    className="object-contain shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    vs {opponent.shortName || opponent.name}
                  </p>
                  <p className="text-gray-500 text-xs">{match.competition.name}</p>
                </div>
              </div>

              {/* Date */}
              <span className="text-gray-400 text-xs shrink-0 text-right">
                {formatDate(match.utcDate, true)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Recent results list
function RecentResultsCard({
  matches,
  teamId,
  leagueCode,
}: {
  matches:    Match[];
  teamId:     number;
  leagueCode: string;
}) {
  const outcomeStyles = {
    W: 'bg-green-500/15 text-green-400 border border-green-500/25',
    D: 'bg-gray-700/60 text-gray-300',
    L: 'bg-red-500/15 text-red-400 border border-red-500/25',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <SectionHeader action={
        <SectionLink href={`/competition/${leagueCode}`}>View all →</SectionLink>
      }>Recent Results</SectionHeader>

      <div className="divide-y divide-gray-800/60 rounded-xl border border-gray-800 overflow-hidden">
        {matches.map((match) => {
          const isHome   = match.homeTeam.id === teamId;
          const opponent = isHome ? match.awayTeam : match.homeTeam;
          const res      = outcome(match, teamId);
          const ftHome   = match.score.fullTime.home ?? 0;
          const ftAway   = match.score.fullTime.away ?? 0;
          const scored   = isHome ? ftHome : ftAway;
          const conceded = isHome ? ftAway : ftHome;

          return (
            <Link
              key={match.id}
              href={matchPath(match.id, match.homeTeam?.name, match.awayTeam?.name)}
              className="flex items-center gap-3 p-3 bg-gray-900 hover:bg-gray-800/60 transition-colors"
            >
              {/* W/D/L badge */}
              <span
                className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded shrink-0 ${
                  res ? outcomeStyles[res] : 'bg-gray-700 text-gray-400'
                }`}
              >
                {res ?? '—'}
              </span>

              {/* Opponent */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {opponent.crest && (
                  <img
                    src={opponent.crest}
                    alt=""
                    width={20}
                    height={20}
                    className="object-contain shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {isHome ? 'vs' : '@'} {opponent.shortName || opponent.name}
                  </p>
                  <p className="text-gray-500 text-xs">{formatDate(match.utcDate)}</p>
                </div>
              </div>

              {/* Score */}
              <span className="font-bold tabular-nums text-sm text-white shrink-0">
                {scored}–{conceded}
              </span>

              {/* Competition code */}
              <span className="text-gray-600 text-xs shrink-0 hidden sm:block w-8 text-right">
                {match.competition.code}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Internal links grid
function CompetitionLinksCard({
  leagueName,
  leagueCode,
  leagueFlag,
}: {
  leagueName: string;
  leagueCode: string;
  leagueFlag: string;
}) {
  const links = [
    { href: `/competition/${leagueCode}`,         label: `${leagueFlag} ${leagueName}`, sub: 'Competition hub' },
    { href: `/standings?competition=${leagueCode}`, label: 'League Table',             sub: 'Full standings' },
    { href: `/schedule?competition=${leagueCode}`,  label: 'Fixtures',                 sub: 'All matches' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <SectionHeader>More from {leagueName}</SectionHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {links.map(({ href, label, sub }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-0.5 rounded-xl border border-gray-800 bg-gray-950 p-4 hover:border-gray-700 hover:bg-gray-800/40 transition-all"
          >
            <span className="text-sm font-semibold text-white group-hover:text-green-400 transition-colors">
              {label}
            </span>
            <span className="text-xs text-gray-500">{sub}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TeamSlugPage({ params }: Params) {
  const { slug } = await params;

  // ── 1. Extract numeric ID from slug prefix ─────────────────────────────
  const id = extractTeamId(slug);
  if (!id) notFound();

  // ── 2. Fetch team data ─────────────────────────────────────────────────
  let team: TeamDetail | null = null;
  try {
    team = await getTeam(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    // API unavailable — render graceful error below
    console.error(`[TeamSlugPage] Could not load team ${id}:`, err instanceof Error ? err.message : String(err));
  }

  if (!team) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-10">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Standings', href: '/standings' },
          { label: 'Team' },
        ]} />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl">🏟️</div>
          <h1 className="text-white font-bold text-lg">Team Data Unavailable</h1>
          <p className="text-gray-400 text-sm">
            This team&apos;s information is temporarily unavailable. Please try again in a few moments.
          </p>
          <Link href="/standings" className="inline-block text-sm text-green-400 hover:text-green-300 transition-colors pt-2">
            ← Back to Standings
          </Link>
        </div>
      </div>
    );
  }

  // ── 3. Canonical slug enforcement ──────────────────────────────────────
  // Redirect if the slug in the URL doesn't match the canonical form so there
  // is exactly one URL per team (prevents duplicate content).
  const canonicalSlug = `${team.id}-${slugify(team.name)}`;
  if (slug !== canonicalSlug) {
    permanentRedirect(`/teams/${canonicalSlug}`);
  }

  const canonicalUrl = `${BASE_URL}/teams/${canonicalSlug}`;

  // ── 4. Resolve primary league competition ──────────────────────────────
  const leagueComp = team.runningCompetitions.find(
    (c) => c.type === 'LEAGUE' && COMPETITIONS.some((k) => k.code === c.code),
  );
  const leagueCode  = leagueComp?.code ?? '';
  const leagueMeta  = COMPETITIONS.find((c) => c.code === leagueCode);
  const leagueFlag  = leagueMeta?.flag ?? '';

  // ── 5. Parallel data fetching ──────────────────────────────────────────
  const [matchesResult, standingsResult, upcomingResult] = await Promise.allSettled([
    getTeamMatches(id),
    leagueCode ? getStandings(leagueCode) : Promise.reject('no league'),
    leagueCode ? getUpcomingMatches(leagueCode) : Promise.reject('no league'),
  ]);

  // Recent results (FINISHED, newest first, capped at 10)
  const recentMatches: Match[] =
    matchesResult.status === 'fulfilled'
      ? [...matchesResult.value.matches]
          .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
          .slice(0, 10)
      : [];

  // Standing in primary league
  let standingEntry:  StandingEntry | null = null;
  let standingTotal   = 0;
  let leagueName      = leagueComp?.name ?? '';

  if (standingsResult.status === 'fulfilled') {
    const data = standingsResult.value;
    leagueName  = data.competition.name;
    const total = data.standings.find((s) => s.type === 'TOTAL');
    if (total) {
      standingTotal  = total.table.length;
      standingEntry  = total.table.find((e) => e.team.id === team.id) ?? null;
    }
  }

  // Upcoming fixtures for this team (from league schedule, soonest first, capped at 5)
  const upcomingForTeam: Match[] =
    upcomingResult.status === 'fulfilled'
      ? upcomingResult.value.matches
          .filter((m) => m.homeTeam.id === team!.id || m.awayTeam.id === team!.id)
          .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
          .slice(0, 5)
      : [];

  const coach = coachName(team);

  return (
    <>
      <TeamJsonLd
        team={team}
        leagueName={leagueName}
        leagueCode={leagueCode}
        canonicalUrl={canonicalUrl}
      />
      <AnalyticsTracker event={{ type: 'team_view', teamId: team.id, teamName: team.name }} />

      <div className="max-w-2xl mx-auto space-y-5 pb-10">

        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            leagueName
              ? { label: leagueName, href: `/competition/${leagueCode}` }
              : { label: 'Leagues', href: '/standings' },
            { label: team.name },
          ]}
        />

        {/* ── Team header ─────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-start gap-5">
            {/* Crest */}
            {team.crest ? (
              <img
                src={team.crest}
                alt={`${team.name} crest`}
                width={88}
                height={88}
                className="object-contain shrink-0 rounded-xl"
              />
            ) : (
              <div className="w-[88px] h-[88px] rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
                <span className="text-3xl">🏟️</span>
              </div>
            )}

            {/* Identity */}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {team.name}
              </h1>
              {team.tla && (
                <p className="mt-0.5 text-sm font-mono text-gray-500">{team.tla}</p>
              )}
              {leagueName && leagueCode && (
                <Link
                  href={`/competition/${leagueCode}`}
                  className="inline-block mt-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {leagueFlag && <span className="mr-1">{leagueFlag}</span>}
                  {leagueName}
                </Link>
              )}
            </div>
          </div>

          {/* Meta grid */}
          {(team.area?.name || team.founded || team.venue || coach || team.clubColors) && (
            <dl className="mt-6 pt-5 border-t border-gray-800 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {team.area?.name && (
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">Country</dt>
                  <dd className="text-white flex items-center gap-1.5">
                    {team.area.flag && (
                      <img src={team.area.flag} alt="" width={16} height={16} className="object-contain" />
                    )}
                    {team.area.name}
                  </dd>
                </div>
              )}
              {team.founded && (
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">Founded</dt>
                  <dd className="text-white">{team.founded}</dd>
                </div>
              )}
              {team.venue && (
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">Stadium</dt>
                  <dd className="text-white">{team.venue}</dd>
                </div>
              )}
              {coach && (
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">Manager</dt>
                  <dd className="text-white">{coach}</dd>
                </div>
              )}
              {team.clubColors && (
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">Colors</dt>
                  <dd className="text-white">{team.clubColors}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* ── Above-fold ad ────────────────────────────────────────────── */}
        <AdSlot slotId={`team-${id}-top`} variant="banner" />

        {/* ── League standing ──────────────────────────────────────────── */}
        {standingEntry && (
          <StandingCard
            entry={standingEntry}
            total={standingTotal}
            leagueName={leagueName}
            leagueCode={leagueCode}
          />
        )}

        {/* ── Upcoming fixtures ────────────────────────────────────────── */}
        {upcomingForTeam.length > 0 && (
          <UpcomingCard
            matches={upcomingForTeam}
            teamId={team.id}
            leagueName={leagueName}
            leagueCode={leagueCode}
          />
        )}

        {/* ── Mid-page ad ──────────────────────────────────────────────── */}
        <AdSlot slotId={`team-${id}-mid`} variant="rectangle" className="mx-auto" />

        {/* ── Recent results ───────────────────────────────────────────── */}
        {recentMatches.length > 0 && (
          <RecentResultsCard matches={recentMatches} teamId={team.id} leagueCode={leagueCode ?? ''} />
        )}

        {/* ── Competition internal links ────────────────────────────────── */}
        {leagueName && leagueCode && (
          <CompetitionLinksCard
            leagueName={leagueName}
            leagueCode={leagueCode}
            leagueFlag={leagueFlag}
          />
        )}

        {/* ── Below-fold ad ────────────────────────────────────────────── */}
        <AdSlot slotId={`team-${id}-bottom`} variant="banner" />

      </div>
    </>
  );
}
