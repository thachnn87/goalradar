import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getStandings, getRecentMatches, getUpcomingMatches } from '@/lib/api';
import { COMPETITIONS } from '@/lib/types';
import type { Match } from '@/lib/types';
import StandingsTable from '@/components/StandingsTable';
import MatchCard from '@/components/MatchCard';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 300;

type Params = { params: Promise<{ code: string }> };

// Pre-render all known competition pages at build time
export function generateStaticParams() {
  return COMPETITIONS.map((c) => ({ code: c.code }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const comp = COMPETITIONS.find((c) => c.code === code.toUpperCase());
  if (!comp) return { title: 'Competition | GoalRadar' };

  const title = `${comp.name} Standings, Fixtures & Results | GoalRadar`;
  const description = `Follow the ${comp.name} with live scores, results, upcoming fixtures and the full league table on GoalRadar.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKickoff(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        {title}
      </h2>
      {count !== undefined && (
        <span className="text-xs text-gray-600">{count} matches</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({
  name,
  code,
  emblem,
}: {
  name: string;
  code: string;
  emblem: string;
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name,
    sport: 'Football',
    image: emblem || undefined,
    url: `https://goalradar.org/competition/${code}`,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CompetitionPage({ params }: Params) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  const meta = COMPETITIONS.find((c) => c.code === code);
  if (!meta) notFound();

  // Fetch all three data sources in parallel
  const [standingsResult, recentResult, upcomingResult] = await Promise.allSettled([
    getStandings(code),
    getRecentMatches(code),
    getUpcomingMatches(code),
  ]);

  // Standings
  const standingsData = standingsResult.status === 'fulfilled' ? standingsResult.value : null;
  const competitionName = standingsData?.competition.name ?? meta.name;
  const competitionEmblem = standingsData?.competition.emblem ?? '';
  const totalTable = standingsData?.standings.find((s) => s.type === 'TOTAL') ?? null;

  // Recent results — sort desc, cap at 6
  const recentMatches: Match[] =
    recentResult.status === 'fulfilled'
      ? [...recentResult.value.matches]
          .filter((m) => m.status === 'FINISHED')
          .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
          .slice(0, 6)
      : [];

  // Upcoming fixtures — sort asc, cap at 6
  const upcomingMatches: Match[] =
    upcomingResult.status === 'fulfilled'
      ? [...upcomingResult.value.matches]
          .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
          .slice(0, 6)
      : [];

  return (
    <>
      <JsonLd name={competitionName} code={code} emblem={competitionEmblem} />

      <div className="max-w-5xl mx-auto space-y-8 pb-10">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Leagues', href: '/standings' },
            { label: competitionName },
          ]}
        />

        {/* Competition header */}
        <div className="flex items-center gap-4">
          {competitionEmblem && (
            <img
              src={competitionEmblem}
              alt=""
              width={56}
              height={56}
              className="object-contain shrink-0"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{meta.flag}</span>
              <h1 className="text-2xl font-black text-white">{competitionName}</h1>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">
              Live scores · Fixtures · Standings
            </p>
          </div>
        </div>

        {/* League table */}
        <section aria-labelledby="standings-heading">
          <SectionHeader title="League Table" />
          {totalTable ? (
            <StandingsTable table={totalTable.table} />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
              Standings not available yet.
            </div>
          )}
        </section>

        {/* Two-column grid: recent + upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent results */}
          <section aria-labelledby="results-heading">
            <SectionHeader title="Recent Results" count={recentMatches.length} />
            {recentMatches.length > 0 ? (
              <div className="space-y-3">
                {recentMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
                No recent results found.
              </div>
            )}
          </section>

          {/* Upcoming fixtures */}
          <section aria-labelledby="fixtures-heading">
            <SectionHeader title="Upcoming Fixtures" count={upcomingMatches.length} />
            {upcomingMatches.length > 0 ? (
              <div className="space-y-3">
                {upcomingMatches.map((match) => (
                  <div key={match.id}>
                    <p className="text-xs text-gray-600 mb-1.5 px-1">
                      {formatKickoff(match.utcDate)}
                    </p>
                    <MatchCard match={match} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
                No upcoming fixtures found.
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
