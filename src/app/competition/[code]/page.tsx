import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import {
  getStandingsCached       as getStandings,
  getRecentMatchesCached   as getRecentMatches,
  getUpcomingMatchesCached as getUpcomingMatches,
} from '@/lib/api';
import { COMPETITIONS } from '@/lib/types';
import type { Match } from '@/lib/types';
import StandingsTable from '@/components/StandingsTable';
import MatchCard from '@/components/MatchCard';
import Breadcrumb from '@/components/Breadcrumb';
import AnalyticsTracker from '@/components/AnalyticsTracker';

export const revalidate = 300;

type Params = { params: Promise<{ code: string }> };

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

const BASE_URL = 'https://goalradar.org';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const normCode = code.toUpperCase();
  const comp = COMPETITIONS.find((c) => c.code === normCode);
  if (!comp) return { title: 'Competition | GoalRadar' };

  const title       = `${comp.name} Standings, Fixtures & Results | GoalRadar`;
  const description = `Follow the ${comp.name} with live scores, results, upcoming fixtures and the full league table on GoalRadar.`;
  // SITEMAP-3: /competition/WC defers canonical authority to the WC hub page.
  // This prevents a duplicate-content split between /competition/WC and
  // /world-cup-2026 — the hub carries all WC signals at a single canonical URL.
  const canonical   = normCode === 'WC'
    ? `${BASE_URL}/world-cup-2026`
    : `${BASE_URL}/competition/${normCode}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'website', url: canonical },
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
      <AnalyticsTracker event={{
        type:            'competition_view',
        competitionCode: code,
        competitionName: competitionName,
        context:         'overview',
      }} />

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
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm space-y-2">
                <p>No recent results found.</p>
                <Link href={`/schedule?competition=${code}`} className="inline-block text-xs text-green-400 hover:text-green-300 transition-colors">
                  Browse {competitionName} schedule →
                </Link>
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
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm space-y-2">
                <p>No upcoming fixtures found.</p>
                <Link href={`/schedule?competition=${code}`} className="inline-block text-xs text-green-400 hover:text-green-300 transition-colors">
                  Browse {competitionName} schedule →
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* Static internal links — always crawlable, not API-gated */}
        <nav aria-label={`${competitionName} quick links`} className="flex flex-wrap gap-4 pt-4 border-t border-gray-800 text-sm">
          <Link href={`/schedule?competition=${code}`} className="text-gray-500 hover:text-white transition-colors">
            📅 {competitionName} fixtures
          </Link>
          <Link href={`/standings?competition=${code}`} className="text-gray-500 hover:text-white transition-colors">
            📊 {competitionName} standings &amp; teams
          </Link>
          <Link href="/schedule" className="text-gray-500 hover:text-white transition-colors">
            All fixtures →
          </Link>
          <Link href="/standings" className="text-gray-500 hover:text-white transition-colors">
            All standings →
          </Link>
        </nav>
      </div>
    </>
  );
}
