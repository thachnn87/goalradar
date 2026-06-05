import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getStandings, getUpcomingMatches, getRecentMatches } from '@/lib/api';
import type { Match } from '@/lib/types';
import MatchCard from '@/components/MatchCard';
import WCGroupTable from '@/components/WCGroupTable';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 60;

// ---------------------------------------------------------------------------
// Group slug ↔ API value mapping  (Groups A–L for WC 2026)
// ---------------------------------------------------------------------------

const GROUPS = ['a','b','c','d','e','f','g','h','i','j','k','l'];

function slugToApiGroup(slug: string) {
  // 'group-a' → 'GROUP_A'
  return slug.replace('group-', 'GROUP_').toUpperCase();
}

function slugToLabel(slug: string) {
  // 'group-a' → 'Group A'
  return slug.replace('group-', 'Group ').toUpperCase().replace('GROUP ', 'Group ');
}

type Params = { params: Promise<{ group: string }> };

export function generateStaticParams() {
  return GROUPS.map((g) => ({ group: `group-${g}` }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { group } = await params;
  if (!GROUPS.includes(group.replace('group-', ''))) {
    return { title: 'World Cup 2026 | GoalRadar' };
  }
  const label = slugToLabel(group);
  const title = `${label} – FIFA World Cup 2026 Standings & Fixtures | GoalRadar`;
  const description = `${label} standings, fixtures and results at FIFA World Cup 2026. Follow live scores for all ${label} matches.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCGroupPage({ params }: Params) {
  const { group: slug } = await params;

  // Validate slug
  if (!GROUPS.includes(slug.replace('group-', ''))) notFound();

  const apiGroup = slugToApiGroup(slug); // e.g. 'GROUP_A'
  const label = slugToLabel(slug);        // e.g. 'Group A'

  const [standingsResult, upcomingResult, recentResult] = await Promise.allSettled([
    getStandings('WC'),
    getUpcomingMatches('WC'),
    getRecentMatches('WC'),
  ]);

  // Find this group's standing table
  const groupTable =
    standingsResult.status === 'fulfilled'
      ? standingsResult.value.standings.find(
          (s) => s.type === 'TOTAL' && s.group === apiGroup
        )
      : null;

  // Filter matches for this group
  const upcoming: Match[] =
    upcomingResult.status === 'fulfilled'
      ? upcomingResult.value.matches
          .filter((m) => m.group === apiGroup)
          .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
      : [];

  const results: Match[] =
    recentResult.status === 'fulfilled'
      ? recentResult.value.matches
          .filter((m) => m.group === apiGroup && m.status === 'FINISHED')
          .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
      : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://goalradar.org' },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: 'https://goalradar.org/world-cup-2026' },
      { '@type': 'ListItem', position: 3, name: label },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-3xl mx-auto space-y-8 pb-10">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'World Cup 2026', href: '/world-cup-2026' },
            { label: label },
          ]}
        />

        {/* Header */}
        <div className="flex items-center gap-4">
          <span className="text-4xl">🏆</span>
          <div>
            <h1 className="text-2xl font-black text-white">{label}</h1>
            <p className="text-gray-500 text-sm">FIFA World Cup 2026</p>
          </div>
        </div>

        {/* Standings */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Standings
          </h2>
          {groupTable ? (
            <>
              <WCGroupTable group={apiGroup} table={groupTable.table} />
              <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0" />
                Advances to knockout stage
              </p>
            </>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              Standings will appear once matches begin.
            </div>
          )}
        </section>

        {/* Results */}
        {results.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Results
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* Fixtures */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Fixtures
          </h2>
          {upcoming.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {upcoming.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              No upcoming fixtures for this group.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
