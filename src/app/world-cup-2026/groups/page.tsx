import Link from 'next/link';
import type { Metadata } from 'next';

// PERF-4.5
import { getStandingsCached } from '@/lib/api';
import type { StandingTable } from '@/lib/types';
import Breadcrumb from '@/components/Breadcrumb';
import WCGroupTable from '@/components/WCGroupTable';
import WCPageNav from '@/components/WCPageNav';
import WCRelatedLinks from '@/components/WCRelatedLinks';

export const revalidate = 3600; // align with STANDINGS TTL (1 hour)

const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/groups`;

export const metadata: Metadata = {
  title: 'FIFA World Cup 2026 Group Standings – All 12 Groups | GoalRadar',
  description:
    'Live FIFA World Cup 2026 group standings for all 12 groups A–L. Points tables, goals scored and qualification status updated in real time.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'FIFA World Cup 2026 Group Standings | GoalRadar',
    description: 'All 12 FIFA World Cup 2026 group tables — Groups A through L with live standings.',
    type: 'website',
    url: PAGE_URL,
  },
  twitter: { card: 'summary_large_image', title: 'World Cup 2026 Groups | GoalRadar',
    description: 'FIFA World Cup 2026 group standings — all 12 groups, live updated.' },
};

const GROUPS = ['a','b','c','d','e','f','g','h','i','j','k','l'];
function groupSlug(apiGroup: string) { return apiGroup.toLowerCase().replace(/[\s_]+/g, '-'); } // GROUP_A / "Group A" → group-a
function groupLabel(apiGroup: string) { return apiGroup.replace('GROUP_', 'Group '); }    // GROUP_A → Group A

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function JsonLd({ groupTables }: { groupTables: StandingTable[] }) {
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',            item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026',  item: `${BASE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: 'Group Standings', item: PAGE_URL },
    ],
  };

  const collection = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'FIFA World Cup 2026 Group Standings',
    description: 'Live group standing tables for all 12 FIFA World Cup 2026 groups.',
    url: PAGE_URL,
    isPartOf: { '@type': 'WebSite', name: 'GoalRadar', url: BASE_URL },
    hasPart: groupTables.map(t => ({
      '@type': 'ItemList',
      name: `FIFA World Cup 2026 ${groupLabel(t.group ?? '')}`,
      url: `${BASE_URL}/world-cup-2026/${groupSlug(t.group ?? '')}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function WCGroupsPage() {
  let groupTables: StandingTable[] = [];
  let apiError = false;
  try {
    const data = await getStandingsCached('WC');
    groupTables = data.standings.filter(s => s.type === 'TOTAL');
  } catch {
    apiError = true;
  }

  const matchesPlayed = groupTables.some(t => t.table.some(e => e.playedGames > 0));

  return (
    <>
      <JsonLd groupTables={groupTables} />

      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'World Cup 2026', href: '/world-cup-2026' },
          { label: 'Group Standings' },
        ]} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">📊</span>
              <h1 className="text-2xl sm:text-3xl font-black text-white">Group Standings</h1>
            </div>
            <p className="text-gray-500 text-sm">
              FIFA World Cup 2026 · Groups A–L · 48 nations
            </p>
          </div>
          <Link href="/world-cup-2026" className="text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium shrink-0 mt-1">
            ← WC Hub
          </Link>
        </div>

        {/* Cross-page navigation */}
        <WCPageNav />

        {/* Status / legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0" /> Advances to knockout stage
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500 shrink-0" /> Possible best third-place
          </span>
          {apiError && (
            <span className="text-orange-500 ml-auto">
              Live standings temporarily unavailable — showing pre-tournament groups
            </span>
          )}
          {!apiError && !matchesPlayed && (
            <span className="text-yellow-600 ml-auto">
              Tournament begins 11 June 2026 — standings update once matches are played
            </span>
          )}
        </div>

        {/* All 12 groups in responsive grid */}
        {groupTables.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupTables.map(t => {
              const slug  = groupSlug(t.group ?? '');
              const label = groupLabel(t.group ?? '');
              return (
                <div key={t.group}>
                  <WCGroupTable
                    group={t.group ?? ''}
                    table={t.table}
                    href={slug ? `/world-cup-2026/${slug}` : undefined}
                  />
                  <Link
                    href={`/world-cup-2026/${slug}`}
                    className="block text-center text-xs text-gray-600 hover:text-yellow-400 transition-colors mt-1.5 py-1"
                  >
                    {label} fixtures & details →
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-300 font-semibold">Group stage hasn't started yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Standings will update automatically once matches begin on <strong className="text-white">11 June 2026</strong>.
            </p>
          </div>
        )}

        {/* Group A–L direct links */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Browse Groups
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {GROUPS.map(g => (
              <Link
                key={g}
                href={`/world-cup-2026/group-${g}`}
                className="bg-gray-900 hover:bg-yellow-500/10 border border-gray-800 hover:border-yellow-700/40 rounded-xl p-3 text-center transition-all group"
              >
                <span className="text-white font-black text-lg group-hover:text-yellow-400 transition-colors">
                  {g.toUpperCase()}
                </span>
                <p className="text-gray-600 text-[10px] mt-0.5">Group {g.toUpperCase()}</p>
              </Link>
            ))}
          </div>
        </section>

        <WCRelatedLinks links={[
          { href: '/world-cup-2026-groups',     icon: '🗂️', label: 'Group Stage Guide',   desc: 'All 12 draws with tiebreaker rules explained' },
          { href: '/world-cup-2026-standings',  icon: '📊', label: 'Live Standings',      desc: 'Points and goal difference per group' },
          { href: '/world-cup-2026-results',    icon: '🏁', label: 'WC 2026 Results',     desc: 'Full-time and live scores for every match' },
          { href: '/world-cup-2026-bracket',    icon: '🔗', label: 'Knockout Bracket',    desc: 'Round of 32 path to the Final at MetLife' },
          { href: '/world-cup-2026-schedule',   icon: '📅', label: 'Match Schedule',      desc: 'All 104 fixtures with timezone converter' },
          { href: '/world-cup-2026/teams',           icon: '👥', label: 'All 48 Teams',   desc: 'Squads and stats for every WC nation' },
        ]} />
      </div>
    </>
  );
}
